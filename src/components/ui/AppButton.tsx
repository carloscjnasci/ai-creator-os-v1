
import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  rounded?: boolean;
  children: ReactNode;
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>((props, ref) => {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    rounded = true,
    children,
    className,
    type = 'button',
    ...rest
  } = props;

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading ? 'true' : undefined}
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'outline' && 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        variant === 'ghost' && 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-base',
        size === 'lg' && 'px-5 py-3 text-lg',
        fullWidth && 'w-full',
        rounded ? 'rounded-md' : 'rounded-none',
        className
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {leftIcon && (
        <span aria-hidden="true" className="mr-2 flex items-center">
          {leftIcon}
        </span>
      )}
      <span>{children}</span>
      {rightIcon && (
        <span aria-hidden="true" className="ml-2 flex items-center">
          {rightIcon}
        </span>
      )}
    </button>
  );
});

AppButton.displayName = 'AppButton';

export default AppButton;

