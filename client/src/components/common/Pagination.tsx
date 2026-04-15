import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
  totalItems?: number;
  currentItems?: number;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalItems,
  currentItems,
}: PaginationProps) => {
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) end = 4;
    else if (currentPage >= totalPages - 2) start = totalPages - 3;

    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
      <div className="flex items-center gap-2 order-2 sm:order-1 text-sm text-muted-foreground">
        <span>Mostrar</span>
        <Select
          value={String(itemsPerPage)}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="w-16"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </Select>
        <span>por pagina</span>
        {totalItems != null && currentItems != null && (
          <span className="ml-1 text-muted-foreground/70">
            — Mostrando {currentItems} de {totalItems}
          </span>
        )}
      </div>

      <nav className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="size-8"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pageNumbers.map((number, index) =>
          number === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 py-1 text-sm text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={number}
              variant={currentPage === number ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(number as number)}
              className="min-w-8 h-8"
            >
              {number}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="size-8"
        >
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
};

export default Pagination;
