import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/i18n";
import { COLORS, FONTS, SPACING } from "../theme/tokens";

type HeaderAction = {
  kind: "back" | "close";
  onPress: () => void;
};

export function ScreenHeader({
  title,
  subtitle,
  leftAction,
  right,
}: {
  title: string;
  subtitle?: string;
  leftAction?: HeaderAction;
  right?: ReactNode;
}) {
  const { t } = useI18n();
  const leftLabel = leftAction
    ? leftAction.kind === "back"
      ? `\u2190 ${t("common.back")}`
      : `\u00d7 ${t("common.close")}`
    : null;

  return (
    <View style={styles.container}>
      {leftAction && leftLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={leftAction.onPress}
          style={styles.leftAction}
        >
          <Text style={styles.leftActionText}>{leftLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  leftAction: {
    alignSelf: "flex-start",
    marginBottom: SPACING.xs,
  },
  leftActionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
