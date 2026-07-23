# Creative Planner Engine — Official Architecture

## 1. Purpose

The Creative Planner is the decision center of the Creative Operating System (COS). AI providers are execution resources; they do not own product strategy, workspace memory, asset selection, campaign state or learning.

The Planner converts a `CreativeIntent` into a deterministic, auditable `CreativePlan` and an ordered `ExecutionPlan`.

## 2. Creative Intent

A Creative Intent represents the result the user wants, not the prompt they think a model requires.

Required fields:

- `goal`: natural-language business or creative outcome.
- `targetAudience`: the audience whose behavior should change.
- `platform`: TikTok, TikTok Shop, YouTube, Instagram, Pinterest, Google or generic.
- `objective`: sales, virality, awareness, engagement, CTR, launch or education.
- `createdAt`: ISO timestamp.

Optional fields:

- preferred product.
- preferred Digital Human.

## 3. Planning Pipeline

1. Interpret the goal and objective.
2. Load the current Workspace snapshot.
3. Resolve preferred entities or select the best available fallback.
4. Build the campaign hypothesis.
5. Generate a three-beat communication structure.
6. Produce provider-specific prompt packages.
7. Calculate the pre-production Viral Score.
8. Create the ten-stage Execution Plan.
9. Publish traceability events.
10. Persist the plan when requested.

## 4. Workspace Inputs

The initial local implementation reads:

- Characters and Digital Human profiles.
- Products.
- Wardrobe.
- Scenes.
- Poses.
- Campaigns.
- Prompt history and Prompt Intelligence experiments.
- Research signals and viral analyses.
- Creative assets and workflows.

Selection never mutates source collections.

## 5. Execution Plan Contract

The canonical order is:

1. Strategy.
2. Product.
3. Digital Human.
4. Wardrobe.
5. Scene and pose.
6. Prompt package.
7. Image production.
8. Video production.
9. Publishing package.
10. Analytics and learning.

Every step contains an identifier, order, domain, label, description, status and optional provider.

A missing required product or Digital Human produces a `blocked` step instead of an exception.

## 6. Deliverables

A generated plan contains:

- Hook.
- Three-beat script.
- Imagen/Gemini image prompt.
- General video prompt.
- Flow motion prompt.
- Veo execution prompt.
- Thumbnail concept.
- Title.
- Caption.
- Hashtags.

## 7. Creative Intelligence Integration

The Planner calls the Viral Score engine before production. The score is an estimate, not a performance guarantee. It evaluates:

- Hook.
- CTA.
- Storytelling.
- Emotion.
- Clothing.
- Trend relevance.
- Product fit.
- Clarity.

The result is persisted with the plan and can be transferred into the Campaign Workflow.

## 8. Creative Graph Integration

The Creative Graph establishes relationships among campaigns, prompts, assets, products, Digital Humans and workflows. Graph generation is derived from canonical storage contracts and does not introduce a second source of truth.

## 9. AI Orchestrator Boundary

The Planner decides what must be produced. The future AI Orchestrator will decide how and where it is executed.

The execution boundary must remain provider-agnostic:

- Planner output is structured data.
- Provider prompts are deliverables, not the plan itself.
- Provider failures must not delete or corrupt the plan.
- Retry, fallback, cost and queue behavior belong to the Orchestrator.

## 10. Learning Loop

After publishing, performance metrics must attach to the campaign, asset and prompt lineage. Future ranking can then use:

- Actual CTR.
- Watch time.
- Retention.
- Conversion rate.
- Saves and shares.
- Prompt version.
- Digital Human.
- Product and styling combination.

## 11. Current Implementation

Implemented files:

- `src/core/types.ts`
- `src/core/creative-planner/creativePlanner.ts`
- `src/core/creative-intelligence/viralScore.ts`
- `src/core/knowledge-graph/creativeGraph.ts`
- `src/core/events/creativeEventBus.ts`
- `src/features/ai-director/pages/AIDirectorPage.tsx`

The current engine is deterministic and local-first. Live provider execution and live social trend ingestion are explicit future integrations.
