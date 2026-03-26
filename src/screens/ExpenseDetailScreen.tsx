import { useEffect, useMemo, useRef, useState } from "react";
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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { useSyncGate } from "../state/syncGateContext";
import type { Category } from "../types/category";
import type { ExpensesStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

const COLORS = {
  background: "#F5F1EB",
  card: "#FFF9F2",
  text: "#1E1A16",
  muted: "#6B6259",
  accent: "#2F6B4F",
  danger: "#C1453C",
  border: "#E6DDD1",
  chip: "#EFE6DA",
};

const FONT_DISPLAY = Platform.select({ ios: "Avenir Next", android: "serif" });
const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ExpenseDetailScreen({ navigation, route }: Props) {
  const { categoriesStatus, categoriesRevision } = useSyncGate();
  const expense = route.params.expense;

  console.log("[UI] ExpenseDetailScreen render", {
    categoriesStatus,
    categoriesRevision,
  });

  const [amount, setAmount] = useState(
    (expense.amountCents / 100).toFixed(2)
  );
  const [description, setDescription] = useState(expense.description ?? "");
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [expenseDate, setExpenseDate] = useState(expense.expenseDate);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;
  const deleteAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    CategoryRepository.getAll().then(setCategories);
  }, [categoriesStatus, categoriesRevision]);

  useEffect(() => {
    // Slide the form in for a clear edit state.
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
    ]).start();
  }, [fade, slide]);

  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }, [amount]);

  const isValid = amountCents > 0 && categoryId && expenseDate.length >= 10;

  async function onSave() {
    if (!isValid || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const trimmedDescription = description.trim();

    await ExpenseRepository.update({
      ...expense,
      amountCents,
      description: trimmedDescription.length ? trimmedDescription : null,
      categoryId,
      expenseDate,
      updatedAt: now,
      dirty: 1,
      version: expense.version + 1,
    });

    setSaving(false);
    navigation.goBack();
  }

  function openDelete() {
    setDeleteVisible(true);
    Animated.timing(deleteAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }

  function closeDelete() {
    Animated.timing(deleteAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setDeleteVisible(false));
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    const now = new Date().toISOString();
    await ExpenseRepository.softDelete(expense.id, now);
    setDeleting(false);
    closeDelete();
    navigation.goBack();
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
              transform: [{ translateY: slide }],
            }}
          >
            <Text style={styles.title}>Edit Expense</Text>
            <Text style={styles.subtitle}>Update details and keep it synced.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Coffee, lunch, subscription"
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
              </View>

              <Text style={styles.label}>Date</Text>
              <TextInput
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />
              <View style={styles.quickRow}>
                <Pressable
                  onPress={() => setExpenseDate(formatISODate(new Date()))}
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.quickText}>Today</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setExpenseDate(
                      formatISODate(new Date(Date.now() - 24 * 60 * 60 * 1000))
                    )
                  }
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.quickText}>Yesterday</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={onSave}
              disabled={!isValid || saving}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isValid || saving) && styles.primaryButtonDisabled,
                pressed && isValid && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>

            <Pressable
              onPress={openDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>Delete Expense</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteVisible}
        transparent
        animationType="none"
        onRequestClose={closeDelete}
      >
        <Pressable onPress={closeDelete} style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.modalOverlay,
              {
                opacity: deleteAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.modalSheet,
            {
              transform: [
                {
                  translateY: deleteAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
              opacity: deleteAnim,
            },
          ]}
        >
          <Text style={styles.modalTitle}>Delete this expense?</Text>
          <Text style={styles.modalBody}>
            This will remove it from your list and mark it for sync.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeDelete}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && styles.modalButtonPressed,
              ]}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.modalButtonDanger,
                pressed && styles.modalButtonPressed,
              ]}
            >
              <Text style={styles.modalButtonTextDanger}>
                {deleting ? "Deleting..." : "Delete"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
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
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: COLORS.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT_BODY,
    fontSize: 16,
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
  quickRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  quickChip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  quickText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.text,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonDisabled: {
    backgroundColor: "#B7C6BE",
  },
  primaryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: "#FFF",
    letterSpacing: 0.3,
  },
  deleteButton: {
    marginTop: 14,
    alignItems: "center",
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
  deleteButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.danger,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
    marginBottom: 8,
  },
  modalBody: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 8,
  },
  modalButtonDanger: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  modalButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
  },
  modalButtonTextDanger: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: "#FFF",
  },
});
