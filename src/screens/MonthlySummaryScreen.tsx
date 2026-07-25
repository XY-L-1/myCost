import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { buildResolvedCategoryBreakdown } from "../domain/categoryResolution";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useSyncGate } from "../state/syncGateContext";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

type InsightsNav = NativeStackNavigationProp<RootStackParamList>;

export function MonthlySummaryScreen() {
  const navigation = useNavigation<InsightsNav>();
  const scope = useCurrentScope();
  const { t } = useI18n();
  const { formatCurrency, formatMonth } = useFormatters();
  const { categoriesRevision } = useSyncGate();

  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<
    { categoryId: string; name: string; total: number }[]
  >([]);

  const load = useCallback(async () => {
    if (!scope) return;

    const months = await ExpenseRepository.getAvailableMonthKeys(scope);
    const monthKey = selectedMonth ?? months[0] ?? null;
    setMonthKeys(months);
    if (!monthKey) {
      setSelectedMonth(null);
      setTotal(0);
      setBreakdown([]);
      return;
    }

    const [categoryMap, monthTotal, monthExpenses] = await Promise.all([
      CategoryRepository.getDisplayNameMap(scope),
      ExpenseRepository.getMonthlyTotal(scope, monthKey),
      ExpenseRepository.list(scope, { monthKey }),
    ]);

    setSelectedMonth(monthKey);
    setTotal(monthTotal);
    setBreakdown(
      buildResolvedCategoryBreakdown(
        scope,
        monthExpenses,
        categoryMap,
        t("common.category")
      )
    );
  }, [scope, selectedMonth, t]);

  useEffect(() => {
    load();
  }, [categoriesRevision, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const topCategory = useMemo(() => breakdown[0] ?? null, [breakdown]);

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader title={t("insights.title")} subtitle={t("insights.subtitle")} />

      {monthKeys.length === 0 ? (
        <EmptyState title={t("insights.title")} body={t("insights.noMonthData")} />
      ) : (
        <>
          <Text style={styles.filterLabel}>{t("insights.exploreMonths")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.monthStrip}
            contentContainerStyle={styles.monthStripContent}
          >
            {monthKeys.map((monthKey) => {
              const selected = selectedMonth === monthKey;
              return (
                <Pressable
                  key={monthKey}
                  accessibilityRole="button"
                  onPress={() => setSelectedMonth(monthKey)}
                  style={({ pressed }) => [
                    styles.monthChip,
                    selected && styles.monthChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthChipLabel,
                      selected && styles.monthChipLabelSelected,
                    ]}
                  >
                    {formatMonth(monthKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedMonth ? (
            <AppCard style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>{t("insights.totalSpending")}</Text>
                <Text style={styles.heroMonth}>{formatMonth(selectedMonth)}</Text>
              </View>
              <Text style={styles.heroValue}>{formatCurrency(total)}</Text>
              {topCategory ? (
                <Text style={styles.heroHint}>
                  {topCategory.name} · {formatCurrency(topCategory.total)}
                </Text>
              ) : null}
            </AppCard>
          ) : null}

          <AppCard>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("insights.categoryBreakdown")}</Text>
              {selectedMonth ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate("MonthDetail", { monthKey: selectedMonth })
                  }
                  style={({ pressed }) => [
                    styles.detailButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.detailButtonText}>
                    {t("insights.monthDetail")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {breakdown.length === 0 ? (
              <EmptyState
                title={t("insights.categoryBreakdown")}
                body={t("insights.noCategoryData")}
              />
            ) : (
              breakdown.map((item, index) => {
                const share = total > 0 ? item.total / total : 0;
                return (
                  <Pressable
                    key={item.categoryId}
                    accessibilityRole="button"
                    onPress={() =>
                      selectedMonth &&
                      navigation.navigate("CategoryTransactions", {
                        monthKey: selectedMonth,
                        categoryId: item.categoryId,
                      })
                    }
                    style={({ pressed }) => [
                      styles.breakdownRow,
                      index > 0 && styles.breakdownRowBorder,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.breakdownTop}>
                      <View style={styles.breakdownCopy}>
                        <Text style={styles.breakdownName}>{item.name}</Text>
                        <Text style={styles.breakdownShare}>
                          {Math.round(share * 100)}%
                        </Text>
                      </View>
                      <Text style={styles.breakdownValue}>
                        {formatCurrency(item.total)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${share * 100}%` },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filterLabel: {
    marginBottom: SPACING.xs,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  monthStrip: {
    marginBottom: SPACING.md,
  },
  monthStripContent: {
    paddingRight: SPACING.lg,
  },
  monthChip: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.xs,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceMuted,
  },
  monthChipSelected: {
    backgroundColor: COLORS.text,
  },
  monthChipLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  monthChipLabelSelected: {
    color: "#FFF",
  },
  pressed: {
    opacity: 0.72,
  },
  hero: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  heroLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.74)",
  },
  heroMonth: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.74)",
  },
  heroValue: {
    marginTop: SPACING.xs,
    fontFamily: FONTS.display,
    fontSize: 34,
    color: "#FFF",
  },
  heroHint: {
    marginTop: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.82)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
  detailButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentSoft,
  },
  detailButtonText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.accent,
  },
  breakdownRow: {
    paddingVertical: SPACING.sm,
  },
  breakdownRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  breakdownTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  breakdownCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING.xs,
  },
  breakdownName: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  breakdownShare: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  breakdownValue: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.text,
  },
  progressTrack: {
    height: 6,
    marginTop: SPACING.sm,
    overflow: "hidden",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceMuted,
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
  },
});
