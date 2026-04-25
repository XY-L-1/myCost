import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useSyncGate } from "../state/syncGateContext";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

type TransactionsNav = NativeStackNavigationProp<RootStackParamList>;

export function ExpenseListScreen() {
  const navigation = useNavigation<TransactionsNav>();
  const scope = useCurrentScope();
  const { t } = useI18n();
  const { formatCurrency, formatDate, formatMonth } = useFormatters();
  const { categoriesRevision } = useSyncGate();
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof ExpenseRepository.list>>>([]);
  const [displayCategoryMap, setDisplayCategoryMap] = useState<Map<string, string>>(new Map());
  const [filterCategories, setFilterCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!scope) return;

    const [monthRows, categoryRows, displayMap] = await Promise.all([
      ExpenseRepository.getAvailableMonthKeys(scope),
      CategoryRepository.getAll(scope),
      CategoryRepository.getDisplayNameMap(scope),
    ]);
    const expenseRows = await ExpenseRepository.list(scope, {
      monthKey: selectedMonth ?? undefined,
      categoryId: selectedCategoryId === "all" ? undefined : selectedCategoryId,
      search,
    });

    setMonthKeys(monthRows);
    setExpenses(expenseRows);
    setFilterCategories(categoryRows.map((item) => ({ id: item.id, name: item.name })));
    setDisplayCategoryMap(displayMap);
    if (
      selectedCategoryId !== "all" &&
      !categoryRows.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId("all");
    }
  }, [scope, search, selectedCategoryId, selectedMonth]);

  useEffect(() => {
    load();
  }, [categoriesRevision, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categoryEntries = useMemo(
    () => filterCategories.map((category) => [category.id, category.name] as const),
    [filterCategories]
  );

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("transactions.title")}
        subtitle={t("transactions.subtitle", { count: expenses.length })}
        right={
          <AppButton
            label={t("transactions.addExpense")}
            onPress={() => navigation.navigate("ExpenseEditor")}
          />
        }
      />

      <AppInput
        label={t("common.search")}
        value={search}
        onChangeText={setSearch}
        placeholder={t("common.search")}
      />

      <Text style={styles.filterLabel}>{t("transactions.month")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        <Pressable
          onPress={() => setSelectedMonth(null)}
          style={[
            styles.chip,
            !selectedMonth && styles.chipSelected,
          ]}
        >
          <Text style={[styles.chipText, !selectedMonth && styles.chipTextSelected]}>
            {t("transactions.allDates")}
          </Text>
        </Pressable>
        {monthKeys.map((monthKey) => {
          const selected = selectedMonth === monthKey;
          return (
            <Pressable
              key={monthKey}
              onPress={() => setSelectedMonth(monthKey)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {formatMonth(monthKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.filterLabel}>{t("common.category")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        <Pressable
          onPress={() => setSelectedCategoryId("all")}
          style={[
            styles.chip,
            selectedCategoryId === "all" && styles.chipSelected,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              selectedCategoryId === "all" && styles.chipTextSelected,
            ]}
          >
            {t("common.all")}
          </Text>
        </Pressable>
        {categoryEntries.map(([id, name]) => {
          const selected = selectedCategoryId === id;
          return (
            <Pressable
              key={id}
              onPress={() => setSelectedCategoryId(id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {expenses.length === 0 ? (
        <EmptyState
          title={t("transactions.emptyTitle")}
          body={t("transactions.emptyBody")}
        />
      ) : (
        expenses.map((expense) => (
          <AppCard key={expense.id} style={styles.row}>
            <Pressable
              onPress={() => navigation.navigate("ExpenseEditor", { expenseId: expense.id })}
            >
              <Text style={styles.rowTitle}>
                {expense.description?.trim() || displayCategoryMap.get(expense.categoryId)}
              </Text>
              <Text style={styles.rowMeta}>
                {(displayCategoryMap.get(expense.categoryId) ?? t("common.category"))} · {formatDate(expense.expenseDate)}
              </Text>
              <Text style={styles.rowAmount}>
                {formatCurrency(expense.amountCents, expense.currency)}
              </Text>
            </Pressable>
          </AppCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filterLabel: {
    marginBottom: 8,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  filters: {
    marginBottom: SPACING.md,
  },
  chip: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.text,
  },
  chipText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  chipTextSelected: {
    color: "#FFF",
  },
  row: {
    marginBottom: SPACING.sm,
  },
  rowTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  rowMeta: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rowAmount: {
    marginTop: 12,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.text,
  },
});
