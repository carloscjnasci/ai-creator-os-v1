import { z } from 'zod';
import {
  AI_PROVIDER_IDS,
  getProviderRegistry,
  type ProviderConnectionPreference,
} from '@/core/provider-gateway';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';

export const PROVIDER_CONNECTION_STORAGE_KEY = 'ai-creator-os.provider-connections.v1';

export const providerConnectionSchema = z.object({
  id: z.string().min(1),
  providerId: z.enum(AI_PROVIDER_IDS),
  enabled: z.boolean(),
  defaultModel: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export const parseStoredProviderConnections = (value: string | null) =>
  parseCollection(value, providerConnectionSchema);

export function loadProviderConnections(): ProviderConnectionPreference[] {
  const stored = loadCollection(PROVIDER_CONNECTION_STORAGE_KEY, providerConnectionSchema);
  const now = new Date().toISOString();
  return getProviderRegistry().map((provider) => {
    const preference = stored.find((item) => item.providerId === provider.id);
    return preference ?? {
      id: `provider-connection-${provider.id}`,
      providerId: provider.id,
      enabled: provider.id === 'mock',
      defaultModel: provider.defaultModel,
      updatedAt: now,
    };
  });
}

export const saveProviderConnections = (connections: ProviderConnectionPreference[]) =>
  saveCollection(PROVIDER_CONNECTION_STORAGE_KEY, connections);
