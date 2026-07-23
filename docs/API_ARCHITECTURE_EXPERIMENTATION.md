# API Architecture & Contracts — Experimentation Engine

This document outlines the API contracts, event payloads, and storage schemas governing the **Experimentation Engine** integration with the broader AI Creator OS.

---

## 1. Local Storage Schema Contracts

All experimentation data is persisted locally in JSON collections under standard keys. Each item must conform to the schemas defined in `/src/features/experimentation/types.ts`.

### A. Experiments Collection (`ai_creator_os:experiments`)
```json
[
  {
    "id": "exp-prompt-headline-trial",
    "name": "Headline Engagement Test",
    "description": "A/B testing direct call-to-action against intrigue-driven hook",
    "status": "running",
    "primaryMetric": "click_through_rate",
    "guardrails": ["unsubscribe_rate", "api_error_rate"],
    "allocationSplit": {
      "control-id": 0.5,
      "treatment-id": 0.5
    },
    "confidenceLevel": 0.95,
    "minimumSampleSize": 100,
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-17T08:00:00Z"
  }
]
```

### B. Variants Collection (`ai_creator_os:experiment_variants`)
```json
[
  {
    "id": "control-id",
    "experimentId": "exp-prompt-headline-trial",
    "name": "Standard Headline",
    "variantKey": "control",
    "allocationWeight": 0.5,
    "metadata": {
      "headline": "Grow Your Audience Instantly"
    }
  },
  {
    "id": "treatment-id",
    "experimentId": "exp-prompt-headline-trial",
    "name": "Intrigue Hook",
    "variantKey": "treatment_a",
    "allocationWeight": 0.5,
    "metadata": {
      "headline": "What 90% of Creators Get Wrong About Growth"
    }
  }
]
```

---

## 2. Event Payload Contracts

The Experimentation Engine relies on the Workspace Event Bus to ingest raw events and emit analytical conclusions.

### Ingesting Telemetry Events

#### `analytics.metric_logged`
Consumed by the engine to update experiment observations.
```typescript
interface MetricLoggedEvent {
  metricType: string;
  value: number;
  entityId?: string; // e.g., userId or clickId
  metadata?: {
    experimentId?: string;
    variantId?: string;
    [key: string]: any;
  };
}
```

### Emitting Analytical Outcomes

#### `experiment.analysis_completed`
Dispatched when statistical analysis finishes.
```typescript
interface ExperimentAnalysisCompletedEvent {
  experimentId: string;
  status: 'winner_detected' | 'inconclusive' | 'guardrail_violation' | 'no_difference';
}
```

#### `experiment.winner_detected`
Dispatched when a treatment variant beats the control and meets confidence/lift thresholds.
```typescript
interface ExperimentWinnerDetectedEvent {
  experimentId: string;
  winnerVariantId: string;
}
```

#### `experiment.guardrail_violated`
Dispatched when safety thresholds of a secondary metric are breached.
```typescript
interface ExperimentGuardrailViolatedEvent {
  experimentId: string;
  guardrails: string[];
}
```

---

## 3. Integration Handlers

### Publication Draft Integration
When a winning variant is selected, it can be exported as an official draft in the **Publishing Hub**.
```typescript
export function createPublicationDraft(
  variant: ExperimentVariant, 
  experiment: Experiment
): PublicationDraft {
  return {
    id: `draft-${Date.now()}`,
    title: `Exported Trial: ${experiment.name} - ${variant.name}`,
    platform: experiment.platform || 'youtube',
    lifecycleStatus: 'draft',
    experimentId: experiment.id,
    variantId: variant.id,
    metadata: {
      ...variant.metadata,
      sourceExperiment: experiment.name,
      evaluatedConfidence: experiment.confidenceLevel
    },
    createdAt: new Date().toISOString()
  };
}
```
This guarantees that **experimentId** and **variantId** are preserved inside the Publishing Hub registry for end-to-end tracing.
