import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { AuthStackParamList } from "../navigation/AuthNavigator";
import { useAuthGate } from "../state/authGateContext";

type AuthNavProp = NativeStackNavigationProp<AuthStackParamList, "AuthEntry">;

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  border: "#E6DDD1",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

export function AuthEntryScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const { continueAsGuest } = useAuthGate();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    // Gentle intro to welcome the user.
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.backgroundLayer}>
        <View style={styles.bgOrbLeft} />
        <View style={styles.bgOrbRight} />
      </View>

      <Animated.View
        style={{
          opacity: fade,
          transform: [{ translateY: slide }],
        }}
      >
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>Track spending even when offline.</Text>

        <View style={styles.card}>
          <Pressable
            onPress={() => navigation.navigate("SignIn")}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryPressed,
            ]}
          >
            <Text style={styles.primaryText}>Sign In</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryPressed,
            ]}
          >
            <Text style={styles.secondaryText}>Create Account</Text>
          </Pressable>

          <Pressable
            onPress={continueAsGuest}
            style={({ pressed }) => [
              styles.guestButton,
              pressed && styles.secondaryPressed,
            ]}
          >
            <Text style={styles.guestText}>Continue without account</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOrbLeft: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#F0E4D7",
    top: -60,
    left: -80,
    opacity: 0.6,
  },
  bgOrbRight: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E7D7C6",
    bottom: -80,
    right: -60,
    opacity: 0.5,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    color: COLORS.text,
    marginTop: 40,
  },
  subtitle: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: "#FFF",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryPressed: {
    opacity: 0.85,
  },
  secondaryText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
  },
  guestButton: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  guestText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
});
