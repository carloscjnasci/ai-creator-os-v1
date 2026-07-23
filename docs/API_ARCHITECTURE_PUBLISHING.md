# API Architecture — Secure Social Publishing

## Boundary

The frontend must never call social publishing APIs with privileged credentials. A secure backend gateway owns account authorization, token refresh, platform requests and webhook processing.

## Suggested endpoints

### POST `/publishing/jobs`

Creates an idempotent publishing job.

Request:

```ts
interface CreatePublishingSessionRequest {
  publicationId: string;
  platform: PublishingPlatform;
  connectionId?: string;
  idempotencyKey: string;
  scheduledAt?: string;
  payload: {
    title: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    destinationUrl?: string;
    assetId: string;
  };
}
```

Response:

```ts
interface CreatePublishingSessionResponse {
  jobId: string;
  status: 'queued' | 'running';
  acceptedAt: string;
}
```

### GET `/publishing/jobs/:id`

Returns queued, running, succeeded, failed or cancelled state. A successful response may include `remotePostId`, `permalink` and `publishedAt`.

### DELETE `/publishing/jobs/:id`

Requests cancellation when the platform has not completed publication.

### POST `/publishing/connections/:platform/authorize`

Future backend-only OAuth initiation endpoint. It must use PKCE or the current platform-recommended authorization flow and a server-validated state value.

### GET `/publishing/connections/:id/status`

Returns non-sensitive connection readiness metadata. It must never return access or refresh tokens.

### POST `/publishing/webhooks/:platform`

Future platform callback endpoint. The backend must verify the platform signature before accepting status or analytics events.

## Backend responsibilities

- authenticate the Workspace user;
- verify account ownership and permissions;
- store OAuth material encrypted;
- rotate and revoke tokens;
- resolve the Creative Asset through secure storage;
- fetch or stream media without exposing privileged storage URLs;
- enforce current platform limits;
- create platform-specific payloads;
- handle rate limits and retries;
- enforce idempotency;
- verify webhook signatures;
- write immutable audit records;
- normalize remote errors;
- return stable post identifiers and permalinks.

## Frontend responsibilities

- collect title, caption, hashtags, schedule and asset selection;
- run local preflight validation;
- request approval;
- display connection readiness without secrets;
- send stable IDs to the backend;
- display job state and normalized errors;
- record the returned stable identifiers;
- never persist privileged credentials.

## Idempotency

The backend must treat `idempotencyKey` as unique within a Workspace and platform. Repeated requests must return the original job or result rather than creating duplicate posts.

## Error model

Suggested normalized codes:

- `AUTHORIZATION_REQUIRED`
- `ACCOUNT_PERMISSION_DENIED`
- `ASSET_NOT_READY`
- `PLATFORM_VALIDATION_FAILED`
- `PLATFORM_RATE_LIMITED`
- `PLATFORM_UNAVAILABLE`
- `DUPLICATE_REQUEST`
- `SCHEDULE_EXPIRED`
- `PUBLISHING_FAILED`
- `WEBHOOK_SIGNATURE_INVALID`

## Scheduling

Production scheduling belongs to a durable server-side queue. The browser may display and edit schedules, but it cannot guarantee execution when closed or offline.

## Metrics handoff

A successful publication changes `metricsStatus` to `waiting`. Sprint 13F can use normalized webhook and polling events to attach performance telemetry to publication, asset, prompt, campaign and Digital Human lineage.
