import { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export function useSortableTable<K extends string>(defaultKey: K, defaultDirection: SortDirection = "asc") {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = useCallback(
    (key: K) => {
      if (sortKey === key) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDirection("asc");
      }
    },
    [sortKey],
  );

  const sortItems = useCallback(
    <T>(items: T[], comparators: Record<K, (a: T, b: T) => number>) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const compare = comparators[sortKey];
      if (!compare) return items;
      return [...items].sort((a, b) => compare(a, b) * direction);
    },
    [sortKey, sortDirection],
  );

  const indicator = useCallback(
    (key: K) => {
      if (sortKey !== key) return "↕";
      return sortDirection === "asc" ? "↑" : "↓";
    },
    [sortKey, sortDirection],
  );

  return { sortKey, sortDirection, toggleSort, sortItems, indicator };
}

export function useSortableData<T, K extends string>(
  items: T[],
  defaultKey: K,
  comparators: Record<K, (a: T, b: T) => number>,
  defaultDirection: SortDirection = "asc",
) {
  const { sortKey, sortDirection, toggleSort, indicator } = useSortableTable(defaultKey, defaultDirection);

  const sorted = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const compare = comparators[sortKey];
    if (!compare) return items;
    return [...items].sort((a, b) => compare(a, b) * direction);
  }, [items, sortKey, sortDirection, comparators]);

  return { sorted, toggleSort, indicator };
}
