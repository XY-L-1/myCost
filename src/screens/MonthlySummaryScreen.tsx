import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { RootStackParamList } from "../navigation/RootNavigator";
import { useSyncGate } from "../state/syncGateContext";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

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

    const [categoryRows, monthTotal, categoryBreakdown] = await Promise.all([
      CategoryRepository.getAll(scope, { includeArchived: true }),
      ExpenseRepository.getMonthlyTotal(scope, monthKey),
      ExpenseRepository.getMonthlyCategoryBreakdown(scope, monthKey),
    ]);

    const categoryMap = new Map(categoryRows.map((item) => [item.id, item.name]));
    setSelectedMonth(monthKey);
    setTotal(monthTotal);
    setBreakdown(
      categoryBreakdown.map((item) => ({
        categoryId: item.categoryId,
        name: categoryMap.get(item.categoryId) ?? t("common.category"),
        total: item.total,
      }))
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
          <View style={styles.monthGrid}>
            {monthKeys.slice(0, 6).map((monthKey) => {
              const selected = selectedMonth === monthKey;
              return (
                <Pressable
                  key={monthKey}
                  onPress={() => setSelectedMonth(monthKey)}
                  style={[styles.monthCard, selected && styles.monthCardSelected]}
                >
                  <Text
                    style={[
                      styles.monthCardLabel,
                      selected && styles.monthCardLabelSelected,
                    ]}
                  >
                    {formatMonth(monthKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedMonth ? (
            <AppCard style={styles.hero}>
              <Text style={styles.heroLabel}>{t("insights.totalSpending")}</Text>
              <Text style={styles.heroValue}>{formatCurrency(total)}</Text>
              {topCategory ? (
                <Text style={styles.heroHint}>
                  {topCategory.name}: {formatCurrency(topCategory.total)}
                </Text>
              ) : null}
            </AppCard>
          ) : null}

          <AppCard>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("insights.categoryBreakdown")}</Text>
              {selectedMonth ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate("MonthDetail", { monthKey: selectedMonth })
                  }
                >
                  <Text style={styles.link}>{t("insights.monthDetail")}</Text>
                </Pressable>
              ) : null}
            </View>
            {breakdown.length === 0 ? (
              <EmptyState
                title={t("insights.categoryBreakdown")}
                body={t("insights.noCategoryData")}
              />
            ) : (
              breakdown.map((item) => (
                <Pressable
                  key={item.categoryId}
                  onPress={() =>
                    selectedMonth &&
                    navigation.navigate("CategoryTransactions", {
                      monthKey: selectedMonth,
                      categoryId: item.categoryId,
                    })
                  }
                  style={styles.breakdownRow}
                >
                  <Text style={styles.breakdownName}>{item.name}</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(item.total)}</Text>
                </Pressable>
              ))
            )}
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  monthCard: {
    width: "48%",
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceMuted,
  },
  monthCardSelected: {
    backgroundColor: COLORS.text,
  },
  monthCardLabel: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  monthCardLabelSelected: {
    color: "#FFF",
  },
  hero: {
    marginBottom: SPACING.md,
  },
  heroLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  heroValue: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.text,
  },
  heroHint: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
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
  link: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.accent,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
  },
  breakdownName: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  breakdownValue: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.text,
  },
});
