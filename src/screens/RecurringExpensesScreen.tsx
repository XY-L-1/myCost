import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { useSettingsStore } from "../settings/settingsStore";
import { CategoryRepository } from "../repositories/categoryRepository";
import { RecurringExpenseRepository } from "../repositories/recurringExpenseRepository";
import { RootStackParamList } from "../navigation/RootNavigator";
import { RecurringExpense } from "../types/recurringExpense";
import { formatDateKey, parseDateKey } from "../utils/date";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

type RecurringNav = NativeStackNavigationProp<
  RootStackParamList,
  "RecurringExpenses"
>;

export function RecurringExpensesScreen() {
  const navigation = useNavigation<RecurringNav>();
  const { t } = useI18n();
  const { formatCurrency, formatDate } = useFormatters();
  const scope = useCurrentScope();
  const preferredCurrency = useSettingsStore((state) => state.currency);
  const scrollRef = useRef<ScrollView>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [nextDueDate, setNextDueDate] = useState(formatDateKey(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope) return;
    const [categoryRows, recurringRows] = await Promise.all([
      CategoryRepository.getAll(scope),
      RecurringExpenseRepository.getAll(scope),
    ]);
    setCategories(categoryRows.map((item) => ({ id: item.id, name: item.name })));
    setCategoryId((current) => current ?? categoryRows[0]?.id ?? null);
    setItems(recurringRows);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setEditingItem(null);
    setTitle("");
    setAmount("");
    setDescription("");
    setFrequency("monthly");
    setNextDueDate(formatDateKey(new Date()));
    setShowDatePicker(false);
    setMutationError(null);
  };

  const save = async () => {
    if (!scope || !categoryId) return;
    const amountCents = parseAmountCents(amount);
    if (!title.trim() || amountCents <= 0 || !parseDateKey(nextDueDate)) {
      setMutationError(t("recurring.validation"));
      return;
    }

    const savingKey = editingItem?.id ?? "new";
    setSavingId(savingKey);
    setMutationError(null);
    try {
      const input = {
        title: title.trim(),
        amountCents,
        currency: editingItem?.currency ?? preferredCurrency,
        categoryId,
        description: description.trim() || null,
        frequency,
        nextDueDate,
      };

      if (editingItem) {
        await RecurringExpenseRepository.update(editingItem, input);
      } else {
        await RecurringExpenseRepository.create(scope, input);
      }

      resetForm();
      await load();
    } catch (error) {
      setMutationError((error as Error).message || t("errors.mutationSyncFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const startEditing = (item: RecurringExpense) => {
    setEditingItem(item);
    setTitle(item.title);
    setAmount((item.amountCents / 100).toFixed(2));
    setDescription(item.description ?? "");
    setFrequency(item.frequency);
    setNextDueDate(item.nextDueDate);
    setCategoryId(item.categoryId);
    setConfirmingDeleteId(null);
    setMutationError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleActive = async (item: RecurringExpense) => {
    if (!scope) return;
    setSavingId(item.id);
    setMutationError(null);
    try {
      await RecurringExpenseRepository.setActive(scope, item.id, !item.isActive);
      await load();
    } catch (error) {
      setMutationError((error as Error).message || t("errors.mutationSyncFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: RecurringExpense) => {
    setSavingId(item.id);
    setMutationError(null);
    try {
      await RecurringExpenseRepository.softDelete(item, new Date().toISOString());
      setConfirmingDeleteId(null);
      if (editingItem?.id === item.id) resetForm();
      await load();
    } catch (error) {
      setMutationError((error as Error).message || t("errors.mutationSyncFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selected) {
      setNextDueDate(formatDateKey(selected));
    }
  };

  const onWebDateChange = (event: { target: { value: string } }) => {
    const selectedDateKey = event.target.value;
    if (parseDateKey(selectedDateKey)) {
      setNextDueDate(selectedDateKey);
    }
  };

  if (!scope) return null;

  return (
    <AppScreen scroll scrollRef={scrollRef}>
      <ScreenHeader
        title={t("recurring.title")}
        subtitle={t("recurring.subtitle")}
        leftAction={{ kind: "back", onPress: () => navigation.goBack() }}
      />
      <Text style={styles.note}>{t("recurring.localOnlyNote")}</Text>

      <AppCard style={styles.editor}>
        {editingItem ? (
          <Text style={styles.editorTitle}>{t("recurring.edit")}</Text>
        ) : null}
        <AppInput label={t("common.title")} value={title} onChangeText={setTitle} />
        <AppInput
          label={t("common.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <AppInput
          label={t("common.description")}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <View style={styles.chips}>
          {categories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <AppButton
                key={category.id}
                label={category.name}
                variant={selected ? "primary" : "secondary"}
                onPress={() => setCategoryId(category.id)}
              />
            );
          })}
        </View>
        <View style={styles.chips}>
          <AppButton
            label={t("common.monthly")}
            variant={frequency === "monthly" ? "primary" : "secondary"}
            onPress={() => setFrequency("monthly")}
          />
          <AppButton
            label={t("common.weekly")}
            variant={frequency === "weekly" ? "primary" : "secondary"}
            onPress={() => setFrequency("weekly")}
          />
        </View>
        <Text style={styles.label}>{t("recurring.nextDue")}</Text>
        {Platform.OS === "web" ? (
          createElement("input", {
            "aria-label": t("recurring.nextDue"),
            type: "date",
            value: nextDueDate,
            onChange: onWebDateChange,
            onInput: onWebDateChange,
            style: webDateInputStyle,
          })
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          >
            <Text style={styles.dateText}>{formatDate(nextDueDate)}</Text>
          </Pressable>
        )}
        {mutationError ? <Text style={styles.error}>{mutationError}</Text> : null}
        {editingItem ? (
          <View style={styles.editorActions}>
            <AppButton
              label={t("common.cancel")}
              variant="secondary"
              disabled={savingId === editingItem.id}
              onPress={resetForm}
            />
            <AppButton
              label={t("recurring.saveChanges")}
              disabled={savingId === editingItem.id}
              onPress={save}
            />
          </View>
        ) : (
          <AppButton
            label={t("recurring.add")}
            disabled={savingId === "new"}
            onPress={save}
          />
        )}
      </AppCard>

      {items.length === 0 ? (
        <EmptyState title={t("recurring.title")} body={t("recurring.empty")} />
      ) : (
        items.map((item) => {
          const categoryName = categories.find(
            (category) => category.id === item.categoryId
          )?.name;
          const isSaving = savingId === item.id;
          return (
            <AppCard key={item.id} style={styles.item}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemText}>
                {formatCurrency(item.amountCents, item.currency)} · {categoryName}
              </Text>
              <Text style={styles.itemText}>
                {t("recurring.nextDue")}: {formatDate(item.nextDueDate)}
              </Text>
              <Text style={styles.itemText}>
                {t("recurring.frequency")}: {item.frequency === "monthly" ? t("common.monthly") : t("common.weekly")}
              </Text>
              <View style={styles.itemActions}>
                <AppButton
                  label={t("common.edit")}
                  variant="secondary"
                  disabled={isSaving}
                  onPress={() => startEditing(item)}
                />
                <AppButton
                  label={item.isActive ? t("common.archive") : t("common.restore")}
                  variant="secondary"
                  disabled={isSaving}
                  onPress={() => toggleActive(item)}
                />
                <AppButton
                  label={t("common.delete")}
                  variant="danger"
                  disabled={isSaving}
                  onPress={() => {
                    setConfirmingDeleteId(item.id);
                    setMutationError(null);
                  }}
                />
              </View>
              {confirmingDeleteId === item.id ? (
                <View style={styles.deleteConfirmation}>
                  <Text style={styles.confirmTitle}>
                    {t("recurring.deleteConfirmTitle")}
                  </Text>
                  <Text style={styles.confirmBody}>
                    {t("recurring.deleteConfirmBody")}
                  </Text>
                  <View style={styles.editorActions}>
                    <AppButton
                      label={t("common.cancel")}
                      variant="secondary"
                      disabled={isSaving}
                      onPress={() => setConfirmingDeleteId(null)}
                    />
                    <AppButton
                      label={t("common.delete")}
                      variant="danger"
                      disabled={isSaving}
                      onPress={() => deleteItem(item)}
                    />
                  </View>
                </View>
              ) : null}
            </AppCard>
          );
        })
      )}

      {showDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseDateKey(nextDueDate) ?? new Date()}
          mode="date"
          onChange={onDateChange}
        />
      ) : null}

      {showDatePicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <DateTimePicker
                value={parseDateKey(nextDueDate) ?? new Date()}
                mode="date"
                display="inline"
                onChange={onDateChange}
              />
              <AppButton
                label={t("common.done")}
                onPress={() => setShowDatePicker(false)}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  editor: {
    marginBottom: SPACING.md,
  },
  editorTitle: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  label: {
    marginBottom: 6,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADII.sm,
    marginBottom: SPACING.sm,
  },
  dateText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  error: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger,
  },
  editorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  item: {
    marginBottom: SPACING.sm,
  },
  itemTitle: {
    marginBottom: 8,
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
  },
  itemText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  itemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  deleteConfirmation: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceMuted,
  },
  confirmTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.text,
  },
  confirmBody: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    padding: SPACING.md,
  },
});

const webDateInputStyle = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: COLORS.border,
  backgroundColor: "#FFF",
  color: COLORS.text,
  borderRadius: RADII.sm,
  padding: "12px 14px",
  marginBottom: SPACING.sm,
  fontFamily: FONTS.body,
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
} as const;

function parseAmountCents(value: string): number {
  const amount = Number(value || "0");
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}
