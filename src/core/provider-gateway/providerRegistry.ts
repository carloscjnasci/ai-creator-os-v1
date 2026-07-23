import type { AIProviderId, ProviderDefinition } from './types';
import type { ExecutionTask } from '../execution-engine';

const baseDefinitions: Omit<ProviderDefinition, 'availability'>[] = [
  {
    id: 'mock',
    name: 'COS Mock Provider',
    description: 'Local deterministic adapter for end-to-end testing without credentials or paid API calls.',
    capabilities: ['text', 'image', 'video'],
    executionDomains: ['prompt', 'image', 'video'],
    defaultModel: 'cos-mock-v1',
    connectionMode: 'local-mock',
    supportsCancellation: true,
    supportsPolling: true,
    maxAttempts: 3,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Text and multimodal reasoning through the secure AI Creator OS gateway.',
    capabilities: ['text'],
    executionDomains: ['prompt'],
    defaultModel: 'gemini-default',
    connectionMode: 'secure-gateway',
    supportsCancellation: true,
    supportsPolling: true,
    maxAttempts: 3,
  },
  {
    id: 'imagen',
    name: 'Imagen',
    description: 'Image generation through the secure AI Creator OS gateway.',
    capabilities: ['image'],
    executionDomains: ['image'],
    defaultModel: 'imagen-default',
    connectionMode: 'secure-gateway',
    supportsCancellation: true,
    supportsPolling: true,
    maxAttempts: 3,
  },
  {
    id: 'flow',
    name: 'Flow',
    description: 'Video production package execution through a secure backend adapter.',
    capabilities: ['video'],
    executionDomains: ['video'],
    defaultModel: 'flow-default',
    connectionMode: 'secure-gateway',
    supportsCancellation: true,
    supportsPolling: true,
    maxAttempts: 3,
  },
  {
    id: 'veo',
    name: 'Veo',
    description: 'Video generation through the secure AI Creator OS gateway.',
    capabilities: ['video'],
    executionDomains: ['video'],
    defaultModel: 'veo-default',
    connectionMode: 'secure-gateway',
    supportsCancellation: true,
    supportsPolling: true,
    maxAttempts: 3,
  },
];

export function getGatewayUrl(): string | undefined {
  const value = import.meta.env.VITE_AI_GATEWAY_URL?.trim();
  return value || undefined;
}

export function getProviderRegistry(gatewayUrl = getGatewayUrl()): ProviderDefinition[] {
  return baseDefinitions.map((definition) => ({
    ...definition,
    availability: definition.connectionMode === 'local-mock' || gatewayUrl
      ? 'available'
      : 'requires-backend',
  }));
}

export function getProviderDefinition(providerId: AIProviderId, gatewayUrl = getGatewayUrl()): ProviderDefinition {
  const definition = getProviderRegistry(gatewayUrl).find((item) => item.id === providerId);
  if (!definition) throw new Error(`Unknown AI provider: ${providerId}`);
  return definition;
}

export function getCompatibleProviders(task: ExecutionTask, gatewayUrl = getGatewayUrl()): ProviderDefinition[] {
  return getProviderRegistry(gatewayUrl).filter((provider) =>
    provider.executionDomains.includes(task.domain),
  );
}
