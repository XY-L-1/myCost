import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { formatMonthKey, shiftMonth } from "../utils/date";
import { CategoryRepository } from "../repositories/categoryRepository";
import { BudgetRepository } from "../repositories/budgetRepository";
import { ExpenseRepository } from "../repositories/expenseRepository";
import {
  buildResolvedCategoryBreakdown,
  isEmptyFallbackCategory,
} from "../domain/categoryResolution";
import { useSyncGate } from "../state/syncGateContext";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";
import { normalizeCategoryName } from "../utils/categoryIdentity";

type BudgetRow = {
  categoryId: string;
  name: string;
  budgetCents: number;
  actualCents: number;
};

export function BudgetScreen() {
  const { t } = useI18n();
  const scope = useCurrentScope();
  const { formatCurrency, formatMonth } = useFormatters();
  const { categoriesRevision } = useSyncGate();
  const [monthKey, setMonthKey] = useState(formatMonthKey(new Date()));
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;

    const [categories, budgets, monthExpenses, displayMap] = await Promise.all([
      CategoryRepository.getAll(scope, { includeArchived: true }),
      BudgetRepository.getByMonth(scope, monthKey),
      ExpenseRepository.list(scope, { monthKey }),
      CategoryRepository.getDisplayNameMap(scope),
    ]);

    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    const budgetMap = new Map(budgets.map((item) => [item.categoryId, item.amountCents]));
    const actualBreakdown = buildResolvedCategoryBreakdown(
      scope,
      monthExpenses,
      displayMap,
      t("common.category")
    );
    const actualByCategoryId = new Map(
      actualBreakdown.map((item) => [item.categoryId, item.total])
    );
    const actualByName = new Map(
      actualBreakdown.map((item) => [normalizeCategoryName(item.name), item.total])
    );
    const categoryIds = new Set<string>();

    categories
      .filter((category) => !category.deletedAt)
      .forEach((category) => categoryIds.add(category.id));
    budgets.forEach((budget) => {
      if (categoryMap.has(budget.categoryId)) {
        categoryIds.add(budget.categoryId);
      }
    });

    const groupedRows = new Map<string, BudgetRow>();

    Array.from(categoryIds).forEach((categoryId) => {
      const category = categoryMap.get(categoryId);
      const normalizedKey = category
        ? normalizeCategoryName(category.name)
        : `missing:${categoryId}`;
      const archived = !!category?.deletedAt;
      const name = category
        ? archived
          ? `${category.name} (${t("common.archived")})`
          : category.name
        : t("common.category");
      const existing = groupedRows.get(normalizedKey);
      const nextBudget = budgetMap.get(categoryId) ?? 0;
      const nextActual =
        actualByName.get(normalizedKey) ?? actualByCategoryId.get(categoryId) ?? 0;

      if (isEmptyFallbackCategory(name, t("common.category"), nextBudget, nextActual)) {
        return;
      }

      if (!existing) {
        groupedRows.set(normalizedKey, {
          categoryId,
          name,
          budgetCents: nextBudget,
          actualCents: nextActual,
        });
        return;
      }

      groupedRows.set(normalizedKey, {
        categoryId: existing.categoryId,
        name: existing.name === t("common.category") ? name : existing.name,
        budgetCents: existing.budgetCents + nextBudget,
        actualCents: existing.actualCents + nextActual,
      });
    });

    const nextRows = Array.from(groupedRows.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setRows(nextRows);
    setDrafts(
      Object.fromEntries(
        nextRows.map((row) => [
          row.categoryId,
          row.budgetCents ? String((row.budgetCents / 100).toFixed(2)) : "",
        ])
      )
    );
  }, [monthKey, scope, t]);

  useEffect(() => {
    load();
  }, [categoriesRevision, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalBudget = useMemo(
    () => rows.reduce((sum, row) => sum + row.budgetCents, 0),
    [rows]
  );
  const totalActual = useMemo(
    () => rows.reduce((sum, row) => sum + row.actualCents, 0),
    [rows]
  );
  const totalRemaining = totalBudget - totalActual;
  const totalProgress =
    totalBudget > 0 ? Math.min(totalActual / totalBudget, 1) : 0;

  const saveBudget = async (categoryId: string) => {
    if (!scope) return;
    const amount = Number(drafts[categoryId] ?? "0");
    if (!Number.isFinite(amount) || amount < 0) {
      setDraftError(t("categories.validationBudget"));
      return;
    }

    setDraftError(null);
    setSavingId(categoryId);
    try {
      await BudgetRepository.upsert(scope, {
        categoryId,
        monthKey,
        amountCents: Math.round(amount * 100),
      });
      setEditingId(null);
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const changeMonth = (amount: number) => {
    setEditingId(null);
    setDraftError(null);
    setMonthKey((value) => shiftMonth(value, amount));
  };

  const startEditing = (row: BudgetRow) => {
    setDrafts((current) => ({
      ...current,
      [row.categoryId]: row.budgetCents
        ? (row.budgetCents / 100).toFixed(2)
        : "",
    }));
    setDraftError(null);
    setEditingId(row.categoryId);
  };

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader title={t("budget.title")} subtitle={t("budget.subtitle")} />

      <View style={styles.monthRow}>
        <MonthButton
          direction="previous"
          label={t("budget.previousMonth")}
          onPress={() => changeMonth(-1)}
        />
        <Text style={styles.monthLabel}>{formatMonth(monthKey)}</Text>
        <MonthButton
          direction="next"
          label={t("budget.nextMonth")}
          onPress={() => changeMonth(1)}
        />
      </View>

      <AppCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>
              {totalBudget === 0
                ? t("budget.totalBudget")
                : totalRemaining < 0
                  ? t("budget.overBy")
                  : t("common.remaining")}
            </Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(
                totalBudget === 0 ? 0 : Math.abs(totalRemaining)
              )}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {totalBudget === 0
                ? t("budget.noBudget")
                : totalRemaining < 0
                  ? t("budget.overBudget")
                  : t("budget.onTrack")}
            </Text>
          </View>
        </View>
        <View style={styles.summaryTrack}>
          <View
            style={[
              styles.summaryFill,
              { width: `${totalProgress * 100}%` },
              totalRemaining < 0 && styles.progressDanger,
            ]}
          />
        </View>
        <View style={styles.summaryMetrics}>
          <Text style={styles.summaryMetric}>
            {t("budget.totalActual")} · {formatCurrency(totalActual)}
          </Text>
          <Text style={styles.summaryMetric}>
            {t("budget.totalBudget")} · {formatCurrency(totalBudget)}
          </Text>
        </View>
      </AppCard>

      <View style={styles.note}>
        <View style={styles.noteDot} />
        <Text style={styles.noteText}>{t("budget.localOnlyNote")}</Text>
      </View>

      {rows.length === 0 ? (
        <EmptyState title={t("budget.title")} body={t("budget.empty")} />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const remaining = row.budgetCents - row.actualCents;
            const progress =
              row.budgetCents > 0
                ? Math.min(row.actualCents / row.budgetCents, 1)
                : 0;
            const isOverBudget = row.budgetCents > 0 && remaining < 0;
            const isEditing = editingId === row.categoryId;
            return (
              <AppCard key={row.categoryId} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <View style={styles.rowHeading}>
                    <Text style={styles.rowTitle}>{row.name}</Text>
                    <Text style={styles.rowBudget}>
                      {t("common.budget")} · {formatCurrency(row.budgetCents)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => startEditing(row)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editButtonText}>
                      {row.budgetCents > 0
                        ? t("common.edit")
                        : t("budget.setBudget")}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                      isOverBudget && styles.progressDanger,
                    ]}
                  />
                </View>
                <View style={styles.metricsRow}>
                  <View>
                    <Text style={styles.metricLabel}>{t("common.actual")}</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(row.actualCents)}
                    </Text>
                  </View>
                  <View style={styles.metricRight}>
                    <Text style={styles.metricLabel}>
                      {row.budgetCents === 0
                        ? t("budget.noBudget")
                        : isOverBudget
                          ? t("budget.overBy")
                          : t("common.remaining")}
                    </Text>
                    <Text
                      style={[
                        styles.metricValue,
                        row.budgetCents > 0 && styles.remaining,
                        isOverBudget && styles.remainingNegative,
                      ]}
                    >
                      {formatCurrency(
                        row.budgetCents === 0 ? 0 : Math.abs(remaining)
                      )}
                    </Text>
                  </View>
                </View>
                {isEditing ? (
                  <View style={styles.editor}>
                    <AppInput
                      label={t("common.budget")}
                      value={drafts[row.categoryId] ?? ""}
                      onChangeText={(value) => {
                        setDrafts((current) => ({
                          ...current,
                          [row.categoryId]: value,
                        }));
                        if (draftError) setDraftError(null);
                      }}
                      keyboardType="decimal-pad"
                      error={draftError}
                    />
                    <View style={styles.editorActions}>
                      <AppButton
                        label={t("common.cancel")}
                        variant="secondary"
                        disabled={savingId === row.categoryId}
                        onPress={() => {
                          setEditingId(null);
                          setDraftError(null);
                        }}
                      />
                      <AppButton
                        label={t("common.save")}
                        disabled={savingId === row.categoryId}
                        onPress={() => saveBudget(row.categoryId)}
                      />
                    </View>
                  </View>
                ) : null}
              </AppCard>
            );
          })}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    padding: SPACING.xs,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  monthLabel: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
  summaryCard: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  summaryLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.74)",
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: "#FFF",
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  statusText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "#FFF",
  },
  summaryTrack: {
    height: 8,
    marginTop: SPACING.md,
    overflow: "hidden",
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  summaryFill: {
    height: "100%",
    borderRadius: RADII.pill,
    backgroundColor: "#FFF",
  },
  summaryMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  summaryMetric: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.78)",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  noteDot: {
    width: 7,
    height: 7,
    marginTop: 6,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
  },
  noteText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
  },
  list: {
    gap: SPACING.sm,
  },
  rowCard: {
    marginBottom: SPACING.sm,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  rowHeading: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  rowBudget: {
    marginTop: 3,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  editButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentSoft,
  },
  editButtonText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.accent,
  },
  progressTrack: {
    height: 7,
    marginTop: SPACING.md,
    overflow: "hidden",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceMuted,
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
  },
  progressDanger: {
    backgroundColor: COLORS.danger,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  metricRight: {
    alignItems: "flex-end",
  },
  metricLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metricValue: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  remaining: {
    color: COLORS.success,
  },
  remainingNegative: {
    color: COLORS.danger,
  },
  editor: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
  },
});

function MonthButton({
  direction,
  label,
  onPress,
}: {
  direction: "previous" | "next";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthButton,
        pressed && styles.pressed,
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Path
          d={direction === "previous" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
          fill="none"
          stroke={COLORS.text}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}
