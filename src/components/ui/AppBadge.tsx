import React, { forwardRef, ReactNode, KeyboardEvent } from "react";
import { cva, VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import { cn } from "@/lib/utils/cn";
import { LucideX } from "lucide-react";
import { useTranslation } from "@/features/i18n/useTranslation";

const badgeVariants = cva(
  "inline-flex items-center font-medium select-none transition-colors text-sm",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        danger: "bg-destructive text-destructive-foreground",
        info: "bg-info text-info-foreground",
        outline:
          "bg-transparent border border-border text-foreground",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-3 py-0.5",
        lg: "text-base px-4 py-1",
      },
      radius: {
        default: "rounded-md",
        rounded: "rounded-lg",
        pill: "rounded-full",
        none: "rounded-none",
      },
      loading: {
        true: "opacity-70 cursor-wait",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
      },
      clickable: {
        true: "cursor-pointer hover:bg-muted/70",
      },
    },
    compoundVariants: [
      { variant: "outline", radius: "pill", className: "rounded-full" },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      radius: "default",
    },
  }
);

export interface AppBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  uppercase?: boolean;
  truncate?: boolean;
  tooltip?: string;
  ariaLabel?: string;
  clickable?: boolean;
  loading?: boolean;
  tabIndex?: number;
}

export const AppBadge = forwardRef<HTMLSpanElement, AppBadgeProps>(
  (
    {
      variant,
      size,
      radius,
      leftIcon,
      rightIcon,
      removable = false,
      onRemove,
      uppercase = false,
      truncate = false,
      tooltip,
      ariaLabel,
      clickable = false,
      loading = false,
      className,
      tabIndex,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const handleRemoveKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        onRemove?.();
      }
    };

    return (
      <span
        {...props}
        ref={ref}
        className={cn(
          badgeVariants({ variant, size, radius, loading, disabled, clickable }),
          uppercase && "uppercase tracking-wide",
          truncate && "truncate",
          className
        )}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        title={tooltip}
        aria-disabled={disabled || loading}
      >
        {leftIcon && (
          <span className="mr-1 flex items-center pointer-events-none text-inherit" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <span>{children}</span>

        {rightIcon && !removable && (
          <span className="ml-1 flex items-center pointer-events-none text-inherit" aria-hidden="true">
            {rightIcon}
          </span>
        )}

        {removable && !disabled && !loading && (
          <button
            type="button"
            aria-label={t('pages.shared.removeBadge')}
            onClick={onRemove}
            onKeyDown={handleRemoveKeyDown}
            tabIndex={0}
            className={cn(
              "ml-2 inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary",
              variant === "outline" ? "text-foreground" : "text-primary-foreground"
            )}
          >
            <LucideX className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }
);

AppBadge.displayName = "AppBadge";

export default AppBadge;
