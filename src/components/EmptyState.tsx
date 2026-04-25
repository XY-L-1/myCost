import { StyleSheet, Text, View } from "react-native";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: "center",
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
