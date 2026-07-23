import type {
  Campaign,
  CampaignStatus,
} from '@/features/campaigns/types';

export const CAMPAIGN_STORAGE_KEY =
  'ai-creator-os.campaigns.v1';

const validCampaignStatuses: CampaignStatus[] = [
  'draft',
  'active',
  'completed',
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCampaign(value: unknown): value is Campaign {
  if (!isRecord(value)) {
    return false;
  }

  const {
    id,
    name,
    description,
    status,
    createdAt,
    characterId,
    productId,
    wardrobeItemId,
    sceneId,
    poseId,
  } = value;

  const isOptString = (v: unknown) => v === undefined || typeof v === 'string';

  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof name === 'string' &&
    name.length > 0 &&
    typeof description === 'string' &&
    typeof status === 'string' &&
    validCampaignStatuses.includes(
      status as CampaignStatus,
    ) &&
    typeof createdAt === 'string' &&
    !Number.isNaN(Date.parse(createdAt)) &&
    isOptString(characterId) &&
    isOptString(productId) &&
    isOptString(wardrobeItemId) &&
    isOptString(sceneId) &&
    isOptString(poseId)
  );
}

export function parseStoredCampaigns(
  serializedCampaigns: string | null,
): Campaign[] {
  if (!serializedCampaigns) {
    return [];
  }

  try {
    const parsedCampaigns: unknown =
      JSON.parse(serializedCampaigns);

    if (!Array.isArray(parsedCampaigns)) {
      return [];
    }

    return parsedCampaigns.filter(isCampaign);
  } catch {
    return [];
  }
}

export function loadCampaignsFromStorage(): Campaign[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedCampaigns = window.localStorage.getItem(
      CAMPAIGN_STORAGE_KEY,
    );

    return parseStoredCampaigns(storedCampaigns);
  } catch {
    return [];
  }
}

export function saveCampaignsToStorage(
  campaigns: Campaign[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      CAMPAIGN_STORAGE_KEY,
      JSON.stringify(campaigns),
    );

    return true;
  } catch {
    return false;
  }
}

export function subscribeToCampaignStorage(
  listener: (campaigns: Campaign[]) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  function handleStorageEvent(event: StorageEvent) {
    if (
      event.storageArea !== window.localStorage ||
      event.key !== CAMPAIGN_STORAGE_KEY
    ) {
      return;
    }

    listener(parseStoredCampaigns(event.newValue));
  }

  window.addEventListener(
    'storage',
    handleStorageEvent,
  );

  return () => {
    window.removeEventListener(
      'storage',
      handleStorageEvent,
    );
  };
}
