
import React, { useState, useEffect, useId, useRef, KeyboardEvent } from 'react';
import { useTranslation } from '@/features/i18n/useTranslation';

export interface AppTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface AppTabsProps {
  tabs: AppTab[];
  defaultTabId?: string;
}

export const AppTabs: React.FC<AppTabsProps> = ({ tabs, defaultTabId }) => {
  const { t } = useTranslation();
  const tabsId = useId();

  const [activeTabId, setActiveTabId] = useState(() => {
    if (defaultTabId && tabs.find(t => t.id === defaultTabId)) {
      return defaultTabId;
    }
    return tabs[0]?.id ?? '';
  });

  useEffect(() => {
    if (!tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? '');
    }
  }, [tabs, activeTabId]);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    setActiveTabId(tabs[newIndex].id);

    tabRefs.current[newIndex]?.focus();
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div role="tablist" onKeyDown={onKeyDown} aria-orientation="horizontal" aria-label={t('common.tabs')} className="flex space-x-2">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const tabId = `${tabsId}-tab-${tab.id}`;
          const panelId = `${tabsId}-panel-${tab.id}`;
          return (
            <button
              key={tab.id}
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              ref={(element) => {
  tabRefs.current[index] = element;
}}
              onClick={() => setActiveTabId(tab.id)}
              className={`rounded-t-xl border-b-2 px-4 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const tabId = `${tabsId}-tab-${tab.id}`;
        const panelId = `${tabsId}-panel-${tab.id}`;

        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            hidden={!isActive}
            className="rounded-b-xl border border-border bg-card p-4 text-card-foreground"
            tabIndex={0}
          >
            {isActive && tab.content}
          </div>
        );
      })}
    </>
  );
};

export default AppTabs;
