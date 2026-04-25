import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { SyncStatusPill } from "../components/SyncStatusPill";
import { useI18n } from "../i18n/i18n";
import { useSettingsStore } from "../settings/settingsStore";
import { useAuthStore } from "../auth/authStore";
import { useAuthGate } from "../state/authGateContext";
import { useSyncGate } from "../state/syncGateContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;
type CurrencyOption = "USD" | "CNY" | "EUR" | "JPY";

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const { t } = useI18n();
  const auth = useAuthStore();
  const { openSignIn, openSignUp, resetAnonymous } = useAuthGate();
  const language = useSettingsStore((state) => state.language);
  const currency = useSettingsStore((state) => state.currency);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setCurrency = useSettingsStore((state) => state.setCurrency);
  const { syncStatus, retrySync } = useSyncGate();
  const currencyLabels: Record<CurrencyOption, string> = {
    USD: t("settings.currencyUsd"),
    CNY: t("settings.currencyCny"),
    EUR: t("settings.currencyEur"),
    JPY: t("settings.currencyJpy"),
  };

  return (
    <AppScreen scroll>
      <ScreenHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <AppCard style={styles.section}>
        <Text style={styles.label}>{t("common.language")}</Text>
        <View style={styles.row}>
          <AppButton
            label={t("settings.languageEnglish")}
            variant={language === "en" ? "primary" : "secondary"}
            onPress={() => setLanguage("en")}
          />
          <AppButton
            label={t("settings.languageChinese")}
            variant={language === "zh-CN" ? "primary" : "secondary"}
            onPress={() => setLanguage("zh-CN")}
          />
        </View>
        <Text style={styles.hint}>{t("settings.languageHint")}</Text>
      </AppCard>

      <AppCard style={styles.section}>
        <Text style={styles.label}>{t("common.currency")}</Text>
        <View style={styles.row}>
          {(Object.keys(currencyLabels) as CurrencyOption[]).map((option) => (
            <AppButton
              key={option}
              label={currencyLabels[option]}
              variant={currency === option ? "primary" : "secondary"}
              onPress={() => setCurrency(option as typeof currency)}
            />
          ))}
        </View>
        <Text style={styles.hint}>{t("settings.currencyHint")}</Text>
      </AppCard>

      <AppCard style={styles.section}>
        <Text style={styles.label}>{t("settings.syncTitle")}</Text>
        <SyncStatusPill />
        <Text style={styles.hint}>{t("settings.syncCoverage")}</Text>
        {auth.user && syncStatus === "error" ? (
          <View style={styles.retryRow}>
            <AppButton label={t("common.retry")} variant="secondary" onPress={retrySync} />
          </View>
        ) : null}
      </AppCard>

      {Platform.OS === "web" ? (
        <AppCard style={styles.section}>
          <Text style={styles.accountTitle}>{t("settings.pwaTitle")}</Text>
          <Text style={styles.hint}>{t("settings.pwaBody")}</Text>
        </AppCard>
      ) : null}

      {!auth.user ? (
        <AppCard style={styles.section}>
          <Text style={styles.accountTitle}>{t("settings.guestAccountTitle")}</Text>
          <Text style={styles.hint}>{t("settings.guestAccountBody")}</Text>
          <View style={styles.row}>
            <AppButton label={t("auth.syncCta")} onPress={openSignIn} />
            <AppButton
              label={t("auth.createAccountCta")}
              variant="secondary"
              onPress={openSignUp}
            />
          </View>
        </AppCard>
      ) : null}

      <AppCard style={styles.section}>
        <Pressable onPress={() => navigation.navigate("Categories")} style={styles.linkRow}>
          <Text style={styles.linkText}>{t("settings.categories")}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("RecurringExpenses")}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>{t("settings.recurring")}</Text>
        </Pressable>
      </AppCard>

      {auth.user ? (
        <AppButton
          label={t("auth.signOut")}
          variant="danger"
          onPress={async () => {
            await auth.signOut();
            resetAnonymous();
          }}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.md,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  hint: {
    marginTop: 10,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  retryRow: {
    marginTop: SPACING.sm,
  },
  linkRow: {
    paddingVertical: 8,
  },
  accountTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 8,
  },
  linkText: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
});
