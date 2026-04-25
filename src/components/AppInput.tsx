import { StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

export function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "decimal-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, !!error && styles.inputError]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFF",
    color: COLORS.text,
    borderRadius: RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  error: {
    marginTop: 6,
    color: COLORS.danger,
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
