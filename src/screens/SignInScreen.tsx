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

type Nav = NativeStackNavigationProp<AuthStackParamList, "SignIn">;

export function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const auth = useAuthStore();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message ?? t("errors.signInFailed"));
      setLoading(false);
    }
  };

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("auth.signIn")}
        subtitle={t("auth.signInSubtitle")}
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          label={loading ? t("common.loading") : t("auth.signIn")}
          onPress={onSignIn}
          disabled={loading}
        />
      </AppCard>

      <View style={styles.footer}>
        <AppButton
          label={t("auth.needAccount")}
          variant="ghost"
          onPress={() => navigation.navigate("SignUp")}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    color: COLORS.danger,
  },
  footer: {
    marginTop: SPACING.md,
  },
});
