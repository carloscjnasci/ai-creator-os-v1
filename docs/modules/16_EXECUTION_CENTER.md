# 16 — Execution Center Functional Specification

## Module Purpose

Execution Center is the operational production workspace of AI Creator OS. It turns a saved Creative Plan into a dependency-aware queue and records the outputs of each production stage.

## Primary User Outcomes

- Start production from an approved Creative Plan.
- See exactly which stage is ready, blocked, under review or completed.
- Copy the correct provider package without rebuilding prompts manually.
- Save generated output URLs, final text and production notes.
- Register completed prompts and assets automatically.
- Keep Campaign Builder synchronized with actual production progress.

## Main Screen

### Production Run List

Displays:

- run name
- run state
- completion percentage

Selecting a run updates the queue and task workspace.

### Run Summary

Displays:

- campaign or plan name
- strategy
- run state
- progress bar
- completion percentage

### Production Queue

Displays ordered tasks with:

- sequence number
- stage name
- provider
- status
- blocker or instruction summary

### Task Workspace

Allows:

- saving an output URL
- saving final output text
- saving notes
- copying provider package
- starting work
- sending work to review
- completing work
- recording failure
- retrying
- skipping
- reopening
- resolving a requirement blocker

## Creation Flow

A run may be created from:

1. AI Director after campaign creation.
2. Execution Center from any saved Creative Plan.

AI Director creates and links:

- campaign
- campaign workflow
- execution run

The user is then routed directly to the Production Center.

## State Rules

- Tasks cannot start before their dependencies are terminal.
- Terminal dependency states are `completed` and `skipped`.
- Requirement blockers must be explicitly resolved.
- Completing a task unlocks the next eligible task.
- Completing the final task completes the run.
- Reopening a completed task recalculates progress and downstream availability.

## Automatic Integrations

### Prompt Intelligence

Completing a prompt task creates a versioned Prompt Experiment when one has not already been registered.

### Creative Asset Library

Completing an image or video task with an output URL creates a Creative Asset when one has not already been registered.

### Campaign Builder

Workflow states are derived from execution task states:

- Prompt: pending, ready, approved
- Image: pending, ready, approved
- Video: pending, ready, approved
- Publishing: not scheduled, scheduled, published
- Analytics: waiting, collecting, complete

### Creative Graph

Execution runs and tasks become graph nodes. Relationships connect runs to workflows and campaigns, and tasks to produced assets.

## Persistence and Validation

All stored runs are validated with Zod. Invalid entries are discarded independently while valid runs remain available.

## Accessibility

- Every action uses a native button.
- Task and run selection remain keyboard accessible.
- Status updates use an `aria-live` message.
- Output links open in a new tab with safe `rel` attributes.

## Responsive Behavior

- Metrics stack on small screens.
- Run list and task workspace become a single-column flow.
- Production queue and task editor use a two-column layout on large screens.
- Provider packages use bounded scrolling to avoid page overflow.

## Explicit Non-Goals

- Direct provider API calls.
- Background job polling.
- Cloud uploads.
- Team assignment and approval permissions.
- Cost or token accounting.
- Automated publishing.
