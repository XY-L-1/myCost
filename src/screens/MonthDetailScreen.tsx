import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
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
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "MonthDetail">;

export function MonthDetailScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const scope = useCurrentScope();
  const { formatCurrency, formatMonth } = useFormatters();
  const [rows, setRows] = useState<{ categoryId: string; name: string; total: number }[]>(
    []
  );

  const load = useCallback(async () => {
    if (!scope) return;
    const [categoryMap, expenses] = await Promise.all([
      CategoryRepository.getDisplayNameMap(scope),
      ExpenseRepository.list(scope, { monthKey: route.params.monthKey }),
    ]);

    setRows(
      buildResolvedCategoryBreakdown(
        scope,
        expenses,
        categoryMap,
        t("common.category")
      )
    );
  }, [route.params.monthKey, scope, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("insights.monthDetail")}
        subtitle={formatMonth(route.params.monthKey)}
        leftAction={{ kind: "back", onPress: () => navigation.goBack() }}
      />
      {rows.length === 0 ? (
        <EmptyState title={t("insights.monthDetail")} body={t("insights.noCategoryData")} />
      ) : (
        rows.map((row) => (
          <AppCard key={row.categoryId} style={styles.rowCard}>
            <Pressable
              onPress={() =>
                navigation.navigate("CategoryTransactions", {
                  monthKey: route.params.monthKey,
                  categoryId: row.categoryId,
                })
              }
            >
              <Text style={styles.title}>{row.name}</Text>
              <Text style={styles.amount}>{formatCurrency(row.total)}</Text>
            </Pressable>
          </AppCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  amount: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
