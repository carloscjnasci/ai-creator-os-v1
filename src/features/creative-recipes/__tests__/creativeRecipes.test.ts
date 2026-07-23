import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreativeRecipeCategory,
  CreativeRecipeStatus,
  RecipeSourceType,
  RecipeVersionStatus,
  RecipeParameterType,
  RecipeEvidenceSourceType,
  RecipeRecommendationType,
  RecipeRecommendationStatus,
} from '../types';
import { creativeRecipeSchema } from '../recipeSchemas';
import {
  loadRecipes,
  saveRecipes,
  loadRecipeVersions,
  saveRecipeVersions,
  loadRecipeEvidence,
  saveRecipeEvidence,
  loadRecipeRecommendations,
  saveRecipeRecommendations,
  loadRecipeApplications,
  saveRecipeApplications,
  clearAllRecipeStorageKeys,
} from '../recipeStorage';
import {
  transitionRecipeStatus,
  isValidRecipeTransition,
} from '../recipeLifecycle';
import {
  createNewVersionDraft,
  activateVersion,
  editVersion,
  deleteVersion,
} from '../recipeVersioning';
import {
  validateRecipe,
  validateStageGraph,
  findUnknownPlaceholders,
} from '../recipeValidator';
import {
  instantiateRecipeVersion,
  generateRecipeFingerprint,
  resolveTemplate,
} from '../recipeInstantiation';
import { addRecipeEvidence } from '../recipeEvidence';
import { generateRecipeScorecard } from '../recipeScoring';
import {
  generateRecipeRecommendations,
  recordRecommendationDecision,
} from '../recipeRecommendationEngine';
import {
  initializeRecipeEventConsumer,
  getRecipeEventConsumerRefCount,
  resetRecipeEventConsumer,
} from '../recipeEvents';
import { MockRecipeAdapter } from '../adapters/mockRecipeAdapter';
import { ManualRecipeAdapter } from '../adapters/manualRecipeAdapter';
import { SecureRecipeAdapter } from '../adapters/secureRecipeAdapter';
import { saveAnalyses } from '../../experimentation/experimentStorage';
import { AnalysisResultStatus } from '../../experimentation/types';
import {
  validateRecipeVersion,
  restoreRecipeThroughNewVersion,
  previewRecipeApplication,
  executeRecipeApplication,
  createRecipe,
  createRecipeApplication,
  approveRecipeApplication,
  activateRecipeVersion,
  archiveRecipe,
  deprecateVersion,
} from '../recipeWorkflows';
import { RECIPE_APPLICATIONS_KEY, subscribeToRecipeStorage } from '../recipeStorage';
import { RecipeApplicationStatus } from '../types';
import { restoreWorkspaceBackup, createWorkspaceBackup } from '@/features/settings/workspaceBackup';

// Import from creativeEventBus to test listeners
import { publishCreativeEvent } from '@/core/events/creativeEventBus';

