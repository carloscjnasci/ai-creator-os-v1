# System Documentation: Analytics Feedback Loop (Sprint 13F)

## 1. Overview
The **Analytics Feedback Loop** connects real or simulated publication performance back to the Creative Intelligence Layer, Creative Planner, and Prompt Engine to form a closed-loop learning system. By ingesting metrics, normalizing them, attributing performance to structural entities, and running outlier detection and recommendation generation, the system adapts and refines future creative generation strategies.

```
       [ Publishing Hub Success ]
                   │
                   ▼
       [ Performance Snapshot Ingestion ] ──► (Event Bus)
                   │
                   ▼
       [ Metric Normalization & Derivation ]
                   │
                   ▼
       [ Lineage-Based Attribution Engine ]
                   │
                   ▼
       [ Scorecard & Gap Analysis Engine ]
                   │
                   ▼
       [ Outlier & Insight Detection ]
                   │
                   ▼
       [ Recommendation Engine ] ──► [ User Decision (Accept/Reject/Apply/Undo) ]
                   │                                         │
                   └─────────────────► [ Learning Context ] ◄─┘
```

---

## 2. Core Data Entities & Schemas (Zod Validated)

Every entity in the Analytics Feedback Loop is fully typed and validated using Zod schemas to ensure deterministic correctness, range safety, and data sanity.

### A. Performance Snapshot
Represents a point-in-time capture of metrics from a publication channel or external connector.
- **`id` & `workspaceId`**: Well-formed identifiers.
- **`platform`**: Platform identifier (e.g., `tiktok`, `instagram_reels`, `youtube_shorts`).
- **`sourceType`**: Source of metrics (`publishing_result`, `mock_connector`, `manual_entry`).
- **`metricWindow`**: Periodicity descriptor (`first_hour`, `first_24_hours`, `weekly`).
- **`periodStart` & `periodEnd`**: ISO datetimes verifying `periodEnd >= periodStart`.
- **`currency`**: Standard 3-letter uppercase code.
- **`impressions`, `views`, `likes`, `comments`, `shares`, `clicks`, `revenue`, `spend`**: Finite non-negative counters.
- **`ctr`, `cvr`, `engagementRate`, `completionRate`**: Floating rates between `0.0` and `1.0` inclusive.
- **Lineage links**: `publicationDraftId`, `publicationJobId`, `campaignId`, `promptHistoryId`, `digitalHumanId`, `productId`, `sceneId`, `wardrobeItemId`.

### B. Performance Scorecard
Captures synthesized scores and multi-dimension benchmarks.
- **`overallScore`**: Scalar index from `0` to `100` inclusive.
- **`dimensions`**: Segmented scores for **Engagement**, **Conversion**, and **Efficiency**, each with support details, confidence, and transparent limitation flags.
- **Prediction Gaps**: Includes `predictedViralScore`, `observedPerformanceScore`, `predictionGap`, `overprediction` (boolean), and `underprediction` (boolean).

### C. Analytics Insight
Synthesized raw performance observations.
- **`category`**: Area of impact (`hook`, `retention`, `conversion`, `efficiency`).
- **`severity`**: Priority level (`low`, `medium`, `high`).
- **`evidence`**: Contains specific raw metrics, actual observed values, baselines, and textual explanation descriptors.
- **`relatedSnapshotIds`**: Trackable reference lineages.

### D. Analytics Recommendation
Actionable prompt or structural adjustments offered to the user.
- **`recommendationType`**: Specific strategy action (e.g., `improve_hook`, `shorten_intro`, `strengthen_cta`, `reuse_prompt_structure`).
- **`proposedChange`**: Structured string describing exact prompt modifications or parameters.
- **`userDecision`**: Tracks explicit user audit actions (`accept`, `reject`, reason, timestamp).

### E. Learning Context
An advisory centralized state representing cumulative learning.
- **`acceptedRecommendationIds` & `rejectedRecommendationIds`**: Audited lineages.
- **`highPerformingPatterns` & `weakPatterns`**: Tracked successful/unsuccessful configurations.

