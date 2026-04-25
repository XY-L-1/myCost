import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigatorScreenParams } from "@react-navigation/native";
import { HomeScreen } from "../screens/HomeScreen";
import { ExpenseListScreen } from "../screens/ExpenseListScreen";
import { MonthlySummaryScreen } from "../screens/MonthlySummaryScreen";
import { BudgetScreen } from "../screens/BudgetScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AddExpenseScreen } from "../screens/AddExpenseScreen";
import { MonthDetailScreen } from "../screens/MonthDetailScreen";
import { CategoryTransactionsScreen } from "../screens/CategoryTransactionsScreen";
import { CategoryManagementScreen } from "../screens/CategoryManagementScreen";
import { RecurringExpensesScreen } from "../screens/RecurringExpensesScreen";
import { COLORS, FONTS, RADII } from "../theme/tokens";
import { useI18n } from "../i18n/i18n";

export type RootTabParamList = {
  HomeTab: undefined;
  TransactionsTab: undefined;
  InsightsTab: undefined;
  BudgetTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList>;
  ExpenseEditor: { expenseId?: string } | undefined;
  MonthDetail: { monthKey: string };
  CategoryTransactions: { monthKey: string; categoryId: string };
  Categories: undefined;
  RecurringExpenses: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useI18n();
  const labels: Record<keyof RootTabParamList, string> = {
    HomeTab: t("nav.home"),
    TransactionsTab: t("nav.transactions"),
    InsightsTab: t("nav.insights"),
    BudgetTab: t("nav.budget"),
    SettingsTab: t("nav.settings"),
  };

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const selected = index === state.index;
        return (
          <Pressable
            accessibilityRole="button"
            key={route.key}
            onPress={() => navigation.navigate(route.name as never)}
            style={[styles.tabButton, selected && styles.tabButtonSelected]}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
              {labels[route.name as keyof RootTabParamList]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="TransactionsTab" component={ExpenseListScreen} />
      <Tab.Screen name="InsightsTab" component={MonthlySummaryScreen} />
      <Tab.Screen name="BudgetTab" component={BudgetScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen
        name="ExpenseEditor"
        component={AddExpenseScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="MonthDetail" component={MonthDetailScreen} />
      <Stack.Screen
        name="CategoryTransactions"
        component={CategoryTransactionsScreen}
      />
      <Stack.Screen name="Categories" component={CategoryManagementScreen} />
      <Stack.Screen
        name="RecurringExpenses"
        component={RecurringExpensesScreen}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: RADII.pill,
  },
  tabButtonSelected: {
    backgroundColor: COLORS.surfaceMuted,
  },
  tabLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabLabelSelected: {
    color: COLORS.text,
  },
});
