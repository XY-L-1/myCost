import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Circle, Line } from "react-native-svg";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
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
      search,
    });
    const visibleExpenseRows =
      selectedCategoryId === "all"
        ? expenseRows
        : filterExpensesByResolvedCategory(
            scope,
            expenseRows,
            displayMap,
            selectedCategoryId,
            t("common.category")
          );

    setMonthKeys(monthRows);
    setExpenses(visibleExpenseRows);
    setFilterCategories(categoryRows.map((item) => ({ id: item.id, name: item.name })));
    setDisplayCategoryMap(displayMap);
    if (
      selectedCategoryId !== "all" &&
      !categoryRows.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId("all");
    }
  }, [scope, search, selectedCategoryId, selectedMonth, t]);

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

      <View style={styles.searchField}>
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Circle
            cx={8.5}
            cy={8.5}
            r={5}
            fill="none"
            stroke={COLORS.textMuted}
            strokeWidth={1.7}
          />
          <Line
            x1={12.3}
            y1={12.3}
            x2={16.5}
            y2={16.5}
            stroke={COLORS.textMuted}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </Svg>
        <TextInput
          accessibilityLabel={t("common.search")}
          value={search}
          onChangeText={setSearch}
          placeholder={t("common.search")}
          placeholderTextColor={COLORS.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>{t("transactions.month")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedMonth(null)}
            style={({ pressed }) => [
              styles.chip,
              !selectedMonth && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                !selectedMonth && styles.chipTextSelected,
              ]}
            >
              {t("transactions.allDates")}
            </Text>
          </Pressable>
          {monthKeys.map((monthKey) => {
            const selected = selectedMonth === monthKey;
            return (
              <Pressable
                key={monthKey}
                accessibilityRole="button"
                onPress={() => setSelectedMonth(monthKey)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {formatMonth(monthKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>{t("common.category")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedCategoryId("all")}
            style={({ pressed }) => [
              styles.chip,
              selectedCategoryId === "all" && styles.chipSelected,
              pressed && styles.pressed,
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
                accessibilityRole="button"
                onPress={() => setSelectedCategoryId(id)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          title={t("transactions.emptyTitle")}
          body={t("transactions.emptyBody")}
        />
      ) : (
        <AppCard style={styles.listCard}>
          {expenses.map((expense, index) => {
            const categoryName = resolveExpenseCategoryName(
              expense,
              displayCategoryMap.get(expense.categoryId),
              t("common.category")
            );
            return (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate("ExpenseEditor", { expenseId: expense.id })}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {expense.description?.trim() || categoryName}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {categoryName} · {formatDate(expense.expenseDate)}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>
                  {formatCurrency(expense.amountCents, expense.currency)}
                </Text>
              </Pressable>
            );
          })}
        </AppCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    backgroundColor: "#FFF",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  filterGroup: {
    marginBottom: SPACING.sm,
  },
  filterLabel: {
    marginBottom: SPACING.xs,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  filterContent: {
    paddingRight: SPACING.lg,
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.xs,
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
  pressed: {
    opacity: 0.72,
  },
  listCard: {
    marginTop: SPACING.xs,
    paddingVertical: 0,
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.text,
  },
  rowMeta: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rowAmount: {
    fontFamily: FONTS.display,
    fontSize: 17,
    color: COLORS.text,
  },
});
