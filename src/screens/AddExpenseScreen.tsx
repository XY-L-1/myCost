import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as SecureStore from "expo-secure-store";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { generateUUID } from "../utils/uuid";
import { useAuthStore } from "../auth/authStore";
import type { Category } from "../types/category";
import type { RootStackParamList } from "../navigation/RootNavigator";

type ExpensesNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddExpenseModal"
>;

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  border: "#E6DDD1",
  chip: "#EFE6DA",
  danger: "#C1453C",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

function formatDateKey(date: Date) {
  // Use local calendar values to avoid timezone shift.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AddExpenseScreen() {
  const auth = useAuthStore();
  const navigation = useNavigation<ExpensesNavProp>();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }, [amount]);

  const canSave = amountCents > 0 && categoryId && !!deviceId;

  useEffect(() => {
    // Entrance animation for a polished first impression.
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide, scale]);

  useEffect(() => {
    // Device id is created during app init; read it here for local inserts.
    SecureStore.getItemAsync("deviceId").then(setDeviceId);
  }, []);

  useEffect(() => {
    loadCategories(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset the form whenever the screen is focused.
      setAmount("");
      setDescription("");
      setExpenseDate(new Date());
      setShowDatePicker(false);
      setShowCategoryInput(false);
      setNewCategoryName("");
      setSaving(false);

      // Reload categories and force default selection.
      loadCategories(true);
    }, [])
  );

  async function loadCategories(forceDefault: boolean) {
    const cats = await CategoryRepository.getAll();
    setCategories(cats);
    if (cats.length === 0) {
      setCategoryId(null);
      return;
    }

    if (forceDefault) {
      setCategoryId(cats[0].id);
      return;
    }

    if (!categoryId) {
      setCategoryId(cats[0].id);
    }
  }

  async function onSave() {
    if (!canSave || saving || !categoryId || !deviceId) return;
    setSaving(true);

    const now = new Date().toISOString();
    const id = await generateUUID();

    await ExpenseRepository.create({
      id,
      userId: auth.user?.id ?? null,
      amountCents,
      currency: "USD",
      categoryId,
      description: description.trim() || null,
      expenseDate: formatDateKey(expenseDate),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
      version: 1,
      deviceId,
    });

    setSaving(false);
    navigation.goBack();
  }

  async function onCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed || creatingCategory || !deviceId) return;

    const existing = categories.find(
      (cat) => cat.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      setCategoryId(existing.id);
      setNewCategoryName("");
      setShowCategoryInput(false);
      return;
    }

    setCreatingCategory(true);
    const now = new Date().toISOString();
    const id = await generateUUID();

    await CategoryRepository.insert({
      id,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
      version: 1,
      deviceId,
      userId: auth.user?.id ?? null,
    });

    await loadCategories(true);
    setCategoryId(id);
    setNewCategoryName("");
    setShowCategoryInput(false);
    setCreatingCategory(false);
  }

  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    // Close the Android picker after selection/dismiss.
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed") return;
    if (selected) {
      // Keep the selected date in state so the UI updates immediately.
      setExpenseDate(selected);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fade,
              transform: [{ translateY: slide }, { scale }],
            }}
          >
            <Text style={styles.headerLabel}>New Expense</Text>
            <Text style={styles.headerTitle}>Capture it fast.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.muted}
                style={styles.amountInput}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Coffee, groceries, rent"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.chipWrap}>
                {categories.map((cat) => {
                  const selected = cat.id === categoryId;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(cat.id)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setShowCategoryInput((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.chipAdd,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.chipAddText}>+ New</Text>
                </Pressable>
              </View>

              {showCategoryInput ? (
                <View style={styles.newCategoryRow}>
                  <TextInput
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder="New category name"
                    placeholderTextColor={COLORS.muted}
                    style={styles.newCategoryInput}
                  />
                  <Pressable
                    onPress={onCreateCategory}
                    style={({ pressed }) => [
                      styles.newCategoryButton,
                      pressed && styles.primaryPressed,
                    ]}
                  >
                    <Text style={styles.newCategoryButtonText}>
                      {creatingCategory ? "Adding..." : "Add"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.label}>Date</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [
                  styles.dateRow,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.dateText}>{formatDateLabel(expenseDate)}</Text>
                <Text style={styles.dateAction}>Pick date</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onSave}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                styles.primaryButton,
                (!canSave || saving) && styles.primaryDisabled,
                pressed && canSave && styles.primaryPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save Expense"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={expenseDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}

      {showDatePicker && Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select date</Text>
              <DateTimePicker
                value={expenseDate}
                mode="date"
                display="inline"
                onChange={handleDateChange}
              />
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.primaryPressed,
                ]}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  headerLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  headerTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    color: COLORS.text,
    marginBottom: 18,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: COLORS.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    color: COLORS.text,
    backgroundColor: "#FFF",
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: "#FFF",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.text,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.text,
  },
  chipTextSelected: {
    color: "#FFF",
  },
  chipAdd: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipAddText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.muted,
  },
  newCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  newCategoryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "#FFF",
  },
  newCategoryButton: {
    marginLeft: 8,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  newCategoryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: "#FFF",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFF",
  },
  rowPressed: {
    opacity: 0.85,
  },
  dateText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
  },
  dateAction: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLORS.accent,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryDisabled: {
    backgroundColor: "#B7C6BE",
  },
  primaryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: "#FFF",
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 12,
  },
  modalButton: {
    marginTop: 12,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: "#FFF",
  },
});
