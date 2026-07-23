# Module Specification — AI Research Hub

## Purpose

Create an evidence layer before campaign planning. The module stores verified platform signals and compares content performance to a user-provided baseline.

## Primary Entities

`TrendSignal`: platform, topic, source URL, summary, views, baseline views, outlier multiplier, tags and capture time.

## Main Screen

- Workspace research metrics.
- New signal form.
- Outlier-ranked signal list.
- Automatically generated Workspace research brief.

## User Actions

- Add a verified signal.
- Record channel baseline.
- Calculate outlier multiplier.
- Tag and search research evidence.
- Use the strongest signal as input to campaign strategy.

## Validation

- Topic is required.
- Views and baseline must be finite non-negative numbers.
- Outlier multiplier is derived from views divided by baseline.
- Live trend claims must not be invented when no provider is connected.

## Integrations

Publishes evidence for Creative Planner, Viral Analyzer, Campaign Builder and future Trend Intelligence providers.

## Current Limitation

No live TikTok, YouTube, Instagram, Pinterest or Google connector is bundled. The screen accepts verified manual research and is ready for provider adapters.
