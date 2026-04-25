import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { EmptyState } from "../components/EmptyState";
import { SyncStatusPill } from "../components/SyncStatusPill";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { useAuthStore } from "../auth/authStore";
import { formatDateKey, formatMonthKey } from "../utils/date";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { BudgetRepository } from "../repositories/budgetRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { RecurringExpenseRepository } from "../repositories/recurringExpenseRepository";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuthGate } from "../state/authGateContext";
import { useSyncGate } from "../state/syncGateContext";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type HomeNav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { t } = useI18n();
  const scope = useCurrentScope();
  const auth = useAuthStore();
  const { openSignIn, openSignUp } = useAuthGate();
  const { formatCurrency, formatDate } = useFormatters();
  const { categoriesRevision } = useSyncGate();

  const [monthTotal, setMonthTotal] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [budgetLeft, setBudgetLeft] = useState(0);
  const [recentExpenses, setRecentExpenses] = useState<
    Awaited<ReturnType<typeof ExpenseRepository.list>>
  >([]);
  const [recurringDueCount, setRecurringDueCount] = useState(0);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());

  const monthKey = useMemo(() => formatMonthKey(new Date()), []);
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const load = useCallback(async () => {
    if (!scope) return;

    const [monthExpenses, recentRows, monthTotalValue, budgets, recurringItems, categoryRows] =
      await Promise.all([
        ExpenseRepository.list(scope, { monthKey }),
        ExpenseRepository.list(scope, { limit: 5 }),
        ExpenseRepository.getMonthlyTotal(scope, monthKey),
        BudgetRepository.getByMonth(scope, monthKey),
        RecurringExpenseRepository.getAll(scope),
        CategoryRepository.getAll(scope, { includeArchived: true }),
      ]);

    setMonthTotal(monthTotalValue);
    setTodayTotal(
      monthExpenses
        .filter((item) => item.expenseDate === todayKey)
        .reduce((sum, item) => sum + item.amountCents, 0)
    );
    setBudgetLeft(
      budgets.reduce((sum, item) => sum + item.amountCents, 0) - monthTotalValue
    );
    setRecentExpenses(recentRows);
    setRecurringDueCount(
      recurringItems.filter((item) => item.isActive && item.nextDueDate <= todayKey)
        .length
    );
    setCategories(new Map(categoryRows.map((item) => [item.id, item.name])));
  }, [monthKey, scope, todayKey]);

  useEffect(() => {
    load();
  }, [categoriesRevision, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("home.title")}
        subtitle={t("home.subtitle")}
        right={
          <AppButton
            label={t("common.add")}
            onPress={() => navigation.navigate("ExpenseEditor")}
          />
        }
      />

      <SyncStatusPill />

      {!auth.user ? (
        <AppCard style={styles.accountCard}>
          <Text style={styles.accountTitle}>{t("auth.guestModeTitle")}</Text>
          <Text style={styles.accountBody}>{t("auth.guestModeBody")}</Text>
          <View style={styles.accountActions}>
            <AppButton label={t("auth.syncCta")} onPress={openSignIn} />
            <AppButton
              label={t("auth.createAccountCta")}
              variant="secondary"
              onPress={openSignUp}
            />
          </View>
        </AppCard>
      ) : null}

      <View style={styles.metrics}>
        <AppCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t("home.spentThisMonth")}</Text>
          <Text style={styles.metricValue}>{formatCurrency(monthTotal)}</Text>
        </AppCard>
        <AppCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t("home.today")}</Text>
          <Text style={styles.metricValue}>{formatCurrency(todayTotal)}</Text>
        </AppCard>
      </View>

      <View style={styles.metrics}>
        <AppCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t("home.budgetLeft")}</Text>
          <Text style={styles.metricValue}>{formatCurrency(budgetLeft)}</Text>
        </AppCard>
        <AppCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t("home.recurringDue")}</Text>
          <Text style={styles.metricValue}>{String(recurringDueCount)}</Text>
        </AppCard>
      </View>

      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("home.latestTransactions")}</Text>
          <AppButton
            label={t("home.viewAll")}
            variant="ghost"
            onPress={() => navigation.navigate("Tabs", { screen: "TransactionsTab" })}
          />
        </View>
        {recentExpenses.length === 0 ? (
          <EmptyState title={t("home.latestTransactions")} body={t("home.noTransactions")} />
        ) : (
          recentExpenses.map((expense) => (
            <Pressable
              key={expense.id}
              onPress={() => navigation.navigate("ExpenseEditor", { expenseId: expense.id })}
              style={styles.expenseRow}
            >
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>
                  {expense.description?.trim() || categories.get(expense.categoryId) || t("common.noData")}
                </Text>
                <Text style={styles.expenseMeta}>
                  {(categories.get(expense.categoryId) ?? t("common.category"))} ·{" "}
                  {formatDate(expense.expenseDate)}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                {formatCurrency(expense.amountCents, expense.currency)}
              </Text>
            </Pressable>
          ))
        )}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  metricCard: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.text,
  },
  sectionCard: {
    marginTop: SPACING.md,
  },
  accountCard: {
    marginTop: SPACING.md,
  },
  accountTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
  accountBody: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  accountActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  expenseInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  expenseTitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  expenseMeta: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  expenseAmount: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.text,
  },
});
