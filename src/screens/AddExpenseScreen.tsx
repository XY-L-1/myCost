import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { AppScreen } from "../components/AppScreen";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppCard } from "../components/AppCard";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { useI18n } from "../i18n/i18n";
import { useCurrentScope } from "../hooks/useCurrentScope";
import { useFormatters } from "../hooks/useFormatters";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { ensureDefaultCategories } from "../services/categorySeedService";
import { repairLocalCategoryDuplicates } from "../services/categoryRepairService";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAppInitStore } from "../state/appInitStore";
import { useSettingsStore } from "../settings/settingsStore";
import { formatDateKey, parseDateKey } from "../utils/date";
import { generateUUID } from "../utils/uuid";
import { COLORS, FONTS, RADII, SPACING } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ExpenseEditor">;

export function AddExpenseScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const scope = useCurrentScope();
  const { deviceId } = useAppInitStore();
  const preferredCurrency = useSettingsStore((state) => state.currency);
  const { formatDate } = useFormatters();

  const [loading, setLoading] = useState(true);
  const [expenseId, setExpenseId] = useState<string | null>(route.params?.expenseId ?? null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dateKey, setDateKey] = useState(formatDateKey(new Date()));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);

  const load = useCallback(async () => {
    if (!scope || !deviceId) return;
    await repairLocalCategoryDuplicates(scope, deviceId);
    await ensureDefaultCategories(scope, deviceId);
    const categoryRows = await CategoryRepository.getAll(scope);
    setCategories(categoryRows.map((item) => ({ id: item.id, name: item.name })));
    setCategoryId((current) =>
      categoryRows.some((item) => item.id === current)
        ? current
        : categoryRows[0]?.id ?? null
    );

    if (route.params?.expenseId) {
      const expense = await ExpenseRepository.getByIdInScope(
        scope,
        route.params.expenseId
      );
      if (expense) {
        const canonicalCategory = await CategoryRepository.getCanonicalByIdInScope(
          scope,
          expense.categoryId
        );
        setExpenseId(expense.id);
        setAmount((expense.amountCents / 100).toFixed(2));
        setDescription(expense.description ?? "");
        setCategoryId(canonicalCategory?.id ?? categoryRows[0]?.id ?? null);
        setDateKey(expense.expenseDate);
      }
    }
    setLoading(false);
  }, [deviceId, route.params?.expenseId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const validate = () => {
    const nextErrors = {
      amount: amountCents > 0 ? null : t("expense.validationAmount"),
      category: categoryId ? null : t("expense.validationCategory"),
      date: parseDateKey(dateKey) ? null : t("expense.validationDate"),
    };
    setErrors(nextErrors);
    return !nextErrors.amount && !nextErrors.category && !nextErrors.date;
  };

  const onSave = async () => {
    if (!scope || !deviceId || !validate()) return;

    const now = new Date().toISOString();
    if (expenseId) {
      const existing = await ExpenseRepository.getByIdInScope(scope, expenseId);
      if (!existing) return;
      await ExpenseRepository.update({
        ...existing,
        amountCents,
        categoryId: categoryId!,
        description: description.trim() || null,
        expenseDate: dateKey,
        updatedAt: now,
        currency: preferredCurrency,
        dirty: scope.userId ? 1 : 0,
        version: existing.version + 1,
      });
    } else {
      await ExpenseRepository.create({
        id: await generateUUID(),
        amountCents,
        currency: preferredCurrency,
        categoryId: categoryId!,
        description: description.trim() || null,
        expenseDate: dateKey,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        dirty: scope.userId ? 1 : 0,
        version: 1,
        deviceId,
        ownerKey: scope.ownerKey,
        userId: scope.userId,
      });
    }

    navigation.goBack();
  };

  const onDelete = async () => {
    if (!scope || !expenseId) return;
    const existing = await ExpenseRepository.getByIdInScope(scope, expenseId);
    if (!existing) return;
    await ExpenseRepository.softDelete(existing, new Date().toISOString());
    navigation.goBack();
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (selected) setDateKey(formatDateKey(selected));
  };

  const onWebDateChange = (event: { target: { value: string } }) => {
    const selectedDateKey = event.target.value;
    if (parseDateKey(selectedDateKey)) {
      setDateKey(selectedDateKey);
    }
  };

  if (!scope || loading) return null;

  return (
    <AppScreen scroll>
      <ScreenHeader
        title={expenseId ? t("expense.editTitle") : t("expense.newTitle")}
        subtitle={t("expense.helper")}
        leftAction={{ kind: "close", onPress: () => navigation.goBack() }}
      />

      <AppCard>
        <AppInput
          label={t("common.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={errors.amount}
        />
        <AppInput
          label={t("common.description")}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>{t("common.category")}</Text>
        <View style={styles.chips}>
          {categories.map((category) => (
            <AppButton
              key={category.id}
              label={category.name}
              variant={category.id === categoryId ? "primary" : "secondary"}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
          <AppButton
            label={t("settings.categories")}
            variant="ghost"
            onPress={() => navigation.navigate("Categories")}
          />
        </View>
        {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

        <Text style={styles.label}>{t("common.date")}</Text>
        {Platform.OS === "web" ? (
          createElement("input", {
            "aria-label": t("common.date"),
            type: "date",
            value: dateKey,
            onChange: onWebDateChange,
            onInput: onWebDateChange,
            style: webDateInputStyle,
          })
        ) : (
          <Pressable onPress={() => setShowPicker(true)} style={styles.dateButton}>
            <Text style={styles.dateText}>{formatDate(dateKey)}</Text>
          </Pressable>
        )}
        {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}

        <View style={styles.actions}>
          {expenseId ? (
            <AppButton label={t("expense.deleteExpense")} variant="danger" onPress={onDelete} />
          ) : null}
          <AppButton
            label={expenseId ? t("expense.saveChanges") : t("expense.saveExpense")}
            onPress={onSave}
          />
        </View>
      </AppCard>

      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseDateKey(dateKey) ?? new Date()}
          mode="date"
          onChange={onDateChange}
        />
      ) : null}

      {showPicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <DateTimePicker
                value={parseDateKey(dateKey) ?? new Date()}
                mode="date"
                display="inline"
                onChange={onDateChange}
              />
              <AppButton label={t("common.done")} onPress={() => setShowPicker(false)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  error: {
    marginBottom: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger,
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
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
