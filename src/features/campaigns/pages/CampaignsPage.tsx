import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import {
  CalendarDays,
  CheckCircle2,
  FileText,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import {
  loadCampaignsFromStorage,
  saveCampaignsToStorage,
  subscribeToCampaignStorage,
} from '@/features/campaigns/lib/campaignStorage';
import type {
  Campaign,
  CampaignStatus,
} from '@/features/campaigns/types';

import { loadCharactersFromStorage } from '@/features/characters/lib/characterStorage';
import { loadProductsFromStorage } from '@/features/products/lib/productStorage';
import { loadWardrobeItemsFromStorage } from '@/features/wardrobe/wardrobeStorage';
import { loadScenesFromStorage } from '@/features/scenes/sceneStorage';
import { loadPosesFromStorage } from '@/features/poses/poseStorage';

import type { Character } from '@/features/characters/types';
import type { Product } from '@/features/products/types';
import type { WardrobeItem } from '@/features/wardrobe/types';
import type { Scene } from '@/features/scenes/types';
import type { Pose } from '@/features/poses/types';

import { loadPromptHistoryFromStorage, PROMPT_HISTORY_STORAGE_KEY } from '@/features/prompt-engine/promptHistoryStorage';
import type { PromptHistoryEntry } from '@/features/prompt-engine/types';

type StorageStatus = 'loading' | 'saving' | 'saved' | 'error';

const CAMPAIGN_NAME_MAX_LENGTH = 80;
const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 300;

export function CampaignsPage() {
  const { t, formatDate, formatDateTime } = useTranslation();
  const { getStatusLabel, translateOutputType, translatePlatform } = useDisplayHelpers();
  const formatCampaignDate = (date: string): string => {
    return formatDate(date);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Library resource lists states
  const [characters, setCharacters] = useState<Character[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [poses, setPoses] = useState<Pose[]>([]);

  // Campaign Workspace states
  const [campaignInWorkspace, setCampaignInWorkspace] = useState<Campaign | null>(null);
  const [workspaceSelections, setWorkspaceSelections] = useState({
    characterId: '',
    productId: '',
    wardrobeItemId: '',
    sceneId: '',
    poseId: '',
  });
  const [hasExternalConflict, setHasExternalConflict] = useState(false);
  const [conflictingExternalCampaign, setConflictingExternalCampaign] = useState<Campaign | null>(null);
  const [isCampaignDeletedExternally, setIsCampaignDeletedExternally] = useState(false);

  const [hasLoadedStoredCampaigns, setHasLoadedStoredCampaigns] =
    useState(false);
  const [storageStatus, setStorageStatus] =
    useState<StorageStatus>('loading');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [campaignPendingDeletion, setCampaignPendingDeletion] =
    useState<Campaign | null>(null);
  const [campaignBeingEdited, setCampaignBeingEdited] =
    useState<Campaign | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const isApplyingExternalUpdateRef = useRef(false);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<'all' | CampaignStatus>('all');
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string>('');

  const handleRecentPromptCopy = async (entry: PromptHistoryEntry) => {
    if (!entry || !entry.generatedPrompt) return;

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      setCopyStatusMessage(t('pages.campaigns.copyApiUnavailable'));
      setTimeout(() => setCopyStatusMessage(''), 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.generatedPrompt);
      setCopiedPromptId(entry.id);
      setCopyStatusMessage(t('pages.campaigns.promptCopiedSuccess'));
      setTimeout(() => {
        setCopiedPromptId(null);
        setCopyStatusMessage('');
      }, 2000);
    } catch {
      setCopyStatusMessage(t('pages.campaigns.promptCopyError'));
      setTimeout(() => {
        setCopyStatusMessage('');
      }, 2000);
    }
  };

  useEffect(() => {
    const storedCampaigns = loadCampaignsFromStorage();

    setCampaigns(storedCampaigns);
    setHasLoadedStoredCampaigns(true);
    setStorageStatus('saved');

    // Load library resources
    setCharacters(loadCharactersFromStorage());
    setProducts(loadProductsFromStorage());
    setWardrobeItems(loadWardrobeItemsFromStorage());
    setScenes(loadScenesFromStorage());
    setPoses(loadPosesFromStorage());
    setPromptHistory(loadPromptHistoryFromStorage());
  }, []);

  // Sync library resources cross-tab
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;

      const keysToSync: Record<string, () => void> = {
        'ai-creator-os.characters.v1': () => setCharacters(loadCharactersFromStorage()),
        'ai-creator-os.products.v1': () => setProducts(loadProductsFromStorage()),
        'ai-creator-os.wardrobe.v1': () => setWardrobeItems(loadWardrobeItemsFromStorage()),
        'ai-creator-os.scenes.v1': () => setScenes(loadScenesFromStorage()),
        'ai-creator-os.poses.v1': () => setPoses(loadPosesFromStorage()),
        [PROMPT_HISTORY_STORAGE_KEY]: () => setPromptHistory(loadPromptHistoryFromStorage()),
      };

      if (event.key && keysToSync[event.key]) {
        keysToSync[event.key]();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Compute workspace changes safely
  const initialWorkspaceSelections = {
    characterId: campaignInWorkspace?.characterId || '',
    productId: campaignInWorkspace?.productId || '',
    wardrobeItemId: campaignInWorkspace?.wardrobeItemId || '',
    sceneId: campaignInWorkspace?.sceneId || '',
    poseId: campaignInWorkspace?.poseId || '',
  };

  const hasWorkspaceChanges =
    campaignInWorkspace !== null &&
    (workspaceSelections.characterId !== initialWorkspaceSelections.characterId ||
      workspaceSelections.productId !== initialWorkspaceSelections.productId ||
      workspaceSelections.wardrobeItemId !== initialWorkspaceSelections.wardrobeItemId ||
      workspaceSelections.sceneId !== initialWorkspaceSelections.sceneId ||
      workspaceSelections.poseId !== initialWorkspaceSelections.poseId);

  const isWorkspaceCharacterValid = !workspaceSelections.characterId || characters.some(c => c.id === workspaceSelections.characterId);
  const isWorkspaceProductValid = !workspaceSelections.productId || products.some(p => p.id === workspaceSelections.productId);
  const isWorkspaceWardrobeValid = !workspaceSelections.wardrobeItemId || wardrobeItems.some(w => w.id === workspaceSelections.wardrobeItemId);
  const isWorkspaceSceneValid = !workspaceSelections.sceneId || scenes.some(s => s.id === workspaceSelections.sceneId);
  const isWorkspacePoseValid = !workspaceSelections.poseId || poses.some(p => p.id === workspaceSelections.poseId);

  const hasOrphanedIds =
    campaignInWorkspace !== null &&
    ((workspaceSelections.characterId ? !isWorkspaceCharacterValid : false) ||
      (workspaceSelections.productId ? !isWorkspaceProductValid : false) ||
      (workspaceSelections.wardrobeItemId ? !isWorkspaceWardrobeValid : false) ||
      (workspaceSelections.sceneId ? !isWorkspaceSceneValid : false) ||
      (workspaceSelections.poseId ? !isWorkspacePoseValid : false));

  // Sync workspace campaign changes cross-tab safely
  useEffect(() => {
    if (!campaignInWorkspace) return;

    const matchedCampaign = campaigns.find(c => c.id === campaignInWorkspace.id);

    if (!matchedCampaign) {
      // Campaign was deleted in another tab
      if (!hasWorkspaceChanges) {
        setCampaignInWorkspace(null);
        setSuccessMessage(t('pages.campaigns.deletedExternalClosed'));
      } else {
        setIsCampaignDeletedExternally(true);
      }
    } else {
      // Campaign was updated in another tab
      const isExternallyUpdated =
        matchedCampaign.name !== campaignInWorkspace.name ||
        matchedCampaign.description !== campaignInWorkspace.description ||
        matchedCampaign.status !== campaignInWorkspace.status ||
        (matchedCampaign.characterId || '') !== (campaignInWorkspace.characterId || '') ||
        (matchedCampaign.productId || '') !== (campaignInWorkspace.productId || '') ||
        (matchedCampaign.wardrobeItemId || '') !== (campaignInWorkspace.wardrobeItemId || '') ||
        (matchedCampaign.sceneId || '') !== (campaignInWorkspace.sceneId || '') ||
        (matchedCampaign.poseId || '') !== (campaignInWorkspace.poseId || '');

      if (isExternallyUpdated) {
        if (!hasWorkspaceChanges) {
          setCampaignInWorkspace(matchedCampaign);
          setWorkspaceSelections({
            characterId: matchedCampaign.characterId || '',
            productId: matchedCampaign.productId || '',
            wardrobeItemId: matchedCampaign.wardrobeItemId || '',
            sceneId: matchedCampaign.sceneId || '',
            poseId: matchedCampaign.poseId || '',
          });
          setHasExternalConflict(false);
          setConflictingExternalCampaign(null);
        } else {
          setHasExternalConflict(true);
          setConflictingExternalCampaign(matchedCampaign);
        }
      }
    }
  }, [campaigns, campaignInWorkspace, hasWorkspaceChanges]);

  useEffect(() => {
    return subscribeToCampaignStorage(
      (storedCampaigns) => {
        isApplyingExternalUpdateRef.current = true;

        setCampaigns(storedCampaigns);

        setCampaignPendingDeletion((pendingCampaign) => {
          if (!pendingCampaign) {
            return null;
          }

          return (
            storedCampaigns.find(
              (campaign) => campaign.id === pendingCampaign.id,
            ) ?? null
          );
        });

        setCampaignBeingEdited((editingCampaign) => {
          if (!editingCampaign) {
            return null;
          }

          const updatedCampaign = storedCampaigns.find(
            (campaign) => campaign.id === editingCampaign.id,
          );

          if (!updatedCampaign) {
            setEditName('');
            setEditDescription('');
            setEditNameError('');
            return null;
          }

          setEditName(updatedCampaign.name);
          setEditDescription(updatedCampaign.description);
          setEditNameError('');

          return updatedCampaign;
        });

        setStorageStatus('saved');
        setSuccessMessage(
          t('pages.campaigns.synchronizedAnotherTab'),
        );
      },
    );
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredCampaigns) {
      return;
    }

    if (isApplyingExternalUpdateRef.current) {
      isApplyingExternalUpdateRef.current = false;
      return;
    }

    const wasSaved = saveCampaignsToStorage(campaigns);

    setStorageStatus(wasSaved ? 'saved' : 'error');
  }, [campaigns, hasLoadedStoredCampaigns]);

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      !normalizedSearchQuery ||
      campaign.name.toLocaleLowerCase().includes(normalizedSearchQuery) ||
      campaign.description.toLocaleLowerCase().includes(normalizedSearchQuery);

    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const hasEditChanges =
    campaignBeingEdited !== null &&
    (
      editName.trim() !== campaignBeingEdited.name.trim() ||
      editDescription.trim() !== campaignBeingEdited.description.trim()
    );

  function openCreateModal() {
    setNameError('');
    setSuccessMessage('');
    setIsCreateModalOpen(true);
  }

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let shouldReplaceParams = false;

    if (searchParams.get('action') === 'create') {
      openCreateModal();
      newParams.delete('action');
      shouldReplaceParams = true;
    }

    const incomingSearchQuery = searchParams.get('q');

    if (incomingSearchQuery !== null) {
      setSearchQuery(incomingSearchQuery);
      newParams.delete('q');
      shouldReplaceParams = true;
    }

    if (shouldReplaceParams) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setName('');
    setDescription('');
    setNameError('');
  }

  function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      setNameError(t('pages.campaigns.nameRequired'));
      return;
    }

    if (normalizedName.length > CAMPAIGN_NAME_MAX_LENGTH) {
      setNameError(
        `Campaign name must contain no more than ${CAMPAIGN_NAME_MAX_LENGTH} characters.`,
      );
      return;
    }

    const campaignAlreadyExists = campaigns.some(
      (campaign) =>
        campaign.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
    );

    if (campaignAlreadyExists) {
      setNameError(t('pages.campaigns.duplicateName'));
      return;
    }

    const newCampaign: Campaign = {
      id: `${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription.slice(0, CAMPAIGN_DESCRIPTION_MAX_LENGTH),
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    setCampaigns((currentCampaigns) => [newCampaign, ...currentCampaigns]);

    setSuccessMessage(t('pages.campaigns.createdSuccess', { name: normalizedName }));

    closeCreateModal();
  }

  function updateCampaignStatus(campaignId: string, status: CampaignStatus) {
    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignId
          ? { ...campaign, status }
          : campaign,
      ),
    );
  }


  function openEditCampaign(campaign: Campaign) {
    setCampaignBeingEdited(campaign);
    setEditName(campaign.name);
    setEditDescription(campaign.description);
    setEditNameError('');
  }

  function closeEditCampaign() {
    setCampaignBeingEdited(null);
    setEditName('');
    setEditDescription('');
    setEditNameError('');
  }

  function handleEditCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!campaignBeingEdited) {
      return;
    }

    const normalizedEditName = editName.trim();
    const normalizedEditDescription = editDescription.trim();

    if (!hasEditChanges) {
      return;
    }

    if (!normalizedEditName) {
      setEditNameError(t('pages.campaigns.nameRequired'));
      return;
    }

    if (normalizedEditName.length > CAMPAIGN_NAME_MAX_LENGTH) {
      setEditNameError(
        `Campaign name must contain no more than ${CAMPAIGN_NAME_MAX_LENGTH} characters.`,
      );
      return;
    }

    const campaignAlreadyExists = campaigns.some(
      (campaign) =>
        campaign.id !== campaignBeingEdited.id &&
        campaign.name.toLocaleLowerCase() ===
          normalizedEditName.toLocaleLowerCase(),
    );

    if (campaignAlreadyExists) {
      setEditNameError(t('pages.campaigns.duplicateName'));
      return;
    }

    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignBeingEdited.id
          ? {
              ...campaign,
              name: normalizedEditName,
              description: normalizedEditDescription.slice(
                0,
                CAMPAIGN_DESCRIPTION_MAX_LENGTH,
              ),
            }
          : campaign,
      ),
    );

    setSuccessMessage(
      t('pages.campaigns.updatedSuccess', { name: normalizedEditName }),
    );

    closeEditCampaign();
  }

  function openDeleteConfirmation(campaign: Campaign) {
    setCampaignPendingDeletion(campaign);
  }

  function closeDeleteConfirmation() {
    setCampaignPendingDeletion(null);
  }

  function confirmDeleteCampaign() {
    if (!campaignPendingDeletion) {
      return;
    }

    setCampaigns((currentCampaigns) =>
      currentCampaigns.filter(
        (campaign) => campaign.id !== campaignPendingDeletion.id,
      ),
    );

    setSuccessMessage(
      t('pages.campaigns.deletedSuccess', { name: campaignPendingDeletion.name }),
    );

    closeDeleteConfirmation();
  }

  function openWorkspace(campaign: Campaign) {
    setCampaignInWorkspace(campaign);
    setWorkspaceSelections({
      characterId: campaign.characterId || '',
      productId: campaign.productId || '',
      wardrobeItemId: campaign.wardrobeItemId || '',
      sceneId: campaign.sceneId || '',
      poseId: campaign.poseId || '',
    });
    setHasExternalConflict(false);
    setConflictingExternalCampaign(null);
    setIsCampaignDeletedExternally(false);
  }

  function closeWorkspace() {
    setCampaignInWorkspace(null);
    setHasExternalConflict(false);
    setConflictingExternalCampaign(null);
    setIsCampaignDeletedExternally(false);
  }

  function handleReloadExternalChanges() {
    if (!conflictingExternalCampaign) return;
    setCampaignInWorkspace(conflictingExternalCampaign);
    setWorkspaceSelections({
      characterId: conflictingExternalCampaign.characterId || '',
      productId: conflictingExternalCampaign.productId || '',
      wardrobeItemId: conflictingExternalCampaign.wardrobeItemId || '',
      sceneId: conflictingExternalCampaign.sceneId || '',
      poseId: conflictingExternalCampaign.poseId || '',
    });
    setHasExternalConflict(false);
    setConflictingExternalCampaign(null);
  }

  function handleKeepSelections() {
    if (!conflictingExternalCampaign) return;
    setCampaignInWorkspace(conflictingExternalCampaign);
    setHasExternalConflict(false);
    setConflictingExternalCampaign(null);
  }

  function handleSaveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignInWorkspace) return;

    const finalCharacterId = isWorkspaceCharacterValid ? workspaceSelections.characterId : '';
    const finalProductId = isWorkspaceProductValid ? workspaceSelections.productId : '';
    const finalWardrobeItemId = isWorkspaceWardrobeValid ? workspaceSelections.wardrobeItemId : '';
    const finalSceneId = isWorkspaceSceneValid ? workspaceSelections.sceneId : '';
    const finalPoseId = isWorkspacePoseValid ? workspaceSelections.poseId : '';

    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignInWorkspace.id
          ? {
              ...campaign,
              characterId: finalCharacterId || undefined,
              productId: finalProductId || undefined,
              wardrobeItemId: finalWardrobeItemId || undefined,
              sceneId: finalSceneId || undefined,
              poseId: finalPoseId || undefined,
            }
          : campaign,
      ),
    );

    setSuccessMessage(t('pages.campaigns.workspaceSavedSuccess', { name: campaignInWorkspace.name }));
    closeWorkspace();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('campaigns.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {t('campaigns.description')}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p
            role="status"
            aria-live="polite"
            className={
              storageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {storageStatus === 'loading'
              ? t('pages.campaigns.loadingSaved')
              : storageStatus === 'error'
                ? t('pages.campaigns.unableToSave')
                : t('pages.campaigns.savedSuccess')}
          </p>

          <AppButton
            size="lg"
            variant="primary"
            className="w-full sm:w-auto"
            onClick={openCreateModal}
          >
            <PlusCircle className="mr-2 h-5 w-5" aria-hidden="true" />{t('pages.campaigns.newCampaign')}</AppButton>
        </div>
      </header>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {successMessage}
      </div>

      <section aria-labelledby="campaign-summary-title">
        <div className="mb-5">
          <h2
            id="campaign-summary-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >{t('pages.campaigns.campaignSummary')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.campaigns.aQuickOverviewOfYourCampaignWorkspace')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AppCard className="flex items-center justify-between rounded-2xl border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('pages.campaigns.totalCampaigns')}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {totalCampaigns}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <FileText aria-hidden="true" />
            </div>
          </AppCard>

          <AppCard className="flex items-center justify-between rounded-2xl border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('pages.campaigns.activeCampaigns')}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {activeCampaigns}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <Sparkles aria-hidden="true" />
            </div>
          </AppCard>

          <AppCard className="flex items-center justify-between rounded-2xl border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('pages.campaigns.completedCampaigns')}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {completedCampaigns}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <CheckCircle2 aria-hidden="true" />
            </div>
          </AppCard>
        </div>
      </section>

      <section aria-labelledby="campaign-list-title">
        <div className="mb-5">
          <h2
            id="campaign-list-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >{t('pages.campaigns.allCampaigns')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.campaigns.campaignsCreatedInYourWorkspaceWillBeLis')}</p>
          <p
            aria-live="polite"
            className="mt-2 text-xs font-medium text-muted-foreground"
          >
            {totalCampaigns === 1
              ? t('pages.campaigns.campaignsInWorkspaceSingular')
              : t('pages.campaigns.campaignsInWorkspacePlural', { count: totalCampaigns })}
          </p>
        </div>

        {!hasLoadedStoredCampaigns ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p role="status" className="text-sm text-muted-foreground">{t('pages.campaigns.loadingCampaigns')}</p>
          </AppCard>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <AppInput
                id="campaign-search"
                name="campaignSearch"
                label={t('pages.campaigns.searchCampaigns')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('pages.campaigns.searchByNameOrDescription')}
                autoComplete="off"
                fullWidth
              />
            
              <div>
                <label
                  htmlFor="campaign-status-filter"
                  className="mb-2 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.status')}</label>
            
                <select
                  id="campaign-status-filter"
                  name="campaignStatusFilter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | CampaignStatus)
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="all">{t('pages.campaigns.allStatuses')}</option>
                  <option value="draft">{t('pages.campaigns.draft')}</option>
                  <option value="active">{t('pages.campaigns.active')}</option>
                  <option value="completed">{t('pages.campaigns.completed')}</option>
                </select>
              </div>
            </div>
            
            {campaigns.length > 0 && (
              <p
                aria-live="polite"
                className="mt-4 text-xs text-muted-foreground"
              >
                {filteredCampaigns.length === 1
                  ? t('pages.campaigns.campaignsMatchingFiltersSingular')
                  : t('pages.campaigns.campaignsMatchingFiltersPlural', { count: filteredCampaigns.length })}
              </p>
            )}
            
            {campaigns.length > 0 && filteredCampaigns.length === 0 && (
              <AppCard
                className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
                shadow
              >
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <FileText
                    aria-hidden="true"
                    className="h-10 w-10 text-muted-foreground"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.campaigns.noMatchingCampaigns')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.campaigns.tryChangingYourSearchTermOrStatusFilter')}</p>
                  <AppButton
                    type="button"
                    variant="outline"
                    className="mt-5"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >{t('pages.campaigns.clearFilters')}</AppButton>
                </div>
              </AppCard>
            )}
            
            {campaigns.length === 0 ? (
              <AppCard
                className="overflow-hidden rounded-2xl border-dashed border-border bg-card"
                shadow
              >
                <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarDays aria-hidden="true" />
                  </div>
                  <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground">{t('pages.campaigns.noCampaignsYet')}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t('pages.campaigns.createYourFirstCampaignToOrganizeProduct')}</p>
                  <AppButton
                    size="lg"
                    variant="primary"
                    className="mt-8 w-full sm:w-auto"
                    onClick={openCreateModal}
                  >
                    <PlusCircle className="mr-2 h-5 w-5" aria-hidden="true" />{t('pages.campaigns.newCampaign')}</AppButton>
                </div>
              </AppCard>
            ) : (
              <ul
                role="list"
                aria-label={t('pages.campaigns.campaigns')}
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              >
                {filteredCampaigns.map((campaign) => {
                  const campaignTitleId = `campaign-${campaign.id}-title`;
                  const selectedCount = [
                    campaign.characterId && characters.some((c) => c.id === campaign.characterId) ? campaign.characterId : null,
                    campaign.productId && products.some((p) => p.id === campaign.productId) ? campaign.productId : null,
                    campaign.wardrobeItemId && wardrobeItems.some((w) => w.id === campaign.wardrobeItemId) ? campaign.wardrobeItemId : null,
                    campaign.sceneId && scenes.some((s) => s.id === campaign.sceneId) ? campaign.sceneId : null,
                    campaign.poseId && poses.some((p) => p.id === campaign.poseId) ? campaign.poseId : null,
                  ].filter(Boolean).length;
            
                  return (
                    <li key={campaign.id}>
                      <AppCard
                        aria-labelledby={campaignTitleId}
                        className="rounded-2xl border-border bg-card p-6"
                        shadow
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3
                            id={campaignTitleId}
                            className="text-lg font-semibold text-card-foreground"
                          >
                            {campaign.name}
                          </h3>
                          <AppBadge
                            variant={
                              campaign.status === 'active'
                                ? 'success'
                                : campaign.status === 'completed'
                                ? 'secondary'
                                : 'warning'
                            }
                            size="sm"
                          >
                             {getStatusLabel(campaign.status)}
                          </AppBadge>
                        </div>
            
                        {campaign.description ? (
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {campaign.description}
                          </p>
                        ) : (
                          <p className="mt-3 italic text-sm text-muted-foreground">{t('pages.campaigns.noDescriptionProvided')}</p>
                        )}

                        {/* Creative setup compact summary */}
                        <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('pages.campaigns.creativeSetup')}</p>
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {campaign.characterId && (
                              <li>
                                <span className="font-medium text-foreground">{t('pages.campaigns.character')}</span>{' '}
                                {characters.find(c => c.id === campaign.characterId)?.name ?? (
                                  <span className="text-destructive font-semibold">{t('pages.campaigns.noLongerAvailable')}</span>
                                )}
                              </li>
                            )}
                            {campaign.productId && (
                              <li>
                                <span className="font-medium text-foreground">{t('pages.campaigns.product')}</span>{' '}
                                {products.find(p => p.id === campaign.productId)?.name ?? (
                                  <span className="text-destructive font-semibold">{t('pages.campaigns.noLongerAvailable')}</span>
                                )}
                              </li>
                            )}
                            {campaign.wardrobeItemId && (
                              <li>
                                <span className="font-medium text-foreground">{t('pages.campaigns.wardrobe')}</span>{' '}
                                {wardrobeItems.find(w => w.id === campaign.wardrobeItemId)?.name ?? (
                                  <span className="text-destructive font-semibold">{t('pages.campaigns.noLongerAvailable')}</span>
                                )}
                              </li>
                            )}
                            {campaign.sceneId && (
                              <li>
                                <span className="font-medium text-foreground">{t('pages.campaigns.scene')}</span>{' '}
                                {scenes.find(s => s.id === campaign.sceneId)?.name ?? (
                                  <span className="text-destructive font-semibold">{t('pages.campaigns.noLongerAvailable')}</span>
                                )}
                              </li>
                            )}
                            {campaign.poseId && (
                              <li>
                                <span className="font-medium text-foreground">{t('pages.campaigns.pose')}</span>{' '}
                                {poses.find(p => p.id === campaign.poseId)?.name ?? (
                                  <span className="text-destructive font-semibold">{t('pages.campaigns.noLongerAvailable')}</span>
                                )}
                              </li>
                            )}
                          </ul>
                          <p className="mt-2 text-xs font-medium text-muted-foreground">
                            {t('pages.campaigns.ofAssetsSelected', { count: selectedCount })}
                          </p>
                        </div>
                        <div className="mt-5">
                          <label
                            htmlFor={`campaign-${campaign.id}-status`}
                            className="mb-2 block text-xs font-medium text-muted-foreground"
                          >{t('pages.campaigns.campaignStatus')}</label>
                          <select
                            id={`campaign-${campaign.id}-status`}
                            name={`campaign-${campaign.id}-status`}
                            value={campaign.status}
                            onChange={(event) =>
                              updateCampaignStatus(
                                campaign.id,
                                event.target.value as CampaignStatus,
                              )
                            }
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-48"
                          >
                            <option value="draft">{t('pages.campaigns.draft')}</option>
                            <option value="active">{t('pages.campaigns.active')}</option>
                            <option value="completed">{t('pages.campaigns.completed')}</option>
                          </select>
                        </div>
            
                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                          <AppButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => openWorkspace(campaign)}
                            aria-label={`${t('pages.campaigns.openWorkspace')} ${campaign.name}`}
                          >{t('pages.campaigns.openWorkspace')}</AppButton>

                          <AppButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditCampaign(campaign)}
                            aria-label={`${t('pages.campaigns.edit')} ${campaign.name}`}
                          >{t('pages.campaigns.edit')}</AppButton>

                          <AppButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteConfirmation(campaign)}
                            aria-label={`${t('pages.campaigns.delete')} ${campaign.name}`}
                          >{t('pages.campaigns.delete')}</AppButton>
                        </div>
            
                        <p className="mt-5 text-xs text-muted-foreground">
                          {t('pages.campaigns.created')}{' '}
                          <time dateTime={campaign.createdAt}>
                            {formatCampaignDate(campaign.createdAt)}
                          </time>
                        </p>
                      </AppCard>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={t('pages.campaigns.createCampaign')}
      >
        <form onSubmit={handleCreateCampaign} className="space-y-5">
          <AppInput
            id="campaign-name"
            name="campaignName"
            autoComplete="off"
            label={t('pages.campaigns.campaignName')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) {
                setNameError('');
              }
            }}
            errorMessage={nameError}
            required
            fullWidth
            autoFocus
            placeholder={t('pages.campaigns.exampleSummerProductLaunch')}
            maxLength={CAMPAIGN_NAME_MAX_LENGTH}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {name.length}/{CAMPAIGN_NAME_MAX_LENGTH}
          </p>

          <div>
            <label
              htmlFor="campaign-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.campaigns.description')}</label>
            <textarea
              id="campaign-description"
              name="campaignDescription"
              aria-describedby="campaign-description-help campaign-description-count"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder={t('pages.campaigns.describeTheGoalAndCreativeDirectionOfThi')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              maxLength={CAMPAIGN_DESCRIPTION_MAX_LENGTH}
            />
            <p
              id="campaign-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.campaigns.optionalYouCanAddMoreDetailsLater')}</p>
            <p
              id="campaign-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {description.length}/{CAMPAIGN_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="w-full sm:w-auto"
            >{t('pages.campaigns.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!name.trim()}
            >{t('pages.campaigns.createCampaign')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={campaignBeingEdited !== null}
        onClose={closeEditCampaign}
        title={t('pages.campaigns.editCampaign')}
      >
        <form onSubmit={handleEditCampaign} className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">{t('pages.campaigns.updateTheCampaignNameAndDescription')}</p>

          <div>
            <AppInput
              id="edit-campaign-name"
              name="editCampaignName"
              label={t('pages.campaigns.campaignName')}
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);

                if (editNameError) {
                  setEditNameError('');
                }
              }}
              errorMessage={editNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={CAMPAIGN_NAME_MAX_LENGTH}
              placeholder={t('pages.campaigns.exampleSummerProductLaunch')}
            />

            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editName.length}/{CAMPAIGN_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-campaign-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.campaigns.description')}</label>

            <textarea
              id="edit-campaign-description"
              name="editCampaignDescription"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={4}
              maxLength={CAMPAIGN_DESCRIPTION_MAX_LENGTH}
              aria-describedby="edit-campaign-description-help edit-campaign-description-count"
              placeholder={t('pages.campaigns.describeTheGoalAndCreativeDirectionOfThi')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />

            <p
              id="edit-campaign-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.campaigns.optionalYouCanAddMoreDetailsLater')}</p>

            <p
              id="edit-campaign-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {editDescription.length}/{CAMPAIGN_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <p
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {hasEditChanges
              ? t('pages.campaigns.readyToSave')
              : t('pages.campaigns.noChanges')}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeEditCampaign}
              className="w-full sm:w-auto"
            >{t('pages.campaigns.cancel')}</AppButton>

            <AppButton
              type="submit"
              variant="primary"
              disabled={!editName.trim() || !hasEditChanges}
              className="w-full sm:w-auto"
            >{t('pages.campaigns.saveChanges')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={campaignPendingDeletion !== null}
        onClose={closeDeleteConfirmation}
        title={t('pages.campaigns.deleteCampaign')}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {t('pages.campaigns.confirmDelete')}{' '}
            <strong className="font-semibold text-foreground">
              {campaignPendingDeletion?.name}
            </strong>{t('pages.campaigns.ThisActionCannotBeUndone')}</p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeleteConfirmation}
              className="w-full sm:w-auto"
            >{t('pages.campaigns.cancel')}</AppButton>

            <AppButton
              type="button"
              variant="primary"
              onClick={confirmDeleteCampaign}
              className="w-full sm:w-auto"
            >{t('pages.campaigns.deleteCampaign')}</AppButton>
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={campaignInWorkspace !== null}
        onClose={closeWorkspace}
        title={t('pages.campaigns.campaignWorkspace')}
      >
        {campaignInWorkspace && (
          <form onSubmit={handleSaveWorkspace} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {campaignInWorkspace.name}
              </h3>
              {campaignInWorkspace.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {campaignInWorkspace.description}
                </p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground">{t('pages.campaigns.noDescriptionProvided')}</p>
              )}
            </div>

            {isCampaignDeletedExternally && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-semibold">
                {t('pages.campaigns.campaignDeletedExternallyWarning')}
              </div>
            )}

            {hasExternalConflict && conflictingExternalCampaign && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-500">
                  {t('pages.campaigns.externalConflictWarning')}
                </p>
                <p className="text-xs text-muted-foreground">{t('pages.campaigns.chooseWhetherToReloadTheExternalChangesD')}</p>
                <div className="flex gap-2">
                  <AppButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReloadExternalChanges}
                  >{t('pages.campaigns.reloadExternalChanges')}</AppButton>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleKeepSelections}
                  >{t('pages.campaigns.keepMySelections')}</AppButton>
                </div>
              </div>
            )}

            <div className="space-y-4 border-t border-b border-border py-5">
              {/* Character Selector */}
              <div>
                <label
                  htmlFor="workspace-character"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.character')}</label>
                <select
                  id="workspace-character"
                  name="workspaceCharacter"
                  value={workspaceSelections.characterId}
                  onChange={(e) =>
                    setWorkspaceSelections((prev) => ({
                      ...prev,
                      characterId: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">{t('pages.campaigns.noneSelected')}</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {!isWorkspaceCharacterValid && workspaceSelections.characterId && (
                    <option value={workspaceSelections.characterId} disabled>
                      {workspaceSelections.characterId} {t('pages.campaigns.notAvailableSuffix')}
                    </option>
                  )}
                </select>
                {!isWorkspaceCharacterValid && (
                  <p className="mt-1 text-xs text-destructive font-medium">
                    {t('pages.campaigns.characterNotAvailable')}
                  </p>
                )}
              </div>

              {/* Product Selector */}
              <div>
                <label
                  htmlFor="workspace-product"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.product')}</label>
                <select
                  id="workspace-product"
                  name="workspaceProduct"
                  value={workspaceSelections.productId}
                  onChange={(e) =>
                    setWorkspaceSelections((prev) => ({
                      ...prev,
                      productId: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">{t('pages.campaigns.noneSelected')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {!isWorkspaceProductValid && workspaceSelections.productId && (
                    <option value={workspaceSelections.productId} disabled>
                      {workspaceSelections.productId} {t('pages.campaigns.notAvailableSuffix')}
                    </option>
                  )}
                </select>
                {!isWorkspaceProductValid && (
                  <p className="mt-1 text-xs text-destructive font-medium">
                    {t('pages.campaigns.productNotAvailable')}
                  </p>
                )}
              </div>

              {/* Wardrobe Selector */}
              <div>
                <label
                  htmlFor="workspace-wardrobe"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.wardrobeItem')}</label>
                <select
                  id="workspace-wardrobe"
                  name="workspaceWardrobe"
                  value={workspaceSelections.wardrobeItemId}
                  onChange={(e) =>
                    setWorkspaceSelections((prev) => ({
                      ...prev,
                      wardrobeItemId: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">{t('pages.campaigns.noneSelected')}</option>
                  {wardrobeItems.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                  {!isWorkspaceWardrobeValid && workspaceSelections.wardrobeItemId && (
                    <option value={workspaceSelections.wardrobeItemId} disabled>
                      {workspaceSelections.wardrobeItemId} {t('pages.campaigns.notAvailableSuffix')}
                    </option>
                  )}
                </select>
                {!isWorkspaceWardrobeValid && (
                  <p className="mt-1 text-xs text-destructive font-medium">
                    {t('pages.campaigns.wardrobeNotAvailable')}
                  </p>
                )}
              </div>

              {/* Scene Selector */}
              <div>
                <label
                  htmlFor="workspace-scene"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.scene')}</label>
                <select
                  id="workspace-scene"
                  name="workspaceScene"
                  value={workspaceSelections.sceneId}
                  onChange={(e) =>
                    setWorkspaceSelections((prev) => ({
                      ...prev,
                      sceneId: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">{t('pages.campaigns.noneSelected')}</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {!isWorkspaceSceneValid && workspaceSelections.sceneId && (
                    <option value={workspaceSelections.sceneId} disabled>
                      {workspaceSelections.sceneId} {t('pages.campaigns.notAvailableSuffix')}
                    </option>
                  )}
                </select>
                {!isWorkspaceSceneValid && (
                  <p className="mt-1 text-xs text-destructive font-medium">
                    {t('pages.campaigns.sceneNotAvailable')}
                  </p>
                )}
              </div>

              {/* Pose Selector */}
              <div>
                <label
                  htmlFor="workspace-pose"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >{t('pages.campaigns.pose')}</label>
                <select
                  id="workspace-pose"
                  name="workspacePose"
                  value={workspaceSelections.poseId}
                  onChange={(e) =>
                    setWorkspaceSelections((prev) => ({
                      ...prev,
                      poseId: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">{t('pages.campaigns.noneSelected')}</option>
                  {poses.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {!isWorkspacePoseValid && workspaceSelections.poseId && (
                    <option value={workspaceSelections.poseId} disabled>
                      {workspaceSelections.poseId} {t('pages.campaigns.notAvailableSuffix')}
                    </option>
                  )}
                </select>
                {!isWorkspacePoseValid && (
                  <p className="mt-1 text-xs text-destructive font-medium">
                    {t('pages.campaigns.poseNotAvailable')}
                  </p>
                )}
              </div>
            </div>

            {/* Recent Prompts Section */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-0.5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />{t('pages.campaigns.recentPrompts')}</h4>
                {(() => {
                  const count = promptHistory.filter((e) => e.campaignId === campaignInWorkspace.id).length;
                  return (
                    <p className="text-xs text-muted-foreground font-medium ml-[22px]">
                      {count === 1
                        ? t('pages.campaigns.promptLinkedSingular', { count })
                        : t('pages.campaigns.promptsLinkedPlural', { count })}
                    </p>
                  );
                })()}
              </div>

              {/* Accessible Polite Status Messenger for copy operations */}
              <div aria-live="polite" className="sr-only" role="status">
                {copyStatusMessage}
              </div>

              {(() => {
                const recentPrompts = promptHistory
                  .filter((e) => e.campaignId === campaignInWorkspace.id)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                
                const displayPrompts = recentPrompts.slice(0, 5);

                if (displayPrompts.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-muted/5">{t('pages.campaigns.noPromptsHaveBeenGeneratedForThisCampaig')}</div>
                  );
                }

                const getOutputTypeLabel = (type: string) =>
                  translateOutputType(type) || t('common.unknown');

                const getPlatformLabel = (platform: string) =>
                  translatePlatform(platform) || t('common.unknown');

                return (
                  <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {displayPrompts.map((entry) => {
                      const isCopied = copiedPromptId === entry.id;
                      return (
                        <li
                          key={entry.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/5 p-3 hover:bg-muted/10 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-b border-border/40 pb-1.5">
                            <span className="font-medium">
                              {formatDateTime(entry.createdAt)}
                            </span>
                            <div className="flex gap-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                {getOutputTypeLabel(entry.configuration.outputType)}
                              </span>
                              <span className="inline-flex items-center rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-border/40">
                                {getPlatformLabel(entry.configuration.platform)}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-mono line-clamp-2 text-ellipsis leading-relaxed break-all whitespace-pre-wrap text-muted-foreground bg-muted/20 border border-border/40 p-2 rounded-md">
                            {entry.generatedPrompt}
                          </div>

                          <div className="flex items-center justify-end text-[11px]">
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleRecentPromptCopy(entry)}
                                className="font-semibold text-primary hover:underline flex items-center gap-1 focus:outline-none"
                              >
                                {isCopied ? t('common.copied') : t('common.copy')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/prompt-engine?historyId=${entry.id}`);
                                }}
                                className="font-semibold text-primary hover:underline focus:outline-none"
                              >{t('pages.campaigns.openInPromptEngine')}</button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {/* Open in Prompt Engine */}
              <AppButton
                type="button"
                variant="outline"
                onClick={() => {
                  navigate(`/prompt-engine?campaignId=${campaignInWorkspace.id}`);
                }}
                disabled={isCampaignDeletedExternally}
                className="w-full sm:w-auto text-primary border-primary/30 hover:bg-primary/5"
              >{t('pages.campaigns.openInPromptEngine')}</AppButton>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end w-full sm:w-auto">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={closeWorkspace}
                  className="w-full sm:w-auto"
                >{t('pages.campaigns.cancel')}</AppButton>
                <AppButton
                  type="submit"
                  variant="primary"
                  disabled={(!hasWorkspaceChanges && !hasOrphanedIds) || isCampaignDeletedExternally || hasExternalConflict}
                  className="w-full sm:w-auto"
                >{t('pages.campaigns.saveChanges')}</AppButton>
              </div>
            </div>
          </form>
        )}
      </AppModal>
    </div>
  );
}

export default CampaignsPage;
