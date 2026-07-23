# Module Specification — Prompt Intelligence

## Purpose

Transform prompts into measurable, versioned creative assets.

## Core Functions

- Detect length risk.
- Detect duplicate instructions.
- Detect contradictory instructions.
- Flag ambiguous wording.
- Restructure prompts into priority sections.
- Create parent/child version lineage.
- Link versions to campaigns and target models.
- Store quality and Viral Score estimates.

## Version Contract

Every experiment includes ID, name, prompt, version, optional parent, optional campaign, model, optimization result, Viral Score and creation time.

Future performance fields include user rating and actual performance score.

## Non-Goals

The optimizer does not guarantee provider acceptance and does not replace provider-specific safety or policy validation.
