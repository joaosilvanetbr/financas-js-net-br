import { useState, useCallback } from "react";

type SortDirection = "asc" | "desc";

export function useSort<K extends string>(defaultKey: K, defaultDirection: SortDirection = "asc") {
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

  const sorted = useCallback(
    <T>(items: T[], compareFn: (a: T, b: T) => number) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      return [...items].sort((a, b) => compareFn(a, b) * direction);
    },
    [sortDirection],
  );

  const indicator = useCallback(
    (key: K) => {
      if (sortKey !== key) return "↕";
      return sortDirection === "asc" ? "↑" : "↓";
    },
    [sortKey, sortDirection],
  );

  return { sortKey, sortDirection, toggleSort, sorted, indicator };
}
