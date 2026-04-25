import { Pressable, StyleSheet, Text } from "react-native";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const stylesForVariant = VARIANT_STYLES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        stylesForVariant.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, stylesForVariant.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});

const variantStyles = StyleSheet.create({
  primaryContainer: {
    backgroundColor: COLORS.text,
  },
  primaryLabel: {
    color: "#FFF",
  },
  secondaryContainer: {
    backgroundColor: COLORS.surfaceMuted,
  },
  secondaryLabel: {
    color: COLORS.text,
  },
  ghostContainer: {
    backgroundColor: "transparent",
  },
  ghostLabel: {
    color: COLORS.accent,
  },
  dangerContainer: {
    backgroundColor: "#F3E3E0",
  },
  dangerLabel: {
    color: COLORS.danger,
  },
});

const VARIANT_STYLES = {
  primary: {
    container: variantStyles.primaryContainer,
    label: variantStyles.primaryLabel,
  },
  secondary: {
    container: variantStyles.secondaryContainer,
    label: variantStyles.secondaryLabel,
  },
  ghost: {
    container: variantStyles.ghostContainer,
    label: variantStyles.ghostLabel,
  },
  danger: {
    container: variantStyles.dangerContainer,
    label: variantStyles.dangerLabel,
  },
} as const;
