import { NavLink } from 'react-router-dom';
import {
  BarChart2,
  Beaker,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Folder,
  Home,
  Library,
  Map,
  Package,
  Radar,
  ScanSearch,
  Settings,
  Shirt,
  Sparkles,
  User,
  Users,
  Workflow,
  ListChecks,
  X,
  Cloud,
  ServerCog,
  CalendarClock,
  RefreshCw,
  FlaskConical,
  BookOpen,
} from 'lucide-react';

import type { RefObject } from 'react';
import { useTranslation } from '@/features/i18n/useTranslation';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  sidebarRef: RefObject<HTMLElement>;
}

interface NavItem {
  icon: typeof Home;
  translationKey: string;
  href: string;
  available: boolean;
}

const navItems: NavItem[] = [
  { icon: Sparkles, translationKey: 'navigation.aiDirector', href: '/ai-director', available: true },
  { icon: Home, translationKey: 'navigation.dashboard', href: '/dashboard', available: true },
  { icon: Radar, translationKey: 'navigation.researchHub', href: '/research', available: true },
  { icon: ScanSearch, translationKey: 'navigation.viralAnalyzer', href: '/viral-analyzer', available: true },
  { icon: Workflow, translationKey: 'navigation.campaignBuilder', href: '/campaign-builder', available: true },
  { icon: ListChecks, translationKey: 'navigation.executionCenter', href: '/execution-center', available: true },
  { icon: ServerCog, translationKey: 'navigation.providerGateway', href: '/provider-gateway', available: true },
  { icon: CalendarClock, translationKey: 'navigation.publishingHub', href: '/publishing-hub', available: true },
  { icon: Folder, translationKey: 'navigation.campaigns', href: '/campaigns', available: true },
  { icon: BrainCircuit, translationKey: 'navigation.digitalHumans', href: '/digital-humans', available: true },
  { icon: User, translationKey: 'navigation.characters', href: '/characters', available: true },
  { icon: Package, translationKey: 'navigation.products', href: '/products', available: true },
  { icon: Shirt, translationKey: 'navigation.wardrobe', href: '/wardrobe', available: true },
  { icon: Map, translationKey: 'navigation.scenes', href: '/scenes', available: true },
  { icon: Users, translationKey: 'navigation.poses', href: '/poses', available: true },
  { icon: Beaker, translationKey: 'navigation.promptIntelligence', href: '/prompt-intelligence', available: true },
  { icon: Cpu, translationKey: 'navigation.promptEngine', href: '/prompt-engine', available: true },
  { icon: Library, translationKey: 'navigation.creativeLibrary', href: '/creative-library', available: true },
  { icon: Cloud, translationKey: 'navigation.assetPipeline', href: '/asset-pipeline', available: true },
  { icon: BarChart2, translationKey: 'navigation.analytics', href: '/analytics', available: true },
  { icon: RefreshCw, translationKey: 'navigation.analyticsFeedbackLoop', href: '/analytics-feedback-loop', available: true },
  { icon: FlaskConical, translationKey: 'navigation.experimentation', href: '/experimentation', available: true },
  { icon: BookOpen, translationKey: 'navigation.creativeRecipes', href: '/creative-recipes', available: true },
  { icon: Settings, translationKey: 'navigation.settings', href: '/settings', available: true },
];

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
  sidebarRef,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        aria-label={t('pages.shared.closeMenu')}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onCloseMobile}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? 'visible pointer-events-auto opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="primary-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background transition-[transform,width] duration-300 ease-in-out md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-20' : 'md:w-64'}`}
        aria-label={t('pages.shared.primaryNavigation')}
        ref={sidebarRef}
        tabIndex={-1}
        aria-expanded={mobileOpen}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-border px-4 ${
            collapsed ? 'md:justify-center' : 'justify-between'
          }`}
        >
          <span className="text-lg font-bold text-foreground md:hidden">
            AI Creator OS
          </span>
          <span className="hidden text-lg font-bold text-foreground md:block">
            {collapsed ? 'AI' : 'AI Creator OS'}
          </span>

          <button
            type="button"
            aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
            aria-expanded={!collapsed}
            aria-controls="primary-navigation-list"
            onClick={onToggle}
            className={`hidden h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex ${
              collapsed
                ? 'md:absolute md:left-[3.9rem] md:bg-background md:shadow-sm'
                : ''
            }`}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            aria-label={t('pages.shared.closeMenu')}
            onClick={onCloseMobile}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          id="primary-navigation-list"
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          <ul className="space-y-1">
            {navItems.map(({ icon: Icon, translationKey, href, available }) => {
              const label = t(translationKey as any);
              const commonClassName = `flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                collapsed ? 'md:justify-center md:gap-0 md:px-2' : ''
              }`;

              if (available) {
                return (
                  <li key={href}>
                    <NavLink
                      to={href}
                      aria-label={collapsed ? label : undefined}
                      title={collapsed ? label : undefined}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        `${commonClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isActive
                            ? 'bg-primary font-semibold text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className={collapsed ? 'md:sr-only' : undefined}>
                        {label}
                      </span>
                    </NavLink>
                  </li>
                );
              }

              const soonText = t('common.soon');
              return (
                <li key={href}>
                  <div
                    aria-disabled="true"
                    aria-label={`${label} — ${soonText}`}
                    title={collapsed ? `${label} — ${soonText}` : undefined}
                    className={`${commonClassName} cursor-not-allowed text-muted-foreground opacity-60`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={collapsed ? 'md:sr-only' : undefined}>
                      {label}
                    </span>
                    <span
                      className={`ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${
                        collapsed ? 'md:hidden' : ''
                      }`}
                    >
                      {soonText}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
