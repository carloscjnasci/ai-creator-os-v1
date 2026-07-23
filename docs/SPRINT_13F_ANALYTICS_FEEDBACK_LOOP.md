# Sprint 13F — Analytics Feedback Loop

## Objective

Connect successful publication records back to Creative Intelligence, Creative Planner, and Prompt Engine domains to establish a closed-loop system of metrics collection, normalization, attribution, gap analysis, and recommendation audit.

## Functionality delivered

- **Analytics Feedback Loop Route & Page**: Intuitive user dashboard presenting snapshots, scorecards, insights, recommendations, decision logs, and calibrations.
- **Idempotent Ingestion**: Singletons and tracking models preventing duplicate snapshot creation.
- **Metric Normalizer**: High-precision formulas mapping raw views, clicks, and spend into clean, bounded rates with zero-denominator safety.
- **Attribution Engine**: Traverses entities to attribute scores to campaigns, prompts, digital humans, assets, wardrobe items, and scene files.
- **Scorecards**: Auto-computes overall performance scores ($0-100$) and tracks prediction gaps (over/under prediction).
- **Outlier Engine**: Identifies positive or negative deviations based on historical baselines.
- **Insight & Recommendation Engine**: Translates performance findings into strategic guidelines with solid metric evidence.
- **User Decision Center**: Full Auditing capabilities enabling users to Accept, Reject, Apply (which logs a formal `FeedbackDecision` and applies patches), or Undo recommendation decisions.
- **Workspace Backup v7**: Upgrades the backup structure to support version 7, guaranteeing backwards-compatible legacy restore of versions 1-6.

## Files added

- `src/features/analytics-feedback/types.ts`
- `src/features/analytics-feedback/index.ts`
- `src/features/analytics-feedback/analyticsFeedback.ts`
- `src/features/analytics-feedback/analyticsFeedbackSchemas.ts`
- `src/features/analytics-feedback/analyticsFeedbackStorage.ts`
- `src/features/analytics-feedback/analyticsFeedbackEvents.ts`
- `src/features/analytics-feedback/analyticsFeedbackWorkflow.ts`
- `src/features/analytics-feedback/metricNormalizer.ts`
- `src/features/analytics-feedback/attributionEngine.ts`
- `src/features/analytics-feedback/scorecardEngine.ts`
- `src/features/analytics-feedback/outlierEngine.ts`
- `src/features/analytics-feedback/insightEngine.ts`
- `src/features/analytics-feedback/recommendationEngine.ts`
- `src/features/analytics-feedback/adapters/mockAnalyticsAdapter.ts`
- `src/features/analytics-feedback/adapters/manualAnalyticsAdapter.ts`
- `src/features/analytics-feedback/adapters/secureAnalyticsAdapter.ts`
- `src/features/analytics-feedback/pages/AnalyticsFeedbackLoopPage.tsx`
- Analytics Feedback Loop tests and documentation.

## Files modified

- `src/App.tsx` (routing)
- `src/components/layout/Sidebar.tsx` (navigation)
- `src/features/settings/workspaceBackup.ts` (Workspace Backup v7 and backward compatibility)
- `src/features/settings/__tests__/workspaceBackupV2.test.ts` (upgrade to version 7 testing)
- `src/features/asset-pipeline/__tests__/assetPipelinePart2.test.ts` (backup version update check)
- `README.md` (incremental update)

## Backup v7

Workspace Backup v7 serializes performance snapshots, scorecards, insights, recommendations, user decisions, calibration records, and centralized learning context. It implements full rollback safety when browser storage limits are exceeded.

## Tests

The Sprint guarantees 100% green unit testing protecting:
- Schema validation & invalid parameters;
- Precision Engagement, CTR, CVR, ROAS formulas;
- Zero-denominator checks;
- Incomplete/Complete lineage attribution;
- Bounded scorecard scores ($0-100$) and gap predictions;
- Minimum history sample constraints;
- Outlier detection and relative lift indices;
- Recommendation status transition validations;
- Idempotent trackPublicationSuccess;
- End-to-end ingestion pipeline;
- User accepts, rejects, applies, and undoes;
- Security audits (metadata sanitation, secret key deletion);
- Backup v7 atomic rollbacks & compatibility with legacy versions (v1-v6).

## Security

No OAuth token, access token, refresh token, social API key, client secret, cookie, or personal user identifier is accepted, stored, or exported in backups. All real analytics extraction is delegated to a credential-free, secure backend API model.
