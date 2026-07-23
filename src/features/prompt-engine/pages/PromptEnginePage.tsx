import { useTranslation } from '@/features/i18n/useTranslation';
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  WandSparkles,
  Copy,
  Trash2,
  RefreshCw,
  Check,
  Info,
  Clock,
  Video,
  Image,
  Sparkles,
} from 'lucide-react';

import { AppButton } from '@/components/ui/AppButton';
import {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
} from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppTextarea } from '@/components/ui/AppTextarea';

import {
  PromptConfiguration,
  PromptHistoryEntry,
  PromptOutputType,
  PromptPlatform,
  PromptAspectRatio,
  PROMPT_OUTPUT_TYPES,
  PROMPT_PLATFORMS,
  PROMPT_ASPECT_RATIOS,
  DEFAULT_PROMPT_CONFIGURATION,
} from '../types';

import {
  loadPromptHistoryFromStorage,
  savePromptHistoryToStorage,
  parseStoredPromptHistory,
  PROMPT_HISTORY_STORAGE_KEY,
} from '../promptHistoryStorage';

import { loadSettingsFromStorage } from '../../settings/settingsStorage';

import { buildPrompt, PromptBuilderResources } from '../promptBuilder';

// Library loaders
import { loadCharactersFromStorage, CHARACTER_STORAGE_KEY } from '@/features/characters/lib/characterStorage';
import { loadProductsFromStorage, PRODUCT_STORAGE_KEY } from '@/features/products/lib/productStorage';
import { loadWardrobeItemsFromStorage, WARDROBE_STORAGE_KEY } from '@/features/wardrobe/wardrobeStorage';
import { loadScenesFromStorage, SCENE_STORAGE_KEY } from '@/features/scenes/sceneStorage';
import { loadPosesFromStorage, POSE_STORAGE_KEY } from '@/features/poses/poseStorage';

import { loadCampaignsFromStorage, CAMPAIGN_STORAGE_KEY } from '@/features/campaigns/lib/campaignStorage';
import type { Campaign } from '@/features/campaigns/types';

import type { Character } from '@/features/characters/types';
import type { Product } from '@/features/products/types';
import type { WardrobeItem } from '@/features/wardrobe/types';
import type { Scene } from '@/features/scenes/types';
import type { Pose } from '@/features/poses/types';

// Storage type for tracking save status
type PromptHistoryStorageStatus = 'idle' | 'saving' | 'saved' | 'error';

// Type guards
function isPromptOutputType(val: unknown): val is PromptOutputType {
  return typeof val === 'string' && (PROMPT_OUTPUT_TYPES as readonly string[]).includes(val);
}

function isPromptPlatform(val: unknown): val is PromptPlatform {
  return typeof val === 'string' && (PROMPT_PLATFORMS as readonly string[]).includes(val);
}

function isPromptAspectRatio(val: unknown): val is PromptAspectRatio {
  return typeof val === 'string' && (PROMPT_ASPECT_RATIOS as readonly string[]).includes(val);
}

// Centralized formatDateTime from useTranslation is used inside the component instead.

// ID Generator
function generateSafeHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function getSafeTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareHistoryNewestFirst(
  first: PromptHistoryEntry,
  second: PromptHistoryEntry
): number {
  return getSafeTimestamp(second.createdAt) - getSafeTimestamp(first.createdAt);
}

function createPromptPreview(prompt: string): string {
  const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();
  if (normalizedPrompt.length <= 180) {
    return normalizedPrompt;
  }
  return `${normalizedPrompt.slice(0, 177)}...`;
}

interface ValidationErrors {
  duration?: string;
  customInstructions?: string;
  general?: string;
}

