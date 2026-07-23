# API Architecture — Secure Analytics Ingestion & Feedback

## Boundary

The frontend must never call raw analytics platforms with privileged credentials. A secure backend gateway owns account authorization, token refresh, query composition, platform rate-limiting, and webhook processing. All metrics are aggregated server-side and returned to the client as clean, credential-free performance snapshots.

## Suggested endpoints

### POST `/api/analytics/connections`

Future backend-only OAuth connection setup. Initiates or completes platform channel associations.

Request:

```ts
interface CreateAnalyticsConnectionRequest {
  platform: AnalyticsPlatform;
  workspaceId: string;
  authorizationCode: string; // Temporary authorization code from OAuth callback
}
```

Response:

```ts
interface CreateAnalyticsConnectionResponse {
  id: string;
  platform: AnalyticsPlatform;
  externalChannelId: string;
  channelName: string;
  connectionStatus: 'active' | 'suspended';
  connectedAt: string;
}
```

### GET `/api/analytics/connections`

Returns non-sensitive channel status lists. Must never expose access tokens, secret keys, or audience identifiers.

### POST `/api/analytics/snapshots`

Triggers an on-demand server-side pull of metrics for a specific publication.

Request:

```ts
interface TriggerSnapshotPullRequest {
  publicationDraftId: string;
  publicationJobId: string;
  platform: AnalyticsPlatform;
  externalPublicationId: string;
  metricWindow: MetricWindow;
}
```

Response:

```ts
interface TriggerSnapshotPullResponse {
  snapshotId: string;
  status: 'draft' | 'normalized' | 'attributed';
  capturedAt: string;
}
```

### GET `/api/analytics/snapshots/:id/scorecard`

Retrieves the computed scorecard and predictions.

## Backend responsibilities

- authenticate the Workspace user;
- verify account permission scopes;
- store external metrics keys, API credentials, and client secrets encrypted;
- execute query compilation against social platforms;
- rotate and revoke tokens;
- handle rate limits, platform retries, and network error models;
- normalize platform-specific metrics (e.g. mapping video views and interactions) into a single standard;
- enforce absolute security isolation: never return user emails, phone lists, raw platform audience profile blocks, or secret tokens.

## Frontend responsibilities

- display connection readiness with zero credentials;
- submit stable tracking references (`publicationDraftId`, `publicationJobId`) when requesting metric refreshes;
- run client-side metric derivation, scorecard composition, and outlier detection for offline validation;
- record user Accept/Reject decisions on recommendations;
- persist learning context locally and safely within the workspace boundaries;
- never store or requests platform credentials or tokens.

## Idempotency

The backend must treat `publicationDraftId` and `publicationJobId` as an idempotent unique key pair when creating tracking entries to prevent duplicate snap generation and ensure double-counting of metrics does not occur.

## Error model

Suggested normalized codes:

- `CONNECTION_EXPIRED`
- `CHANNEL_NOT_FOUND`
- `METRICS_NOT_YET_AVAILABLE`
- `PLATFORM_RATE_LIMITED`
- `UNAUTHORIZED_FEED_ACCESS`
