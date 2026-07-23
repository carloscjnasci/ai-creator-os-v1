# Sprint 13E — Publishing Hub

## Objective

Convert the publishing step of a Creative Plan into an operational editorial and distribution workflow connected to campaigns, assets, execution and future analytics.

## Functionality delivered

- Publishing Hub route and navigation;
- campaign-to-publication draft creation;
- Creative Plan title, caption and hashtag reuse;
- automatic campaign asset selection;
- configurable platform preflight policies;
- review and approval flow;
- local editorial scheduling;
- due-schedule runner;
- deterministic mock publishing adapter;
- manual export adapter;
- secure backend adapter contract;
- publishing jobs and retry limits;
- idempotent result reuse;
- Campaign Builder synchronization;
- Execution Center result synchronization;
- Creative Graph publication lineage;
- channel connection preferences without credentials;
- Workspace Backup v6;
- backward compatibility with backups v1–v5.

## Files added

- `src/features/publishing-hub/types.ts`
- `src/features/publishing-hub/index.ts`
- `src/features/publishing-hub/lib/publishingSchemas.ts`
- `src/features/publishing-hub/lib/publishingStorage.ts`
- `src/features/publishing-hub/lib/publishingPolicies.ts`
- `src/features/publishing-hub/lib/publishingContracts.ts`
- `src/features/publishing-hub/lib/publishingService.ts`
- `src/features/publishing-hub/adapters/mockPublishingAdapter.ts`
- `src/features/publishing-hub/adapters/manualPublishingAdapter.ts`
- `src/features/publishing-hub/adapters/securePublishingAdapter.ts`
- `src/features/publishing-hub/pages/PublishingHubPage.tsx`
- Publishing Hub tests and documentation.

## Files modified

- routes, navigation and application lazy loading;
- Dashboard quick actions;
- Creative Event Bus;
- Creative Graph;
- Workspace Backup and compatibility tests;
- README.

## Backup v6

Backup v6 includes safe metadata for:

- publication drafts;
- publishing jobs;
- channel connection preferences.

It excludes credentials because the domain does not accept or store them. Versions v1 through v5 remain importable and initialize publishing collections as empty.

## Tests

The Sprint protects:

- validation policies;
- media compatibility;
- idempotent draft creation;
- review and approval gates;
- schedule validation;
- due-schedule execution;
- mock publishing;
- publishing-job idempotency;
- Campaign Builder synchronization;
- Execution Center synchronization;
- cancellation, retry, archive and restore;
- storage parsing and subscription cleanup;
- deterministic mock output;
- secure transport payload safety;
- Event Bus archive and clear behavior;
- Creative Graph idempotency;
- backup v1–v6 compatibility.

## Security

No OAuth token, refresh token, social API key, client secret, cookie or authorization header is stored in source, localStorage or backup. Real publishing is explicitly delegated to a secure backend.

## Explicit non-goals

- real social network publication;
- live OAuth;
- remote scheduling workers;
- webhook ingestion;
- social metrics collection;
- production notifications;
- multi-user approval permissions.

## Remaining limitations

The local schedule runner executes only while the application is open. Platform rules are configurable preflight defaults and require backend revalidation against current APIs before production publication.
