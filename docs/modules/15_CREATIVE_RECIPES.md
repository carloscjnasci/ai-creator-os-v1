# Creative Recipes Module

The Creative Recipes module converts successful content strategies, high-performing campaign models, and prompt formats into reusable, versioned, and parameterized templates.

## Overview

A **Creative Recipe** is a blueprint defining a multi-step structured content campaign. By parameterizing variable segments (such as product names, audience targets, and style guidelines), creators can execute uniform, repeatable marketing pipelines while maintaining strategic control.

## State Lifecycle Machine

Recipes and their respective versions progress through a strict, deterministic, and audited state machine:

```
          ┌──────────────┐
          │    DRAFT     │
          └──────┬───────┘
                 │ (validate)
                 ▼
          ┌──────────────┐
          │  VALIDATING  │
          └──────┬───────┘
                 │ (validation passes)
                 ▼
          ┌──────────────┐
          │    READY     │
          └──────┬───────┘
                 │ (activate)
                 ▼
          ┌──────────────┐◄──────────────┐
          │    ACTIVE    │ (supersede)   │
          └──────┬───────┘               │
                 │ (deprecate)           │
                 ▼                       │
          ┌──────────────┐               │
          │  DEPRECATED  ├───────────────┘
          └──────┬───────┘ (restore)
                 │ (archive)
                 ▼
          ┌──────────────┐
          │   ARCHIVED   │ (Terminal State)
          └──────────────┘
```

### State Definitions

1. **DRAFT**: Initial creation state. Structural parameters, target steps, and guidelines are defined but not locked. Cannot be activated.
2. **VALIDATING**: Intermediate automated safety and structural check. Evaluates DAG graph completeness.
3. **READY**: Post-validation success state. The recipe or version is verified and prepared for activation.
4. **ACTIVE**: Live execution template state. One version per recipe is ACTIVE at any time. Approved applications can only be executed when the recipe and version are ACTIVE.
5. **DEPRECATED**: Retired template state. New applications cannot be executed. Can be restored back to ACTIVE via a new version.
6. **FAILED**: Verification failure state.
7. **ARCHIVED**: Terminal state. Read-only, immutable, and cannot be restored.

---

## DAG Graph Dependency Validation

To prevent infinite loops and deadlocks in multi-stage campaigns, recipe steps and stages must form a strict Directed Acyclic Graph (DAG):
- **Unresolved Dependencies**: Every dependency listed by a stage must resolve to an existing preceding stage.
- **Cycle Detection**: Traverses the step dependencies using depth-first-search (DFS) to verify there are zero cycles.

## Parameter & Binding Integrity

- **Required Parameters**: All parameter placeholders defined in templates must map to declared variables.
- **Type Constraints**: Parameters enforce data types (`string`, `number`, `boolean`, `list`, `nested`).
- **Circular Binding Prevention**: Guards against self-referencing inputs.

## Data Persistence & Rollbacks

- **Atomic Rollbacks**: Any save failures (such as standard browser storage quota limits exceeded) automatically restore the entire local database, reverting partial modifications to prevent corrupted indexes.
