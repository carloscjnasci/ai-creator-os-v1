# Module Specification — Campaign Builder

## Purpose

Persist the entire creative journey as a visual workflow.

## Canonical Flow

Objective → Product → Digital Human → Wardrobe → Scene/Pose → Prompt → Image → Video → Publishing → Analytics.

## Workflow State

A workflow may link to an existing Campaign or originate from an AI Director plan.

Production states:

- Prompt: pending, ready, approved.
- Image: pending, ready, approved.
- Video: pending, ready, approved.
- Publishing: not scheduled, scheduled, published.
- Analytics: waiting, collecting, complete.

## Rules

- Existing Campaign storage remains the campaign source of truth.
- Workflow state supplements, not replaces, the Campaign entity.
- Missing assets remain visible and selectable.
- Viral Score is recalculated when the workflow is saved.
