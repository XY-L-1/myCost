import { v5 as uuidv5 } from "uuid";
import { GUEST_OWNER_KEY } from "../domain/dataScope";

export const DEFAULT_CATEGORIES = [
  "Food",
  "Gas",
  "Gift",
  "Transport",
  "Shopping",
  "Entertainment",
  "Housing",
  "Utilities",
  "Healthcare",
  "Other",
];

const DEFAULT_CATEGORY_NAMESPACE = "3f25e2f0-77d5-4e91-9fd0-7b5f1b2b3c9a";

export function normalizeCategoryName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function deterministicCategoryId(userId: string, name: string) {
  const normalized = normalizeCategoryName(name);
  return uuidv5(`${userId}:${normalized}`, DEFAULT_CATEGORY_NAMESPACE);
}

export function deterministicGuestCategoryId(name: string) {
  return `${GUEST_OWNER_KEY}:${normalizeCategoryName(name)}`;
}
