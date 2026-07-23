# Functional Specification — Digital Humans

## 1. Module Purpose

A Digital Human is an intelligent creative asset, not a profile record. The module owns stable identity, creative behavior, voice, visual constraints, brand alignment, reusable memory and performance context.

Business objective: create consistent, reusable AI identities that can participate in campaigns without re-describing their full DNA in every prompt.

User value: faster generation, fewer identity errors, stronger brand consistency and measurable character performance.

System responsibilities:

- Link intelligence profiles to canonical Character records.
- Preserve legacy Character compatibility.
- Store complete DNA in a dedicated contract.
- Surface campaign and prompt usage metrics.
- Publish profile update events.

## 2. User Roles

### Administrator

Full read/write, archive, restore, import, export and policy management.

### Workspace Owner

Create, edit, duplicate, archive, restore, generate campaigns and manage DNA.

### Editor

Create and edit active/draft profiles, references and campaign usage. Cannot permanently delete protected identities.

### Viewer

Read profiles, history, performance and assets. No mutation.

### Future API Client

Scope-based access to identity, generation-safe DNA and approved references. Private memory and internal notes require explicit permission.

## 3. Main Screens

Implemented foundation:

- Digital Human selector.
- Quick identity creation.
- DNA completeness metrics.
- Lifecycle management.
- Identity and behavior editor.
- Visual and Prompt DNA editor.
- Knowledge and memory editor.
- Reference URL editor.
- Campaign and prompt usage counters.

Planned expansion:

- Grid and table views.
- Advanced filters.
- Dedicated profile route.
- Timeline.
- Campaign history.
- Performance dashboard.
- Wardrobe and asset tabs.
- Version comparison.

## 4. Lifecycle

Supported states:

- `draft`
- `active`
- `training`
- `generating`
- `archived`

Allowed transitions:

- Draft → Active, Training or Archived.
- Active → Training, Generating or Archived.
- Training → Active or Archived.
- Generating → Active or Archived.
- Archived → Draft or Active.

Deleted is a future soft-delete state and must never be used as an untracked hard deletion.

## 5. Functional Sections

### Identity

Canonical Character name and description.

### Appearance DNA

Face, hair, skin, body proportions, anatomy, continuity rules and immutable visual traits.

### Personality

Behavioral traits, emotional range, communication style and role boundaries.

### Voice DNA

Language, accent, cadence, age impression, energy, prohibited styles and approved narration behavior.

### Fashion

Specialties and campaign styling are linked through the Wardrobe domain.

### Knowledge and Memory

Long-lived creative context, user-approved facts, recurring preferences and campaign learnings.

### Brand Rules

Claims, tone, visual restrictions, compliance constraints and identity-safe behavior.

### Prompt DNA

Reusable positive instructions that should be injected into provider prompts.

### Negative Prompt

Identity drift, anatomy, clothing, camera, text, logo and continuity failures to prevent.

### References

Approved image and video URLs. Future file storage must preserve consent, provenance and version history.

### Performance

Derived campaign count and prompt count are implemented. Full KPI attribution is planned.

## 6. User Actions

Implemented:

- Create identity.
- Select profile.
- Edit lifecycle.
- Edit DNA.
- Save references.
- View usage counts.

Planned:

- Duplicate.
- Archive and restore.
- Compare versions.
- Import and export.
- Generate campaign, image or video.
- Train memory.
- Analyze performance.

## 7. Integrations

- Creative Planner selects a Digital Human.
- AI Director binds the identity to a complete plan.
- Campaign Builder saves `digitalHumanId`.
- Viral Analyzer adapts structures to the selected identity.
- Asset Library stores identity metadata.
- Prompt Intelligence tracks identity-related prompt lineage.
- Creative Graph links identity, campaigns, prompts and assets.

## 8. Events

Published:

- `digital-human.updated`

Future:

- `digital-human.created`
- `digital-human.activated`
- `digital-human.archived`
- `digital-human.reference-approved`
- `digital-human.memory-trained`

Consumed:

- Campaign performance updated.
- Asset generated.
- Prompt experiment rated.
- Wardrobe item archived.

## 9. Validation Rules

- Profile ID and Character ID are required.
- Lifecycle must match the canonical enum.
- Lists must contain strings only.
- Timestamps must be valid ISO datetimes.
- A profile cannot silently replace a different Character ID.
- References must remain explicitly user-approved.
- Prompt DNA and Negative Prompt must not contain mutually exclusive identity rules.

## 10. UX Principles

- Progressive disclosure.
- Immediate local persistence only after explicit save.
- Clear DNA completeness.
- No hidden mutation of base Character data.
- Accessible labels and keyboard controls.
- Responsive two-column layout collapsing to one column.
- Low cognitive load through grouped identity domains.

## 11. Future Expansion

- Digital Human marketplace.
- Approved templates.
- DNA version history.
- Consent-aware AI cloning.
- Collaborative review.
- Voice sample validation.
- Automated consistency scoring.
- Cross-campaign performance ranking.
