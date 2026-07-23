# Delivery Manifest — Sprint 13C AI Provider Gateway

## Delivery Status

Candidate. This package is not official until an independent Quality Gate approves the Sprint.

## Baseline

- **AI Creator OS — Sprint 13B final — official**
- Sprint 13B package and storage contracts remain supported.

## Primary Capability

Sprint 13C connects ready Production Center tasks to an idempotent, persistent and secure AI provider runtime contract.

## Files Added

- `DELIVERY_MANIFEST_SPRINT_13C.md`
- `QUALITY_GATE_SPRINT_13C_AI_PROVIDER_GATEWAY_CANDIDATE.md`
- `docs/13_AI_PROVIDER_GATEWAY.md`
- `docs/SPRINT_13C_AI_PROVIDER_GATEWAY.md`
- `src/core/__tests__/providerGateway.test.ts`
- `src/core/provider-gateway/adapters.ts`
- `src/core/provider-gateway/index.ts`
- `src/core/provider-gateway/jobEngine.ts`
- `src/core/provider-gateway/providerRegistry.ts`
- `src/core/provider-gateway/types.ts`
- `src/features/provider-gateway/__tests__/providerGatewayContracts.test.ts`
- `src/features/provider-gateway/index.ts`
- `src/features/provider-gateway/lib/providerConnectionStorage.ts`
- `src/features/provider-gateway/lib/providerGatewayService.ts`
- `src/features/provider-gateway/lib/providerJobStorage.ts`
- `src/features/provider-gateway/pages/ProviderGatewayPage.tsx`

## Files Modified

- `.env.example`
- `README.md`
- `src/App.tsx`
- `src/constants.ts`
- `src/core/events/creativeEventBus.ts`
- `src/core/execution-engine/types.ts`
- `src/core/index.ts`
- `src/core/knowledge-graph/creativeGraph.ts`
- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/execution-center/lib/executionIntegrations.ts`
- `src/features/execution-center/lib/executionRunStorage.ts`
- `src/features/execution-center/pages/ExecutionCenterPage.tsx`
- `src/features/settings/__tests__/workspaceBackupV2.test.ts`
- `src/features/settings/workspaceBackup.ts`
- `src/routes.ts`
- `src/vite-env.d.ts`

## Provider Registry

- COS Mock Provider
- Gemini
- Imagen
- Flow
- Veo

## Storage Contracts Added

- `ai-creator-os.provider-jobs.v1`
- `ai-creator-os.provider-connections.v1`

## Workspace Backup

- Current export version: 4
- Version 1 import: supported
- Version 2 import: supported
- Version 3 import: supported
- Missing provider data in older backups: initialized safely

## New Route

- `/provider-gateway`

## Security Contract

- no provider credentials in localStorage
- no provider credentials in the frontend bundle
- real provider execution requires a server-side gateway
- `VITE_AI_GATEWAY_URL` contains only a public gateway endpoint

## Runtime Dependency Changes

None. `package.json` and `package-lock.json` remain byte-identical to Sprint 13B.

## Delivery Exclusions

- `node_modules`
- `dist`
- nested ZIP files
- caches
- temporary logs
- operating-system metadata
