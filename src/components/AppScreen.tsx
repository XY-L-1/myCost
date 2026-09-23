import { ReactNode, Ref } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../theme/tokens";

export function AppScreen({
  children,
  scroll = false,
  scrollRef,
}: {
  children: ReactNode;
  scroll?: boolean;
  scrollRef?: Ref<ScrollView>;
}) {
  const insets = useSafeAreaInsets();
  const contentBottomPadding = SPACING.xl + insets.bottom;
  const scrollBottomPadding = contentBottomPadding + 72;
  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        styles.webContent,
        { paddingBottom: scrollBottomPadding },
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.content, styles.webContent, { paddingBottom: contentBottomPadding }]}
    >
      {children}
    </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
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
