import React from 'react';

interface AppTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  placeholder?: string;
  error?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
}

export const AppTextarea: React.FC<AppTextareaProps> = ({
  label,
  placeholder,
  error,
  description,
  disabled = false,
  required = false,
  id,
  ...props
}) => {
  const textareaId = id || `textarea_${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={textareaId} className="mb-1 font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        placeholder={placeholder}
        className={`rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        {...props}
      />
      {description && !error && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {error && (
        <p id={`${textareaId}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default AppTextarea;
