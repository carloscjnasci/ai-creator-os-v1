
import React, { useEffect, useRef, useId, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/features/i18n';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export const AppModal: React.FC<AppModalProps> = ({ isOpen, onClose, title, children }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Save last focused element
    lastFocusedElementRef.current = document.activeElement as HTMLElement;

    // Focus modal container
    dialogRef.current?.focus();

    // Lock scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      // Restore scroll
      document.body.style.overflow = originalOverflow;

      // Remove event listener
      document.removeEventListener('keydown', onKeyDown);

      // Restore focus
      if (lastFocusedElementRef.current && lastFocusedElementRef.current.focus) {
        lastFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ariaLabelProps = title
    ? { 'aria-labelledby': titleId }
    : { 'aria-label': t('pages.shared.dialog') };

  const onBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        {...ariaLabelProps}
        className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        {title && <h2 id={titleId} className="text-lg font-semibold">{title}</h2>}
        <button
          type="button"
          aria-label={t('pages.shared.closeDialog')}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X aria-hidden="true" />
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default AppModal;
