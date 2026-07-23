# Module Specification — AI Asset Library

## Purpose

Store generated outputs with their complete creative lineage.

## Asset Metadata

- Name and type.
- Source URL or path.
- Campaign.
- Digital Human.
- Product.
- Wardrobe.
- Scene.
- Prompt experiment.
- Prompt used.
- AI model.
- Tags.
- Creation time.

## Asset Types

Image, video, audio, thumbnail and document.

## Search

The initial implementation filters by type and searches name, model and tags.

## Ingestion and Cloud Asset Integration

In Sprint 13D, the AI Asset Library was fully upgraded and integrated with the **Cloud Asset Pipeline**. When assets are processed through the Cloud Asset Pipeline and reach the `READY` state, they are automatically synchronized into the Creative Library.

Key capabilities now active:
- **Unique Ingestion (Idempotency)**: Prevents duplicate library records for matching Provider Jobs or identical output URLs.
- **Physical Verification**: Calculates and verifies SHA-256 integrity checksums to ensure file provenance and safety.
- **Ancestry Tracking (Lineage)**: Preserves precise links to execution runs, parent assets (for thumbnails and derivatives), and prompting configurations.
- **Compliance Schedule**: Respects active retention periods and legal holds blocking deletion.
- **Flexible Management**: Users can retry failed imports, cancel active processing, or restore items from cold storage archives.
