import React, { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchButtonProps {
  searchTerm: string;
  onSearch: (value: string) => void;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  placeholder?: string;
  className?: string;
  hideButton?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function SearchButton({
  searchTerm,
  onSearch,
  onKeyPress,
  onSearchSubmit,
  placeholder = "Buscar...",
  hideButton = false,
  inputRef,
}: SearchButtonProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchSubmit();
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  return (
    <div className="flex items-center py-4 sm:max-w-full lg:max-w-xl gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              onSearchSubmit();
            }
            onKeyPress?.(e);
          }}
          ref={inputRef}
          className="pl-9"
        />
      </div>
      {!hideButton && (
        <Button onClick={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          onSearchSubmit();
        }}>
          <Search className="size-4" />
          Buscar
        </Button>
      )}
    </div>
  );
}
