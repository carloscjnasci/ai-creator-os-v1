# Creative Recipes — API Architecture

Programmatic design specifications and API schemas for the Creative Recipes template management system.

## Data Model Types

### 1. Creative Recipe
```typescript
export interface CreativeRecipe {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: CreativeRecipeCategory; // 'HOOK' | 'CAMPAIGN' | 'PROMPT' | 'PLACEMENT'
  status: CreativeRecipeStatus;     // 'DRAFT' | 'VALIDATING' | 'READY' | 'ACTIVE' | 'DEPRECATED' | 'FAILED' | 'ARCHIVED'
  currentVersionId: string;
  sourceType: RecipeSourceType;     // 'MANUAL' | 'DERIVED'
  sourceEntityIds: string[];
  objective: string;
  targetPlatforms: string[];
  targetAudienceDescription: string;
  productCategories: string[];
  tags: string[];
  requiredCapabilities: string[];
  brandRuleIds: string[];
  evidenceSummary: {
    evidenceCount: number;
    averageScore: number;
    liftSummary: string;
  };
  confidence: number;
  usageCount: number;
  successfulApplicationCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  archivedAt?: string;
}
```

### 2. Creative Recipe Version
```typescript
export interface CreativeRecipeVersion {
  id: string;
  recipeId: string;
  versionNumber: number;
  changelog: string;
  status: RecipeVersionStatus;       // 'DRAFT' | 'VALIDATING' | 'READY' | 'ACTIVE' | 'SUPERSEDED' | 'DEPRECATED' | 'FAILED'
  stages: RecipeStage[];
  parameters: RecipeParameterDefinition[];
  parameterBindings: RecipeParameterBinding[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  supersededAt?: string;
}
```

---

## Operations & Service Layer

The module interfaces are located in `/src/features/creative-recipes/recipeWorkflows.ts`:

### 1. `validateRecipeVersion(recipeId, versionId)`
Validates that:
- The stages form a Directed Acyclic Graph (DAG) with zero cycles.
- Parameters and template references resolve safely.
- Transitions state to `READY` (if valid) or `FAILED` (if invalid).

### 2. `activateRecipeVersion(recipeId, versionId, operatorId)`
- Marks the specified version as `ACTIVE`.
- Marks any previously active version of the same recipe as `SUPERSEDED`.
- Moves the parent recipe status to `ACTIVE`.
- **Atomic Rollback**: If saving the updated versions or recipes fails (e.g. quota limit reached), both collections are restored immediately to their original values.

### 3. `executeRecipeApplication(applicationId, operatorId, context)`
- Asserts that both recipe and version statuses are `ACTIVE`.
- Simulates multi-stage entity creation in the creative asset ecosystem.
- Increments `usageCount` and `successfulApplicationCount` counters in the parent recipe.
- **Atomic Rollback**: Reverts all changes to applications and recipes on write failure, then marks application status as `FAILED` with a detailed error trace.

---

## Event Bus Integration

The Creative Recipes system uses the central `subscribeToCreativeEvents` pattern with deterministic singleton routing to prevent listener leakages:
- **Event listener**: Registered on the global `ai-creator-os:creative-event` bus.
- **Reference counting**: Shared reference counters prevent duplicate bindings across React component re-mounts.
- **Auto-Cleanup**: Fully de-registers when reference counts drop to zero.
