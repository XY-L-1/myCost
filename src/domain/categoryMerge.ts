export type MergeableCategory = {
  id: string;
  name: string;
  normalizedName?: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function categoryIdentityKey(
  category: Pick<MergeableCategory, "name" | "normalizedName">
): string {
  return (category.normalizedName ?? category.name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function preferCategoryRecord<T extends MergeableCategory>(a: T, b: T): T {
  const activeDiff = Number(!!a.deletedAt) - Number(!!b.deletedAt);
  if (activeDiff !== 0) {
    return activeDiff < 0 ? a : b;
  }

  const updatedDiff =
    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  if (updatedDiff !== 0) {
    return updatedDiff > 0 ? a : b;
  }

  const createdDiff =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) {
    return createdDiff < 0 ? a : b;
  }

  return a.id <= b.id ? a : b;
}

export function collapseCategoriesByIdentity<T extends MergeableCategory>(
  categories: T[],
  options: { includeArchived?: boolean } = {}
): T[] {
  const groups = new Map<string, T[]>();

  categories.forEach((category) => {
    const key = categoryIdentityKey(category);
    const group = groups.get(key) ?? [];
    group.push(category);
    groups.set(key, group);
  });

  const collapsed: T[] = [];

  groups.forEach((group) => {
    const active = group.filter((category) => !category.deletedAt);
    if (active.length > 0) {
      collapsed.push(active.reduce(preferCategoryRecord));
      return;
    }

    if (options.includeArchived) {
      collapsed.push(group.reduce(preferCategoryRecord));
    }
  });

  return collapsed.sort((a, b) => {
    const deletedRank = Number(!!a.deletedAt) - Number(!!b.deletedAt);
    if (deletedRank !== 0) return deletedRank;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
