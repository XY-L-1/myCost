import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { runMigrations } from './src/db/migration';
import { generateUUID } from './src/utils/uuid';
import * as SecureStore from "expo-secure-store";
import { seedCategoriesIfNeeded } from "./src/db/seedCategories";
import { useAppInitStore } from "./src/state/appInitStore";
import { useAuthStore } from "./src/auth/authStore";

import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "./src/navigation/RootNavigator";


export default function App() {
  const appInit = useAppInitStore();
  const auth = useAuthStore();

  useEffect(() => {
    appInit.initialize();
    auth.initialize();
  }, []);

  useEffect(() => {
    if (!auth.user && !auth.initializing) {
      auth.signInWithEmail("test@eric.com", "password123");
    }
  }, [auth.user, auth.initializing]);

  if (appInit.initializing || auth.initializing) {
    return <Text>Initializing app...</Text>;
  }

  if (!appInit.ready) {
    return null;
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = {
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
};