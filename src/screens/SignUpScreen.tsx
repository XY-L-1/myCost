import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { useI18n } from "../i18n/i18n";
import { useAuthStore } from "../auth/authStore";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type Nav = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const auth = useAuthStore();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await auth.signUp(email.trim(), password);
      setAwaitingVerify(true);
    } catch (e) {
      setError((e as Error).message ?? t("errors.signUpFailed"));
    } finally {
      setLoading(false);
    }
  };

  const onVerified = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message ?? t("errors.verifyIncomplete"));
      setLoading(false);
    }
  };

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("auth.signUp")}
        subtitle={t("auth.signUpSubtitle")}
        leftAction={{ kind: "back", onPress: () => navigation.navigate("AuthEntry") }}
      />

      <AppCard>
        <AppInput
          label={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <AppInput
          label={t("auth.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {awaitingVerify ? <Text style={styles.info}>{t("auth.verifyHint")}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          label={
            awaitingVerify
              ? t("auth.verified")
              : loading
                ? t("common.loading")
                : t("auth.signUp")
          }
          onPress={awaitingVerify ? onVerified : onSignUp}
          disabled={loading}
        />
      </AppCard>

      <View style={styles.footer}>
        <AppButton
          label={t("auth.haveAccount")}
          variant="ghost"
          onPress={() => navigation.navigate("SignIn")}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  info: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  error: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    color: COLORS.danger,
  },
  footer: {
    marginTop: SPACING.md,
  },
});
