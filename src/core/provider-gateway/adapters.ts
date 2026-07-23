import type {
  AIProviderId,
  ProviderAdapter,
  ProviderAdapterPollResult,
  ProviderAdapterSubmission,
  ProviderJob,
  ProviderJobResponse,
} from './types';
import { getGatewayUrl } from './providerRegistry';

function mockResponse(job: ProviderJob): ProviderJobResponse {
  const taskDomain = String(job.request.parameters.taskDomain ?? 'prompt');
  if (taskDomain === 'image') {
    return {
      outputText: `Mock image generated from ${job.request.title}.`,
      outputUrl: `mock://ai-creator-os/image/${job.id}`,
      mimeType: 'image/png',
      providerMetadata: { simulated: true, provider: job.providerId },
    };
  }
  if (taskDomain === 'video') {
    return {
      outputText: `Mock video generated from ${job.request.title}.`,
      outputUrl: `mock://ai-creator-os/video/${job.id}`,
      mimeType: 'video/mp4',
      providerMetadata: { simulated: true, provider: job.providerId },
    };
  }
  return {
    outputText: `${job.request.content}\n\nMOCK PROVIDER RESULT\nValidated and executed by COS Mock Provider.`,
    mimeType: 'text/plain',
    providerMetadata: { simulated: true, provider: job.providerId },
  };
}

export class MockProviderAdapter implements ProviderAdapter {
  async submit(job: ProviderJob): Promise<ProviderAdapterSubmission> {
    return {
      status: 'succeeded',
      remoteJobId: `mock-${job.id}`,
      response: mockResponse(job),
      estimatedCostUsd: 0,
    };
  }

  async poll(job: ProviderJob): Promise<ProviderAdapterPollResult> {
    return {
      status: 'succeeded',
      response: job.response ?? mockResponse(job),
      estimatedCostUsd: 0,
    };
  }

  async cancel(): Promise<boolean> {
    return true;
  }
}

interface GatewayResponse {
  id?: string;
  status?: ProviderAdapterPollResult['status'];
  outputText?: string;
  outputUrl?: string;
  mimeType?: string;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean>;
}

function parseGatewayResponse(value: GatewayResponse): ProviderAdapterPollResult {
  return {
    status: value.status ?? 'queued',
    response: value.outputText || value.outputUrl || value.mimeType || value.metadata
      ? {
          outputText: value.outputText,
          outputUrl: value.outputUrl,
          mimeType: value.mimeType,
          providerMetadata: value.metadata,
        }
      : undefined,
    estimatedCostUsd: value.estimatedCostUsd,
    errorCode: value.errorCode,
    errorMessage: value.errorMessage,
  };
}

export class SecureGatewayAdapter implements ProviderAdapter {
  constructor(private readonly gatewayUrl: string) {}

  async submit(job: ProviderJob): Promise<ProviderAdapterSubmission> {
    const response = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-idempotency-key': job.idempotencyKey,
      },
      body: JSON.stringify({
        provider: job.providerId,
        model: job.model,
        request: job.request,
        context: {
          executionRunId: job.executionRunId,
          executionTaskId: job.executionTaskId,
          planId: job.planId,
          campaignId: job.campaignId,
        },
      }),
    });
    if (!response.ok) throw new Error(`Gateway submission failed with HTTP ${response.status}.`);
    const payload = await response.json() as GatewayResponse;
    const parsed = parseGatewayResponse(payload);
    return {
      status: parsed.status,
      remoteJobId: payload.id,
      response: parsed.response,
      estimatedCostUsd: parsed.estimatedCostUsd,
      errorCode: parsed.errorCode,
      errorMessage: parsed.errorMessage,
    };
  }

  async poll(job: ProviderJob): Promise<ProviderAdapterPollResult> {
    if (!job.remoteJobId) throw new Error('The provider job has no remote job identifier.');
    const response = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/jobs/${encodeURIComponent(job.remoteJobId)}`);
    if (!response.ok) throw new Error(`Gateway polling failed with HTTP ${response.status}.`);
    return parseGatewayResponse(await response.json() as GatewayResponse);
  }

  async cancel(job: ProviderJob): Promise<boolean> {
    if (!job.remoteJobId) return true;
    const response = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/jobs/${encodeURIComponent(job.remoteJobId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  }
}

export function createProviderAdapter(providerId: AIProviderId): ProviderAdapter {
  if (providerId === 'mock') return new MockProviderAdapter();
  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) throw new Error('A secure AI gateway backend is required for this provider.');
  return new SecureGatewayAdapter(gatewayUrl);
}
