# 13 — AI Provider Gateway

## Purpose

The AI Provider Gateway is the secure runtime boundary between the AI Creator OS Execution Engine and external generative AI providers.

It converts a ready Production Center task into an idempotent provider job, sends the request through an approved adapter, tracks asynchronous status, and writes successful outputs back into the Workspace learning loop.

The frontend never stores provider API keys.

## Architecture

```text
Creative Intent
→ Creative Plan
→ Execution Run
→ Execution Task
→ Provider Job
→ Secure Adapter
→ Provider Backend
→ Generated Output
→ Prompt Intelligence / Creative Library
```

Runtime structure:

```text
src/core/provider-gateway
├── types.ts
├── providerRegistry.ts
├── jobEngine.ts
├── adapters.ts
└── index.ts

src/features/provider-gateway
├── lib/providerJobStorage.ts
├── lib/providerConnectionStorage.ts
├── lib/providerGatewayService.ts
├── pages/ProviderGatewayPage.tsx
└── __tests__/providerGatewayContracts.test.ts
```

## Provider Registry

Registered providers:

- COS Mock Provider
- Gemini
- Imagen
- Flow
- Veo

Each definition declares:

- capabilities
- compatible execution domains
- default model label
- connection mode
- backend availability
- polling support
- cancellation support
- retry limit

The local mock provider is always available. Real providers require `VITE_AI_GATEWAY_URL` to point to a server-side gateway.

## Security Boundary

The browser may store:

- provider enabled/disabled preference
- non-secret model labels
- provider job metadata
- job status and output lineage

The browser must never store:

- API keys
- OAuth refresh tokens
- service-account credentials
- provider secrets
- signed long-lived provider credentials

Provider credentials belong exclusively in the server-side gateway environment.

## Job Contract

A Provider Job records:

- idempotency key
- provider and model
- execution run and task
- Creative Plan and campaign relationship
- request package
- attempt count and retry limit
- remote job identifier
- status
- output text or URL
- MIME type
- error code and message
- estimated cost
- timestamps

Statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

## Idempotency

The idempotency key is derived from:

- execution run
- execution task
- provider
- model
- provider package content

Equivalent queued, running or successful jobs are not dispatched twice.

## Adapters

### COS Mock Provider

The mock adapter executes locally and deterministically. It is intended for:

- end-to-end workflow testing
- UI validation
- backup validation
- integration testing
- demonstrations without paid API calls

Mock output URLs use the `mock://` scheme and are explicitly simulated assets.

### Secure Gateway Adapter

The secure adapter uses the backend contract:

```text
POST   /jobs
GET    /jobs/:id
DELETE /jobs/:id
```

Submission includes an `x-idempotency-key` header and contains no browser-side secret.

The backend is responsible for:

- provider authentication
- quotas
- rate limits
- request signing
- provider-specific payload conversion
- polling
- webhooks
- cost reconciliation
- output storage
- credential rotation

## Execution Center Integration

Ready prompt, image and video tasks can be dispatched directly from Production Center.

On dispatch:

1. compatibility is validated
2. provider enablement is checked
3. an idempotent job is created
4. the execution task moves to `in-progress`
5. the adapter submits the job
6. success or failure updates both the job and task

On success:

- the task is completed
- final output is stored
- Prompt Intelligence receives prompt tasks
- Creative Library receives image/video tasks
- Campaign Builder progress is synchronized
- provider model and job ID remain attached to the task
- Creative Graph can represent Provider Job lineage

## Retry and Cancellation

Failed or cancelled jobs may be retried while `attempt < maxAttempts`.

Retry:

- increments the attempt counter
- clears remote and error state
- restores the execution task to ready
- starts a new adapter submission using the same logical job

Cancellation:

- requests remote cancellation when supported
- marks the job cancelled
- marks the execution task failed with an audit note

## Persistence

Storage keys:

```text
ai-creator-os.provider-jobs.v1
ai-creator-os.provider-connections.v1
```

Workspace backup version 4 includes both collections. Backup versions 1, 2 and 3 remain valid and initialize provider collections safely.

## Events

Published events:

- `provider.job.created`
- `provider.job.updated`
- `provider.job.completed`

## Current Boundary

This Sprint provides the full client contract and a functional mock runtime. Real provider execution still requires deployment of the server-side gateway and provider credentials outside the frontend bundle.
