import { useState } from "react";
import {
  Pencil,
  Trash2,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataTableRow {
  id: string | number;
  [key: string]: unknown;
}

interface DataTableColumn<T extends DataTableRow> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  status?: boolean;
}

interface DataTableProps<T extends DataTableRow> {
  columns: DataTableColumn<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T, e?: React.MouseEvent) => void;
  onViewCredit?: (item: T) => void;
  emptyMessage?: string;
  actions?: boolean;
  customActions?: (item: T) => React.ReactNode;
  getStatusColor?: (status: unknown) => string;
  getStatusText?: (status: unknown) => string;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

function DataTable<T extends DataTableRow>({
  columns,
  data,
  onEdit,
  onDelete,
  onViewCredit,
  emptyMessage = "No se encontraron registros",
  actions = true,
  customActions,
  getStatusColor,
  getStatusText,
  sortKey,
  sortOrder,
  onSort,
}: DataTableProps<T>) {
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortOrder, setLocalSortOrder] = useState<"asc" | "desc">("asc");

  const sortedData =
    !onSort && localSortKey
      ? [...data].sort((a, b) => {
          const aValue = a[localSortKey];
          const bValue = b[localSortKey];
          if (aValue == null) return 1;
          if (bValue == null) return -1;
          if (aValue === bValue) return 0;
          return localSortOrder === "asc"
            ? aValue > bValue ? 1 : -1
            : aValue < bValue ? 1 : -1;
        })
      : data;

  const activeKey = onSort ? sortKey : localSortKey;
  const activeOrder = onSort ? sortOrder : localSortOrder;

  function handleSort(key: string) {
    if (onSort) {
      onSort(key, sortKey === key && sortOrder === "asc" ? "desc" : "asc");
    } else {
      if (localSortKey === key) {
        setLocalSortOrder(localSortOrder === "asc" ? "desc" : "asc");
      } else {
        setLocalSortKey(key);
        setLocalSortOrder("asc");
      }
    }
  }

  function SortIcon({ columnKey }: { columnKey: string }) {
    if (activeKey !== columnKey) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/40" />;
    }
    return activeOrder === "asc" ? (
      <ArrowUp className="size-3.5 text-primary" />
    ) : (
      <ArrowDown className="size-3.5 text-primary" />
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:bg-muted transition-colors"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {column.label}
                    <SortIcon columnKey={column.key} />
                  </div>
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((item) => (
              <tr
                key={item.id}
                className="bg-background hover:bg-muted/30 transition-colors"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-foreground">
                    {column.render ? (
                      column.render(item)
                    ) : column.status ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 rounded-full ${
                            getStatusColor?.(item[column.key]) || "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-sm">
                          {getStatusText?.(item[column.key]) ||
                            String(item[column.key])}
                        </span>
                      </div>
                    ) : (
                      String(item[column.key])
                    )}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3">
                    {customActions ? (
                      customActions(item)
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(item)}
                            title="Editar"
                            className="size-8 text-primary hover:text-primary"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {onViewCredit && item.VentaTipo === "CR" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewCredit(item)}
                            title="Ver Detalles de Credito"
                            className="size-8 text-emerald-600 hover:text-emerald-600"
                          >
                            <CreditCard className="size-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item, e);
                            }}
                            title="Eliminar"
                            className="size-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="size-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

export default DataTable;
