"use client";

import React, { useState, useMemo, useId, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "./Shimmer";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Column<T> {
  /** Unique key, used for sorting. */
  key: keyof T & string;
  /** Column header label. */
  header: string;
  /** Custom cell renderer. Defaults to `String(row[key])`. */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Whether this column is sortable. Defaults to true. */
  sortable?: boolean;
  /** Tailwind class(es) to apply to all cells in this column. */
  cellClassName?: string;
  /** Tailwind class(es) for the header cell only. */
  headerClassName?: string;
}

type SortDir = "asc" | "desc" | "none";

interface SortState {
  key: string;
  dir: SortDir;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export interface DataTableProps<T> {
  /** Column definitions. */
  columns: Column<T>[];
  /** Row data. */
  data: T[];
  /** Unique row identifier. */
  rowKey: keyof T;
  /** Show the search/filter bar. Default true. */
  searchable?: boolean;
  /** Keys to search across. Defaults to all string/number columns. */
  searchKeys?: (keyof T)[];
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Initial page size. */
  defaultPageSize?: number;
  /** Accessible label for the table. */
  caption?: string;
  className?: string;
  /** Rendered when the filtered result set is empty. */
  emptyState?: React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sortData<T>(data: T[], sort: SortState): T[] {
  if (sort.dir === "none") return data;
  return [...data].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort.key];
    const bv = (b as Record<string, unknown>)[sort.key];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function filterData<T>(data: T[], query: string, keys: (keyof T)[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return data;
  return data.filter((row) =>
    keys.some((k) => String((row as Record<string, unknown>)[k as string] ?? "").toLowerCase().includes(q))
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  searchable = true,
  searchKeys,
  searchPlaceholder = "Search…",
  defaultPageSize = 10,
  caption,
  className,
  emptyState,
}: DataTableProps<T>) {
  const tableId = useId();
  const captionId = `${tableId}-caption`;

  const effectiveSearchKeys =
    searchKeys ??
    (columns
      .filter((c) => c.sortable !== false)
      .map((c) => c.key) as (keyof T)[]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "", dir: "none" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);

  const filtered = useMemo(
    () => filterData(data, query, effectiveSearchKeys),
    [data, query, effectiveSearchKeys]
  );

  const sorted = useMemo(() => sortData(filtered, sort), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const handleSort = useCallback(
    (key: string) => {
      setSort((prev) => {
        if (prev.key !== key) return { key, dir: "asc" };
        if (prev.dir === "asc") return { key, dir: "desc" };
        return { key: "", dir: "none" };
      });
      setPage(1);
    },
    []
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  }, []);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sort.key !== colKey)
      return <ChevronsUpDown size={13} className="opacity-40" />;
    return sort.dir === "asc" ? (
      <ChevronUp size={13} className="text-primary-400" />
    ) : (
      <ChevronDown size={13} className="text-primary-400" />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            aria-label={`Filter ${caption ?? "table"}`}
            className={cn(
              "w-full pl-9 pr-4 py-2.5 rounded-xl text-sm",
              "bg-white/5 border border-white/10",
              "text-gray-200 placeholder:text-gray-600",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60",
              "transition-colors"
            )}
          />
        </div>
      )}

      {/* Table wrapper */}
      <div className="card overflow-x-auto p-0">
        <table
          className="w-full text-sm"
          aria-labelledby={caption ? captionId : undefined}
        >
          {caption && (
            <caption id={captionId} className="sr-only">
              {caption}
            </caption>
          )}

          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => {
                const isSorted = sort.key === col.key;
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                      sortable && "cursor-pointer select-none hover:text-white transition-colors",
                      isSorted && "text-primary-400",
                      col.headerClassName
                    )}
                    onClick={sortable ? () => handleSort(col.key) : undefined}
                    aria-sort={
                      isSorted
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {sortable && <SortIcon colKey={col.key} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm text-gray-500"
                >
                  {emptyState ?? (
                    <span>
                      {query ? `No results for "${query}"` : "No data available"}
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={String((row as Record<string, unknown>)[rowKey as string])}
                  className={cn(
                    "border-b border-white/5 last:border-0 transition-colors",
                    "hover:bg-white/3",
                    i % 2 === 0 ? "" : "bg-white/1"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-4 text-gray-300",
                        col.cellClassName
                      )}
                    >
                      {col.render
                        ? col.render(
                            (row as Record<string, unknown>)[col.key] as T[keyof T],
                            row
                          )
                        : String(
                            (row as Record<string, unknown>)[col.key] ?? ""
                          )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
        {/* Row count + page size */}
        <div className="flex items-center gap-3">
          <span>
            {sorted.length === 0
              ? "No results"
              : `${(safePage - 1) * pageSize + 1}–${Math.min(
                  safePage * pageSize,
                  sorted.length
                )} of ${sorted.length}`}
          </span>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Page buttons */}
        <nav aria-label="Table pagination" className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              safePage === 1
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-white/10 hover:text-white"
            )}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page number pills */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) =>
                p === 1 ||
                p === totalPages ||
                Math.abs(p - safePage) <= 1
            )
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                acc.push("…");
              }
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "…" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-gray-600">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  aria-label={`Page ${p}`}
                  aria-current={safePage === p ? "page" : undefined}
                  className={cn(
                    "min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors",
                    safePage === p
                      ? "bg-primary-600 text-white"
                      : "hover:bg-white/10 hover:text-white"
                  )}
                >
                  {p}
                </button>
              )
            )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              safePage === totalPages
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-white/10 hover:text-white"
            )}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      </div>
    </div>
  );
}
