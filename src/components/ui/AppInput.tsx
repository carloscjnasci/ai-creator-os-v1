
import React, { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { type InputHTMLAttributes } from 'react';

export type AppInputVariant = 'default' | 'success' | 'warning' | 'error';
export type AppInputSize = 'sm' | 'md' | 'lg';

export interface AppInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  variant?: AppInputVariant;
  inputSize?: AppInputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

export const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>((props, ref) => {
  const {
    label,
    helperText,
    errorMessage,
    variant = 'default',
    inputSize = 'md',
    leftIcon,
    rightIcon,
    fullWidth = false,
    required = false,
    disabled = false,
    readOnly = false,
    id,
    type,
    className,
    ...rest
  } = props;

  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = variant === 'error' || Boolean(errorMessage);

  const descriptionId = errorMessage ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;

  return (
    <div className={cn(fullWidth ? 'w-full' : 'w-auto', className)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium leading-6 text-foreground">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <div className="relative mt-2">
        {leftIcon && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-muted-foreground">
            {leftIcon}
          </div>
        )}

        <input
          {...rest}
          id={inputId}
          ref={ref}
          type={type}
          aria-describedby={descriptionId}
          aria-invalid={hasError || undefined}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            'block w-full rounded-md border bg-background text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 read-only:bg-muted/30',
            variant === 'default' && 'border-input',
            variant === 'success' && 'border-success focus-visible:ring-success focus-visible:border-success',
            variant === 'warning' && 'border-warning focus-visible:ring-warning focus-visible:border-warning',
            (variant === 'error' || errorMessage) &&
              'border-destructive focus-visible:ring-destructive focus-visible:border-destructive',
            inputSize === 'sm' && 'py-1 px-2 text-sm',
            inputSize === 'md' && 'py-2 px-3 text-base',
            inputSize === 'lg' && 'py-3 px-4 text-lg',
            Boolean(leftIcon) && 'pl-8',
            Boolean(rightIcon) && 'pr-8'
          )}
        />

        {rightIcon && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>

      {errorMessage ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

AppInput.displayName = 'AppInput';

export default AppInput;
