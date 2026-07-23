
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, User, Globe } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/features/i18n/useTranslation';

import type { RefObject } from 'react';

interface TopbarProps {
  mobileSidebarOpen: boolean;
  onOpenSidebar: () => void;
  menuButtonRef: RefObject<HTMLButtonElement>;
}

const Topbar: React.FC<TopbarProps> = ({
  mobileSidebarOpen,
  onOpenSidebar,
  menuButtonRef,
}) => {
  const { setTheme, resolvedTheme } = useTheme();
  const { locale, changeLocale, t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return t('navigation.dashboard');
    if (path.startsWith('/ai-director')) return t('navigation.aiDirector');
    if (path.startsWith('/research')) return t('navigation.researchHub');
    if (path.startsWith('/viral-analyzer')) return t('navigation.viralAnalyzer');
    if (path.startsWith('/campaign-builder')) return t('navigation.campaignBuilder');
    if (path.startsWith('/execution-center')) return t('navigation.executionCenter');
    if (path.startsWith('/provider-gateway')) return t('navigation.providerGateway');
    if (path.startsWith('/publishing-hub')) return t('navigation.publishingHub');
    if (path.startsWith('/campaigns')) return t('navigation.campaigns');
    if (path.startsWith('/digital-humans')) return t('navigation.digitalHumans');
    if (path.startsWith('/characters')) return t('navigation.characters');
    if (path.startsWith('/products')) return t('navigation.products');
    if (path.startsWith('/wardrobe')) return t('navigation.wardrobe');
    if (path.startsWith('/scenes')) return t('navigation.scenes');
    if (path.startsWith('/poses')) return t('navigation.poses');
    if (path.startsWith('/prompt-intelligence')) return t('navigation.promptIntelligence');
    if (path.startsWith('/prompt-engine')) return t('navigation.promptEngine');
    if (path.startsWith('/creative-library')) return t('navigation.creativeLibrary');
    if (path.startsWith('/asset-pipeline')) return t('navigation.assetPipeline');
    if (path.startsWith('/analytics-feedback-loop')) return t('navigation.analyticsFeedbackLoop');
    if (path.startsWith('/analytics')) return t('navigation.analytics');
    if (path.startsWith('/experimentation')) return t('navigation.experimentation');
    if (path.startsWith('/creative-recipes')) return t('navigation.creativeRecipes');
    if (path.startsWith('/settings')) return t('navigation.settings');
    return t('navigation.dashboard'); // Default fallback
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur transition-colors md:px-6">
      <div className="flex items-center gap-2">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={t('common.openMenu')}
          aria-controls="primary-navigation"
          aria-expanded={mobileSidebarOpen}
          className="mr-2 inline-flex items-center rounded-md p-2 text-foreground hover:bg-muted md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={onOpenSidebar}
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Compact Language Selector */}
        <div className="flex items-center gap-1.5 mr-1">
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="topbar-locale-select" className="sr-only">
            {t('settings.languageSelectorLabel')}
          </label>
          <select
            id="topbar-locale-select"
            value={locale}
            onChange={(e) => changeLocale(e.target.value as any)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="pt-BR">PT</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </div>

        <button
          type="button"
          aria-label={resolvedTheme === 'light' ? t('common.switchToDark') : t('common.switchToLight')}
          onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
          className="rounded-md p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {mounted ? (
            resolvedTheme === 'light' ? (
              <Moon className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Sun className="h-6 w-6" aria-hidden="true" />
            )
          ) : (
            <span className="inline-block h-6 w-6" />
          )}
        </button>

        <div className="flex items-center">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <User className="h-5 w-5" />
          </div>
          <span className="sr-only">{t('common.currentUser')}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
