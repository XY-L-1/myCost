import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigatorScreenParams } from "@react-navigation/native";
import type { Expense } from "../types/expense";
import { HomeScreen } from "../screens/HomeScreen";
import { ExpenseListScreen } from "../screens/ExpenseListScreen";
import { AddExpenseScreen } from "../screens/AddExpenseScreen";
import { ExpenseDetailScreen } from "../screens/ExpenseDetailScreen";
import { MonthlySummaryScreen } from "../screens/MonthlySummaryScreen";
import { useSyncGate } from "../state/syncGateContext";
import { useAuthGate } from "../state/authGateContext";
import { useAuthStore } from "../auth/authStore";

export type HomeStackParamList = {
  Home: undefined;
};

export type ExpensesStackParamList = {
  Expenses: undefined;
  ExpenseDetail: { expense: Expense };
};

export type SummaryStackParamList = {
  Summary: undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  ExpensesTab: NavigatorScreenParams<ExpensesStackParamList>;
  SummaryTab: NavigatorScreenParams<SummaryStackParamList>;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  AddExpenseModal: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>();
const SummaryStack = createNativeStackNavigator<SummaryStackParamList>();

const COLORS = {
  background: "#F5F1EB",
  text: "#1E1A16",
  muted: "#6B6259",
  card: "#FFF9F2",
  border: "#E6DDD1",
};

const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const tabWidth = layoutWidth / state.routes.length;
  const routes = state.routes;

  useEffect(() => {
    if (!layoutWidth) return;
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }, [indicatorX, layoutWidth, state.index, tabWidth]);

  return (
    <View
      style={[styles.tabBar, { paddingBottom: insets.bottom + 10 }]}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      {layoutWidth > 0 ? (
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabWidth, transform: [{ translateX: indicatorX }] },
          ]}
        />
      ) : null}
      {routes.map((route: typeof routes[number], index: number) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name.replace("Tab", "");
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tabButton,
              pressed && styles.tabButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                isFocused && styles.tabLabelActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
    </HomeStack.Navigator>
  );
}

function ExpensesStackNavigator() {
  return (
    <ExpensesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FONT_BODY, color: COLORS.text },
        headerTintColor: COLORS.text,
      }}
    >
      <ExpensesStack.Screen
        name="Expenses"
        component={ExpenseListScreen}
        options={{ headerShown: false }}
      />
      <ExpensesStack.Screen
        name="ExpenseDetail"
        component={ExpenseDetailScreen}
        options={{ title: "Edit Expense" }}
      />
    </ExpensesStack.Navigator>
  );
}

function SummaryStackNavigator() {
  return (
    <SummaryStack.Navigator screenOptions={{ headerShown: false }}>
      <SummaryStack.Screen name="Summary" component={MonthlySummaryScreen} />
    </SummaryStack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props: BottomTabBarProps) => <AnimatedTabBar {...props} />}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesStackNavigator}
        options={{ title: "Expenses" }}
      />
      <Tab.Screen
        name="SummaryTab"
        component={SummaryStackNavigator}
        options={{ title: "Summary" }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { categoriesStatus } = useSyncGate();
  const { allowAnonymous } = useAuthGate();
  const auth = useAuthStore();

  console.log("[UI] RootNavigator render", {
    categoriesStatus,
    allowAnonymous,
    userId: auth.user?.id ?? null,
  });

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
      <RootStack.Screen
        name="AddExpenseModal"
        component={AddExpenseScreen}
        options={{ presentation: "modal" }}
      />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  tabIndicator: {
    position: "absolute",
    top: 6,
    left: 10,
    height: 36,
    backgroundColor: "#EFE6DA",
    borderRadius: 18,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 1,
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
  tabLabelActive: {
    color: COLORS.text,
  },
});
