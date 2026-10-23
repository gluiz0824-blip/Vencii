"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortDirection = "ascending" | "descending";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  filterValue?: (row: T) => string;
  sortValue?: (row: T) => string | number | Date | null;
  align?: "start" | "end";
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  filterPlaceholder?: string;
  pageSize?: number;
  emptyState?: ReactNode;
  caption?: string;
}

function compareValues(
  left: string | number | Date | null,
  right: string | number | Date | null,
): number {
  if (left === null) return 1;
  if (right === null) return -1;
  const normalizedLeft = left instanceof Date ? left.getTime() : left;
  const normalizedRight = right instanceof Date ? right.getTime() : right;

  if (
    typeof normalizedLeft === "string" &&
    typeof normalizedRight === "string"
  ) {
    return normalizedLeft.localeCompare(normalizedRight, "pt-BR", {
      sensitivity: "base",
      numeric: true,
    });
  }

  return Number(normalizedLeft) - Number(normalizedRight);
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  filterPlaceholder = "Filtrar resultados…",
  pageSize = 10,
  emptyState,
  caption = "Tabela de resultados",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{
    id: string;
    direction: SortDirection;
  } | null>(null);

  const processedRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = normalizedQuery
      ? data.filter((row) =>
          columns.some((column) =>
            column
              .filterValue?.(row)
              .toLocaleLowerCase("pt-BR")
              .includes(normalizedQuery),
          ),
        )
      : data;

    if (!sort) return filtered;
    const column = columns.find(({ id }) => id === sort.id);
    if (!column?.sortValue) return filtered;

    return [...filtered].sort((left, right) => {
      const comparison = compareValues(
        column.sortValue!(left),
        column.sortValue!(right),
      );
      return sort.direction === "ascending" ? comparison : -comparison;
    });
  }, [columns, data, query, sort]);

  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = processedRows.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    setPage(0);
    setSort((current) => {
      if (current?.id !== column.id) {
        return { id: column.id, direction: "ascending" };
      }
      return {
        id: column.id,
        direction:
          current.direction === "ascending" ? "descending" : "ascending",
      };
    });
  }

  return (
    <div className="bg-card shadow-card overflow-hidden rounded-xl border">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            className="ps-9"
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
          />
        </div>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {processedRows.length}{" "}
          {processedRows.length === 1 ? "resultado" : "resultados"}
        </p>
      </div>

      {visibleRows.length > 0 ? (
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const direction =
                  sort?.id === column.id ? sort.direction : undefined;
                const SortIcon =
                  direction === "ascending"
                    ? ArrowUp
                    : direction === "descending"
                      ? ArrowDown
                      : ArrowUpDown;

                return (
                  <TableHead
                    key={column.id}
                    aria-sort={direction ?? "none"}
                    className={cn(column.align === "end" && "text-end")}
                  >
                    {column.sortValue ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "-mx-2 text-xs",
                          column.align === "end" && "ms-auto",
                        )}
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        <SortIcon aria-hidden="true" />
                      </Button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(column.align === "end" && "text-end")}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="px-5 py-12 text-center">
          {data.length === 0 && emptyState ? (
            emptyState
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum resultado corresponde aos filtros.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
        <p className="text-muted-foreground text-xs">
          Página {currentPage + 1} de {pageCount}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={currentPage === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              setPage((current) => Math.min(pageCount - 1, current + 1))
            }
            disabled={currentPage >= pageCount - 1}
            aria-label="Próxima página"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
