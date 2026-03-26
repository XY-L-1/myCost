import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuthStore } from "../auth/authStore";
import type { AuthStackParamList } from "../navigation/AuthNavigator";

type AuthNavProp = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  danger: "#C1453C",
  border: "#E6DDD1",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

export function SignUpScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const auth = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [checking, setChecking] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Calm entrance so the form feels approachable.
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
    ]).start();
  }, [fade, slide]);

  async function onSignUp() {
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);

    try {
      await auth.signUp(email.trim(), password);
      setAwaitingVerify(true);
    } catch (err) {
      setError((err as Error).message ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerified() {
    if (checking) return;
    setChecking(true);
    setError(null);

    try {
      await auth.signIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message ?? "Unable to verify yet.");
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start tracking in minutes.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              editable={!awaitingVerify && !loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Create a password"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              editable={!awaitingVerify && !loading}
            />

            {awaitingVerify ? (
              <View style={styles.verifyBox}>
                <Text style={styles.verifyTitle}>Almost there</Text>
                <Text style={styles.verifyBody}>
                  We’ve sent a confirmation email. Please verify your email to
                  continue.
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {!awaitingVerify ? (
              <Pressable
                onPress={onSignUp}
                disabled={loading || !email || !password}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (loading || !email || !password) && styles.primaryDisabled,
                  pressed && !loading && styles.primaryPressed,
                ]}
              >
                <Text style={styles.primaryText}>
                  {loading ? "Creating..." : "Create Account"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onVerified}
                disabled={checking}
                style={({ pressed }) => [
                  styles.primaryButton,
                  checking && styles.primaryDisabled,
                  pressed && !checking && styles.primaryPressed,
                ]}
              >
                <Text style={styles.primaryText}>
                  {checking ? "Checking..." : "I’ve verified my email"}
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => navigation.navigate("SignIn")}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 20,
  },
  backText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    color: COLORS.text,
  },
  subtitle: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: COLORS.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: "#FFF",
  },
  verifyBox: {
    backgroundColor: "#F0ECE6",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  verifyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 6,
  },
  verifyBody: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
  errorText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.danger,
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryDisabled: {
    backgroundColor: "#B7C6BE",
  },
  primaryText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: "#FFF",
  },
  link: {
    alignSelf: "center",
    marginTop: 20,
  },
  linkText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
