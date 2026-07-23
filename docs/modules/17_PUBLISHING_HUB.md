# Module Specification — Publishing Hub

## Module purpose

Prepare, validate, approve, schedule and trace distribution-ready content without exposing social-network credentials in the frontend.

## Primary users

- Workspace Owner: manages connections, approvals and publishing actions;
- Editor: prepares drafts and requests review;
- Viewer: inspects calendar, validation and lineage;
- future backend client: executes secure publishing jobs and reports results.

## Main screens

- Publishing summary;
- draft queue;
- publication editor;
- preflight validation;
- approval controls;
- editorial calendar;
- publishing-job status;
- channel preparation;
- publication result and permalink.

## Entities

- PublicationDraft;
- PublishingJob;
- PublishingConnectionPreference;
- PublicationValidationResult.

## User actions

- create from Campaign Workflow;
- select Creative Library asset;
- edit title, caption, hashtags and destination URL;
- request review;
- approve;
- schedule;
- publish through mock or manual mode;
- cancel;
- retry;
- archive;
- restore;
- run due local schedules.

## Validation rules

- a Creative Library asset is required;
- the asset type must match the platform policy;
- caption is required;
- titles are required where the configured policy requires them;
- configured title, caption and hashtag limits must pass;
- schedule must be in the future when created;
- timezone is required;
- publishing requires approval and a valid draft.

## Integrations

- AI Director supplies title, caption and hashtags through the Creative Plan;
- Campaign Builder supplies platform and lineage;
- Creative Library supplies media;
- Execution Center receives the publishing result;
- Creative Graph records publication lineage;
- Analytics receives a waiting metrics state after publication;
- Workspace Backup v6 stores safe metadata.

## Accessibility and responsive behavior

- all form controls use labels;
- validation is rendered as text, not color alone;
- status changes use an aria-live message;
- controls remain usable in one-column mobile layouts;
- calendar cards remain readable without hover.

## Explicit non-goals

- frontend OAuth;
- real social API tokens;
- guaranteed background schedules;
- automatic live metrics;
- webhook processing;
- team permission enforcement;
- production notification delivery.
