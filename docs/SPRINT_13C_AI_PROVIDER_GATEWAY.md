# Sprint 13C — AI Provider Gateway

## Objective

Connect the Production Center to a secure, traceable provider runtime without exposing credentials in the browser.

## Files Added

- `src/core/provider-gateway/types.ts`
- `src/core/provider-gateway/providerRegistry.ts`
- `src/core/provider-gateway/jobEngine.ts`
- `src/core/provider-gateway/adapters.ts`
- `src/core/provider-gateway/index.ts`
- `src/core/__tests__/providerGateway.test.ts`
- `src/features/provider-gateway/lib/providerJobStorage.ts`
- `src/features/provider-gateway/lib/providerConnectionStorage.ts`
- `src/features/provider-gateway/lib/providerGatewayService.ts`
- `src/features/provider-gateway/pages/ProviderGatewayPage.tsx`
- `src/features/provider-gateway/__tests__/providerGatewayContracts.test.ts`
- `src/features/provider-gateway/index.ts`
- `docs/13_AI_PROVIDER_GATEWAY.md`
- `docs/SPRINT_13C_AI_PROVIDER_GATEWAY.md`

## Major Changes

- provider registry for Mock, Gemini, Imagen, Flow and Veo
- secure gateway adapter contract
- deterministic local mock adapter
- persistent provider jobs
- idempotent dispatch
- polling, cancellation and bounded retry
- Production Center provider execution
- automatic execution-task completion
- Prompt Intelligence and Creative Library registration
- provider lineage in Creative Graph
- Provider Gateway monitoring route
- Dashboard and sidebar navigation
- Workspace backup version 4

## Contracts Protected

- Sprint 13B execution task transitions
- existing manual Production Center workflow
- localStorage keys from earlier Sprints
- backup versions 1, 2 and 3
- Prompt Intelligence registration
- Creative Asset registration
- Campaign Builder synchronization
- Firebase lazy-loading boundary

## Explicit Non-Goals

- provider credentials in the frontend
- direct client-to-provider API calls
- production billing reconciliation
- social publishing
- cloud asset upload
- provider-specific OAuth flows
- webhook hosting

## Validation Commands

```bash
npm ci
npm run typecheck
npm run test:run
npm run build
npm run preview
```

## Known Limitations

- Real provider execution requires a deployed backend implementing the documented `/jobs` contract.
- Mock asset URLs are simulated and are not downloadable binary files.
- Automatic background polling stops when the browser page is closed; the persistent job monitor supports manual polling after reopening.
- Estimated costs depend on backend provider responses.
