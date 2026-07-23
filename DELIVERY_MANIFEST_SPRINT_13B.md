# Delivery Manifest — Sprint 13B Execution Engine

## Delivery Status

Candidate. This package is not official until independent review approves the Sprint.

## Primary Capability

Sprint 13B adds the missing operational layer between Creative Planning and content production. Saved Creative Plans can now become dependency-aware Execution Runs managed in the Production Center.

## Files Added

- `docs/12_EXECUTION_ENGINE.md`
- `docs/modules/16_EXECUTION_CENTER.md`
- `src/core/__tests__/executionEngine.test.ts`
- `src/core/execution-engine/executionEngine.ts`
- `src/core/execution-engine/index.ts`
- `src/core/execution-engine/providerPackages.ts`
- `src/core/execution-engine/types.ts`
- `src/features/execution-center/__tests__/executionCenterContracts.test.ts`
- `src/features/execution-center/index.ts`
- `src/features/execution-center/lib/executionIntegrations.ts`
- `src/features/execution-center/lib/executionRunStorage.ts`
- `src/features/execution-center/pages/ExecutionCenterPage.tsx`

## Files Modified

- `README.md`
- `metadata.json`
- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/constants.ts`
- `src/core/events/creativeEventBus.ts`
- `src/core/index.ts`
- `src/core/knowledge-graph/creativeGraph.ts`
- `src/features/ai-director/pages/AIDirectorPage.tsx`
- `src/features/campaign-builder/lib/campaignWorkflowStorage.ts`
- `src/features/campaign-builder/types.ts`
- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/settings/__tests__/workspaceBackupV2.test.ts`
- `src/features/settings/workspaceBackup.ts`
- `src/routes.ts`

## Storage Contract Added

- `ai-creator-os.execution-runs.v1`

## Workspace Backup

- Current export version: 3
- Version 1 import: supported
- Version 2 import: supported
- Missing execution data in older backups: initialized as an empty array

## New Route

- `/execution-center`

## Major Integrations

- AI Director creates a campaign, workflow and execution run.
- Production progress synchronizes to Campaign Builder.
- Completed prompt tasks register Prompt Experiments.
- Completed image and video tasks with URLs register Creative Assets.
- Creative Graph includes execution-run and execution-task lineage.
- Dashboard and sidebar expose the Production Center.

## Runtime Dependency Changes

None.

## Delivery Exclusions

- `node_modules`
- `dist`
- nested ZIP files
- caches
- temporary logs
- operating-system metadata
