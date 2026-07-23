# AI Creator OS — Creative Operating System

AI Creator OS is no longer positioned as a prompt generator. It is a local-first operating system for AI-assisted content production, connecting research, creative decisions, Digital Humans, campaigns, prompts, generated assets, publishing preparation and analytics.

The primary interaction is a **Creative Intent**: the user describes the outcome they want and the AI Director creates an auditable execution plan.

# AI Creator OS — Google AI Studio edition

This version is built on top of the robust, validated codebase from previous phases, incorporating comprehensive settings, runtime resilience, advanced workspace navigation, immersive campaign creative management, and campaign-level prompt tracking.

## Compatible Runtime

- React 18
- Vite 5
- TypeScript
- React Router
- Tailwind CSS
- Browser localStorage persistence
- Optional Firebase configuration

---

## Active Modules & Sprint History

### 1. Dashboard & Sprint 12A (Workspace Navigation)
Provides a high-level creative overview of the workspace, displaying real-time statistics (total, active, completed campaigns), quick action shortcuts (New Campaign, New Scene, New Pose), and a list of active campaigns.
- **Dynamic Global Search**: Integrated dynamic search and quick-filters across all library entities (Characters, Products, Wardrobe, Scenes, Poses) and Campaigns directly from the main view.
- **Fluid transitions**: Uses smooth transitions and robust routing.

### 2. Campaigns, Campaign Creative Workspace & Sprint 12B
Organizing and managing campaigns with standard status workflows (Draft, Active, Completed). It integrates a live-synchronized workspace modal for complex multi-asset referencing:
- **Five-Asset Integration**: Links any campaign with specific Character, Product, Wardrobe Item, Scene, and Pose references.
- **Storage Compatibility**: Maintained under the canonical key `ai-creator-os.campaigns.v1`, supporting seamless loading of both legacy unlinked campaigns and newly structured multi-asset campaigns.
- **Orphan ID Cleaning**: Scans library assets upon opening a workspace, detects deleted references, flags them with visual indicators (e.g. "Pose is no longer available"), and purges invalid IDs upon saving.
- **Tab Conflict & Deletion Warnings**: Employs an external conflict detector. If a campaign is updated in another tab, it prompts the user to "Reload external changes" or "Keep my selections". If a campaign is deleted in another tab while editing, a blocking banner disables save actions and advises on safe closure options.

### 3. Reusable Creative Libraries
Dedicated profile management hubs for:
- **Characters**: Profile management containing names, descriptions, visual reference placeholders, and tag metadata.
- **Products**: Register names, SKU numbers, category descriptors, and specific visual assets.
- **Wardrobe**: Document clothing types, fits, and color definitions.
- **Scenes**: Location settings detailing lighting, camera angles, and mood parameters.
- **Poses**: Character stances, rotation, and dynamic elements.

### 4. Prompt Engine & Sprint 12C (Campaign Prompt Tracking)
Advanced composer that integrates creative assets with custom constraints into structured prompts for image/video generation.
- **Prompt History Extensions**: History logs now include optional `campaignId` and `campaignName` fields.
- **Retrocompatible Validation**: Old history logs are parsed with optional string fields (set to `undefined`), while new logs strictly validate that non-undefined fields must be non-null strings.
- **Advanced History Filtering**: Filter logs by All Prompts, Campaign Prompts, Standalone Prompts, or prompts specifically linked to the active campaign.
- **Verification Badges**: Displays original campaign names on history cards with safe warnings if the campaign is deleted ("Original campaign no longer available").
- **Recent Prompts (Campaign Workspace)**: A dedicated section inside the Campaign Workspace displaying up to 5 recently generated prompts. Shows prompt previews, creation timestamps, output type (Image/Video), and platform (Google Veo 3, Grok, Nano Banana, Generic AI Generator), equipped with safe asynchronous copy actions (with visual feedback and `aria-live` announcements) and direct deep-linking ("Open in Prompt Engine").
- **Exclusion Cross-Tab Handling**: Safely clears loaded campaign context, updates internal lists, removes invalid "Current campaign" filters, and alerts the user when a campaign has been deleted in another browser tab, without losing the user's active draft or configurations.

