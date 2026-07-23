import { useEffect, useState, useMemo } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';

import {
  LucideBarChart3,
  LucideBox,
  LucideCpu,
  LucideFileText,
  LucideMap,
  ListChecks,
  LucidePackage,
  LucidePersonStanding,
  LucidePlusCircle,
  LucideSearch,
  LucideUser,
  LucideUserPlus,
  LucideUsers,
  Shirt,
  Settings,
  ServerCog,
  CalendarClock,
  FlaskConical,
  BookOpen,
} from 'lucide-react';

import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';

import type { Campaign } from '@/features/campaigns/types';
import type { Character } from '@/features/characters/types';
import type { Product } from '@/features/products/types';
import type { Pose } from '@/features/poses/types';
import type { Scene } from '@/features/scenes/types';
import type { WardrobeItem } from '@/features/wardrobe/types';

import {
  loadCampaignsFromStorage,
  CAMPAIGN_STORAGE_KEY,
} from '@/features/campaigns/lib/campaignStorage';
import {
  loadCharactersFromStorage,
  CHARACTER_STORAGE_KEY,
} from '@/features/characters/lib/characterStorage';
import {
  loadProductsFromStorage,
  PRODUCT_STORAGE_KEY,
} from '@/features/products/lib/productStorage';
import {
  loadPosesFromStorage,
  POSE_STORAGE_KEY,
} from '@/features/poses/poseStorage';
import {
  loadScenesFromStorage,
  SCENE_STORAGE_KEY,
} from '@/features/scenes/sceneStorage';
import {
  loadWardrobeItemsFromStorage,
  WARDROBE_STORAGE_KEY,
} from '@/features/wardrobe/wardrobeStorage';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  available: boolean;
  path?: string;
  buttonLabel?: string;
}

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

// Centralized locale-aware formatDate from useTranslation is used inside the DashboardPage component instead.

function getSafeTimestamp(
  dateString: string | undefined | null
): number {
  if (!dateString) {
    return 0;
  }

  const timestamp = new Date(dateString).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getStatusBadgeVariant(status: Campaign['status']): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'active':
      return 'success';
    case 'completed':
      return 'info';
    default:
      return 'default';
  }
}

interface GlobalSearchResult {
  id: string;
  module: 'Campaign' | 'Character' | 'Product' | 'Wardrobe' | 'Scene' | 'Pose';
  name: string;
  description: string;
  createdAt: string;
  path: string;
}

function buildSearchResultPath(modulePath: string, itemName: string): string {
  const params = new URLSearchParams({ q: itemName });
  return `${modulePath}?${params.toString()}`;
}

