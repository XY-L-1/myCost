import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
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
import {
  filterExpensesByResolvedCategory,
  resolveExpenseCategoryName,
} from "../domain/categoryResolution";
import { RootStackParamList } from "../navigation/RootNavigator";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "CategoryTransactions">;

export function CategoryTransactionsScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const scope = useCurrentScope();
  const { formatCurrency, formatDate, formatMonth } = useFormatters();
  const [categoryName, setCategoryName] = useState<string>(t("common.category"));
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof ExpenseRepository.list>>>([]);

  const load = useCallback(async () => {
    if (!scope) return;
    const [category, categoryMap, monthRows] = await Promise.all([
      CategoryRepository.getCanonicalByIdInScope(scope, route.params.categoryId),
      CategoryRepository.getDisplayNameMap(scope),
      ExpenseRepository.list(scope, {
        monthKey: route.params.monthKey,
      }),
    ]);
    const rows = filterExpensesByResolvedCategory(
      scope,
      monthRows,
      categoryMap,
      route.params.categoryId,
      t("common.category")
    );
    const resolvedName = rows[0]
      ? resolveExpenseCategoryName(
          rows[0],
          categoryMap.get(rows[0].categoryId),
          category?.name ?? t("common.category")
        )
      : category?.name ?? t("common.category");
    setCategoryName(resolvedName);
    setExpenses(rows);
  }, [route.params.categoryId, route.params.monthKey, scope, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={categoryName}
        subtitle={formatMonth(route.params.monthKey)}
        leftAction={{ kind: "back", onPress: () => navigation.goBack() }}
      />
      {expenses.length === 0 ? (
        <EmptyState
          title={t("insights.categoryDetail")}
          body={t("transactions.emptyBody")}
        />
      ) : (
        expenses.map((expense) => (
          <AppCard key={expense.id} style={styles.rowCard}>
            <Text style={styles.title}>{expense.description?.trim() || categoryName}</Text>
            <Text style={styles.meta}>{formatDate(expense.expenseDate)}</Text>
            <Text style={styles.amount}>
              {formatCurrency(expense.amountCents, expense.currency)}
            </Text>
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
  meta: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  amount: {
    marginTop: 10,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
});
