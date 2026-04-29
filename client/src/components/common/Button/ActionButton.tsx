import type { MouseEventHandler, ComponentType } from "react";
import { Button } from "@/components/ui/button";

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ActionButtonProps {
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  size?: ButtonSize;
  form?: string;
}

const variantMap: Record<ButtonVariant, "default" | "outline" | "destructive" | "secondary" | "ghost" | "success"> = {
  primary: "default",
  secondary: "outline",
  danger: "destructive",
  success: "success",
  ghost: "ghost",
};

const sizeMap: Record<ButtonSize, "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

export default function ActionButton({
  label,
  onClick,
  icon: Icon,
  className = "",
  disabled = false,
  type = "button",
  variant = "primary",
  size = "md",
  form,
}: ActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      type={type}
      variant={variantMap[variant]}
      size={sizeMap[size]}
      disabled={disabled}
      className={className}
      form={form}
    >
      {Icon && <Icon className="size-4" />}
      {label}
    </Button>
  );
}