### 5. Settings, Backup & Restore (Sprint 10C)
Comprehensive settings management page containing theme configurations, prompt composer defaults, and complete workspace data backup/restore:
- **Default Prompt Configurations**: Set global fallback defaults for output type (Image, Video), target platform, and video duration.
- **Theme Selection**: Choose between sleek Dark Mode, high-contrast Slate Theme, and system-adaptive settings.
- **Meticulous Backup Export**: Compiles all campaigns, library assets, custom configurations, and prompt history into a single structured JSON backup file with complete type integrity.
- **Atomic Rollback Restore**: Validates the imported backup file. If any corruption, type mismatch, or structure violation is detected (such as nested arrays, invalid platform types, or object mismatches), the import is safely aborted, reverting to the previous state with atomic precision.

### 6. Runtime Resilience & Sprint 11B
Defensive bounds check, missing key fallbacks, and clean graceful degradations across all views to prevent any runtime exceptions or application crashes:
- **Missing Resource Fallbacks**: If a library asset or referenced campaign is missing, the UI falls back to clean placeholders, safe defaults, and explicit visual warnings instead of throwing.
- **Storage Protection**: Standard storage validation checks all inputs at load time, discarding invalid objects while keeping valid entries intact.

### 7. Analytics
Read-only performance analytics dashboard:
- **Zero External Tracking**: Runs completely locally using cached assets and browser local storage.
- **Dynamic Charting**: Built with `recharts` to render active status distributions, composition ratios, and timeline metrics.

