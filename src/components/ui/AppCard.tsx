
import React, { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  shadow?: boolean;
}

const AppCard = forwardRef<HTMLDivElement, AppCardProps>(
  ({ children, className, shadow = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-border bg-card text-card-foreground',
          shadow && 'shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AppCard.displayName = 'AppCard';

const AppCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-4 border-b border-border', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AppCardHeader.displayName = 'AppCardHeader';

const AppCardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-lg font-semibold text-card-foreground', className)}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
AppCardTitle.displayName = 'AppCardTitle';

const AppCardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('mt-1 text-sm text-muted-foreground', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
AppCardDescription.displayName = 'AppCardDescription';

const AppCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('p-4', className)} {...props}>
        {children}
      </div>
    );
  }
);
AppCardContent.displayName = 'AppCardContent';

const AppCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-4 border-t border-border', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AppCardFooter.displayName = 'AppCardFooter';

export {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter,
};
