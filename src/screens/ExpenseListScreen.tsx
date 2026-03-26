import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Expense } from "../types/expense";
import { Category } from "../types/category";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { useSyncGate } from "../state/syncGateContext";
import type {
  ExpensesStackParamList,
  RootStackParamList,
} from "../navigation/RootNavigator";

type ExpensesNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ExpensesStackParamList, "Expenses">,
  NativeStackNavigationProp<RootStackParamList>
>;

type MonthKey = { year: number; month: number };

const COLORS = {
  background: "#F5F1EB",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  border: "#E6DDD1",
  listRow: "#FFF9F2",
  chip: "#EFE6DA",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

function formatCurrency(cents: number) {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function monthKey(month: MonthKey) {
  return `${month.year}-${month.month}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function buildPreviousMonths(year: number, month: number, count: number) {
  const months: MonthKey[] = [];
  for (let i = 0; i < count; i += 1) {
    months.push(shiftMonth(year, month, -i));
  }
  return months;
}

function getOldestMonth(months: MonthKey[]) {
  return months.reduce((oldest, current) => {
    if (current.year < oldest.year) return current;
    if (current.year === oldest.year && current.month < oldest.month) return current;
    return oldest;
  }, months[0]);
}

function mergeExpenses(current: Expense[], incoming: Expense[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) =>
    b.expenseDate.localeCompare(a.expenseDate)
  );
}

export function ExpenseListScreen() {
  const navigation = useNavigation<ExpensesNavProp>();
  const { categoriesStatus, categoriesRevision } = useSyncGate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  console.log("[UI] ExpenseListScreen render", {
    categoriesStatus,
    categoriesRevision,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedMonths, setLoadedMonths] = useState<MonthKey[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [filterMode, setFilterMode] = useState<"all" | "month">("all");
  const [filterDate, setFilterDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((cat) => [cat.id, cat.name]));
  }, [categories]);

  const fetchMonths = useCallback(async (months: MonthKey[]) => {
    const results = await Promise.all(
      months.map((point) => ExpenseRepository.getByMonth(point.year, point.month))
    );
    return results.flat();
  }, []);

  const loadInitial = useCallback(async () => {
    // Load a broad range of months to build a full history view.
    setLoading(true);
    const now = new Date();
    const initialMonths = buildPreviousMonths(now.getFullYear(), now.getMonth() + 1, 12);
    const [cats, newExpenses] = await Promise.all([
      CategoryRepository.getAll(),
      fetchMonths(initialMonths),
    ]);

    setCategories(cats);
    setExpenses(mergeExpenses([], newExpenses));
    setLoadedMonths(initialMonths);
    setLoading(false);
  }, [fetchMonths]);

  useEffect(() => {
    if (categoriesStatus === "ready") {
      // Refresh once categories finish syncing to avoid "Uncategorized".
      loadInitial();
    }
  }, [categoriesStatus, categoriesRevision, loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loadedMonths.length === 0) return;
    setLoadingMore(true);

    const oldest = getOldestMonth(loadedMonths);
    const start = shiftMonth(oldest.year, oldest.month, -1);
    const nextMonths = buildPreviousMonths(start.year, start.month, 6);
    const existing = new Set(loadedMonths.map(monthKey));
    const monthsToLoad = nextMonths.filter((month) => !existing.has(monthKey(month)));

    if (monthsToLoad.length > 0) {
      const newExpenses = await fetchMonths(monthsToLoad);
      setExpenses((prev) => mergeExpenses(prev, newExpenses));
      setLoadedMonths((prev) => [...prev, ...monthsToLoad]);
    }

    setLoadingMore(false);
  }, [fetchMonths, loadedMonths, loadingMore]);

  const ensureMonthLoaded = useCallback(
    async (month: MonthKey) => {
      const existing = new Set(loadedMonths.map(monthKey));
      if (existing.has(monthKey(month))) return;

      const newExpenses = await fetchMonths([month]);
      setExpenses((prev) => mergeExpenses(prev, newExpenses));
      setLoadedMonths((prev) => [...prev, month]);
    },
    [fetchMonths, loadedMonths]
  );

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesSearch = searchQuery
        ? item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
        : true;

      const matchesCategory =
        selectedCategoryId === "all" || item.categoryId === selectedCategoryId;

      const matchesMonth =
        filterMode === "all"
          ? true
          : item.expenseDate.startsWith(
              `${filterDate.getFullYear()}-${String(filterDate.getMonth() + 1).padStart(2, "0")}`
            );

      return matchesSearch && matchesCategory && matchesMonth;
    });
  }, [expenses, filterDate, filterMode, searchQuery, selectedCategoryId]);

  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed") return;
    if (selected) {
      // Keep the picker value and filter state in sync.
      setFilterDate(selected);
      setFilterMode("month");
      ensureMonthLoaded({
        year: selected.getFullYear(),
        month: selected.getMonth() + 1,
      });
    }
  }

  const header = (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Transactions</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? "Loading..." : `${filteredExpenses.length} items`}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("AddExpenseModal")}
          style={({ pressed }) => [
            styles.headerAdd,
            pressed && styles.headerAddPressed,
          ]}
        >
          <Text style={styles.headerAddText}>Add</Text>
        </Pressable>
      </View>

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search description"
        placeholderTextColor={COLORS.muted}
        style={styles.searchInput}
      />

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            onPress={() => setSelectedCategoryId("all")}
            style={({ pressed }) => [
              styles.chip,
              selectedCategoryId === "all" && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategoryId === "all" && styles.chipTextSelected,
              ]}
            >
              All
            </Text>
          </Pressable>
          {categories.map((cat) => {
            const selected = selectedCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Date</Text>
        <View style={styles.dateControls}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [
              styles.dateButton,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.dateButtonText}>
              {filterMode === "month" ? getMonthLabel(filterDate) : "All dates"}
            </Text>
          </Pressable>
          {filterMode === "month" ? (
            <Pressable
              onPress={() => setFilterMode("all")}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No transactions</Text>
              <Text style={styles.emptyBody}>
                Add an expense or adjust your filters.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("AddExpenseModal")}
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.emptyButtonPressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>Add Expense</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const categoryName = categoryMap.get(item.categoryId) ?? "Uncategorized";
          return (
            <Pressable
              onPress={() =>
                navigation.navigate("ExpenseDetail", { expense: item })
              }
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.description?.trim() || "Untitled"}
                </Text>
                <Text style={styles.rowMeta}>
                  {categoryName} · {formatShortDate(item.expenseDate)}
                </Text>
              </View>
              <Text style={styles.rowAmount}>
                {formatCurrency(item.amountCents)}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          loadedMonths.length > 0 ? (
            <Pressable
              onPress={loadMore}
              style={({ pressed }) => [
                styles.loadMore,
                pressed && styles.loadMorePressed,
              ]}
            >
              <Text style={styles.loadMoreText}>
                {loadingMore ? "Loading..." : "Load older"}
              </Text>
            </Pressable>
          ) : null
        }
      />

      {showDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={filterDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}

      {showDatePicker && Platform.OS === "ios" ? (
        <View style={styles.inlinePicker}
          onStartShouldSetResponder={() => true}
        >
          <DateTimePicker
            value={filterDate}
            mode="date"
            display="inline"
            onChange={handleDateChange}
          />
          <Pressable
            onPress={() => setShowDatePicker(false)}
            style={({ pressed }) => [
              styles.inlineDone,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.inlineDoneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  headerAdd: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerAddPressed: {
    opacity: 0.85,
  },
  headerAddText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: "#FFF",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "#FFF",
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.muted,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.text,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.text,
  },
  chipTextSelected: {
    color: "#FFF",
  },
  dateControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFF",
  },
  dateButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.text,
  },
  clearButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.accent,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: COLORS.listRow,
    borderRadius: 14,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  rowMeta: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
  },
  rowAmount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: COLORS.text,
  },
  separator: {
    height: 10,
  },
  emptyState: {
    backgroundColor: COLORS.listRow,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 14,
  },
  emptyButton: {
    backgroundColor: COLORS.text,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  emptyButtonPressed: {
    opacity: 0.85,
  },
  emptyButtonText: {
    color: "#FFF",
    fontFamily: FONT_BODY,
    fontSize: 13,
  },
  loadMore: {
    alignSelf: "center",
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFF",
  },
  loadMorePressed: {
    opacity: 0.8,
  },
  loadMoreText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.text,
  },
  inlinePicker: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.listRow,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inlineDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  inlineDoneText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.accent,
  },
});
