# 16. Creative Recipes Engine — Architectural Blueprint & Guide

The **Creative Recipes Engine** is a high-performance, deterministic execution and strategy system designed to codify high-converting marketing campaigns, proven layout structures, and smart prompt templates into reusable workspace blueprints.

This engine solves the gap between retrospective experiment insights and active future execution by providing a rigorous, parameterized framework for transforming winner patterns into atomic, version-controlled recipes.

---

## 1. Domain Architecture & Entities

The domain model is built on structured schemas designed for cloud persistence and workspace portability:

### A. `CreativeRecipe`
*   **Purpose**: Represents the core container of a strategy profile.
*   **Key Fields**:
    *   `id`: Deterministic unique identifier.
    *   `workspaceId`: Scoped container ID.
    *   `name` & `description`: Metadata context.
    *   `category`: Type of recipe (Campaign blueprint, Prompt layout, Asset synthesis).
    *   `status`: Lifecycle state (`DRAFT`, `READY`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`).
    *   `currentVersionId`: Pointer to the active operational version.
    *   `sourceType`: Origin of the recipe (`WINNING_EXPERIMENT`, `PROMPT_HISTORY`, `MANUAL`).

### B. `CreativeRecipeVersion`
*   **Purpose**: Manages immutable version increments of templates and parameters.
*   **Key Fields**:
    *   `versionLabel`: Semantic representation (e.g., `1.0.0`).
    *   `status`: State of this specific version (`DRAFT`, `ACTIVE`, `DEPRECATED`, `SUPERSEDED`).
    *   `parameters`: Declared variables (with validations, types, defaults).
    *   `structure`: Evaluatable stages containing templates with syntax placeholders (e.g., `{{productName}}`).

### C. `RecipeEvidence` & `RecipeScorecard`
*   **Purpose**: Track real performance signals (lifts, ctr, conversions) and calculate overall strategy reputation/integrity scores.

### D. `RecipeApplication`
*   **Purpose**: An instantiation of a recipe with values bound to its parameters.
*   **States**:
    *   `PREVIEWED`: Temporary sandbox state. Output generated but not saved to the system database.
    *   `APPROVED`: User approved application, ready for execution.
    *   `COMPLETED`: Resolved assets and campaign structures saved and registered.

---

## 2. Core Workflows & Lifecycle Safety

The engine implements atomic and idempotent execution patterns to guarantee safe environment mutations:

```
 [Draft Recipe] ──> [Add Version Draft] ──> [Validate Version] 
                                                    │
 [Active Recipe] <── [Activate Version] <───────────┘ (Atomic Upgrade)
        │
 [Deprecate Version]
        │
 [Archive Recipe] (Hidden from planner)
```

### Key Safety Guarantees
1.  **Idempotent Resource Instantiation**: Repeat application requests using an `idempotencyKey` yield cached structures without creating duplicate side-effect entities.
2.  **No Silent Failures**: Database transactions fall back to their previous states atomically if serialization/save fails.
3.  **Digital Human Integrity Guard**: Recipes cannot mutate core digital human genetics or DNA structure; they are only authorized to recommend clothes, scenes, or actions.
4.  **No Pre-Persistence (Deferred Approvals)**: Sandbox generation acts purely client-side or within memory. Real workspace entities (such as campaigns) are only created on explicit user approval.

---

## 3. Integration & Knowledge Graph Mapping

*   **Creative Graph Nodes**: Extended to support `recipe`, `recipe-version`, `recipe-evidence`, `recipe-scorecard`, `recipe-recommendation`, and `recipe-application`.
*   **Feedback Loops**: Listens to `experiment.analysis.completed` events via the global event bus, converting winners with >10% metric lifts into recipe drafts.
*   **Backups v9**: Seamlessly bundles all workspace recipe structures into standard ZIP migrations.
