import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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

  const load = useCallback(async () => {
    if (!scope) return;

    const [categories, budgets, breakdown] = await Promise.all([
      CategoryRepository.getAll(scope, { includeArchived: true }),
      BudgetRepository.getByMonth(scope, monthKey),
      ExpenseRepository.getMonthlyCategoryBreakdown(scope, monthKey),
    ]);

    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    const budgetMap = new Map(budgets.map((item) => [item.categoryId, item.amountCents]));
    const actualMap = new Map(breakdown.map((item) => [item.categoryId, item.total]));
    const categoryIds = new Set<string>();

    categories
      .filter((category) => !category.deletedAt)
      .forEach((category) => categoryIds.add(category.id));
    budgets.forEach((budget) => categoryIds.add(budget.categoryId));

    const groupedRows = new Map<string, BudgetRow>();

    Array.from(categoryIds).forEach((categoryId) => {
      const category = categoryMap.get(categoryId);
      const normalizedKey = category
        ? category.normalizedName ?? normalizeCategoryName(category.name)
        : `missing:${categoryId}`;
      const archived = !!category?.deletedAt;
      const name = category
        ? archived
          ? `${category.name} (${t("common.archived")})`
          : category.name
        : t("common.category");
      const existing = groupedRows.get(normalizedKey);
      const nextBudget = budgetMap.get(categoryId) ?? 0;
      const nextActual = actualMap.get(categoryId) ?? 0;

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

  const saveBudget = async (categoryId: string) => {
    if (!scope) return;
    const amount = Number(drafts[categoryId] ?? "0");
    const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    await BudgetRepository.upsert(scope, {
      categoryId,
      monthKey,
      amountCents,
    });
    await load();
  };

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader title={t("budget.title")} subtitle={t("budget.subtitle")} />
      <Text style={styles.note}>{t("budget.localOnlyNote")}</Text>

      <View style={styles.monthRow}>
        <AppButton
          label="‹"
          variant="secondary"
          onPress={() => setMonthKey((value) => shiftMonth(value, -1))}
        />
        <Text style={styles.monthLabel}>{formatMonth(monthKey)}</Text>
        <AppButton
          label="›"
          variant="secondary"
          onPress={() => setMonthKey((value) => shiftMonth(value, 1))}
        />
      </View>

      <View style={styles.summaryRow}>
        <AppCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("budget.totalBudget")}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBudget)}</Text>
        </AppCard>
        <AppCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("budget.totalActual")}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalActual)}</Text>
        </AppCard>
      </View>

      {rows.length === 0 ? (
        <EmptyState title={t("budget.title")} body={t("budget.empty")} />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const remaining = row.budgetCents - row.actualCents;
            return (
              <AppCard key={row.categoryId} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>{row.name}</Text>
                  <Text
                    style={[
                      styles.remaining,
                      remaining < 0 && styles.remainingNegative,
                    ]}
                  >
                    {formatCurrency(remaining)}
                  </Text>
                </View>
                <Text style={styles.metricText}>
                  {t("common.actual")}: {formatCurrency(row.actualCents)}
                </Text>
                <AppInput
                  label={t("common.budget")}
                  value={drafts[row.categoryId] ?? ""}
                  onChangeText={(value) =>
                    setDrafts((current) => ({ ...current, [row.categoryId]: value }))
                  }
                  keyboardType="decimal-pad"
                />
                <AppButton
                  label={t("budget.setBudget")}
                  onPress={() => saveBudget(row.categoryId)}
                />
              </AppCard>
            );
          })}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  monthLabel: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  summaryValue: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
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
    alignItems: "center",
    marginBottom: 8,
  },
  rowTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  remaining: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.success,
  },
  remainingNegative: {
    color: COLORS.danger,
  },
  metricText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
});
