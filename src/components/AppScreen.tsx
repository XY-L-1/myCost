import { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../theme/tokens";

export function AppScreen({
  children,
  scroll = false,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, styles.webContent]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.webContent]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  webContent: Platform.select({
    web: {
      width: "100%",
      maxWidth: 1040,
      alignSelf: "center",
    },
    default: {},
  }),
});
