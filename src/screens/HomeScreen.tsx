import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { useAuthStore } from "../auth/authStore";
import { useAuthGate } from "../state/authGateContext";
import { useSyncGate } from "../state/syncGateContext";
import type { Expense } from "../types/expense";
import type { Category } from "../types/category";
import type {
  HomeStackParamList,
  RootTabParamList,
  RootStackParamList,
} from "../navigation/RootNavigator";

type HomeNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "Home">,
  CompositeNavigationProp<
    BottomTabNavigationProp<RootTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  accent2: "#C1453C",
  border: "#E6DDD1",
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

function formatTodayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const auth = useAuthStore();
  const { resetAnonymous, allowAnonymous } = useAuthGate();
  const { categoriesStatus, categoriesRevision } = useSyncGate();

  console.log("[UI] HomeScreen render", {
    categoriesStatus,
    categoriesRevision,
    allowAnonymous,
    userId: auth.user?.id ?? null,
  });
  const [totalCents, setTotalCents] = useState(0);
  const [todayCents, setTodayCents] = useState(0);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [largestCents, setLargestCents] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;
  const pop = useRef(new Animated.Value(0.98)).current;

  const categoryMap = useMemo(() => {
    return new Map(categories.map((cat) => [cat.id, cat.name]));
  }, [categories]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const todayKey = now.toISOString().slice(0, 10);

    const [total, expenses, cats] = await Promise.all([
      ExpenseRepository.getMonthlyTotal(year, month),
      ExpenseRepository.getByMonth(year, month),
      CategoryRepository.getAll(),
    ]);

    const todayTotal = expenses
      .filter((item) => item.expenseDate.startsWith(todayKey))
      .reduce((sum, item) => sum + item.amountCents, 0);

    const largest = expenses.reduce(
      (max, item) => Math.max(max, item.amountCents),
      0
    );

    setCategories(cats);
    setTotalCents(total);
    setTodayCents(todayTotal);
    setLargestCents(largest);
    setTransactionCount(expenses.length);
    setRecentExpenses(expenses.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (categoriesStatus === "ready") {
      // Refresh once categories finish syncing to avoid "Uncategorized".
      loadData();
    }
  }, [categoriesStatus, categoriesRevision, loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    // Lightweight entrance to spotlight the top numbers.
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, pop, slide]);

  const dailyAverage = transactionCount
    ? Math.round(totalCents / Math.max(1, new Date().getDate()))
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.backgroundLayer}>
        <View style={styles.bgOrbLeft} />
        <View style={styles.bgOrbRight} />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fade,
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>Today</Text>
            <Text style={styles.headerTitle}>{formatTodayLabel()}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate("AddExpenseModal")}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
            {auth.user ? (
              <Pressable
                onPress={() => {
                  auth.signOut();
                  resetAnonymous();
                }}
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && styles.signOutPressed,
                ]}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            ) : allowAnonymous ? (
              <Pressable
                onPress={resetAnonymous}
                style={({ pressed }) => [
                  styles.signInButton,
                  pressed && styles.signOutPressed,
                ]}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Animated.View style={[styles.heroRow, { transform: [{ scale: pop }] }]}> 
          <View style={styles.heroCardPrimary}>
            <Text style={styles.heroLabel}>Spent Today</Text>
            <Text style={styles.heroAmount}>
              {loading ? "—" : formatCurrency(todayCents)}
            </Text>
            <Text style={styles.heroSub}>Quick glance</Text>
          </View>
          <View style={styles.heroCardSecondary}>
            <Text style={styles.heroLabel}>This Month</Text>
            <Text style={styles.heroAmount}>
              {loading ? "—" : formatCurrency(totalCents)}
            </Text>
            <Text style={styles.heroSub}>So far</Text>
          </View>
        </Animated.View>

        <View style={styles.insightRow}>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Avg / Day</Text>
            <Text style={styles.insightValue}>
              {loading ? "—" : formatCurrency(dailyAverage)}
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Transactions</Text>
            <Text style={styles.insightValue}>
              {loading ? "—" : `${transactionCount}`}
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Largest</Text>
            <Text style={styles.insightValue}>
              {loading ? "—" : formatCurrency(largestCents)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable
            onPress={() => navigation.navigate("ExpensesTab")}
            style={({ pressed }) => pressed && styles.linkPressed}
          >
            <Text style={styles.sectionLink}>All expenses</Text>
          </Pressable>
        </View>

        <View style={styles.recentCard}>
          {recentExpenses.length === 0 && !loading ? (
            <Text style={styles.emptyText}>No expenses yet.</Text>
          ) : (
            <FlatList
              data={recentExpenses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const categoryName =
                  categoryMap.get(item.categoryId) ?? "Uncategorized";
                return (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("ExpensesTab", {
                        screen: "ExpenseDetail",
                        params: { expense: item },
                      })
                    }
                    style={({ pressed }) => [
                      styles.recentRow,
                      pressed && styles.recentRowPressed,
                    ]}
                  >
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {item.description?.trim() || "Untitled"}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {categoryName} · {formatShortDate(item.expenseDate)}
                      </Text>
                    </View>
                    <Text style={styles.recentAmount}>
                      {formatCurrency(item.amountCents)}
                    </Text>
                  </Pressable>
                );
              }}
              scrollEnabled={false}
            />
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOrbLeft: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#F0E4D7",
    top: -70,
    left: -80,
    opacity: 0.55,
  },
  bgOrbRight: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#E7D7C6",
    bottom: -60,
    right: -60,
    opacity: 0.45,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  headerTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    color: "#FFF",
    fontFamily: FONT_BODY,
    fontSize: 13,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginLeft: 8,
  },
  signOutPressed: {
    opacity: 0.75,
  },
  signOutText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
  },
  signInButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "#E8F0EA",
    marginLeft: 8,
  },
  signInText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.accent,
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  heroCardPrimary: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroCardSecondary: {
    flex: 1,
    backgroundColor: "#F0ECE6",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: COLORS.muted,
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    color: COLORS.text,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
  },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  insightCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  insightLabel: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.muted,
    marginBottom: 6,
  },
  insightValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: COLORS.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: COLORS.text,
  },
  sectionLink: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.accent,
  },
  linkPressed: {
    opacity: 0.7,
  },
  recentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentRowPressed: {
    backgroundColor: "#F3ECE3",
    borderRadius: 12,
  },
  recentInfo: {
    flex: 1,
    marginRight: 12,
  },
  recentTitle: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  recentMeta: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
  },
  recentAmount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: COLORS.text,
  },
  emptyText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    paddingVertical: 8,
  },
});
