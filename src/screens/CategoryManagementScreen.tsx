import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { CategoryRepository } from "../repositories/categoryRepository";
import { useAppInitStore } from "../state/appInitStore";
import { Category } from "../types/category";
import { useSyncGate } from "../state/syncGateContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { COLORS, FONTS, SPACING } from "../theme/tokens";
import { useFormatters } from "../hooks/useFormatters";

type CategoryManagementNav = NativeStackNavigationProp<RootStackParamList, "Categories">;

export function CategoryManagementScreen() {
  const navigation = useNavigation<CategoryManagementNav>();
  const { t } = useI18n();
  const { formatCurrency } = useFormatters();
  const scope = useCurrentScope();
  const { deviceId } = useAppInitStore();
  const { categoriesRevision } = useSyncGate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftBudget, setDraftBudget] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    setCategories(await CategoryRepository.getAll(scope, { includeArchived: true }));
  }, [scope]);

  useEffect(() => {
    load();
  }, [categoriesRevision, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeCategories = categories.filter((item) => !item.deletedAt);
  const archivedCategories = categories.filter((item) => !!item.deletedAt);

  const saveCategory = async () => {
    if (!scope || !deviceId) return;
    const name = draftName.trim();
    const budgetText = draftBudget.trim();
    const budget = budgetText ? Number(budgetText) : 0;

    if (!name) {
      setMutationError(t("categories.validationName"));
      return;
    }

    if (!Number.isFinite(budget) || budget < 0) {
      setMutationError(t("categories.validationBudget"));
      return;
    }

    setMutationError(null);

    try {
      if (editingId) {
        const existing = categories.find((item) => item.id === editingId);
        if (!existing) return;

        const duplicate = await CategoryRepository.findByNormalizedName(scope, name, {
          includeArchived: true,
          excludeId: editingId,
        });

        if (duplicate) {
          setMutationError(t("categories.duplicateError"));
          return;
        }

        await CategoryRepository.update(existing, { name, budget });
      } else {
        const result = await CategoryRepository.createOrRestore({
          scope,
          deviceId,
          name,
          budget,
        });

        if (result.status === "existing") {
          setMutationError(t("categories.duplicateError"));
          return;
        }
      }

      setDraftName("");
      setDraftBudget("0");
      setEditingId(null);
      await load();
    } catch (error) {
      setMutationError((error as Error).message ?? t("errors.mutationSyncFailed"));
    }
  };

  if (!scope) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={t("categories.title")}
        subtitle={t("categories.subtitle")}
        leftAction={{ kind: "back", onPress: () => navigation.goBack() }}
      />

      <AppCard style={styles.editor}>
        <AppInput
          label={editingId ? t("categories.editCategory") : t("categories.addCategory")}
          value={draftName}
          onChangeText={(value) => {
            setDraftName(value);
            if (mutationError) {
              setMutationError(null);
            }
          }}
          placeholder={t("categories.namePlaceholder")}
        />
        <AppInput
          label={t("categories.budgetLabel")}
          value={draftBudget}
          onChangeText={(value) => {
            setDraftBudget(value);
            if (mutationError) {
              setMutationError(null);
            }
          }}
          placeholder={t("categories.budgetPlaceholder")}
          keyboardType="decimal-pad"
        />
        {mutationError ? <Text style={styles.error}>{mutationError}</Text> : null}
        <AppButton
          label={editingId ? t("common.save") : t("categories.addCategory")}
          onPress={saveCategory}
        />
      </AppCard>

      {activeCategories.length === 0 ? (
        <EmptyState title={t("categories.title")} body={t("categories.empty")} />
      ) : (
        activeCategories.map((category) => (
          <AppCard key={category.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{category.name}</Text>
              <Text style={styles.rowBudget}>
                {t("categories.budgetLabel")}:{" "}
                {formatCurrency(Math.round(category.budget * 100))}
              </Text>
              <Text style={styles.rowBody}>{t("categories.archiveHint")}</Text>
            </View>
            <View style={styles.rowActions}>
              <AppButton
                label={t("common.edit")}
                variant="secondary"
                onPress={() => {
                  setEditingId(category.id);
                  setDraftName(category.name);
                  setDraftBudget(category.budget.toFixed(2));
                }}
              />
              <AppButton
                label={t("categories.archive")}
                variant="danger"
                onPress={async () => {
                  setMutationError(null);
                  await CategoryRepository.archive(category);
                  await load();
                }}
              />
            </View>
          </AppCard>
        ))
      )}

      {archivedCategories.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t("categories.archivedTitle")}</Text>
          {archivedCategories.map((category) => (
            <AppCard key={category.id} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{category.name}</Text>
                <Text style={styles.rowBudget}>
                  {t("categories.budgetLabel")}:{" "}
                  {formatCurrency(Math.round(category.budget * 100))}
                </Text>
                <Text style={styles.rowBody}>{t("common.archived")}</Text>
              </View>
              <AppButton
                label={t("categories.restore")}
                variant="secondary"
                onPress={async () => {
                  setMutationError(null);
                  await CategoryRepository.restore(category);
                  await load();
                }}
              />
            </AppCard>
          ))}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  editor: {
    marginBottom: SPACING.md,
  },
  error: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger,
  },
  sectionLabel: {
    marginTop: SPACING.md,
    marginBottom: 8,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  rowBudget: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  rowBody: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rowActions: {
    gap: SPACING.xs,
  },
});
