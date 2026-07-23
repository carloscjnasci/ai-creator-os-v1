# Experimentation Engine Architecture

The **Experimentation Engine** is a core sub-system of the AI Creator OS designed to enable safe, scientifically sound, and high-performance A/B and multivariate testing of creatives, prompts, assets, and publication channels. 

The system enforces deterministic user assignment, frequentist statistical hypothesis testing, rigorous guardrail validation, and automated risk mitigation without relying on external real-time network evaluation calls, keeping core execution loops offline-first, highly responsive, and statistically robust.

---

## 1. System Topology

```
+------------------------------------------------------------------------+
|                            AI Creator OS Core                         |
+------------------------------------------------------------------------+
       |                                                         ^
       | Dispatches Assignment & Variant Events                  | Listens to
       v                                                         | Recommendations
+------------------------------------------------------------------------+
|                        Experimentation Event Bus                       |
+------------------------------------------------------------------------+
       |                                                         |
       | Observations / Telemetry Ingest                         | Decisions
       v                                                         | Applied
+------------------------------------------------------------------------+
|                          Experimentation Engine                        |
|                                                                        |
|  +--------------------+  +--------------------+  +------------------+  |
|  |   Deterministic    |  | Frequentist Analyt |  |    Guardrail     |  |
|  |  Variant Assigner  |  |       Engine       |  |     Monitor      |  |
|  +--------------------+  +--------------------+  +------------------+  |
|  |           LocalStorage Core / Fallback Cloud Persistence         |  |
|  +------------------------------------------------------------------+  |
+------------------------------------------------------------------------+
```

---

## 2. Core Architectural Pillars

### A. Deterministic Variant Assignment
To prevent assignment drift and ensure statistical validity, variant allocation must be perfectly reproducible for any given target user/entity and experiment. 
- **Seed-Based Hashing**: Implements MurmurHash3 or FNV-1a hashing over `(experimentId + separator + entityId)` to determine variant assignment.
- **Allocation Splits**: Respects customized traffic allocation weights (e.g., 50% Control, 50% Treatment) mapped onto a deterministic `[0, 1)` range.
- **Zero Entropy**: No standard randomizers (`Math.random`) are used in the core assignment loop, guaranteeing the same user is always assigned the same variant upon repeated interactions.

### B. Frequentist Statistical Evaluation
The analytical core evaluates variant performance relative to the control using a rigorous frequentist hypothesis testing framework (specifically two-proportion and two-sample continuous Z-tests).
- **Z-Test Hypothesis Testing**: Computes standard errors, z-scores, p-values, and relative lift.
- **Continuous Metrics Aggregate Handling**: Gracefully handles continuous metrics by executing two-sample continuous Z-tests when valid variance is present, returning descriptive metrics only when no variance exists.
- **Primary Outcomes**:
  - **p-value**: Assesses statistical significance against the designated confidence level (e.g. p < 0.05).
  - **Relative Lift**: Percentage difference between variant and control mean values.
  - **Confidence Intervals (95%)**: Frequentist confidence intervals representing the range of the estimated effect size.

### C. Automated Guardrail Validation
Protects critical system health and brand metrics during live trials.
- **Primary Metric Isolation**: Maximizes lift on the focus metric.
- **Guardrail Metrics**: Tracks secondary metrics (e.g., user complaints, API errors).
- **Rule Engine**: Evaluates safety assertions. If a guardrail is violated (e.g., a variant decreases engagement by >5%), the system fires high-severity events to pause the variant or terminate the experiment immediately.

### D. Workspace Event Bus Integration
The engine acts as both a producer and consumer on the global event bus:
- **Subscriptions**:
  - `workspace.cleared`: Purges all local experiment registries, observation tables, and assignments.
  - `analytics.metric_logged`: Safely ingests raw user events to update observation logs.
- **Dispatches**:
  - `experiment.winner_detected`: Triggered when a variant meets the target confidence and lift thresholds.
  - `experiment.guardrail_violated`: Dispatched if safety parameters are breached.

---

## 3. Core Domain Entities

### Experiment
Represents the test definition:
```typescript
interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'evaluating' | 'completed';
  primaryMetric: string;
  guardrails: string[];
  allocationSplit: Record<string, number>; // variantId -> split decimal
  confidenceLevel: number; // e.g., 0.95
  minimumSampleSize: number;
  createdAt: string;
  updatedAt: string;
}
```

### ExperimentVariant
The variants tested under the experiment:
```typescript
interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;
  variantKey: 'control' | 'treatment_a' | 'treatment_b';
  allocationWeight: number; // split target
  metadata: Record<string, any>;
}
```

### ExperimentObservation
Ingested telemetry data aggregated per variant:
```typescript
interface ExperimentObservation {
  id: string;
  experimentId: string;
  variantId: string;
  metricType: string;
  sampleSize: number;
  value: number; // sum of metric
  variance?: number;
  updatedAt: string;
}
```

---

## 4. State Machine Lifecycle

```
     +---------+
     |  Draft  |
     +----+----+
          |
          | Publish / Launch
          v
     +----+----+             Pause
     | Running | <------------------------+
     +----+----+                          |
          |                               |
          | Ingest Events / Evaluate      | Resume
          v                               |
     +----+----+                          |
     |Evaluating                          |
     +----+----+ -------------------------+
          |
          | Thresholds Met / Apply Decision
          v
     +----+----+
     |Completed|
     +---------+
```

1. **Draft**: Configurations are structured. Variants and metrics are assigned. No users are allocated.
2. **Running**: Variant assignments are activated. Telemetry events feed the observation store.
3. **Evaluating**: Statistical analysis is compiled. Recommendations are prepared.
4. **Completed**: Winner or Control applied. Non-winning variants retired. Drafts of successful elements exported to the Creative Library and Publishing Hub.