---

## 3. Core Processing Engines

### A. Metric Normalizer
- **Exact Derivations**:
  - `Engagement Rate = (likes + comments + shares) / impressions` (or falling back to `views` if impressions are omitted).
  - `CTR = clicks / impressions`.
  - `CVR = purchases / clicks`.
  - `ROAS = revenue / spend`.
- **Division-by-Zero Protection**: Denominators are strictly validated. If a denominator is zero, the resulting derived metric is set to `undefined` rather than generating an error or `NaN`.
- **Estimated Fallbacks**: If optimal metrics are missing (e.g., impressions), the normalizer uses alternative signals (such as views) and labels the formula as estimated, setting the calculation's confidence under `1.0`.

### B. Attribution Engine
- **Lineage Traversal**: Scans the snapshot for entities linking it to campaigns, prompt history entries, products, digital humans, scene parameters, and wardrobe combinations.
- **Confidence Matrix**: Confidence scales linearly with the number of resolved links. A fully populated lineage path receives `1.0` confidence, whereas sparse/unresolved links generate missing link warning telemetry and lower confidence ratings.

### C. Outlier Engine
- **Minimum Sample Enforcement**: Outlier calculations require a configurable minimum history matching baseline (default `3` matching snapshots) to avoid false outlier claims from extremely small sample pools.
- **Positive & Negative Thresholds**: Compares observed values against historical baselines. Highlights positive or negative outliers based on configurable lift multipliers (e.g., positive outliers at $> 150\%$ of baseline, negative outliers at $< 66\%$).

### D. Insight & Recommendation Generator
- Translates scorecard performance gaps and outlier analysis into highly formatted insights and recommendations.
- Guarantees transparency by compiling explicit evidence arrays detailing exactly what metrics and baselines triggered each recommendation.

---

## 4. Integration & Security Architecture

### A. Publication Feedback Hook
- The `trackPublicationSuccess` function acts as the bridge. On any successful publication, it creates an initial DRAFT performance snapshot with pre-filled structural lineage.
- **Idempotent Workflows**: Checks existing publication draft and job tracking IDs to strictly avoid creating duplicate snapshots on multiple re-reads or manual retries.

### B. Credential-Free Frontend & Security Audit
- The entire feedback loop is engineered to be **credential-free** and secure.
- **Automatic Sanitation**: All metadata entries are sanitized. Any keys containing secret-related substrings (`token`, `secret`, `key`, `password`, `auth`) are dropped automatically.
- **Temporary URL Stripping**: Expiring/signed URLs containing temporary AWS S3 or provider authentication keys (e.g., `signature=`, `expires=`, `token=`) are removed on export to avoid exposing tokens in long-term backups.

### C. Workspace Backup v7 & Atomic Rollbacks
- **Compatibility**: Supports legacy restore of backups from previous versions (v1 to v6) by gracefully provisioning empty fallback structures for newly introduced collections.
- **Atomic Rollbacks**: Restoring a backup is fully atomic. The system takes an in-memory snapshot of current storage entries before writing. If any write failure occurs (e.g., a `QuotaExceededError` due to local storage limits), the system catches the error and executes a full rollback of all collections to their original values.

---

## 5. User Decision Workflows
Recommendations are advisory and require explicit user audit to preserve ultimate control:
1. **Accept**: Updates status, appends the recommendation ID to the learning context's accepted collection, and derives positive patterns.
2. **Reject**: Updates status and learning context's weak patterns list to prevent suggesting identical weak prompt structures in the future.
3. **Apply**: Sets status to `applied`, appends a formal `FeedbackDecision` record (recording user, timestamp, and rationale), and applies the proposed prompt/campaign patches.
4. **Undo**: Rolls back applied changes, restores the recommendation status to `accepted`, and cleans up any versioned configurations created by the patch.
