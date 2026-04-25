import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../components/AppScreen";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { useI18n } from "../i18n/i18n";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import { useAuthGate } from "../state/authGateContext";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type Nav = NativeStackNavigationProp<AuthStackParamList, "AuthEntry">;

export function AuthEntryScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { continueAsGuest } = useAuthGate();

  return (
    <AppScreen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>{t("auth.welcomeTitle")}</Text>
        <Text style={styles.body}>{t("auth.welcomeBody")}</Text>
      </View>

      <AppCard>
        <AppButton
          label={t("auth.continueAsGuest")}
          onPress={continueAsGuest}
        />
        <View style={styles.spacer} />
        <AppButton
          label={t("auth.signIn")}
          variant="secondary"
          onPress={() => navigation.navigate("SignIn")}
        />
        <View style={styles.spacer} />
        <AppButton
          label={t("auth.signUp")}
          variant="ghost"
          onPress={() => navigation.navigate("SignUp")}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.text,
  },
  body: {
    marginTop: 10,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  spacer: {
    height: SPACING.sm,
  },
});