---

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run build
```

No `.env` file is required for the current localStorage features. Firebase remains optional.

## Google AI Studio

Import the project files and run the default development command:

```bash
npm run dev
```

The Vite server listens on `0.0.0.0:3000` for preview compatibility.


---

## Sprint 13A — Creative Operating System Foundation

This candidate introduces the operational COS layer:

- **AI Director**: converts a Creative Intent into strategy, asset selection, a ten-stage Execution Plan, provider prompt package and publishing package.
- **AI Research Hub**: stores verified trend signals and calculates content outliers against user-provided baselines.
- **Viral Analyzer**: analyzes hook, storytelling, CTA, camera, lighting, emotion, caption, hashtags, audio, scene, clothing, expression, pose and rhythm, then adapts the structure to Workspace assets.
- **Campaign Builder**: persists the complete Objective → Product → Digital Human → Wardrobe → Scene → Prompt → Image → Video → Publishing → Analytics flow.
- **Digital Human Intelligence**: adds personality, memory, voice, appearance, Prompt DNA, Negative Prompt, brand rules, references and lifecycle.
- **Prompt Intelligence**: detects conflicts, redundancy, length and ambiguity while preserving prompt version lineage.
- **AI Asset Library**: stores generated assets with campaign, Digital Human, product, wardrobe, scene, prompt and model metadata.
- **Viral Score**: estimates pre-production readiness across eight creative dimensions.
- **Creative Graph and Event Bus**: provide traceability foundations for future learning and orchestration.

### New routes

- `/ai-director`
- `/research`
- `/viral-analyzer`
- `/campaign-builder`
- `/digital-humans`
- `/prompt-intelligence`
- `/creative-library`

The root route now opens AI Director. All Sprint 12C routes remain supported.

### Tests

```bash
npm run test
npm run test:run
```

Workspace backup version 2 includes every COS collection and remains backward-compatible with version 1 backups.

### Current integration boundary

Live trend ingestion, social URL transcription, direct Gemini/Imagen/Flow/Veo execution and cloud asset upload require authorized external connectors. The current implementation provides complete local contracts, workflows and provider-ready outputs without fabricating live data.

---

## Sprint 13B — Execution Engine & Production Center

Sprint 13B operationalizes the Creative Plans introduced in Sprint 13A.

### Production Center

New route:

- `/execution-center`

The Production Center provides:

- dependency-aware production queues
- requirement blockers and explicit resolution
- task states for ready, in progress, review, completed, failed and skipped work
- deterministic progress calculation
- provider-specific execution packages
- output URLs, final text and production notes
- automatic Prompt Intelligence registration
- automatic image/video Asset Library registration
- Campaign Builder synchronization
- Creative Graph execution lineage

### AI Director integration

Creating a campaign now also creates:

- a Campaign Builder workflow
- an Execution Run

The user is routed directly to the Production Center.

### Workspace backup v3

Workspace backup version 3 includes:

- all Sprint 12C collections
- all Sprint 13A COS collections
- Sprint 13B execution runs

Version 1 and version 2 backups remain importable. Missing execution data is initialized as an empty collection.

### Test coverage

The automated suite now protects:

- execution dependency ordering
- requirement blockers
- valid and invalid task transitions
- progress and completion calculation
- provider package generation
- execution storage parsing
- Prompt Intelligence registration
- Creative Asset registration
- Campaign Builder synchronization
- backup v1, v2 and v3 compatibility

### Integration boundary

External provider execution remains intentionally disconnected until secure credentials, server-side proxying, quotas and asynchronous job contracts are implemented.

---

## Sprint 13C — AI Provider Gateway

Sprint 13C connects the Production Center to a secure provider runtime contract.

### Provider Gateway

New route:

- `/provider-gateway`

Registered providers:

- COS Mock Provider
- Gemini
- Imagen
- Flow
- Veo

The Provider Gateway includes:

- provider capability registry
- provider enablement and model preferences
- idempotent provider jobs
- queued, running, succeeded, failed and cancelled statuses
- bounded retries
- cancellation
- manual polling
- estimated cost metadata
- complete execution-run and execution-task lineage

### Production Center execution

Ready prompt, image and video tasks can now be dispatched to an enabled compatible provider.

The local COS Mock Provider completes the full workflow without credentials or paid calls. Successful provider output automatically updates the Execution Task, Prompt Intelligence, Creative Library and Campaign Builder.

### Secure backend boundary

Real Gemini, Imagen, Flow and Veo execution requires:

```env
VITE_AI_GATEWAY_URL=https://your-secure-gateway.example
```

This value is only the public backend endpoint. Provider API keys and credentials must remain on the server and must never be included in `.env` frontend variables, localStorage or the production bundle.

### Workspace backup v4

Backup version 4 includes:

- provider jobs
- provider connection preferences
- every Sprint 12C, 13A and 13B collection

Backup versions 1, 2 and 3 remain importable.

### Test coverage

The suite now protects:

- provider compatibility
- deterministic idempotency
- valid job transitions
- retry limits
- storage parsing
- mock end-to-end prompt execution
- mock end-to-end image execution
- duplicate dispatch prevention
- provider lineage in generated assets
- backup v1, v2, v3 and v4 compatibility

---

## Sprint 13D — Cloud Asset Pipeline

Sprint 13D introduces a provider-agnostic, local-first Cloud Asset Pipeline to manage the ingestion, processing, metadata validation, compliance, and secure backup of media assets.

### Cloud Asset Pipeline

New route:

- `/asset-pipeline`

Features implemented in Sprint 13D:

- **State-Based Lifecycle Machine**: Standardized transitions across `INGESTING`, `PROCESSING`, `READY`, `ARCHIVED`, `FAILED`, and `DELETED` states with strict validation controls.
- **Provider-Agnostic Storage Adapters**: Implemented decoupling layers between raw file storage, secure credential-free client routes, and signed URL generation mechanics.
- **Automated Ingestion**: Seamless ingestion of Provider Job results with MIME-type based automatic asset classification.
- **Compliance Guards**: Built-in legal hold blocks, automatic retention schedule calculations, and soft deletion tombstones preserving Creative Graph lineage.
- **Workspace Backup V5**: Securely sanitizes cloud asset records, strips temporary signed URLs, and normalizes interrupted uploads. Backwards-compatible with Backup versions 1 to 4.
- **Monitoring & Operations Dashboard**: Integrated controls for filtering assets, calculating checksums, generating derivatives, and manually triggering retries or overrides.

### Test Coverage

The automated test suite now covers:

- Allowed and rejected lifecycle state transitions.
- Deleted asset terminal tombstones and retention limits.
- Idempotency boundaries (preventing duplicate provider ingestion or user uploads).
- Storage adapters (metadata extraction, simulated failures, signed URL expiry, and simulated object lifecycle).
- Secure backup serialization, credential sanitization, and atomic rollback recovery.
- Workspace clearing and legacy backup restoration.


---

## Sprint 13E — Publishing Hub

Sprint 13E turns the publishing step into an operational editorial workflow connected to campaigns, assets and production runs.

### Publishing Hub

New route:

- `/publishing-hub`

The Hub provides:

- campaign-based publication drafts;
- Creative Plan title, caption and hashtag reuse;
- Creative Library asset selection;
- platform policy preflight validation;
- review and approval gates;
- editorial scheduling and due-schedule processing;
- deterministic mock publishing;
- manual export mode;
- publishing jobs, retries and idempotency;
- Campaign Builder synchronization;
- Execution Center permalink registration;
- Creative Graph publication lineage;
- channel readiness preferences without credentials.

### Secure backend boundary

Real social publishing requires a backend that owns OAuth tokens, token refresh, account verification, platform requests, rate limiting and webhook signatures. The browser stores no social-network secrets.

### Workspace backup v6

Backup version 6 adds:

- publication drafts;
- publishing jobs;
- publishing connection preferences.

Backups v1 through v5 remain importable and initialize the Publishing Hub collections safely.

### Test coverage

The automated suite protects publication validation, media compatibility, approval, scheduling, due execution, idempotency, mock publishing, retries, storage parsing, Event Bus behavior, Creative Graph lineage and backup compatibility.

---

## Sprint 13F — Analytics Feedback Loop

Sprint 13F implements the closed-loop learning engine that connects publication success and external performance snapshots back to campaigns, assets, prompts, digital humans, products, scene files, and wardrobe items.

### Analytics Feedback Loop

New route:

- `/analytics-feedback`

Features implemented in Sprint 13F:

- **State-Based Ingestion**: Collects external performance snapshots idempotently and securely.
- **Metric Normalizer**: Precision metrics calculator for Engagement, CTR, CVR, and ROAS with zero-denominator guards and fallback estimations.
- **Attribution Engine**: Traverses entities to attribute scores to campaigns, prompts, digital humans, assets, wardrobe items, and scene files with confidence matrix tracking.
- **Scorecards**: Generates normalized overall performance scores ($0-100$) and tracks prediction gap margins.
- **Outlier Engine**: Identifies significant positive and negative deviations based on historical averages with minimum sample requirements.
- **Insight & Recommendation Engine**: Translates performance findings into strategic guidelines supported by metric evidence.
- **Auditing Decision Panel**: Enables explicit user actions to Accept, Reject, Apply (generates a `FeedbackDecision` record and updates state), or Undo decisions.
- **Workspace Backup v7**: Full backing of performance snapshots, scorecards, insights, recommendations, decisions, calibrations, and learning contexts with backward compatibility (v1-v6) and local storage quota rollback safety.

### Test Coverage

The automated test suite covers:
- Metric normalization mathematical precision and zero-denominator safety.
- Full-lineage and sparse-lineage attribution.
- Multi-dimensional score calculation bounded between $0$ and $100$.
- Dynamic outlier lift indexes with minimum sample size enforcement.
- Safe recommendation status transitions.
- Idempotent tracking and duplicate snapshot prevention.
- User Accept/Reject/Apply decision workflows and Learning Context synchronization.
- Complete decision Rollback (Undo) operations.
- Backup v7 upgrade and backwards-compatible restore testing.

---

## Sprint 14A — Experimentation Engine

Sprint 14A introduces a statistically rigorous, secure A/B and multivariate testing framework to allow content creators and autonomous AI agents to validate prompt structures, visual elements, campaign setups, and distribution strategies under real-world conditions.

### Key Features

- **Core Statistical Engine**: Built-in frequentist statistical testing core using two-proportion and continuous two-sample Z-tests to calculate p-values, relative lift, standard errors, and confidence intervals.
- **Deterministic Assignment**: Seed-based hash routing system mapping entity IDs over customized split allocations to guarantee zero-entropy assignments without state-tracking overhead or standard random variance.
- **Guardrail Monitor**: Continuous validation of secondary metrics (e.g., brand health, complaints, API error rates) to automatically pause or stop runaway trials.
- **Workspace Integrations**: Promotes winning variants to Gold-Standard drafts while preserving original experiment IDs and variant IDs, ensuring complete downstream auditability.
- **Workspace Backup v8**: Correctly incorporates experiments, variants, observations, metadata, and learning signals with backward-compatibility for v1-v7 schemas.

### Test Coverage

The automated test suite covers statistical edge-cases, deterministic assignment splits, guardrail breaches, event-bus message handling, backup v8 serialization, and deep key sanitization.

---

## Sprint 14B — Creative Recipes & Experiment Templates

Sprint 14B introduces Creative Recipes and Experiment Templates to convert successful campaign approaches, proven creative strategies, and validated prompt styles into parameterized, versioned, reusable templates.

### Key Features

- **Strict State-Based Lifecycle Machine**: Standardized transitions across `DRAFT`, `VALIDATING`, `READY`, `ACTIVE`, `DEPRECATED`, `FAILED`, and `ARCHIVED` states with strict validation controls.
- **DAG Graph Dependency Validation**: Validates the internal structure of recipe steps/stages, ensuring they form a Directed Acyclic Graph (DAG) with no circular dependencies or unresolved references.
- **Parameter & Binding Integrity**: Enforces type safety on parameters, prevents duplicate/circular parameter bindings, and validates template placeholders against a strict allowed list.
- **Atomic Activation and Execution**: Transactional writes are used during both activation and application execution. In case of storage/quota failures, the entire local state is rolled back to original values, guaranteeing zero partial or corrupted saves.
- **Comprehensive Local Evidence & Recommendations**: Associates recipes with empirical campaign/test performance data, ensuring a high confidence level based on actual performance.
- **Workspace Backup v9**: Extends backup, restore, clear, and upgrade routines to cover recipes, versions, evidence, scorecards, recommendations, and applications securely. Fully backward-compatible with legacy backup versions 1 through 8.

### SPRINT 14B — FOCUSED CORRECTION PASS
- **Deterministic Event Bus Singleton**: Integrated a reference-counted singleton pattern for the recipe event consumer inside `recipeEvents.ts` to cleanly handle duplicate initializations (e.g., React StrictMode) and prevent duplicate event handler registration while ensuring clean unsubscription when reference count drops to 0.
- **Robust Storage Subscription Testing**: Verified `subscribeToRecipeStorage` under extreme environments, including same-tab custom events, cross-tab `StorageEvent` interactions, ignoring unrelated keys, and total listener unsubscription.
- **Strengthened System-Integrity Workflows**: Added rigorous, deterministic validation tests proving:
  - DRAFT recipe/version cannot activate before validation.
  - ARCHIVED recipe remains terminal and cannot restore.
  - DEPRECATED recipe/version cannot execute a new application.
  - Application write failure restores both application state and recipe counters.
  - Activation write failure restores both recipe and version collections.
- **Quality Gate Compliance**: Achieved 100% test success across all 204 suite assertions with zero TypeScript compiler errors or linter warnings.


---

## Sprint 14C — Internationalization & Localization (i18n)

Sprint 14C introduces complete Internationalization and Localization capabilities to AI Creator OS, enabling seamless multilingual support for Portuguese (pt-BR), Spanish (es), and English (en) without page reloads.

### Key Features

- **Core i18n Translation Engine**: High-performance translation lookup utilizing nested dot-notated keys, dynamic token interpolation, and native locale-aware formatting utilities.
- **Deterministic Pluralization**: Standardized plural categorization via native `Intl.PluralRules` ensuring secure, compilation-safe text generation without unsafe eval loops.
- **Reactive Multi-Locale UI Layouts**: Complete localization of key layouts such as Settings and the primary Dashboard, keeping all content, action panels, and dates fully reactive to active locale adjustments.
- **Workspace Backup Version 10**: Fully integrates workspace backup version 10, preserving selected locale choices upon export/import, stripping sensitive secrets and tokens dynamically, and securing structural data integrity with transactional atomic rollback recovery.
- **System HTML Default Configuration**: Updated the source landing structure's default landing language to Brazilian Portuguese (`pt-BR`).
- **Comprehensive Quality Gate Validation**: Expanded test suites to cover i18n dictionary integrity, plural rules, formatters, and workspace configuration schemas. All tests compile and run successfully.




