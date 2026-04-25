import { DEFAULT_CATEGORIES, normalizeCategoryName } from "../utils/categoryIdentity";

const KEYWORDS_BY_CATEGORY = new Map<string, string[]>([
  [
    "food",
    [
      "food",
      "pizza",
      "restaurant",
      "costco",
      "grocery",
      "groceries",
      "meal",
      "dining",
      "eating",
      "85c",
      "99 ranch",
    ],
  ],
  ["gas", ["gas", "fuel", "shell", "chevron", "exxon", "mobil", "76"]],
  ["transport", ["uber", "lyft", "bus", "train", "parking", "transit", "transport"]],
  ["housing", ["rent", "mortgage", "housing", "apartment", "lease"]],
  ["utilities", ["utility", "utilities", "electric", "water", "internet", "phone"]],
  ["healthcare", ["health", "doctor", "medical", "pharmacy", "dental", "kaiser"]],
  ["entertainment", ["movie", "cinema", "game", "netflix", "spotify", "entertainment"]],
  ["shopping", ["shopping", "amazon", "target", "walmart"]],
  ["subscription", ["subscription", "membership", "visible", "sim card"]],
  ["gift", ["gift", "present", "donation"]],
]);

export function inferDefaultCategoryName(text: string | null | undefined): string | null {
  const normalizedText = normalizeCategoryName(text ?? "");
  if (!normalizedText) return null;

  const defaultByNormalized = new Map(
    DEFAULT_CATEGORIES.map((name) => [normalizeCategoryName(name), name])
  );

  for (const [normalizedName, displayName] of defaultByNormalized.entries()) {
    if (normalizedText.includes(normalizedName)) {
      return displayName;
    }
  }

  for (const [normalizedName, keywords] of KEYWORDS_BY_CATEGORY.entries()) {
    if (keywords.some((keyword) => normalizedText.includes(keyword))) {
      return defaultByNormalized.get(normalizedName) ?? titleCaseCategory(normalizedName);
    }
  }

  return null;
}

function titleCaseCategory(normalizedName: string): string {
  return normalizedName
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
