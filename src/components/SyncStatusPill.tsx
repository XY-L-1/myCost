import { StyleSheet, Text, View } from "react-native";
import { useSyncGate } from "../state/syncGateContext";
import { useI18n } from "../i18n/i18n";
import { COLORS, FONTS, RADII } from "../theme/tokens";
import { useAuthStore } from "../auth/authStore";
import { formatRelativeSyncTime } from "../utils/formatting";

export function SyncStatusPill() {
  const auth = useAuthStore();
  const { t, language } = useI18n();
  const { syncStatus, lastSyncAt, syncMessage } = useSyncGate();

  const label = !auth.user
    ? t("common.localOnly")
    : syncStatus === "syncing"
      ? t("common.syncing")
      : syncStatus === "error"
        ? t("common.syncError")
        : t("common.synced");

  const subtitle =
    syncStatus === "error" && syncMessage
      ? syncMessage.startsWith("errors.")
        ? t(syncMessage)
        : syncMessage
      : auth.user && lastSyncAt
      ? t("sync.syncedAt", {
          time: formatRelativeSyncTime(lastSyncAt, language) ?? "",
        })
      : !auth.user
        ? t("sync.guestBody")
        : t("sync.notSyncedYet");

  return (
    <View style={[styles.pill, syncStatus === "error" && styles.errorPill]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorPill: {
    backgroundColor: "#F2E1DE",
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
