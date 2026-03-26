import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, G } from "react-native-svg";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { useSyncGate } from "../state/syncGateContext";

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  accent2: "#C1453C",
  accent3: "#3F51B5",
  accent4: "#9C7A3F",
  accent5: "#6B4F3B",
  border: "#E6DDD1",
  chip: "#EFE6DA",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

const CATEGORY_COLORS = [
  COLORS.accent,
  COLORS.accent2,
  COLORS.accent3,
  COLORS.accent4,
  COLORS.accent5,
];

type SummaryRow = {
  id: string;
  name: string;
  total: number;
  percent: number;
  color: string;
};

type TrendPoint = {
  label: string;
  total: number;
};

function formatCurrency(cents: number) {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getMonthShort(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
  });
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function buildTrendMonths(year: number, month: number, count: number) {
  const months: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(shiftMonth(year, month, -i));
  }
  return months;
}

function DonutChart({
  segments,
  total,
}: {
  segments: SummaryRow[];
  total: number;
}) {
  const size = 170;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let start = 0;

  return (
    <View style={styles.donutWrapper}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {segments.map((segment) => {
            const length = circumference * segment.percent;
            const dasharray = `${length} ${circumference - length}`;
            const dashoffset = circumference * start;
            start += segment.percent;

            return (
              <Circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dasharray}
                strokeDashoffset={-dashoffset}
                fill="none"
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutTotal}>{formatCurrency(total)}</Text>
        <Text style={styles.donutLabel}>Total</Text>
      </View>
    </View>
  );
}

export function MonthlySummaryScreen() {
  const { categoriesStatus, categoriesRevision } = useSyncGate();

  console.log("[UI] MonthlySummaryScreen render", {
    categoriesStatus,
    categoriesRevision,
  });
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [totalCents, setTotalCents] = useState(0);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  const isCurrentMonth =
    selectedYear === today.getFullYear() &&
    selectedMonth === today.getMonth() + 1;

  const monthLabel = getMonthLabel(selectedYear, selectedMonth);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [total, breakdown, cats] = await Promise.all([
      ExpenseRepository.getMonthlyTotal(selectedYear, selectedMonth),
      ExpenseRepository.getMonthlyCategoryBreakdown(selectedYear, selectedMonth),
      CategoryRepository.getAll(),
    ]);

    const map = new Map(cats.map((cat) => [cat.id, cat.name]));
    const sorted = breakdown
      .map((item) => ({
        id: item.categoryId,
        name: map.get(item.categoryId) ?? "Uncategorized",
        total: item.total,
      }))
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        percent: total > 0 ? item.total / total : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .filter((item) => item.total > 0);

    const trendMonths = buildTrendMonths(selectedYear, selectedMonth, 6);
    const trendTotals = await Promise.all(
      trendMonths.map((point) =>
        ExpenseRepository.getMonthlyTotal(point.year, point.month)
      )
    );

    setTotalCents(total);
    setRows(sorted);
    setTrend(
      trendMonths.map((point, index) => ({
        label: getMonthShort(point.year, point.month),
        total: trendTotals[index],
      }))
    );
    setLoading(false);
  }, [selectedMonth, selectedYear]);

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
    // Smooth entrance for analytic panels.
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const maxTrend = Math.max(...trend.map((point) => point.total), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.backgroundLayer}>
        <View style={styles.bgOrbLeft} />
        <View style={styles.bgOrbRight} />
      </View>

      {/* Scroll container keeps all charts reachable on smaller screens. */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
          }}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Summary</Text>
              <Text style={styles.headerSubtitle}>Patterns and comparisons</Text>
            </View>
            <View style={styles.monthSwitcher}>
              <Pressable
                onPress={() => {
                  const next = shiftMonth(selectedYear, selectedMonth, -1);
                  setSelectedYear(next.year);
                  setSelectedMonth(next.month);
                }}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.monthButtonPressed,
                ]}
              >
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => {
                  if (isCurrentMonth) return;
                  const next = shiftMonth(selectedYear, selectedMonth, 1);
                  setSelectedYear(next.year);
                  setSelectedMonth(next.month);
                }}
                style={({ pressed }) => [
                  styles.monthButton,
                  isCurrentMonth && styles.monthButtonDisabled,
                  pressed && !isCurrentMonth && styles.monthButtonPressed,
                ]}
              >
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Spending</Text>
            <Text style={styles.heroAmount}>
              {loading ? "—" : formatCurrency(totalCents)}
            </Text>
            <Text style={styles.heroSub}>Selected month total</Text>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {rows.length === 0 && !loading ? (
              <Text style={styles.emptyText}>No category data.</Text>
            ) : (
              <DonutChart segments={rows} total={totalCents} />
            )}
            <View style={styles.legend}>
              {rows.map((row) => (
                <View key={row.id} style={styles.legendRow}>
                  <View
                    style={[styles.legendDot, { backgroundColor: row.color }]}
                  />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.legendValue}>
                    {Math.round(row.percent * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Monthly Trend</Text>
            {trend.length === 0 && !loading ? (
              <Text style={styles.emptyText}>No trend data.</Text>
            ) : (
              <View style={styles.barChart}>
                {trend.map((point) => {
                  const height = maxTrend
                    ? Math.max(6, (point.total / maxTrend) * 120)
                    : 6;
                  return (
                    <View key={point.label} style={styles.barItem}>
                      <View style={[styles.bar, { height }]} />
                      <Text style={styles.barLabel}>{point.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
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
    left: -90,
    opacity: 0.6,
  },
  bgOrbRight: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#E7D7C6",
    bottom: -60,
    right: -70,
    opacity: 0.45,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
  monthSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthButton: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: COLORS.chip,
  },
  monthButtonPressed: {
    opacity: 0.8,
  },
  monthButtonDisabled: {
    opacity: 0.4,
  },
  monthButtonText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    color: COLORS.text,
  },
  monthLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.text,
    marginHorizontal: 8,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  heroLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLORS.muted,
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 36,
    color: COLORS.text,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  donutWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
  },
  donutTotal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: COLORS.text,
  },
  donutLabel: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    color: COLORS.muted,
  },
  legend: {
    marginTop: 4,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.text,
  },
  legendValue: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.muted,
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 150,
    marginTop: 6,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
  },
  bar: {
    width: 14,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  barLabel: {
    marginTop: 8,
    fontFamily: FONT_BODY,
    fontSize: 11,
    color: COLORS.muted,
  },
  emptyText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    paddingVertical: 8,
  },
});
