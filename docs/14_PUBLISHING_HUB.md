# AI Creator OS — Publishing Hub Architecture

## Purpose

The Publishing Hub converts approved campaign outputs into validated, reviewable and schedulable publication records. It is the distribution boundary between generated Creative Library assets and future social-network integrations.

The frontend implementation is deliberately local-first. It provides a complete operational workflow through mock and manual adapters while keeping OAuth credentials, refresh tokens, platform secrets and privileged publishing operations outside the browser.

## End-to-end flow

```text
Creative Intent
  → Creative Plan
  → Campaign Workflow
  → Execution Run
  → Provider Job
  → Cloud Asset
  → Creative Library Asset
  → Publication Draft
  → Review and Approval
  → Schedule
  → Publishing Job
  → Published Result
  → Metrics Collection State
```

## Domain records

### PublicationDraft

A publication draft contains stable lineage identifiers, platform content, selected media, approval state, schedule, adapter mode, validation report, publishing result and metrics-collection state.

Important relationships:

- `campaignId` and `workflowId` connect distribution to planning;
- `creativePlanId` connects title, caption and hashtags to the Creative Planner;
- `executionRunId` and `executionTaskId` connect the result to Production Center;
- `creativeAssetId` and `cloudAssetId` connect media lineage;
- `activeJobId` connects asynchronous distribution work;
- `remotePostId` and `permalink` represent the stable external result when available.

### PublishingJob

Publishing jobs protect asynchronous state and retries independently from the editorial draft. Jobs are idempotent and support:

- queued;
- running;
- succeeded;
- failed;
- cancelled.

A successful job is reused when the same publication idempotency key is processed again.

### PublishingConnectionPreference

Connection preferences contain only safe UI metadata:

- platform;
- account label;
- adapter mode;
- enabled state;
- connection readiness status.

They never contain OAuth access tokens, refresh tokens, cookies, client secrets or authorization headers.

## Publication lifecycle

```text
draft
  → in-review
  → approved
  → scheduled
  → publishing
  → published
```

Additional transitions:

- draft, failed or cancelled → in-review;
- in-review → draft when changes are requested;
- approved → publishing for immediate publication;
- scheduled → publishing when the schedule is due;
- publishing → failed;
- failed or cancelled → retry preparation;
- any non-active record → archived;
- archived → its last safe editorial state.

Published records remain immutable in the editor. Archive is non-destructive and preserves lineage.

## Platform policy profiles

The current browser policies are configurable preflight defaults, not authoritative copies of live social-network API rules. They protect:

- title presence and configured length;
- caption presence and configured length;
- hashtag count and duplicates;
- asset presence;
- allowed asset type;
- source URL availability;
- schedule timestamp;
- timezone.

Production backend integrations must revalidate against the current platform API immediately before publishing.

## Adapters

### Mock adapter

The mock adapter provides deterministic local results and clearly uses the reserved `.invalid` domain. It enables end-to-end testing without network credentials or platform calls.

### Manual adapter

Manual mode prepares and records an export-oriented publishing result. It does not claim to have posted content to a social network.

### Secure backend adapter

The secure adapter depends on an injected backend transport. The frontend sends only stable publication metadata and asset identifiers. The backend must own OAuth, account verification, platform API calls, webhooks and token rotation.

## Integrations

### Campaign Builder

Scheduling changes `publishingStatus` to `scheduled`. Successful publication changes it to `published` and starts the analytics collection state.

### Execution Center

A successful publication writes the permalink to the publishing task and completes the task when its dependency state permits completion.

### Creative Graph

Publishing adds:

- publication nodes;
- publishing-job nodes;
- asset → publication relationships;
- execution-task → publication relationships;
- publication → campaign relationships;
- publishing-job → publication relationships.

Edges are deduplicated.

### Event Bus

The Hub publishes draft, validation, approval, schedule, execution, success, failure, retry, cancellation, archive and restore events. It consumes campaign archive and workspace-clear events through a singleton subscription.

## Security model

The browser must not persist:

- OAuth tokens;
- refresh tokens;
- platform client secrets;
- cookies or session credentials;
- authorization headers;
- webhook signing secrets;
- privileged API URLs.

A real integration requires an authenticated backend with encrypted secret storage, access control, audit logs, platform-specific rate limiting and webhook signature verification.

## Current limitations

- platform API publishing is simulated or manual;
- live platform limits are not fetched dynamically;
- no social OAuth connection flow exists;
- no webhook ingestion exists;
- no real remote metrics are collected;
- the editorial calendar is a local scheduling view;
- browser timers do not guarantee background publication when the app is closed.