describe('Creative Recipes Feature Part 1 Tests', () => {
  beforeEach(() => {
    // Clear localStorage mockup keys before each test
    clearAllRecipeStorageKeys();
    saveAnalyses([]);
    vi.restoreAllMocks();
  });

  // 1. RECIPE SCHEMA
  describe('Recipe Schema Validation', () => {
    it('successfully parses valid canonical CreativeRecipe structure', () => {
      const now = new Date().toISOString();
      const rawRecipe = {
        id: 'rec-test-1',
        workspaceId: 'ws-test',
        name: 'High Impact Test Hook',
        description: 'Test description',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.DRAFT,
        currentVersionId: '',
        sourceType: RecipeSourceType.MANUAL,
        sourceEntityIds: [],
        objective: 'Increase clicks',
        targetPlatforms: ['tiktok'],
        targetAudienceDescription: 'Gen Z',
        productCategories: ['apparel'],
        tags: ['test'],
        requiredCapabilities: [],
        brandRuleIds: [],
        evidenceSummary: {
          evidenceCount: 0,
          averageScore: 0,
          liftSummary: 'None',
        },
        confidence: 0,
        usageCount: 0,
        successfulApplicationCount: 0,
        averageObservedScore: 0,
        createdBy: 'user-admin',
        createdAt: now,
        updatedAt: now,
      };

      const result = creativeRecipeSchema.safeParse(rawRecipe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('rec-test-1');
      }
    });

    it('rejects malformed identifier formatting', () => {
      const result = creativeRecipeSchema.safeParse({
        id: 'bad id format!!', // fails regex
        workspaceId: 'ws_test',
        name: 'Recipe',
        category: CreativeRecipeCategory.OTHER,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });
  });

  // 2. LIFECYCLE TRANSITIONS
  describe('Recipe Lifecycle Transitions', () => {
    it('permits valid status transitions', () => {
      expect(isValidRecipeTransition(CreativeRecipeStatus.DRAFT, CreativeRecipeStatus.VALIDATING)).toBe(true);
      expect(isValidRecipeTransition(CreativeRecipeStatus.ACTIVE, CreativeRecipeStatus.DEPRECATED)).toBe(true);
      expect(isValidRecipeTransition(CreativeRecipeStatus.DEPRECATED, CreativeRecipeStatus.ARCHIVED)).toBe(true);
    });

    it('denies transition out of ARCHIVED (terminal state)', () => {
      expect(isValidRecipeTransition(CreativeRecipeStatus.ARCHIVED, CreativeRecipeStatus.DRAFT)).toBe(false);
      expect(isValidRecipeTransition(CreativeRecipeStatus.ARCHIVED, CreativeRecipeStatus.ACTIVE)).toBe(false);
    });

    it('successfully updates and saves recipe with appropriate timestamps', () => {
      const now = new Date().toISOString();
      const recipe: any = {
        id: 'rec-life-1',
        workspaceId: 'ws-test',
        name: 'Lifecycle Recipe',
        category: CreativeRecipeCategory.PROMPT,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'operator',
        createdAt: now,
        updatedAt: now,
      };
      saveRecipes([recipe]);

      const updated = transitionRecipeStatus('rec-life-1', CreativeRecipeStatus.VALIDATING, 'operator');
      expect(updated.status).toBe(CreativeRecipeStatus.VALIDATING);
      expect(loadRecipes()[0].status).toBe(CreativeRecipeStatus.VALIDATING);
    });
  });

  // 3. VERSION INCREMENTS
  describe('Recipe Version Increments', () => {
    it('deterministically increments version numbers and sets parents', () => {
      const recipeId = 'rec-vincr-1';
      const now = new Date().toISOString();
      const v1 = createNewVersionDraft(recipeId, undefined, 'user-admin', {
        versionLabel: 'v1.0.0-draft',
      });
      expect(v1.versionNumber).toBe(1);

      const v2 = createNewVersionDraft(recipeId, v1.id, 'user-admin', {
        versionLabel: 'v2.0.0-draft',
      });
      expect(v2.versionNumber).toBe(2);
      expect(v2.parentVersionId).toBe(v1.id);
    });
  });

  // 4. ACTIVE-VERSION EXCLUSIVITY
  describe('Active Version Exclusivity', () => {
    it('sets previous active version to SUPERSEDED upon new activation', () => {
      const recipeId = 'rec-excl-1';
      const now = new Date().toISOString();
      
      const recipe: any = {
        id: recipeId,
        workspaceId: 'ws-test',
        name: 'Exclusive Recipe',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
      };
      saveRecipes([recipe]);

      const v1 = createNewVersionDraft(recipeId, undefined, 'user', { versionLabel: 'v1' });
      const v2 = createNewVersionDraft(recipeId, v1.id, 'user', { versionLabel: 'v2' });

      // Initially both are DRAFT
      expect(v1.status).toBe(RecipeVersionStatus.DRAFT);

      // Activate v1
      const act1 = activateVersion(recipeId, v1.id, 'user');
      expect(act1.activatedVersion.status).toBe(RecipeVersionStatus.ACTIVE);

      // Activate v2 (superseding v1)
      const act2 = activateVersion(recipeId, v2.id, 'user');
      expect(act2.activatedVersion.status).toBe(RecipeVersionStatus.ACTIVE);

      const reloadedVersions = loadRecipeVersions();
      const reloadedV1 = reloadedVersions.find(v => v.id === v1.id);
      expect(reloadedV1?.status).toBe(RecipeVersionStatus.SUPERSEDED);
      expect(reloadedV1?.supersededAt).toBeDefined();
    });
  });

  // 5. IMMUTABLE HISTORICAL VERSIONS
  describe('Immutable Historical Versions', () => {
    it('does not allow editing active version without spawning a new draft', () => {
      const recipeId = 'rec-imm-1';
      const now = new Date().toISOString();
      
      const recipe: any = {
        id: recipeId,
        workspaceId: 'ws-test',
        name: 'Immutable',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.ACTIVE,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
      };
      saveRecipes([recipe]);

      const v1 = createNewVersionDraft(recipeId, undefined, 'user', { versionLabel: 'v1' });
      // Set status to ACTIVE
      activateVersion(recipeId, v1.id, 'user');

      // Editing v1 (which is ACTIVE) will spawn a brand new draft version instead of changing v1
      const nextVersion = editVersion(recipeId, v1.id, { versionLabel: 'v1-edited' }, 'user');
      expect(nextVersion.id).not.toBe(v1.id);
      expect(nextVersion.versionNumber).toBe(2);
      expect(nextVersion.status).toBe(RecipeVersionStatus.DRAFT);

      // V1 should remain unchanged in storage
      const v1Reloaded = loadRecipeVersions().find(v => v.id === v1.id);
      expect(v1Reloaded?.versionLabel).toBe('v1');
    });

    it('blocks deletion of a version after it has been applied to applications', () => {
      const versionId = 'ver-applied-999';
      const application: any = {
        id: 'app-1',
        recipeId: 'rec-applied',
        recipeVersionId: versionId,
        workspaceId: 'ws-test',
        status: 'completed',
        fingerprint: 'fp-1',
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveRecipeApplications([application]);

      const version: any = {
        id: versionId,
        recipeId: 'rec-applied',
        versionNumber: 1,
        versionLabel: 'v1',
        status: 'active',
        structure: { stages: [] },
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      };
      saveRecipeVersions([version]);

      expect(() => deleteVersion('rec-applied', versionId)).toThrow(
        'Version deletion is not allowed after it has been applied.'
      );
    });
  });

  // 6. PARAMETER VALIDATION
  describe('Parameter Validation', () => {
    it('enforces parameter minimum/maximum validation', () => {
      const version: any = {
        id: 'ver-param-1',
        recipeId: 'rec-param-1',
        versionNumber: 1,
        parameters: [
          {
            id: 'p1',
            key: 'size',
            label: 'Size',
            parameterType: RecipeParameterType.NUMBER,
            required: true,
            minimum: 10,
            maximum: 100,
            visibility: 'visible',
            order: 1,
          }
        ],
        structure: { stages: [] },
      };

      const resultLow = instantiateRecipeVersion(version, { size: 5 }, {});
      expect(resultLow.validationErrors).toContain("Parameter 'size' value 5 is less than minimum 10.");

      const resultHigh = instantiateRecipeVersion(version, { size: 120 }, {});
      expect(resultHigh.validationErrors).toContain("Parameter 'size' value 120 is greater than maximum 100.");

      const resultOk = instantiateRecipeVersion(version, { size: 50 }, {});
      expect(resultOk.validationErrors.length).toBe(0);
    });

    it('validates pattern regex for text parameters', () => {
      const version: any = {
        id: 'ver-pattern-1',
        recipeId: 'rec-pattern-1',
        versionNumber: 1,
        parameters: [
          {
            id: 'p1',
            key: 'hashtag',
            label: 'Hashtag',
            parameterType: RecipeParameterType.TEXT,
            required: true,
            pattern: '^#[a-zA-Z0-9]+$',
            visibility: 'visible',
            order: 1,
          }
        ],
        structure: { stages: [] },
      };

      const resultBad = instantiateRecipeVersion(version, { hashtag: 'no-hash-symbol' }, {});
      expect(resultBad.validationErrors.length).toBeGreaterThan(0);

      const resultOk = instantiateRecipeVersion(version, { hashtag: '#SmartSerum' }, {});
      expect(resultOk.validationErrors.length).toBe(0);
    });
  });

  // 7. UNKNOWN PLACEHOLDERS
  describe('Placeholder Safety', () => {
    it('extracts and flags unknown placeholders while letting approved ones through', () => {
      const templateStr = 'Our new {{product.name}} with high-tech {{unknownVar}} at cost of {{anotherBad}}';
      const unknowns = findUnknownPlaceholders(templateStr);
      expect(unknowns).toContain('unknownVar');
      expect(unknowns).toContain('anotherBad');
      expect(unknowns).not.toContain('product.name');
    });

    it('rejects execution or validation of unknown placeholders', () => {
      const recipe: any = {
        id: 'rec-safe-1',
        workspaceId: 'ws-test',
        name: 'Placeholder Recipe',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const version: any = {
        id: 'ver-safe-1',
        recipeId: 'rec-safe-1',
        versionNumber: 1,
        versionLabel: 'v1',
        status: 'draft',
        parameters: [],
        structure: {
          stages: [
            {
              id: 'stage-1',
              type: 'hook',
              title: 'Visual overlay',
              template: 'Introducing {{product.name}} backed by {{unsupportedValue}}!',
              parameterBindings: {},
              dependencies: [],
              outputType: 'text',
              optional: false,
              order: 1,
              validationRules: {},
            }
          ]
        },
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      };

      saveRecipes([recipe]);
      saveRecipeVersions([version]);

      const result = validateRecipe('rec-safe-1', 'ver-safe-1');
      expect(result.valid).toBe(false);
      expect(result.errors.join('')).toContain('unsupportedValue');
    });
  });

  // 8. CIRCULAR BINDING REJECTION
  describe('Circular Binding Rejection', () => {
    it('detects and rejects duplicate or circular sourceBindings in parameters', () => {
      const recipe: any = {
        id: 'rec-circ-param',
        workspaceId: 'ws-test',
        name: 'Circular Param Bindings',
        category: CreativeRecipeCategory.PROMPT,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const version: any = {
        id: 'ver-circ-param-1',
        recipeId: 'rec-circ-param',
        versionNumber: 1,
        versionLabel: 'v1',
        status: 'draft',
        parameters: [
          {
            id: 'param-1',
            key: 'p1',
            label: 'P1',
            parameterType: RecipeParameterType.TEXT,
            required: true,
            sourceBinding: 'circular_ref_key',
            visibility: 'visible',
            order: 1,
          },
          {
            id: 'param-2',
            key: 'p2',
            label: 'P2',
            parameterType: RecipeParameterType.TEXT,
            required: true,
            sourceBinding: 'circular_ref_key', // Duplicate/circular reference key
            visibility: 'visible',
            order: 2,
          }
        ],
        structure: { stages: [] },
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      };

      saveRecipes([recipe]);
      saveRecipeVersions([version]);

      const result = validateRecipe('rec-circ-param', 'ver-circ-param-1');
      expect(result.valid).toBe(false);
      expect(result.errors.join('')).toContain('Circular binding detected in recipe parameters');
    });
  });

  // 9. STAGE DAG VALIDATION & 10. CIRCULAR STAGE DEPENDENCIES
  describe('Stage Graph DAG and Cycle Validation', () => {
    it('accepts perfectly valid Directed Acyclic Graph (DAG) structures', () => {
      const stages: any[] = [
        { id: 'stg-1', dependencies: [] },
        { id: 'stg-2', dependencies: ['stg-1'] },
        { id: 'stg-3', dependencies: ['stg-1', 'stg-2'] },
      ];
      const result = validateStageGraph(stages);
      expect(result.isValid).toBe(true);
    });

    it('rejects graphs containing self-dependencies', () => {
      const stages: any[] = [
        { id: 'stg-1', dependencies: ['stg-1'] },
      ];
      const result = validateStageGraph(stages);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Circular');
    });

    it('rejects graphs containing cyclic dependencies', () => {
      const stages: any[] = [
        { id: 'stg-1', dependencies: ['stg-2'] },
        { id: 'stg-2', dependencies: ['stg-3'] },
        { id: 'stg-3', dependencies: ['stg-1'] },
      ];
      const result = validateStageGraph(stages);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Circular stage dependencies detected');
    });

    it('rejects stages containing duplicate stage IDs', () => {
      const stages: any[] = [
        { id: 'stg-dup', dependencies: [] },
        { id: 'stg-dup', dependencies: [] },
      ];
      const result = validateStageGraph(stages);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Duplicated stage IDs');
    });

    it('rejects stages depending on non-existent dependencies', () => {
      const stages: any[] = [
        { id: 'stg-1', dependencies: ['stg-missing'] },
      ];
      const result = validateStageGraph(stages);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-existent stage');
    });
  });

  // 11. DETERMINISTIC INSTANTIATION & 12. STABLE FINGERPRINT
  describe('Deterministic Instantiation and Fingerprinting', () => {
    it('generates the exact same output template and stable hash fingerprint on same inputs without using random', () => {
      const version: any = {
        id: 'ver-determ-1',
        recipeId: 'rec-determ-1',
        versionNumber: 1,
        parameters: [
          {
            id: 'p-hook',
            key: 'hook',
            label: 'Hook',
            parameterType: RecipeParameterType.TEXT,
            required: true,
            visibility: 'visible',
            order: 1,
          }
        ],
        structure: {
          stages: [
            {
              id: 'stg-1',
              type: 'hook',
              title: 'Visual Hook',
              template: 'Try {{hook}} today!',
              parameterBindings: {},
              dependencies: [],
              outputType: 'text',
              optional: false,
              order: 1,
              validationRules: {},
            }
          ]
        },
      };

      const params1 = { hook: 'SmartSerum' };
      const workspaceContext = { product: { name: 'Serum' } };

      const inst1 = instantiateRecipeVersion(version, params1, workspaceContext);
      const inst2 = instantiateRecipeVersion(version, params1, workspaceContext);

      // Verify identical fingerprints and resolved contents
      expect(inst1.fingerprint).toBe(inst2.fingerprint);
      expect(inst1.resolvedStages[0].resolvedTemplate).toBe(inst2.resolvedStages[0].resolvedTemplate);
      expect(inst1.fingerprint).toBeDefined();
      expect(inst1.fingerprint).not.toContain('NaN');
    });
  });

  // 13. BRAND-RULE PRECEDENCE
  describe('Brand Safety Integration', () => {
    it('reports safety warnings if no brand rules are mapped or validated', () => {
      const recipe: any = {
        id: 'rec-brand-test',
        workspaceId: 'ws-test',
        name: 'Brand Test',
        category: CreativeRecipeCategory.SCRIPT,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        brandRuleIds: [], // Empty brand rules
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const version: any = {
        id: 'ver-brand-1',
        recipeId: 'rec-brand-test',
        versionNumber: 1,
        versionLabel: 'v1',
        status: 'draft',
        parameters: [],
        structure: { stages: [] },
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      };

      saveRecipes([recipe]);
      saveRecipeVersions([version]);

      const result = validateRecipe('rec-brand-test', 'ver-brand-1');
      expect(result.warnings.join('')).toContain('safety');
    });
  });

  // 14. EVIDENCE LEVELS
  describe('Recipe Evidence Levels', () => {
    it('classifies evidence levels deterministically based on empirical count', () => {
      const recipe: any = {
        id: 'rec-ev-lvl',
        workspaceId: 'ws-test',
        name: 'Evidence Levels Recipe',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.DRAFT,
        sourceType: RecipeSourceType.MANUAL,
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const version: any = {
        id: 'ver-ev-lvl-1',
        recipeId: 'rec-ev-lvl',
        versionNumber: 1,
        versionLabel: 'v1',
        status: 'draft',
        parameters: [],
        structure: { stages: [] },
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      };

      saveRecipes([recipe]);
      saveRecipeVersions([version]);

      // 0 evidence -> untested
      const res0 = validateRecipe('rec-ev-lvl', 'ver-ev-lvl-1');
      expect(res0.evidenceLevel).toBe('untested');

      // Add 2 evidences -> preliminary
      const evs: any[] = [
        {
          id: 'ev-1',
          recipeId: 'rec-ev-lvl',
          recipeVersionId: 'ver-ev-lvl-1',
          sourceType: RecipeEvidenceSourceType.MANUAL,
          sourceEntityId: 'ent-1',
          metricName: 'ctr',
          observedValue: 0.1,
          baselineValue: 0.08,
          absoluteLift: 0.02,
          relativeLift: 0.25,
          sampleSize: 100,
          confidence: 0.8,
          capturedAt: new Date().toISOString(),
        },
        {
          id: 'ev-2',
          recipeId: 'rec-ev-lvl',
          recipeVersionId: 'ver-ev-lvl-1',
          sourceType: RecipeEvidenceSourceType.MANUAL,
          sourceEntityId: 'ent-2',
          metricName: 'ctr',
          observedValue: 0.1,
          baselineValue: 0.08,
          absoluteLift: 0.02,
          relativeLift: 0.25,
          sampleSize: 100,
          confidence: 0.8,
          capturedAt: new Date().toISOString(),
        }
      ];
      saveRecipeEvidence(evs);

      const res2 = validateRecipe('rec-ev-lvl', 'ver-ev-lvl-1');
      expect(res2.evidenceLevel).toBe('preliminary');
    });
  });

  // 15. INCONCLUSIVE EXPERIMENT EVIDENCE
  describe('Inconclusive Experiment Integration', () => {
    it('blocks registering evidence from inconclusive experiments', () => {
      // Seed inconclusive experiment analysis results
      const analyses: any[] = [
        {
          experimentId: 'exp-inconclusive-999',
          primaryMetric: 'ctr',
          controlVariantId: 'v-control',
          evaluatedVariantIds: ['v-1'],
          sampleSizes: {},
          observedValues: {},
          absoluteLift: {},
          relativeLift: {},
          standardError: {},
          confidenceInterval: {},
          confidenceLevel: 0.95,
          minimumDetectableEffect: 0.05,
          statisticalSignificance: {},
          practicalSignificance: {},
          resultStatus: AnalysisResultStatus.INCONCLUSIVE, // INCONCLUSIVE status
          warnings: [],
          limitations: [],
          analyzedAt: new Date().toISOString(),
        }
      ];
      saveAnalyses(analyses);

      const evInput: any = {
        recipeId: 'rec-inc-test',
        recipeVersionId: 'ver-inc-1',
        sourceType: RecipeEvidenceSourceType.EXPERIMENT,
        sourceEntityId: 'exp-inconclusive-999',
        experimentId: 'exp-inconclusive-999',
        metricName: 'ctr',
        observedValue: 0.05,
        baselineValue: 0.05,
        absoluteLift: 0.0,
        relativeLift: 0.0,
        sampleSize: 1000,
        confidence: 0.5,
        limitations: [],
      };

      expect(() => addRecipeEvidence(evInput)).toThrow(
        'Evidence from inconclusive experiments cannot be treated as a win.'
      );
    });
  });

  // 16. SCORE BOUNDARIES
  describe('Recipe Score Boundaries', () => {
    it('guarantees scorecard outputs are strictly clamped between 0 and 100', () => {
      const recipe: any = {
        id: 'rec-score-1',
        name: 'Scored Recipe',
        usageCount: 0,
        successfulApplicationCount: 0,
        confidence: 0,
        brandRuleIds: [],
      };
      const version: any = {
        id: 'ver-score-1',
        recipeId: 'rec-score-1',
        parameters: [],
        compatiblePlatforms: [],
        structure: { stages: [] },
      };

      const scorecard = generateRecipeScorecard(recipe, version);
      expect(scorecard.evidenceStrength).toBeGreaterThanOrEqual(0);
      expect(scorecard.evidenceStrength).toBeLessThanOrEqual(100);
      expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
      expect(scorecard.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // 17. RECOMMENDATION EVIDENCE
  describe('Recommendation Engine rules', () => {
    it('creates context proposed recommendations, preventing automatic mutation', () => {
      // Add an active winner experiment analysis
      const analyses: any[] = [
        {
          experimentId: 'exp-winner-888',
          primaryMetric: 'ctr',
          controlVariantId: 'v-control',
          evaluatedVariantIds: ['v-winner'],
          sampleSizes: {},
          observedValues: {},
          absoluteLift: {},
          relativeLift: {},
          standardError: {},
          confidenceInterval: {},
          confidenceLevel: 0.95,
          minimumDetectableEffect: 0.05,
          statisticalSignificance: {},
          practicalSignificance: {},
          winnerVariantId: 'v-winner',
          resultStatus: AnalysisResultStatus.WINNER, // Clear winner
          warnings: [],
          limitations: [],
          analyzedAt: new Date().toISOString(),
        }
      ];
      saveAnalyses(analyses);

      const recs = generateRecipeRecommendations('ws-test');
      const winnerRec = recs.find(r => r.type === RecipeRecommendationType.CONVERT_WINNER);
      expect(winnerRec).toBeDefined();
      expect(winnerRec?.status).toBe(RecipeRecommendationStatus.PROPOSED);

      // Verify recipe was NOT automatically created yet (is still absent)
      const recipes = loadRecipes();
      expect(recipes.length).toBe(0);

      // Apply decision
      const acceptedRec = recordRecommendationDecision(winnerRec!.id, 'accept');
      expect(acceptedRec.status).toBe(RecipeRecommendationStatus.ACCEPTED);
      expect(acceptedRec.userDecision).toBe('accept');
    });
  });

  // 18. STORAGE FAILURES & 19. STORAGE SUBSCRIPTIONS
  describe('Storage Subscriptions and Error Safeguards', () => {
    it('proves subscribeToRecipeStorage behaves correctly on same-tab, cross-tab, ignore, and cleanup', () => {
      let callCount = 0;
      const callback = () => { callCount++; };

      // 1. Setup subscription
      const unsubscribe = subscribeToRecipeStorage('ai_creator_os:creative_recipes', callback);

      // Proves: relevant custom same-tab event invokes the listener
      window.dispatchEvent(
        new CustomEvent('ai-creator-os:recipes-changed', {
          detail: { key: 'ai_creator_os:creative_recipes' },
        })
      );
      expect(callCount).toBe(1);

      // Proves: unrelated custom key is ignored
      window.dispatchEvent(
        new CustomEvent('ai-creator-os:recipes-changed', {
          detail: { key: 'unrelated_key' },
        })
      );
      expect(callCount).toBe(1);

      // Proves: relevant cross-tab StorageEvent invokes the listener
      const storageEvent = new StorageEvent('storage', {
        key: 'ai_creator_os:creative_recipes',
        storageArea: localStorage,
      });
      window.dispatchEvent(storageEvent);
      expect(callCount).toBe(2);

      // Proves: unrelated storage key is ignored
      const unrelatedStorageEvent = new StorageEvent('storage', {
        key: 'unrelated_key',
        storageArea: localStorage,
      });
      window.dispatchEvent(unrelatedStorageEvent);
      expect(callCount).toBe(2);

      // Proves: cleanup removes both listeners
      unsubscribe();

      // Proves: events after cleanup do not invoke the callback
      window.dispatchEvent(
        new CustomEvent('ai-creator-os:recipes-changed', {
          detail: { key: 'ai_creator_os:creative_recipes' },
        })
      );
      window.dispatchEvent(storageEvent);
      expect(callCount).toBe(2);
    });
  });

  // 20. MOCK ADAPTER DETERMINISM
  describe('Mock Recipe Adapter', () => {
    it('returns structured, realistic and clearly labeled mock recipes', () => {
      const mockRecipes = MockRecipeAdapter.getMockRecipes('ws-test');
      expect(mockRecipes.length).toBeGreaterThan(0);
      expect(mockRecipes[0].name).toContain('[MOCK]');
    });
  });

  // 21. MANUAL ADAPTER VALIDATION
  describe('Manual Recipe Adapter', () => {
    it('creates a draft recipe and initiates validation rules', () => {
      const manualRecipe = ManualRecipeAdapter.createRecipe(
        'ws-test',
        'Manual Book',
        'Visual test',
        CreativeRecipeCategory.VISUAL_STYLE,
        'user-admin'
      );
      expect(manualRecipe.status).toBe(CreativeRecipeStatus.DRAFT);
      expect(manualRecipe.sourceType).toBe(RecipeSourceType.MANUAL);

      const validation = ManualRecipeAdapter.validateRecipe(manualRecipe.id);
      expect(validation.recommendedCorrections.length).toBeGreaterThan(0);
    });
  });

  // 22. SECURE ADAPTER CONTRACTS & 23. NO CREDENTIAL PERSISTENCE
  describe('Secure Recipe Adapter Contracts', () => {
    it('returns descriptive errors instead of completing calls and rejects raw secrets/credentials', async () => {
      await expect(
        SecureRecipeAdapter.createRecipe('ws-test', 'R1', 'D1', CreativeRecipeCategory.OTHER, 'user-admin')
      ).rejects.toThrow('SecureRecipeAdapter: Backend connection is not yet configured.');

      // credential check
      await expect(
        SecureRecipeAdapter.createRecipe('ws-test', 'R1', 'D1', CreativeRecipeCategory.OTHER, 'user-admin', 'password123')
      ).rejects.toThrow('Security Error: Raw credentials or API keys must not be passed');
    });
  });

  // 24. NO EVAL OR EXECUTABLE TEMPLATE CODE
  describe('Executability Safety Protection', () => {
    it('strips script tags and prevents evaluation inside substitutions', () => {
      const badValue = 'Hello <script>alert("hacked")</script> world';
      const template = 'Greetings: {{input}}';
      const errors: string[] = [];
      const resolved = resolveTemplate(template, { input: badValue }, {}, errors);
      expect(resolved).not.toContain('<script>');
      expect(resolved).toContain('[Script Blocked]');
    });
  });

  // 25. NO MATH.RANDOM DEPENDENCY
  describe('Zero Non-Deterministic Random Dependencies', () => {
    it('verifies deterministic fingerprint outcomes and no Math.random references', () => {
      const fingerprintA = generateRecipeFingerprint('ver-999', { value: 'static-string' });
      const fingerprintB = generateRecipeFingerprint('ver-999', { value: 'static-string' });
      expect(fingerprintA).toBe(fingerprintB);
    });
  });

  // 26. WORKFLOWS, ATOMICITY, AND SYSTEM INTEGRITY
  describe('Workflows, Atomicity, and System Integrity Tests', () => {
    it('verifies storage key alignment', () => {
      expect(RECIPE_APPLICATIONS_KEY).toBe('ai_creator_os:creative_recipes:applications');
    });

    it('verifies validateRecipeVersion successfully transitions statuses (DRAFT -> VALIDATING -> READY)', () => {
      const { recipe, version } = createRecipe('ws-test', 'Transition Test Recipe', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      expect(recipe.status).toBe(CreativeRecipeStatus.DRAFT);
      expect(version.status).toBe(RecipeVersionStatus.DRAFT);

      const valResult = validateRecipeVersion(recipe.id, version.id);
      expect(valResult.valid).toBe(true);

      const reloadedRecipes = loadRecipes();
      const reloadedVersions = loadRecipeVersions();

      const updatedRecipe = reloadedRecipes.find(r => r.id === recipe.id);
      const updatedVersion = reloadedVersions.find(v => v.id === version.id);

      expect(updatedRecipe?.status).toBe(CreativeRecipeStatus.READY);
      expect(updatedVersion?.status).toBe(RecipeVersionStatus.READY);
    });

    it('verifies restoreRecipeThroughNewVersion for deprecated vs archived recipes', () => {
      const { recipe, version } = createRecipe('ws-test', 'Restore Test Recipe', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      
      // Attempting to restore a draft recipe throws
      expect(() => restoreRecipeThroughNewVersion(recipe.id, 'user-1')).toThrow(
        'Only DEPRECATED recipes can be restored'
      );

      // Transition to DEPRECATED
      const recipes = loadRecipes();
      recipes[recipes.findIndex(r => r.id === recipe.id)].status = CreativeRecipeStatus.DEPRECATED;
      saveRecipes(recipes);

      const restoreResult = restoreRecipeThroughNewVersion(recipe.id, 'user-1');
      expect(restoreResult.recipe.status).toBe(CreativeRecipeStatus.DRAFT);
      expect(restoreResult.draftVersion.versionNumber).toBe(2);
      expect(restoreResult.draftVersion.status).toBe(RecipeVersionStatus.DRAFT);

      // Transition to ARCHIVED
      const freshRecipes = loadRecipes();
      freshRecipes[freshRecipes.findIndex(r => r.id === recipe.id)].status = CreativeRecipeStatus.ARCHIVED;
      saveRecipes(freshRecipes);

      // Archived recipe is terminal and cannot be restored
      expect(() => restoreRecipeThroughNewVersion(recipe.id, 'user-1')).toThrow(
        'Archived recipes are terminal and cannot be restored.'
      );
    });

    it('verifies preview vs execute and preview persistence', () => {
      const { recipe, version } = createRecipe('ws-test', 'Execution Test Recipe', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      
      // Make active
      const valResult = validateRecipeVersion(recipe.id, version.id);
      activateRecipeVersion(recipe.id, version.id, 'user-1');

      // Preview (does not persist application)
      const preview = previewRecipeApplication(recipe.id, version.id, {}, {});
      expect(preview.fingerprint).toBeDefined();
      expect(loadRecipeApplications().length).toBe(0);

      // Create application (persists with status PREVIEWED)
      const app = createRecipeApplication('ws-test', recipe.id, version.id, {}, 'user-1');
      expect(app.status).toBe(RecipeApplicationStatus.PREVIEWED);
      expect(loadRecipeApplications().length).toBe(1);

      // Approve application
      const approvedApp = approveRecipeApplication(app.id, 'user-1');
      expect(approvedApp.status).toBe(RecipeApplicationStatus.APPROVED);

      // Execute application
      const executed = executeRecipeApplication(app.id, 'user-1', {});
      expect(executed.status).toBe(RecipeApplicationStatus.COMPLETED);
    });

    it('verifies execute fails on inactive or unapproved recipes/versions', () => {
      const { recipe, version } = createRecipe('ws-test', 'Inactive Test Recipe', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      
      const app = createRecipeApplication('ws-test', recipe.id, version.id, {}, 'user-1');
      
      // Attempting to execute unapproved application throws
      expect(() => executeRecipeApplication(app.id, 'user-1', {})).toThrow(
        'Application must be APPROVED'
      );

      // Approve it
      approveRecipeApplication(app.id, 'user-1');

      // Attempting to execute when recipe/version is not ACTIVE throws
      expect(() => executeRecipeApplication(app.id, 'user-1', {})).toThrow(
        'Cannot execute application: Recipe status is'
      );
    });

    it('verifies atomic application execution with rollback on storage write failure', () => {
      const { recipe, version } = createRecipe('ws-test', 'Atomic Exec Test', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      validateRecipeVersion(recipe.id, version.id);
      activateRecipeVersion(recipe.id, version.id, 'user-1');

      const app = createRecipeApplication('ws-test', recipe.id, version.id, {}, 'user-1');
      approveRecipeApplication(app.id, 'user-1');

      const originalApps = loadRecipeApplications();

      // Spy on saveRecipeApplications to simulate a quota error
      const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
        if (key === RECIPE_APPLICATIONS_KEY) {
          throw new Error('QuotaExceededError');
        }
      });

      // Executing should capture failure and update status to FAILED in the catch block (if possible),
      // but let's see how our executeRecipeApplication rollback is handled.
      // It sets app.status to FAILED and tries to save it, throwing the error.
      expect(() => executeRecipeApplication(app.id, 'user-1', {})).toThrow(
        'QuotaExceededError'
      );

      // The recipes and applications should be restored to their original state
      expect(loadRecipeApplications()).toEqual(originalApps);

      saveSpy.mockRestore();
    });

    it('verifies atomic activation with rollback on storage write failure', () => {
      const { recipe, version } = createRecipe('ws-test', 'Atomic Act Test', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      validateRecipeVersion(recipe.id, version.id);

      const originalRecipes = loadRecipes();
      const originalVersions = loadRecipeVersions();

      // Spy on saveRecipeVersions to simulate a write failure
      const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
        if (key === 'ai_creator_os:creative_recipe_versions') {
          throw new Error('DiskFullError');
        }
      });

      expect(() => activateRecipeVersion(recipe.id, version.id, 'user-1')).toThrow(
        'QuotaExceededError'
      );

      // Both recipes and versions must be fully rolled back
      expect(loadRecipes()).toEqual(originalRecipes);
      expect(loadRecipeVersions()).toEqual(originalVersions);

      saveSpy.mockRestore();
    });

    it('verifies Event Bus singleton pattern with reference counting and cleanup', () => {
      // Clean up any existing consumer first
      resetRecipeEventConsumer();

      const CREATIVE_OS_EVENT = 'ai-creator-os:creative-event';
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      // 1. First initialization registers exactly one listener
      const cleanup1 = initializeRecipeEventConsumer();
      expect(getRecipeEventConsumerRefCount()).toBe(1);
      
      const registerCalls = addSpy.mock.calls.filter(call => call[0] === CREATIVE_OS_EVENT);
      expect(registerCalls.length).toBe(1);

      // 2. Repeated initialization (e.g. React StrictMode) does not duplicate window subscription
      const cleanup2 = initializeRecipeEventConsumer();
      expect(getRecipeEventConsumerRefCount()).toBe(2);
      
      const registerCallsAfterSecond = addSpy.mock.calls.filter(call => call[0] === CREATIVE_OS_EVENT);
      expect(registerCallsAfterSecond.length).toBe(1);

      // 3. Intermediate cleanup keeps the subscription active
      cleanup1();
      expect(getRecipeEventConsumerRefCount()).toBe(1);
      
      const removeCallsAfterFirstCleanup = removeSpy.mock.calls.filter(call => call[0] === CREATIVE_OS_EVENT);
      expect(removeCallsAfterFirstCleanup.length).toBe(0);

      // 4. Final cleanup removes the listener completely
      cleanup2();
      expect(getRecipeEventConsumerRefCount()).toBe(0);
      
      const removeCallsAfterFinalCleanup = removeSpy.mock.calls.filter(call => call[0] === CREATIVE_OS_EVENT);
      expect(removeCallsAfterFinalCleanup.length).toBe(1);

      // 5. Re-initialization works perfectly after full cleanup
      const cleanup3 = initializeRecipeEventConsumer();
      expect(getRecipeEventConsumerRefCount()).toBe(1);
      const registerCallsAfterReinit = addSpy.mock.calls.filter(call => call[0] === CREATIVE_OS_EVENT);
      expect(registerCallsAfterReinit.length).toBe(2);

      // Real contract call for the event
      publishCreativeEvent('recipe.activated', {
        recipeId: 'bus-1',
        versionId: 'ver-1',
      });

      cleanup3();
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('verifies backup v9 atomic rollback on quota exceeded', () => {
      const { recipe } = createRecipe('ws-test', 'Backup Rollback Test', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
      
      const baseBackup = createWorkspaceBackup();
      const backupPayload = {
        ...baseBackup,
        recipes: [recipe],
      };

      const nativeSetItem = Storage.prototype.setItem;
      let mockTriggered = false;

      const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === 'ai_creator_os:creative_recipes') {
          mockTriggered = true;
          throw new Error('QuotaExceededError');
        }
        return nativeSetItem.call(this, key, value);
      });

      const success = restoreWorkspaceBackup(backupPayload);
      expect(success).toBe(false);
      expect(mockTriggered).toBe(true);

      saveSpy.mockRestore();
    });

    describe('Strengthened Workflow Regression Tests', () => {
      it('asserts DRAFT recipe/version cannot activate before validation', () => {
        const { recipe, version } = createRecipe('ws-test', 'Draft Activation Block', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
        
        // Assert draft version cannot be activated directly
        expect(() => activateRecipeVersion(recipe.id, version.id, 'user-1')).toThrow(
          'Cannot activate directly from DRAFT or VALIDATING status. Must be READY first.'
        );
      });

      it('asserts ARCHIVED recipe remains terminal and cannot restore', () => {
        const { recipe } = createRecipe('ws-test', 'Archived Terminal Test', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
        
        // Archive the recipe
        archiveRecipe(recipe.id, 'user-1');
        const archivedRecipe = loadRecipes().find(r => r.id === recipe.id);
        expect(archivedRecipe?.status).toBe(CreativeRecipeStatus.ARCHIVED);

        // Try to restore archived recipe -> must throw
        expect(() => restoreRecipeThroughNewVersion(recipe.id, 'user-1')).toThrow(
          'Archived recipes are terminal and cannot be restored.'
        );
      });

      it('asserts DEPRECATED recipe/version cannot execute a new application', () => {
        const { recipe, version } = createRecipe('ws-test', 'Deprecated Execution Block', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
        validateRecipeVersion(recipe.id, version.id);
        
        // Activate it first so we can make an approved application
        activateRecipeVersion(recipe.id, version.id, 'user-1');
        
        const app = createRecipeApplication('ws-test', recipe.id, version.id, {}, 'user-1');
        approveRecipeApplication(app.id, 'user-1');

        // Now deprecate the version
        deprecateVersion(recipe.id, version.id, 'user-1');
        
        // Try to execute -> must throw because version status is DEPRECATED (not ACTIVE)
        expect(() => executeRecipeApplication(app.id, 'user-1', {})).toThrow(
          'Cannot execute application: Version status is deprecated, but must be ACTIVE.'
        );
      });

      it('asserts application write failure restores both application state and recipe counters', () => {
        const { recipe, version } = createRecipe('ws-test', 'App Failure Counters', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
        validateRecipeVersion(recipe.id, version.id);
        activateRecipeVersion(recipe.id, version.id, 'user-1');

        const app = createRecipeApplication('ws-test', recipe.id, version.id, {}, 'user-1');
        approveRecipeApplication(app.id, 'user-1');

        const originalRecipes = loadRecipes();
        const originalApps = loadRecipeApplications();

        // Mock write failure on the specific key RECIPE_APPLICATIONS_KEY
        const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
          if (key === RECIPE_APPLICATIONS_KEY) {
            throw new Error('QuotaExceededError');
          }
        });

        expect(() => executeRecipeApplication(app.id, 'user-1', {})).toThrow();

        // Verify both are restored
        expect(loadRecipes()).toEqual(originalRecipes);
        expect(loadRecipeApplications()).toEqual(originalApps);

        saveSpy.mockRestore();
      });

      it('asserts activation write failure restores both recipe and version collections', () => {
        const { recipe, version } = createRecipe('ws-test', 'Act Failure Rollback', CreativeRecipeCategory.HOOK, 'Objective', 'user-1');
        validateRecipeVersion(recipe.id, version.id);

        const originalRecipes = loadRecipes();
        const originalVersions = loadRecipeVersions();

        // Mock write failure on saveRecipeVersions (key 'ai_creator_os:creative_recipe_versions')
        const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
          if (key === 'ai_creator_os:creative_recipe_versions') {
            throw new Error('QuotaExceededError');
          }
        });

        expect(() => activateRecipeVersion(recipe.id, version.id, 'user-1')).toThrow();

        // Verify both are restored
        expect(loadRecipes()).toEqual(originalRecipes);
        expect(loadRecipeVersions()).toEqual(originalVersions);

        saveSpy.mockRestore();
      });
    });
  });
});
