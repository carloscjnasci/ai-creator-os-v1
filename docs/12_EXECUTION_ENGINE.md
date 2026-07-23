# 12 — Execution Engine

## Purpose

The Execution Engine converts an approved `CreativePlan` into a controlled production run. It is the operational bridge between the Creative Planner and external AI providers, publishing systems and analytics.

The engine does not fabricate provider execution. It prepares, tracks and records the work that must occur, while keeping every output connected to its original intent, campaign and Workspace entities.

## Core Responsibilities

1. Convert ordered plan steps into executable tasks.
2. Preserve sequential dependencies between production stages.
3. Distinguish dependency blockers from unresolved business requirements.
4. Enforce valid task state transitions.
5. Calculate production progress and run status deterministically.
6. Generate provider-specific execution packages.
7. Register completed prompt packages in Prompt Intelligence.
8. Register completed image and video outputs in the Creative Asset Library.
9. Synchronize production progress with Campaign Builder workflows.
10. Publish execution events for future orchestration and learning.

## Runtime Structure

```text
src/core/execution-engine
├── types.ts
├── executionEngine.ts
├── providerPackages.ts
└── index.ts
```

The core contains only deterministic domain logic. Browser persistence and feature integrations remain under `src/features/execution-center`.

## Execution Run

An `ExecutionRun` represents one attempt to produce the deliverables from a Creative Plan.

Required relationships:

- `planId`
- optional `campaignId`
- optional `workflowId`

Run states:

- `draft`
- `active`
- `blocked`
- `completed`
- `cancelled`

Progress is calculated from tasks marked `completed` or `skipped`.

## Execution Task

Each plan step becomes one `ExecutionTask` with:

- stable task and source-step identifiers
- sequence order
- domain
- provider
- task status
- dependency IDs
- requirement-blocked flag
- provider instruction
- optional output URL
- optional output text
- production notes
- optional Prompt Intelligence relationship
- optional Creative Asset relationship
- timestamps

Task states:

- `blocked`
- `ready`
- `in-progress`
- `review`
- `completed`
- `failed`
- `skipped`

## Dependency Rules

- The first unblocked task starts as `ready`.
- Later tasks remain blocked until every dependency is completed or skipped.
- Completing or skipping a task automatically unlocks the next eligible task.
- A requirement blocker is not removed automatically.
- Requirement-blocked tasks require an explicit `unblock` transition.
- Invalid transitions return an error and preserve the original run object.

## Provider Packages

Provider packages are calculated from the original Creative Plan and selected task.

Supported providers:

- COS
- Gemini
- Imagen
- Flow
- Veo
- Manual
- Publishing
- Analytics

Packages include the correct subset of:

- Creative Intent
- strategy
- selected asset IDs
- hook
- script
- image prompt
- Flow prompt
- Veo prompt
- title
- caption
- hashtags
- thumbnail concept
- Viral Score baseline

## Learning Loop

When a prompt task is completed, the final task output or generated provider package can be stored as a `PromptExperiment`.

When an image or video task is completed with an output URL, the output can be stored as a `CreativeAsset` with campaign, Digital Human, product, wardrobe, scene, prompt, provider and execution-run metadata.

This preserves lineage from:

```text
Creative Intent
→ Creative Plan
→ Execution Run
→ Execution Task
→ Prompt Experiment
→ Creative Asset
→ Campaign Analytics
```

## Persistence

Storage key:

```text
ai-creator-os.execution-runs.v1
```

Workspace backup version 3 includes execution runs. Backup versions 1 and 2 remain valid and restore the execution collection as an empty array.

## Events

Published events:

- `execution.run.created`
- `execution.run.updated`
- `execution.task.updated`

## Current Boundary

The engine prepares and tracks provider work but does not call external AI APIs. Direct execution requires provider credentials, quota controls, secure server-side proxying and asynchronous job monitoring.
