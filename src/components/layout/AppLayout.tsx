
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useTranslation } from '@/features/i18n/useTranslation';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const hasOpenedMobileSidebar = useRef(false);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    let rafId: number;
    if (mobileSidebarOpen) {
      hasOpenedMobileSidebar.current = true;
      rafId = requestAnimationFrame(() => {
        mobileSidebarRef.current?.focus();
      });
    } else {
      if (hasOpenedMobileSidebar.current) {
        mobileMenuButtonRef.current?.focus();
      }
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    const sidebar = mobileSidebarRef.current;
    if (!sidebar) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Tab') return;

  const focusableElements: HTMLElement[] = Array.from(
    sidebar.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) => element.offsetParent !== null && !element.hasAttribute('disabled'),
  );

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (document.activeElement === sidebar) {
    event.preventDefault();

    if (event.shiftKey) {
      lastElement.focus();
    } else {
      firstElement.focus();
    }

    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t('pages.shared.skipToMainContent')}
      </a>

      <div className="flex h-dvh min-w-0 overflow-hidden bg-background text-foreground">
        <Sidebar
          collapsed={desktopSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onToggle={() => setDesktopSidebarCollapsed((current) => !current)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          sidebarRef={mobileSidebarRef}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
  mobileSidebarOpen={mobileSidebarOpen}
  onOpenSidebar={() => setMobileSidebarOpen(true)}
  menuButtonRef={mobileMenuButtonRef}
/>

          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
