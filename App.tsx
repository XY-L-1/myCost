import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { Text, View, StyleSheet } from "react-native";
import { AuthGateProvider } from "./src/state/authGateContext";
import { SyncGateProvider } from "./src/state/syncGateContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { useAuthStore } from "./src/auth/authStore";
import { useAppRuntime } from "./src/app/useAppRuntime";
import { useAppInitStore } from "./src/state/appInitStore";
import { useSettingsStore } from "./src/settings/settingsStore";
import { I18nProvider, useI18n } from "./src/i18n/i18n";
import { COLORS, FONTS } from "./src/theme/tokens";
import { AppButton } from "./src/components/AppButton";
import { AuthEntryTarget } from "./src/state/authGateContext";

function AppContent() {
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [authEntryTarget, setAuthEntryTarget] = useState<AuthEntryTarget>("entry");

  return (
    <I18nProvider>
      <AuthGateProvider
        value={{
          allowAnonymous,
          authEntryTarget,
          continueAsGuest: () => {
            setAuthEntryTarget("entry");
            setAllowAnonymous(true);
          },
          openAuthEntry: () => {
            setAuthEntryTarget("entry");
            setAllowAnonymous(false);
          },
          openSignIn: () => {
            setAuthEntryTarget("signIn");
            setAllowAnonymous(false);
          },
          openSignUp: () => {
            setAuthEntryTarget("signUp");
            setAllowAnonymous(false);
          },
          resetAnonymous: () => {
            setAuthEntryTarget("entry");
            setAllowAnonymous(true);
          },
        }}
      >
        <AppShell
          allowAnonymous={allowAnonymous}
          authEntryTarget={authEntryTarget}
          setAllowAnonymous={setAllowAnonymous}
          setAuthEntryTarget={setAuthEntryTarget}
        />
      </AuthGateProvider>
    </I18nProvider>
  );
}

function AppShell({
  allowAnonymous,
  authEntryTarget,
  setAllowAnonymous,
  setAuthEntryTarget,
}: {
  allowAnonymous: boolean;
  authEntryTarget: AuthEntryTarget;
  setAllowAnonymous: (value: boolean) => void;
  setAuthEntryTarget: (value: AuthEntryTarget) => void;
}) {
  const auth = useAuthStore();
  const appInit = useAppInitStore();
  const settings = useSettingsStore();
  const runtime = useAppRuntime();
  const { t } = useI18n();

  useEffect(() => {
    if (auth.user) {
      setAuthEntryTarget("entry");
      setAllowAnonymous(false);
    }
  }, [auth.user?.id, setAllowAnonymous, setAuthEntryTarget]);

  if (appInit.initializing || auth.initializing || !settings.ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("common.appName")}</Text>
        <Text style={styles.body}>{t("startup.preparingWorkspace")}</Text>
      </View>
    );
  }

  if (appInit.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("common.appName")}</Text>
        <Text style={styles.body}>{t(appInit.error)}</Text>
        <AppButton label={t("common.retry")} onPress={() => appInit.initialize()} />
      </View>
    );
  }

  const navKey = auth.user?.id
    ? `user:${auth.user.id}`
    : allowAnonymous
      ? "guest"
      : `auth:${authEntryTarget}`;

  return (
    <SyncGateProvider value={runtime}>
      <NavigationContainer key={navKey}>
        {auth.user || allowAnonymous ? (
          <RootNavigator />
        ) : (
          <AuthNavigator initialRouteName={resolveAuthInitialRoute(authEntryTarget)} />
        )}
      </NavigationContainer>
    </SyncGateProvider>
  );
}

export default function App() {
  return <AppContent />;
}

function resolveAuthInitialRoute(target: AuthEntryTarget) {
  switch (target) {
    case "signIn":
      return "SignIn" as const;
    case "signUp":
      return "SignUp" as const;
    default:
      return "AuthEntry" as const;
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
});
