# Module Specification — AI Director

## Purpose

Provide the primary interface of the Creative Operating System. The user states the desired result; the system generates the connected production plan.

## Inputs

Creative Intent, audience, platform, objective, preferred product and preferred Digital Human.

## Outputs

Campaign strategy, selected assets, ten-step Execution Plan, Viral Score, hook, script, image prompt, Flow prompt, Veo prompt, thumbnail concept, title, caption and hashtags.

## Actions

- Generate plan.
- Copy deliverables.
- Save plan.
- Create Campaign.
- Create Campaign Workflow.

## Decision Boundary

The AI Director orchestrates Planner output. It does not directly call external AI providers in the local-first implementation.

## UX Principle

The primary question is: “What do you want to achieve today?” Forms exist only to clarify the intent, not to expose provider complexity.
