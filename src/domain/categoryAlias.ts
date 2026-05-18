import { categoryIdentityKey, preferCategoryRecord } from "./categoryMerge";

export type CategoryAliasSource = {
  id: string;
  name: string;
  normalizedName?: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function buildCategoryAliasMap<T extends CategoryAliasSource>(
  categories: T[]
): Map<string, string> {
  const groups = new Map<string, T[]>();

  categories.forEach((category) => {
    const key = categoryIdentityKey(category);
    const group = groups.get(key) ?? [];
    group.push(category);
    groups.set(key, group);
  });

  const aliases = new Map<string, string>();
  groups.forEach((group) => {
    const canonical = group.reduce(preferCategoryRecord);
    group.forEach((category) => {
      aliases.set(category.id, canonical.id);
    });
  });

  return aliases;
}