export function PromptEnginePage() {
  const { t, formatDateTime } = useTranslation();
  const formatPromptHistoryDate = (value: string): string => {
    if (!value) return '';
    return formatDateTime(value);
  };

  const getOutputTypeLabel = (type: string) => {
    return type === 'video' ? t('common.video') : t('common.image');
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'veo-3': return 'Google Veo 3';
      case 'grok': return 'Grok';
      case 'nano-banana': return 'Nano Banana';
      case 'generic': return t('pages.promptEngine.genericAiGenerator');
      default: return platform;
    }
  };

  const getAspectRatioLabel = (aspectRatio: string) => {
    switch (aspectRatio) {
      case '9:16': return t('pages.promptEngine.aspectRatio9_16');
      case '16:9': return t('pages.promptEngine.aspectRatio16_9');
      case '1:1': return t('pages.promptEngine.aspectRatio1_1');
      case '4:5': return t('pages.promptEngine.aspectRatio4_5');
      default: return aspectRatio;
    }
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadedCampaign, setLoadedCampaign] = useState<Campaign | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'campaign' | 'standalone' | 'current_campaign'>('all');

  // Configuration State
  const [configuration, setConfiguration] = useState<PromptConfiguration>(() => {
    const settings = loadSettingsFromStorage();
    const defaults = settings.promptDefaults;
    return {
      ...DEFAULT_PROMPT_CONFIGURATION,
      outputType: defaults.outputType,
      platform: defaults.platform,
      aspectRatio: defaults.aspectRatio,
      durationSeconds: Number.isNaN(defaults.durationSeconds) ? DEFAULT_PROMPT_CONFIGURATION.durationSeconds : defaults.durationSeconds,
    };
  });

  // Output Prompt State
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');

  // Loaded Libraries State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wardrobes, setWardrobes] = useState<WardrobeItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [poses, setPoses] = useState<Pose[]>([]);

  // History State
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [historyStorageStatus, setHistoryStorageStatus] = useState<PromptHistoryStorageStatus>('idle');
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const isApplyingExternalHistoryRef = React.useRef(false);

  // Interactive UI Status
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Deletion Modal States
  const [historyEntryBeingDeleted, setHistoryEntryBeingDeleted] = useState<PromptHistoryEntry | null>(null);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState<boolean>(false);

  // Initial Data Load
  useEffect(() => {
    setCharacters(loadCharactersFromStorage());
    setProducts(loadProductsFromStorage());
    setWardrobes(loadWardrobeItemsFromStorage());
    setScenes(loadScenesFromStorage());
    setPoses(loadPosesFromStorage());
    setAllCampaigns(loadCampaignsFromStorage());

    // Load History
    const loadedHistory = loadPromptHistoryFromStorage();
    const sorted = loadedHistory.slice().sort(compareHistoryNewestFirst).slice(0, 50);
    setPromptHistory(sorted);
    setHasLoadedHistory(true);
    setHistoryStorageStatus('saved');
  }, []);

  // Load campaign from URL parameter and set configuration
  useEffect(() => {
    const campaignId = searchParams.get('campaignId');
    if (!campaignId) return;

    const loadedCharacters = loadCharactersFromStorage();
    const loadedProducts = loadProductsFromStorage();
    const loadedWardrobe = loadWardrobeItemsFromStorage();
    const loadedScenes = loadScenesFromStorage();
    const loadedPoses = loadPosesFromStorage();

    const allCamps = loadCampaignsFromStorage();
    const campaign = allCamps.find((c) => c.id === campaignId);

    if (campaign) {
      setLoadedCampaign(campaign);

      // Validate linked IDs against existing items (ignore invalid IDs)
      const validCharacterId = campaign.characterId && loadedCharacters.some((c) => c.id === campaign.characterId) ? campaign.characterId : '';
      const validProductId = campaign.productId && loadedProducts.some((p) => p.id === campaign.productId) ? campaign.productId : '';
      const validWardrobeItemId = campaign.wardrobeItemId && loadedWardrobe.some((w) => w.id === campaign.wardrobeItemId) ? campaign.wardrobeItemId : '';
      const validSceneId = campaign.sceneId && loadedScenes.some((s) => s.id === campaign.sceneId) ? campaign.sceneId : '';
      const validPoseId = campaign.poseId && loadedPoses.some((p) => p.id === campaign.poseId) ? campaign.poseId : '';

      setConfiguration((prev) => ({
        ...prev,
        characterId: validCharacterId,
        productId: validProductId,
        wardrobeItemId: validWardrobeItemId,
        sceneId: validSceneId,
        poseId: validPoseId,
      }));

      setStatusMessage(t('pages.promptEngine.campaignContextLoaded', { name: campaign.name }));
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('campaignId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load history entry from URL parameter and restore configuration/prompt/campaign
  useEffect(() => {
    const historyId = searchParams.get('historyId');
    if (!historyId) return;

    const loadedHistory = loadPromptHistoryFromStorage();
    const entry = loadedHistory.find((e) => e.id === historyId);

    if (entry) {
      const configCopy = { ...entry.configuration };
      const loadedCharacters = loadCharactersFromStorage();
      const loadedProducts = loadProductsFromStorage();
      const loadedWardrobe = loadWardrobeItemsFromStorage();
      const loadedScenes = loadScenesFromStorage();
      const loadedPoses = loadPosesFromStorage();

      // Validate linked library items (clear if deleted)
      if (configCopy.characterId && !loadedCharacters.some((c) => c.id === configCopy.characterId)) {
        configCopy.characterId = '';
      }
      if (configCopy.productId && !loadedProducts.some((p) => p.id === configCopy.productId)) {
        configCopy.productId = '';
      }
      if (configCopy.wardrobeItemId && !loadedWardrobe.some((w) => w.id === configCopy.wardrobeItemId)) {
        configCopy.wardrobeItemId = '';
      }
      if (configCopy.sceneId && !loadedScenes.some((s) => s.id === configCopy.sceneId)) {
        configCopy.sceneId = '';
      }
      if (configCopy.poseId && !loadedPoses.some((p) => p.id === configCopy.poseId)) {
        configCopy.poseId = '';
      }

      setConfiguration(configCopy);
      setGeneratedPrompt(entry.generatedPrompt);

      // Restore Campaign Context if still exists
      if (entry.campaignId) {
        const allCamps = loadCampaignsFromStorage();
        const matchedCampaign = allCamps.find((c) => c.id === entry.campaignId);
        if (matchedCampaign) {
          setLoadedCampaign(matchedCampaign);
          setStatusMessage(t('pages.promptEngine.restoredWithCampaignContext', { name: matchedCampaign.name }));
        } else {
          setLoadedCampaign(null);
          setStatusMessage(t('pages.promptEngine.restoredCampaignNoLongerAvailable'));
        }
      } else {
        setLoadedCampaign(null);
        setStatusMessage(t('pages.promptEngine.configurationPromptRestored'));
      }
    } else {
      setStatusMessage(t('pages.promptEngine.historyEntryNotFound'));
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('historyId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Sync history filter
  useEffect(() => {
    if (!loadedCampaign && historyFilter === 'current_campaign') {
      setHistoryFilter('all');
    }
  }, [loadedCampaign, historyFilter]);

  // Automatic history persistence
  useEffect(() => {
    if (!hasLoadedHistory) return;

    if (isApplyingExternalHistoryRef.current) {
      isApplyingExternalHistoryRef.current = false;
      return;
    }

    setHistoryStorageStatus('saving');
    const success = savePromptHistoryToStorage(promptHistory);
    setHistoryStorageStatus(success ? 'saved' : 'error');
  }, [promptHistory, hasLoadedHistory]);

  // Sync Libraries and History Cross-Tab
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;

      if (event.key === CHARACTER_STORAGE_KEY) {
        const loaded = loadCharactersFromStorage();
        setCharacters(loaded);
        setConfiguration((prev) => {
          if (prev.characterId && !loaded.some((c) => c.id === prev.characterId)) {
            setStatusMessage(t('pages.promptEngine.selectedCharacterDeleted'));
            return { ...prev, characterId: '' };
          }
          return prev;
        });
      } else if (event.key === PRODUCT_STORAGE_KEY) {
        const loaded = loadProductsFromStorage();
        setProducts(loaded);
        setConfiguration((prev) => {
          if (prev.productId && !loaded.some((p) => p.id === prev.productId)) {
            setStatusMessage(t('pages.promptEngine.selectedProductDeleted'));
            return { ...prev, productId: '' };
          }
          return prev;
        });
      } else if (event.key === WARDROBE_STORAGE_KEY) {
        const loaded = loadWardrobeItemsFromStorage();
        setWardrobes(loaded);
        setConfiguration((prev) => {
          if (prev.wardrobeItemId && !loaded.some((w) => w.id === prev.wardrobeItemId)) {
            setStatusMessage(t('pages.promptEngine.selectedWardrobeDeleted'));
            return { ...prev, wardrobeItemId: '' };
          }
          return prev;
        });
      } else if (event.key === SCENE_STORAGE_KEY) {
        const loaded = loadScenesFromStorage();
        setScenes(loaded);
        setConfiguration((prev) => {
          if (prev.sceneId && !loaded.some((s) => s.id === prev.sceneId)) {
            setStatusMessage(t('pages.promptEngine.selectedSceneDeleted'));
            return { ...prev, sceneId: '' };
          }
          return prev;
        });
      } else if (event.key === POSE_STORAGE_KEY) {
        const loaded = loadPosesFromStorage();
        setPoses(loaded);
        setConfiguration((prev) => {
          if (prev.poseId && !loaded.some((p) => p.id === prev.poseId)) {
            setStatusMessage(t('pages.promptEngine.selectedPoseDeleted'));
            return { ...prev, poseId: '' };
          }
          return prev;
        });
      } else if (event.key === CAMPAIGN_STORAGE_KEY) {
        const loaded = loadCampaignsFromStorage();
        setAllCampaigns(loaded);
        setLoadedCampaign((prev) => {
          if (prev) {
            const updated = loaded.find((c) => c.id === prev.id);
            if (!updated) {
              setStatusMessage(t('pages.promptEngine.originalCampaignNoLongerAvailable'));
              return null;
            }
            return updated;
          }
          return null;
        });
      } else if (event.key === PROMPT_HISTORY_STORAGE_KEY) {
        const loadedHistory = parseStoredPromptHistory(event.newValue);
        const sorted = loadedHistory.slice().sort(compareHistoryNewestFirst).slice(0, 50);

        isApplyingExternalHistoryRef.current = true;
        setPromptHistory(sorted);
        setStatusMessage(t('pages.promptEngine.historyUpdatedAnotherTab'));

        setHistoryEntryBeingDeleted((pendingEntry) => {
          if (!pendingEntry) {
            return null;
          }

          const updatedEntry = sorted.find((entry) => entry.id === pendingEntry.id);

          if (!updatedEntry) {
            setStatusMessage(t('pages.promptEngine.historyEntryDeletedAnotherTab'));
            return null;
          }

          return updatedEntry;
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle Form Change Helper
  const handleConfigChange = <K extends keyof PromptConfiguration>(
    key: K,
    value: PromptConfiguration[K]
  ) => {
    setConfiguration((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear relevant error on change
    if (key === 'durationSeconds') {
      setValidationErrors((prev) => ({ ...prev, duration: undefined }));
    } else if (key === 'customInstructions') {
      setValidationErrors((prev) => ({ ...prev, customInstructions: undefined }));
    }
    setValidationErrors((prev) => ({ ...prev, general: undefined }));
  };

  // Reset Configuration Action
  const handleReset = () => {
    setConfiguration({ ...DEFAULT_PROMPT_CONFIGURATION });
    setValidationErrors({});
    setStatusMessage('');
  };

  // Clear Output Action
  const handleClearOutput = () => {
    setGeneratedPrompt('');
  };

  // Generate Prompt locally
  const handleGeneratePrompt = () => {
    const errors: ValidationErrors = {};

    // Validate overall empty
    const hasSelection =
      configuration.characterId ||
      configuration.productId ||
      configuration.wardrobeItemId ||
      configuration.sceneId ||
      configuration.poseId;
    const hasInstructions = configuration.customInstructions.trim() !== '';

    if (!hasSelection && !hasInstructions) {
      errors.general = t('pages.promptEngine.selectionOrInstructionsRequired');
    }

    // Validate duration (video only)
    if (configuration.outputType === 'video') {
      const duration = Number(configuration.durationSeconds);
      if (isNaN(duration) || !Number.isInteger(duration)) {
        errors.duration = t('pages.promptEngine.videoDurationWholeNumber');
      } else if (duration < 1 || duration > 60) {
        errors.duration = t('pages.promptEngine.videoDurationBetween1And60');
      }
    }

    // Validate custom instruction length
    if (configuration.customInstructions.length > 2000) {
      errors.customInstructions = t('pages.promptEngine.customInstructionsTooLong');
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prepare active resources
    const activeResources: PromptBuilderResources = {
      character: characters.find((c) => c.id === configuration.characterId),
      product: products.find((p) => p.id === configuration.productId),
      wardrobeItem: wardrobes.find((w) => w.id === configuration.wardrobeItemId),
      scene: scenes.find((s) => s.id === configuration.sceneId),
      pose: poses.find((p) => p.id === configuration.poseId),
    };

    const promptText = buildPrompt(configuration, activeResources, loadedCampaign || undefined);
    setGeneratedPrompt(promptText);

    const historyConfiguration: PromptConfiguration = {
      ...configuration,
      durationSeconds:
        configuration.outputType === 'video'
          ? configuration.durationSeconds
          : DEFAULT_PROMPT_CONFIGURATION.durationSeconds,
    };

    const campaignId = loadedCampaign ? loadedCampaign.id : undefined;
    let campaignName = undefined;
    if (loadedCampaign) {
      const trimmedName = (loadedCampaign.name || '').trim();
      campaignName = trimmedName.length > 0 ? trimmedName : t('pages.promptEngine.unnamedCampaign');
    }

    // Add to history state and sync storage
    const newHistoryEntry: PromptHistoryEntry = {
      id: generateSafeHistoryId(),
      configuration: historyConfiguration,
      generatedPrompt: promptText,
      createdAt: new Date().toISOString(),
      ...(campaignId ? { campaignId, campaignName } : {}),
    };

    setPromptHistory((prev) => [newHistoryEntry, ...prev].slice(0, 50));
    setStatusMessage(t('pages.promptEngine.promptCreatedSaved'));
  };

  // Copy to Clipboard
  const handleCopyToClipboard = async (text: string): Promise<void> => {
    if (!text) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      setStatusMessage(t('pages.promptEngine.copyUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);

      setCopyFeedback(true);
      setStatusMessage(t('pages.promptEngine.promptCopiedClipboard'));

      window.setTimeout(() => {
        setCopyFeedback(false);
      }, 2000);
    } catch {
      setCopyFeedback(false);
      setStatusMessage(t('pages.promptEngine.copyUnavailable'));
    }
  };

  // Use Again
  const handleUseAgain = (entry: PromptHistoryEntry) => {
    const configCopy = { ...entry.configuration };

    // Confirm active resources still exist in our loaded library
    if (configCopy.characterId && !characters.some((c) => c.id === configCopy.characterId)) {
      configCopy.characterId = '';
    }
    if (configCopy.productId && !products.some((p) => p.id === configCopy.productId)) {
      configCopy.productId = '';
    }
    if (configCopy.wardrobeItemId && !wardrobes.some((w) => w.id === configCopy.wardrobeItemId)) {
      configCopy.wardrobeItemId = '';
    }
    if (configCopy.sceneId && !scenes.some((s) => s.id === configCopy.sceneId)) {
      configCopy.sceneId = '';
    }
    if (configCopy.poseId && !poses.some((p) => p.id === configCopy.poseId)) {
      configCopy.poseId = '';
    }

    setConfiguration(configCopy);
    setGeneratedPrompt(entry.generatedPrompt);
    setValidationErrors({});

    // Restore Campaign Context if still exists
    if (entry.campaignId) {
      const allCamps = loadCampaignsFromStorage();
      const matchedCampaign = allCamps.find((c) => c.id === entry.campaignId);
      if (matchedCampaign) {
        setLoadedCampaign(matchedCampaign);
        setStatusMessage(t('pages.promptEngine.configCampaignRestored', { name: matchedCampaign.name }));
      } else {
        setLoadedCampaign(null);
        setStatusMessage(t('pages.promptEngine.campaignContextRestoredNoCampaign'));
      }
    } else {
      setLoadedCampaign(null);
      setStatusMessage(t('pages.promptEngine.configurationRestored'));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete history item
  const handleDeleteHistoryEntry = () => {
    if (!historyEntryBeingDeleted) return;

    setPromptHistory((prev) => prev.filter((entry) => entry.id !== historyEntryBeingDeleted.id));
    setHistoryEntryBeingDeleted(null);
    setStatusMessage(t('pages.promptEngine.historyEntryDeleted'));
  };

  // Clear all history
  const handleClearAllHistory = () => {
    setPromptHistory([]);
    setIsClearHistoryModalOpen(false);
    setStatusMessage(t('pages.promptEngine.historyCleared'));
  };

  // Sorted selector options alphabetically
  const sortedCharacters = React.useMemo(
    () =>
      [...characters].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
      ),
    [characters]
  );
  const sortedProducts = React.useMemo(
    () =>
      [...products].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
      ),
    [products]
  );
  const sortedWardrobe = React.useMemo(
    () =>
      [...wardrobes].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
      ),
    [wardrobes]
  );
  const sortedScenes = React.useMemo(
    () =>
      [...scenes].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
      ),
    [scenes]
  );
  const sortedPoses = React.useMemo(
    () =>
      [...poses].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
      ),
    [poses]
  );

  const filteredHistory = React.useMemo(() => {
    return promptHistory.filter((entry) => {
      if (historyFilter === 'campaign') {
        return !!entry.campaignId;
      }
      if (historyFilter === 'standalone') {
        return !entry.campaignId;
      }
      if (historyFilter === 'current_campaign') {
        return entry.campaignId === loadedCampaign?.id;
      }
      return true;
    });
  }, [promptHistory, historyFilter, loadedCampaign]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header Section */}
      <div className="mb-6 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <WandSparkles className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.promptEngine.creativeStudio')}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('promptEngine.title')}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-muted-foreground text-sm max-w-2xl leading-relaxed">
          {t('promptEngine.description')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <span>{t('pages.promptEngine.promptsAreComposedLocallyFromYourSavedLi')}</span>
        </div>
        {loadedCampaign && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <span className="font-semibold text-primary">{t('pages.promptEngine.campaignContext')}</span>
              <span>{loadedCampaign.name}</span>
              {loadedCampaign.description && (
                <span className="text-xs text-muted-foreground">({loadedCampaign.description})</span>
              )}
            </div>
            <AppButton
              size="sm"
              variant="outline"
              onClick={() => {
                setLoadedCampaign(null);
                setStatusMessage(t('pages.promptEngine.campaignContextCleared'));
              }}
            >{t('pages.promptEngine.clearCampaignContext')}</AppButton>
          </div>
        )}
      </div>

      {/* Accessible Polite Status Messenger */}
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* LEFT COLUMN: Prompt Configuration */}
        <div className="space-y-6">
          <AppCard className="overflow-hidden">
            <AppCardHeader className="bg-muted/15 border-b border-border/40">
              <AppCardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />{t('pages.promptEngine.promptConfiguration')}</AppCardTitle>
              <AppCardDescription>{t('pages.promptEngine.defineOutputPropertiesAndChooseSavedAsse')}</AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-5 p-6">
              {/* Output Type Select */}
              <AppSelect
                label={t('pages.promptEngine.outputType')}
                options={[
                  { value: 'video', label: t('pages.promptEngine.video') },
                  { value: 'image', label: t('pages.promptEngine.image') },
                ]}
                value={configuration.outputType}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isPromptOutputType(val)) {
                    handleConfigChange('outputType', val);
                  }
                }}
              />

              {/* Platform Select */}
              <AppSelect
                label={t('pages.promptEngine.aiGeneratorPlatform')}
                options={[
                  { value: 'veo-3', label: 'Google Veo 3' },
                  { value: 'grok', label: 'Grok' },
                  { value: 'nano-banana', label: 'Nano Banana' },
                  { value: 'generic', label: t('common.genericAiGenerator') },
                ]}
                value={configuration.platform}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isPromptPlatform(val)) {
                    handleConfigChange('platform', val);
                  }
                }}
              />

              {/* Aspect Ratio Select */}
              <AppSelect
                label={t('pages.promptEngine.aspectRatio')}
                options={[
                  { value: '9:16', label: t('pages.promptEngine.aspectRatio9_16') },
                  { value: '16:9', label: t('pages.promptEngine.aspectRatio16_9') },
                  { value: '1:1', label: t('pages.promptEngine.aspectRatio1_1') },
                  { value: '4:5', label: t('pages.promptEngine.aspectRatio4_5') },
                ]}
                value={configuration.aspectRatio}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isPromptAspectRatio(val)) {
                    handleConfigChange('aspectRatio', val);
                  }
                }}
              />

              {/* Duration Input (Video only) */}
              {configuration.outputType === 'video' && (
                <AppInput
                  label={t('pages.promptEngine.durationSeconds')}
                  type="number"
                  min={1}
                  max={60}
                  value={configuration.durationSeconds}
                  errorMessage={validationErrors.duration}
                  variant={validationErrors.duration ? 'error' : 'default'}
                  onChange={(e) => handleConfigChange('durationSeconds', Number(e.target.value))}
                />
              )}

              {/* Character Selector */}
              <div>
                <AppSelect
                  label={t('pages.promptEngine.character')}
                  options={[
                    { value: '', label: t('pages.promptEngine.noCharacterSelected') },
                    ...sortedCharacters.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={configuration.characterId}
                  onChange={(e) => handleConfigChange('characterId', e.target.value)}
                />
                {characters.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    {t('pages.promptEngine.noCharactersSavedYet')}{' '}
                    <Link to="/characters" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">{t('pages.promptEngine.createCharacters')}</Link>
                  </p>
                )}
              </div>

              {/* Product Selector */}
              <div>
                <AppSelect
                  label={t('pages.promptEngine.product')}
                  options={[
                    { value: '', label: t('pages.promptEngine.noProductSelected') },
                    ...sortedProducts.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  value={configuration.productId}
                  onChange={(e) => handleConfigChange('productId', e.target.value)}
                />
                {products.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    {t('pages.promptEngine.noProductsSavedYet')}{' '}
                    <Link to="/products" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">{t('pages.promptEngine.createProducts')}</Link>
                  </p>
                )}
              </div>

              {/* Wardrobe Selector */}
              <div>
                <AppSelect
                  label={t('pages.promptEngine.wardrobeItem')}
                  options={[
                    { value: '', label: t('pages.promptEngine.noWardrobeSelected') },
                    ...sortedWardrobe.map((w) => ({ value: w.id, label: w.name })),
                  ]}
                  value={configuration.wardrobeItemId}
                  onChange={(e) => handleConfigChange('wardrobeItemId', e.target.value)}
                />
                {wardrobes.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    {t('pages.promptEngine.noWardrobeItemsSavedYet')}{' '}
                    <Link to="/wardrobe" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">{t('pages.promptEngine.createWardrobeItems')}</Link>
                  </p>
                )}
              </div>

              {/* Scene Selector */}
              <div>
                <AppSelect
                  label={t('pages.promptEngine.scene')}
                  options={[
                    { value: '', label: t('pages.promptEngine.noSceneSelected') },
                    ...sortedScenes.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={configuration.sceneId}
                  onChange={(e) => handleConfigChange('sceneId', e.target.value)}
                />
                {scenes.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    {t('pages.promptEngine.noScenesSavedYet')}{' '}
                    <Link to="/scenes" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">{t('pages.promptEngine.createScenes')}</Link>
                  </p>
                )}
              </div>

              {/* Pose Selector */}
              <div>
                <AppSelect
                  label={t('pages.promptEngine.pose')}
                  options={[
                    { value: '', label: t('pages.promptEngine.noPoseSelected') },
                    ...sortedPoses.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  value={configuration.poseId}
                  onChange={(e) => handleConfigChange('poseId', e.target.value)}
                />
                {poses.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    {t('pages.promptEngine.noPosesSavedYet')}{' '}
                    <Link to="/poses" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">{t('pages.promptEngine.createPoses')}</Link>
                  </p>
                )}
              </div>

              {/* Custom Instructions */}
              <div>
                <AppTextarea
                  label={t('pages.promptEngine.customInstructions')}
                  placeholder={t('pages.promptEngine.describeMovementCameraBehaviorLightingDi')}
                  value={configuration.customInstructions}
                  onChange={(e) => handleConfigChange('customInstructions', e.target.value)}
                  error={validationErrors.customInstructions}
                  rows={4}
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t('pages.promptEngine.customTextIsAddedToThePromptLayout')}</span>
                  <span className={configuration.customInstructions.length > 2000 ? 'text-destructive font-semibold' : ''}>
                    {configuration.customInstructions.length} / 2,000 characters
                  </span>
                </div>
              </div>

              {/* General Validation Error Alert */}
              {validationErrors.general && (
                <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-medium">
                  {validationErrors.general}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <AppButton
                  onClick={handleGeneratePrompt}
                  className="flex-1 font-bold"
                  variant="primary"
                >{t('pages.promptEngine.generatePrompt')}</AppButton>
                <AppButton
                  onClick={handleReset}
                  variant="outline"
                  leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                >{t('pages.promptEngine.resetConfiguration')}</AppButton>
              </div>
            </AppCardContent>
          </AppCard>
        </div>

        {/* RIGHT COLUMN: Output display + History logs */}
        <div className="space-y-6">
          {/* Output Card */}
          <AppCard>
            <AppCardHeader className="bg-muted/15 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <AppCardTitle className="text-base font-bold">{t('pages.promptEngine.generatedStructuredPrompt')}</AppCardTitle>
                <AppCardDescription>{t('pages.promptEngine.copyThisGeneratedPromptDirectlyIntoYourV')}</AppCardDescription>
              </div>
            </AppCardHeader>
            <AppCardContent className="p-6">
              {generatedPrompt ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg border border-border bg-muted/20 p-4 max-h-[350px] overflow-y-auto font-mono text-sm leading-relaxed text-foreground select-text whitespace-pre-wrap break-words">
                    {generatedPrompt}
                  </div>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />{t('pages.promptEngine.promptCreatedLocally')}</span>
                    <div className="flex gap-2">
                      <AppButton
                        onClick={() => handleCopyToClipboard(generatedPrompt)}
                        size="sm"
                        variant={copyFeedback ? 'primary' : 'secondary'}
                        leftIcon={<Copy className="h-4 w-4" />}
                      >
                        {copyFeedback ? t('pages.promptEngine.copied') : t('pages.promptEngine.copyPrompt')}
                      </AppButton>
                      <AppButton onClick={handleClearOutput} size="sm" variant="outline">{t('pages.promptEngine.clearOutput')}</AppButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-border/80 rounded-xl bg-muted/10">
                  <div className="inline-flex rounded-full bg-muted/50 p-3 text-muted-foreground/80 mb-3">
                    <WandSparkles className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{t('pages.promptEngine.noPromptGeneratedYet')}</h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">{t('pages.promptEngine.chooseItemsFromYourLibraryOrAddCustomIns')}</p>
                </div>
              )}
            </AppCardContent>
          </AppCard>

          {/* History Card */}
          <AppCard>
            <AppCardHeader className="bg-muted/15 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <AppCardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{t('pages.promptEngine.promptHistory')}</AppCardTitle>
                <AppCardDescription>{t('pages.promptEngine.generatedPromptsAreStoredLocallyInThisBr')}</AppCardDescription>
              </div>
              {promptHistory.length > 0 && (
                <AppButton onClick={() => setIsClearHistoryModalOpen(true)} size="sm" variant="outline" className="text-xs">{t('pages.promptEngine.clearHistory')}</AppButton>
              )}
            </AppCardHeader>
            <AppCardContent className="p-6">
              <div aria-live="polite" className="sr-only">
                {historyStorageStatus === 'saving' && t('pages.promptEngine.savingPromptHistory')}
                {historyStorageStatus === 'saved' && t('pages.promptEngine.promptHistorySaved')}
                {historyStorageStatus === 'error' && t('pages.promptEngine.unableToSavePromptHistory')}
              </div>

              {/* History Filters */}
              {promptHistory.length > 0 && (
                <div className="mb-4 flex flex-col gap-1.5">
                  <label htmlFor="history-filter-select" className="text-xs font-semibold text-muted-foreground">{t('pages.promptEngine.filterHistory')}</label>
                  <select
                    id="history-filter-select"
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as any)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">{t('pages.promptEngine.allPrompts')}</option>
                    <option value="campaign">{t('pages.promptEngine.campaignPrompts')}</option>
                    <option value="standalone">{t('pages.promptEngine.standalonePrompts')}</option>
                    {loadedCampaign && (
                      <option value="current_campaign">
                        {t('pages.promptEngine.currentCampaignContext', { name: loadedCampaign.name || t('pages.promptEngine.unnamedCampaign') })}
                      </option>
                    )}
                  </select>
                </div>
              )}

              {filteredHistory.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {filteredHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="group border border-border/60 hover:border-border/100 rounded-xl p-4 bg-muted/5 hover:bg-muted/10 transition-colors space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="font-semibold text-muted-foreground">
                          {formatPromptHistoryDate(entry.createdAt)}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                            {entry.configuration.outputType === 'video' ? (
                              <Video className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Image className="h-3 w-3" aria-hidden="true" />
                            )}
                            {getOutputTypeLabel(entry.configuration.outputType)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                            {getPlatformLabel(entry.configuration.platform)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-foreground font-medium">
                            {getAspectRatioLabel(entry.configuration.aspectRatio)}
                          </span>
                          {entry.configuration.outputType === 'video' && entry.configuration.durationSeconds && (
                            <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-foreground font-medium">
                              {entry.configuration.durationSeconds}s
                            </span>
                          )}
                        </div>
                      </div>

                      {entry.campaignName && (
                        <div className="text-xs text-primary font-medium flex flex-wrap items-center gap-1.5 bg-primary/5 rounded-lg px-2.5 py-1 border border-primary/10">
                          <span>{t('pages.promptEngine.campaign')}<strong>{entry.campaignName}</strong></span>
                          {entry.campaignId && !allCampaigns.some((c) => c.id === entry.campaignId) && (
                            <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                              {t('pages.promptEngine.originalCampaignWarning')}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-xs font-mono bg-muted/20 border border-border/40 p-2 rounded-md max-h-16 overflow-hidden text-ellipsis line-clamp-3 leading-relaxed whitespace-pre-wrap break-all">
                        {createPromptPreview(entry.generatedPrompt)}
                      </div>

                      <div className="flex justify-end gap-2 text-xs">
                        <AppButton onClick={() => handleUseAgain(entry)} size="sm" variant="secondary" className="px-2.5 py-1 text-xs">{t('pages.promptEngine.useAgain')}</AppButton>
                        <AppButton
                          onClick={() => handleCopyToClipboard(entry.generatedPrompt)}
                          size="sm"
                          variant="outline"
                          className="px-2.5 py-1 text-xs"
                          leftIcon={<Copy className="h-3 w-3" />}
                        >{t('pages.promptEngine.copy')}</AppButton>
                        <AppButton
                          onClick={() => setHistoryEntryBeingDeleted(entry)}
                          size="sm"
                          variant="ghost"
                          className="px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          leftIcon={<Trash2 className="h-3 w-3" />}
                        >{t('pages.promptEngine.delete')}</AppButton>
                      </div>
                    </div>
                  ))}
                  {historyStorageStatus === 'saving' && <p className="text-xs text-center text-muted-foreground animate-pulse">{t('pages.promptEngine.savingPromptHistory')}</p>}
                  {historyStorageStatus === 'error' && <p className="text-xs text-center text-destructive font-semibold">{t('pages.promptEngine.unableToSavePromptHistoryInThisBrowser')}</p>}
                  {historyStorageStatus === 'saved' && <p className="text-xs text-center text-success/80 font-medium">{t('pages.promptEngine.promptHistoryIsSavedInThisBrowser')}</p>}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-foreground">{t('pages.promptEngine.noPromptHistory')}</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mt-1">{t('pages.promptEngine.generatedPromptsWillAppearHereAndRemainA')}</p>
                </div>
              )}
            </AppCardContent>
          </AppCard>
        </div>
      </div>

      {/* Confirmation Modal: Delete Single Entry */}
      <AppModal
        isOpen={!!historyEntryBeingDeleted}
        onClose={() => setHistoryEntryBeingDeleted(null)}
        title={t('pages.promptEngine.deletePromptHistoryEntry')}
      >
        {historyEntryBeingDeleted && (
          <div className="space-y-4 pt-3">
            <p className="text-sm text-foreground leading-relaxed">{t('pages.promptEngine.deleteThe')}<span className="lowercase">{getOutputTypeLabel(historyEntryBeingDeleted.configuration.outputType)}</span>{' '}{t('pages.promptEngine.promptFor')}{' '}
              <span className="font-semibold">{getPlatformLabel(historyEntryBeingDeleted.configuration.platform)}</span>{' '}
              {t('pages.promptEngine.createdOn')}{' '}
              <span className="font-semibold text-primary">
                {formatPromptHistoryDate(historyEntryBeingDeleted.createdAt)}
              </span>{t('pages.promptEngine.ThisActionCannotBeUndone')}</p>
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
              <p><strong>{t('pages.promptEngine.platform')}</strong> {getPlatformLabel(historyEntryBeingDeleted.configuration.platform)}</p>
              <p><strong>{t('pages.promptEngine.type')}</strong> <span className="capitalize">{getOutputTypeLabel(historyEntryBeingDeleted.configuration.outputType)}</span></p>
              <p><strong>{t('pages.promptEngine.date')}</strong> {formatPromptHistoryDate(historyEntryBeingDeleted.createdAt)}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <AppButton onClick={() => setHistoryEntryBeingDeleted(null)} variant="outline">{t('pages.promptEngine.cancel')}</AppButton>
              <AppButton onClick={handleDeleteHistoryEntry} variant="danger">{t('pages.promptEngine.deleteEntry')}</AppButton>
            </div>
          </div>
        )}
      </AppModal>

      {/* Confirmation Modal: Clear All History */}
      <AppModal
        isOpen={isClearHistoryModalOpen}
        onClose={() => setIsClearHistoryModalOpen(false)}
        title={t('pages.promptEngine.clearPromptHistory')}
      >
        <div className="space-y-4 pt-3">
          <p className="text-sm text-foreground">{t('pages.promptEngine.thisWillRemoveAllGeneratedPromptsSavedLo')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('pages.promptEngine.thisWillPermanentlyEraseAll')}<strong>{promptHistory.length}</strong>{t('pages.promptEngine.previousHistoryEntriesYourActiveLayoutCo')}</p>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <AppButton onClick={() => setIsClearHistoryModalOpen(false)} variant="outline">{t('pages.promptEngine.cancel')}</AppButton>
            <AppButton onClick={handleClearAllHistory} variant="danger">{t('pages.promptEngine.clearHistory')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default PromptEnginePage;