export function DashboardPage() {
  const { t, formatDate: i18nFormatDate } = useTranslation();
  const { translateStatus } = useDisplayHelpers();
  const navigate = useNavigate();

  const ariaLabels: Record<string, string> = useMemo(() => ({
    'new-campaign': t('dashboard.ariaLabels.new-campaign'),
    'new-character': t('dashboard.ariaLabels.new-character'),
    'new-product': t('dashboard.ariaLabels.new-product'),
    'new-wardrobe-item': t('dashboard.ariaLabels.new-wardrobe-item'),
    'new-scene': t('dashboard.ariaLabels.new-scene'),
    'new-pose': t('dashboard.ariaLabels.new-pose'),
    'prompt-engine': t('dashboard.ariaLabels.prompt-engine'),
    'execution-center': t('dashboard.ariaLabels.execution-center'),
    'provider-gateway': t('dashboard.ariaLabels.provider-gateway'),
    'publishing-hub': t('dashboard.ariaLabels.publishing-hub'),
    'analytics': t('dashboard.ariaLabels.analytics'),
    'settings': t('dashboard.ariaLabels.settings'),
    'experimentation': t('dashboard.ariaLabels.experimentation'),
    'creative-recipes': t('dashboard.ariaLabels.creative-recipes'),
  }), [t]);

  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'new-campaign',
      title: t('dashboard.quickActions.new-campaign.title'),
      description: t('dashboard.quickActions.new-campaign.description'),
      icon: LucidePlusCircle,
      available: true,
      path: '/campaigns?action=create',
      buttonLabel: t('dashboard.quickActions.new-campaign.buttonLabel'),
    },
    {
      id: 'new-character',
      title: t('dashboard.quickActions.new-character.title'),
      description: t('dashboard.quickActions.new-character.description'),
      icon: LucideUserPlus,
      available: true,
      path: '/characters?action=create',
      buttonLabel: t('dashboard.quickActions.new-character.buttonLabel'),
    },
    {
      id: 'new-product',
      title: t('dashboard.quickActions.new-product.title'),
      description: t('dashboard.quickActions.new-product.description'),
      icon: LucidePackage,
      available: true,
      path: '/products?action=create',
      buttonLabel: t('dashboard.quickActions.new-product.buttonLabel'),
    },
    {
      id: 'new-wardrobe-item',
      title: t('dashboard.quickActions.new-wardrobe-item.title'),
      description: t('dashboard.quickActions.new-wardrobe-item.description'),
      icon: Shirt,
      available: true,
      path: '/wardrobe?action=create',
      buttonLabel: t('dashboard.quickActions.new-wardrobe-item.buttonLabel'),
    },
    {
      id: 'new-scene',
      title: t('dashboard.quickActions.new-scene.title'),
      description: t('dashboard.quickActions.new-scene.description'),
      icon: LucideMap,
      available: true,
      path: '/scenes?action=create',
      buttonLabel: t('dashboard.quickActions.new-scene.buttonLabel'),
    },
    {
      id: 'new-pose',
      title: t('dashboard.quickActions.new-pose.title'),
      description: t('dashboard.quickActions.new-pose.description'),
      icon: LucidePersonStanding,
      available: true,
      path: '/poses?action=create',
      buttonLabel: t('dashboard.quickActions.new-pose.buttonLabel'),
    },
    {
      id: 'prompt-engine',
      title: t('dashboard.quickActions.prompt-engine.title'),
      description: t('dashboard.quickActions.prompt-engine.description'),
      icon: LucideCpu,
      available: true,
      path: '/prompt-engine',
      buttonLabel: t('dashboard.quickActions.prompt-engine.buttonLabel'),
    },
    {
      id: 'execution-center',
      title: t('dashboard.quickActions.execution-center.title'),
      description: t('dashboard.quickActions.execution-center.description'),
      icon: ListChecks,
      available: true,
      path: '/execution-center',
      buttonLabel: t('dashboard.quickActions.execution-center.buttonLabel'),
    },
    {
      id: 'provider-gateway',
      title: t('dashboard.quickActions.provider-gateway.title'),
      description: t('dashboard.quickActions.provider-gateway.description'),
      icon: ServerCog,
      available: true,
      path: '/provider-gateway',
      buttonLabel: t('dashboard.quickActions.provider-gateway.buttonLabel'),
    },
    {
      id: 'publishing-hub',
      title: t('dashboard.quickActions.publishing-hub.title'),
      description: t('dashboard.quickActions.publishing-hub.description'),
      icon: CalendarClock,
      available: true,
      path: '/publishing-hub',
      buttonLabel: t('dashboard.quickActions.publishing-hub.buttonLabel'),
    },
    {
      id: 'analytics',
      title: t('dashboard.quickActions.analytics.title'),
      description: t('dashboard.quickActions.analytics.description'),
      icon: LucideBarChart3,
      available: true,
      path: '/analytics',
      buttonLabel: t('dashboard.quickActions.analytics.buttonLabel'),
    },
    {
      id: 'settings',
      title: t('dashboard.quickActions.settings.title'),
      description: t('dashboard.quickActions.settings.description'),
      icon: Settings,
      available: true,
      path: '/settings',
      buttonLabel: t('dashboard.quickActions.settings.buttonLabel'),
    },
    {
      id: 'experimentation',
      title: t('dashboard.quickActions.experimentation.title'),
      description: t('dashboard.quickActions.experimentation.description'),
      icon: FlaskConical,
      available: true,
      path: '/experimentation',
      buttonLabel: t('dashboard.quickActions.experimentation.buttonLabel'),
    },
    {
      id: 'creative-recipes',
      title: t('dashboard.quickActions.creative-recipes.title'),
      description: t('dashboard.quickActions.creative-recipes.description'),
      icon: BookOpen,
      available: true,
      path: '/creative-recipes',
      buttonLabel: t('dashboard.quickActions.creative-recipes.buttonLabel'),
    },
  ], [t]);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return t('common.unknownDate');
    return i18nFormatDate(dateString) || t('common.unknownDate');
  };
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [poses, setPoses] = useState<Pose[]>([]);
  const [hasLoadedDashboardData, setHasLoadedDashboardData] = useState<boolean>(false);

  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');
  const [isGlobalSearchFocused, setIsGlobalSearchFocused] = useState<boolean>(false);

  const globalSearchResults: GlobalSearchResult[] = (() => {
    const term = globalSearchTerm.trim().toLowerCase();
    if (!term) return [];

    const allResults: GlobalSearchResult[] = [];

    campaigns.forEach((c) => {
      allResults.push({
        id: c.id,
        module: 'Campaign',
        name: c.name || '',
        description: c.description || '',
        createdAt: c.createdAt || '',
        path: buildSearchResultPath('/campaigns', c.name),
      });
    });

    characters.forEach((c) => {
      allResults.push({
        id: c.id,
        module: 'Character',
        name: c.name || '',
        description: c.description || '',
        createdAt: c.createdAt || '',
        path: buildSearchResultPath('/characters', c.name),
      });
    });

    products.forEach((p) => {
      allResults.push({
        id: p.id,
        module: 'Product',
        name: p.name || '',
        description: p.description || '',
        createdAt: p.createdAt || '',
        path: buildSearchResultPath('/products', p.name),
      });
    });

    wardrobeItems.forEach((w) => {
      allResults.push({
        id: w.id,
        module: 'Wardrobe',
        name: w.name || '',
        description: w.description || '',
        createdAt: w.createdAt || '',
        path: buildSearchResultPath('/wardrobe', w.name),
      });
    });

    scenes.forEach((scene) => {
      allResults.push({
        id: scene.id,
        module: 'Scene',
        name: scene.name || '',
        description: scene.description || '',
        createdAt: scene.createdAt || '',
        path: buildSearchResultPath('/scenes', scene.name),
      });
    });

    poses.forEach((pose) => {
      allResults.push({
        id: pose.id,
        module: 'Pose',
        name: pose.name || '',
        description: pose.description || '',
        createdAt: pose.createdAt || '',
        path: buildSearchResultPath('/poses', pose.name),
      });
    });

    const filtered = allResults.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(term);
      const descMatch = item.description.toLowerCase().includes(term);
      return nameMatch || descMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aNameLower = a.name.toLowerCase();
      const bNameLower = b.name.toLowerCase();

      const aExact = aNameLower === term;
      const bExact = bNameLower === term;
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aStarts = aNameLower.startsWith(term);
      const bStarts = bNameLower.startsWith(term);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      const aContainsName = aNameLower.includes(term);
      const bContainsName = bNameLower.includes(term);
      if (aContainsName !== bContainsName) return aContainsName ? -1 : 1;

      const aDescLower = a.description.toLowerCase();
      const bDescLower = b.description.toLowerCase();
      const aContainsDesc = aDescLower.includes(term);
      const bContainsDesc = bDescLower.includes(term);
      if (aContainsDesc !== bContainsDesc) return aContainsDesc ? -1 : 1;

      return (
        getSafeTimestamp(b.createdAt) -
        getSafeTimestamp(a.createdAt)
      );
    });

    return sorted.slice(0, 8);
  })();

  useEffect(() => {
    // Initial load
    setCampaigns(loadCampaignsFromStorage());
    setCharacters(loadCharactersFromStorage());
    setProducts(loadProductsFromStorage());
    setWardrobeItems(loadWardrobeItemsFromStorage());
    setScenes(loadScenesFromStorage());
    setPoses(loadPosesFromStorage());
    setHasLoadedDashboardData(true);

    function handleDashboardStorageChange(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      switch (event.key) {
        case CAMPAIGN_STORAGE_KEY:
          setCampaigns(loadCampaignsFromStorage());
          break;
        case CHARACTER_STORAGE_KEY:
          setCharacters(loadCharactersFromStorage());
          break;
        case PRODUCT_STORAGE_KEY:
          setProducts(loadProductsFromStorage());
          break;
        case WARDROBE_STORAGE_KEY:
          setWardrobeItems(loadWardrobeItemsFromStorage());
          break;
        case SCENE_STORAGE_KEY:
          setScenes(loadScenesFromStorage());
          break;
        case POSE_STORAGE_KEY:
          setPoses(loadPosesFromStorage());
          break;
        default:
          break;
      }
    }

    window.addEventListener('storage', handleDashboardStorageChange);
    return () => {
      window.removeEventListener('storage', handleDashboardStorageChange);
    };
  }, []);

  const overviewStats = [
    {
      id: 'campaigns',
      title: t('navigation.campaigns'),
      icon: LucideFileText,
      count: campaigns.length,
    },
    {
      id: 'characters',
      title: t('navigation.characters'),
      icon: LucideUsers,
      count: characters.length,
    },
    {
      id: 'products',
      title: t('navigation.products'),
      icon: LucidePackage,
      count: products.length,
    },
    {
      id: 'wardrobe',
      title: t('navigation.wardrobe'),
      icon: Shirt,
      count: wardrobeItems.length,
    },
    {
      id: 'scenes',
      title: t('navigation.scenes'),
      icon: LucideMap,
      count: scenes.length,
    },
    {
      id: 'poses',
      title: t('navigation.poses'),
      icon: LucidePersonStanding,
      count: poses.length,
    },
  ];

  const recentCampaigns = [...campaigns]
    .sort(
      (a, b) =>
        getSafeTimestamp(b.createdAt) -
        getSafeTimestamp(a.createdAt)
    )
    .slice(0, 3);

  const recentCharacters = [...characters]
    .sort(
      (a, b) =>
        getSafeTimestamp(b.createdAt) -
        getSafeTimestamp(a.createdAt)
    )
    .slice(0, 3);

  const recentProducts = [...products]
    .sort(
      (a, b) =>
        getSafeTimestamp(b.createdAt) -
        getSafeTimestamp(a.createdAt)
    )
    .slice(0, 3);

  const recentWardrobeItems = [...wardrobeItems]
    .sort(
      (a, b) =>
        getSafeTimestamp(b.createdAt) -
        getSafeTimestamp(a.createdAt)
    )
    .slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('dashboard.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <AppButton
          size="lg"
          variant="primary"
          onClick={() => navigate('/campaigns?action=create')}
          className="w-full sm:w-auto"
        >
          {t('dashboard.newCampaign')}
        </AppButton>
      </header>

      <section
        aria-labelledby="global-search-title"
        className="relative rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
        aria-busy={!hasLoadedDashboardData}
      >
        <h2 id="global-search-title" className="sr-only">
          {t('dashboard.globalSearch')}
        </h2>

        <div className="relative">
          <AppInput
            inputSize="lg"
            type="search"
            fullWidth
            placeholder={t('dashboard.searchPlaceholder')}
            aria-label={t('dashboard.searchPlaceholder')}
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => setIsGlobalSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsGlobalSearchFocused(false);
              }
            }}
            disabled={!hasLoadedDashboardData}
            leftIcon={<LucideSearch className="w-5 h-5" aria-hidden="true" />}
          />

          {hasLoadedDashboardData && globalSearchTerm.trim() !== '' && isGlobalSearchFocused && (
            <div
              role="region"
              aria-label={t('pages.dashboard.globalSearchResults')}
              className="absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <span aria-live="polite">
                  {globalSearchResults.length > 0
                    ? t('pages.dashboard.showingResults')
                    : t('pages.dashboard.noResultsFound')}
                </span>
                <button
                  type="button"
                  aria-label={t('pages.dashboard.closeSearchResultsPanel')}
                  className="rounded px-1.5 py-0.5 text-[10px] hover:bg-muted font-medium block"
                  onClick={() => setIsGlobalSearchFocused(false)}
                >{t('pages.dashboard.closePanel')}</button>
              </div>

              {globalSearchResults.length > 0 ? (
                <div className="divide-y divide-border/40 py-1">
                  {globalSearchResults.map((result) => {
                    const badgeVariant =
                      result.module === 'Campaign'
                        ? 'primary'
                        : result.module === 'Character'
                        ? 'success'
                        : result.module === 'Product'
                        ? 'warning'
                        : result.module === 'Scene'
                        ? 'info'
                        : result.module === 'Pose'
                        ? 'outline'
                        : 'default';

                    return (
                      <button
                        key={`${result.module}-${result.id}`}
                        type="button"
                        onClick={() => {
                          navigate(result.path);
                          setGlobalSearchTerm('');
                          setIsGlobalSearchFocused(false);
                        }}
                        className="flex w-full flex-col items-start gap-1 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label={t('pages.dashboard.goToResultInModule', { name: result.name, module: result.module })}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {result.name}
                          </span>
                          <AppBadge variant={badgeVariant} size="sm">
                            {result.module}
                          </AppBadge>
                        </div>
                        {result.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {result.description}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/80 mt-1">
                          {t('pages.dashboard.created')} {formatDate(result.createdAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('dashboard.noResultsFound')}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.noResultsFoundDesc')}
                  </p>
                  <div className="mt-4">
                    <AppButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setGlobalSearchTerm('')}
                    >
                      {t('dashboard.clearSearch')}
                    </AppButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!(globalSearchTerm.trim() !== '' && isGlobalSearchFocused) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('dashboard.searchHelperText')}
          </p>
        )}
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-5">
          <h2
            id="quick-actions-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            {t('dashboard.quickActionsTitle')}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.quickActionsDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (action.available) {
              return (
                <AppCard
                  key={action.id}
                  className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border-border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </div>

                  <h3 className="mt-5 text-base font-semibold text-card-foreground">
                    {t('dashboard.quickActions.' + action.id + '.title')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t('dashboard.quickActions.' + action.id + '.description')}
                  </p>

                  <div className="mt-auto pt-5">
                    <AppButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (action.path) {
                          navigate(action.path);
                        }
                      }}
                      aria-label={t('dashboard.quickActions.' + action.id + '.ariaLabel')}
                    >
                      {t('dashboard.quickActions.' + action.id + '.buttonLabel')}
                    </AppButton>
                  </div>
                </AppCard>
              );
            }

            return (
              <AppCard
                key={action.id}
                className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border-border bg-card p-6 opacity-80 transition-shadow hover:shadow-md"
                aria-disabled="true"
                title={t('common.comingSoon')}
              >
                <AppBadge
                  variant="secondary"
                  size="sm"
                  className="absolute right-4 top-4"
                >
                  {t('common.soon')}
                </AppBadge>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-base font-semibold text-card-foreground">
                  {t('dashboard.quickActions.' + action.id + '.title')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('dashboard.quickActions.' + action.id + '.description')}
                </p>

                <p className="mt-auto pt-5 text-xs font-medium text-muted-foreground">
                  {t('common.comingSoon')}
                </p>
              </AppCard>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="overview-title" aria-busy={!hasLoadedDashboardData ? 'true' : 'false'}>
        <div className="mb-5">
          <h2
            id="overview-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            {t('dashboard.overviewTitle')}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.overviewDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewStats.map(({ id, title, icon: Icon, count }) => (
            <AppCard key={id} className="flex items-center justify-between rounded-2xl border-border bg-card p-5">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('dashboard.stats.' + id)}
                </h3>
                <p
                  className="mt-2 text-3xl font-bold tracking-tight text-card-foreground"
                  aria-live="polite"
                >
                  {hasLoadedDashboardData ? count : '...'}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </div>
            </AppCard>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="recent-activity-title"
        className="space-y-6"
        aria-busy={!hasLoadedDashboardData ? 'true' : 'false'}
      >
        <div>
          <h2
            id="recent-activity-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            {t('dashboard.recentActivity')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.recentActivityDesc')}
          </p>
        </div>

        {/* Recent Campaigns */}
        <section
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h3 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
            {t('dashboard.recentCampaigns')}
          </h3>
          {!hasLoadedDashboardData ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
              <p className="text-muted-foreground">{t('dashboard.loadingRecentCampaigns')}</p>
            </div>
          ) : recentCampaigns.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
              <LucideFileText
                aria-hidden="true"
                className="mb-2 h-12 w-12 text-muted-foreground"
              />
              <p className="text-muted-foreground font-medium">
                {t('dashboard.noCampaigns')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('dashboard.noCampaignsDesc')}
              </p>
            </div>
          ) : (
            <ul
              role="list"
              aria-label={t('dashboard.recentCampaigns')}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {recentCampaigns.map((campaign) => (
                <li key={campaign.id}>
                  <AppCard
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 h-full"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {campaign.name}
                      </h4>
                      <AppBadge variant={getStatusBadgeVariant(campaign.status)} size="sm">
                        {translateStatus(campaign.status)}
                      </AppBadge>
                    </div>
                    {campaign.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {campaign.description}
                      </p>
                    ) : null}
                    <p className="mt-auto pt-3 text-xs text-muted-foreground">
                      {t('dashboard.createdOn', { date: formatDate(campaign.createdAt) })}
                    </p>
                  </AppCard>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Characters */}
          <section
            className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col"
          >
            <h3 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
              {t('dashboard.recentCharacters')}
            </h3>
            {!hasLoadedDashboardData ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                <p className="text-muted-foreground">{t('dashboard.loadingRecentCharacters')}</p>
              </div>
            ) : recentCharacters.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center h-full">
                <LucideUser
                  aria-hidden="true"
                  className="mb-2 h-12 w-12 text-muted-foreground"
                />
                <p className="text-muted-foreground font-medium">
                  {t('dashboard.noCharacters')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.noCharactersDesc')}
                </p>
              </div>
            ) : (
              <ul
                role="list"
                aria-label={t('dashboard.recentCharacters')}
                className="flex flex-col gap-4"
              >
                {recentCharacters.map((character) => (
                  <li key={character.id}>
                    <AppCard
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-none h-full"
                    >
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {character.name}
                      </h4>
                      {character.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {character.description}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-2 text-xs text-muted-foreground">
                        {t('dashboard.createdOn', { date: formatDate(character.createdAt) })}
                      </p>
                    </AppCard>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent Products */}
          <section
            className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col"
          >
            <h3 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
              {t('dashboard.recentProducts')}
            </h3>
            {!hasLoadedDashboardData ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                <p className="text-muted-foreground">{t('dashboard.loadingRecentProducts')}</p>
              </div>
            ) : recentProducts.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center h-full">
                <LucideBox
                  aria-hidden="true"
                  className="mb-2 h-12 w-12 text-muted-foreground"
                />
                <p className="text-muted-foreground font-medium">
                  {t('dashboard.noProducts')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.noProductsDesc')}
                </p>
              </div>
            ) : (
              <ul
                role="list"
                aria-label={t('dashboard.recentProducts')}
                className="flex flex-col gap-4"
              >
                {recentProducts.map((product) => (
                  <li key={product.id}>
                    <AppCard
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-none h-full"
                    >
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {product.name}
                      </h4>
                      {product.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-2 text-xs text-muted-foreground">
                        {t('dashboard.createdOn', { date: formatDate(product.createdAt) })}
                      </p>
                    </AppCard>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent Wardrobe Items */}
          <section
            className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col"
          >
            <h3 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
              {t('dashboard.recentWardrobeItems')}
            </h3>
            {!hasLoadedDashboardData ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                <p className="text-muted-foreground">{t('dashboard.loadingRecentWardrobe')}</p>
              </div>
            ) : recentWardrobeItems.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center h-full">
                <Shirt
                  aria-hidden="true"
                  className="mb-2 h-12 w-12 text-muted-foreground"
                />
                <p className="text-muted-foreground font-medium">
                  {t('dashboard.noWardrobe')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.noWardrobeDesc')}
                </p>
              </div>
            ) : (
              <ul
                role="list"
                aria-label={t('dashboard.recentWardrobeItems')}
                className="flex flex-col gap-4"
              >
                {recentWardrobeItems.map((item) => (
                  <li key={item.id}>
                    <AppCard
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-none h-full"
                    >
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {item.name}
                      </h4>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-2 text-xs text-muted-foreground">
                        {t('dashboard.createdOn', { date: formatDate(item.createdAt) })}
                      </p>
                    </AppCard>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      {hasLoadedDashboardData && campaigns.length === 0 && (
        <section
          aria-labelledby="primary-empty-state-title"
          className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5"
        >
          <div className="flex flex-col items-center gap-6 p-8 text-center sm:p-10 lg:flex-row lg:justify-between lg:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LucideFileText
                aria-hidden="true"
                className="h-8 w-8"
              />
            </div>

            <div>
              <h2
                id="primary-empty-state-title"
                className="text-2xl font-semibold tracking-tight text-primary"
              >
                {t('dashboard.noCampaignsYet')}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t('dashboard.noCampaignsYetDesc')}
              </p>
            </div>

            <AppButton
              size="lg"
              variant="primary"
              onClick={() => navigate('/campaigns?action=create')}
              className="w-full sm:w-auto"
            >
              {t('dashboard.newCampaign')}
            </AppButton>
          </div>
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
