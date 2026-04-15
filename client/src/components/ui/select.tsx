import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        "inline-flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground appearance-none bg-[length:16px_16px] bg-[right_4px_center] bg-no-repeat pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer",
        className
      )}
      ref={ref}
      {...props}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        ...props.style,
      }}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };
