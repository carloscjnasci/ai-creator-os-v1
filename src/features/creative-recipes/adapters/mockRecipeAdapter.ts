import {
  CreativeRecipe,
  CreativeRecipeVersion,
  CreativeRecipeCategory,
  CreativeRecipeStatus,
  RecipeSourceType,
  RecipeVersionStatus,
  RecipeParameterType,
  RecipeEvidence,
  RecipeEvidenceSourceType,
  RecipeScorecard,
} from '../types';

/**
 * MockRecipeAdapter provides deterministic recipe playbooks and evidence logs.
 * All operations are clearly labeled as mock data.
 */
export const MockRecipeAdapter = {
  getMockRecipes(workspaceId: string): CreativeRecipe[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'rec-mock-hook-123',
        workspaceId,
        name: '[MOCK] TikTok High-Impact Hook',
        description: 'A proven 3-second hook structure optimized for visual interest and micro-storytelling on vertical video platforms.',
        category: CreativeRecipeCategory.HOOK,
        status: CreativeRecipeStatus.ACTIVE,
        currentVersionId: 'ver-mock-hook-123-1',
        sourceType: RecipeSourceType.SYSTEM_TEMPLATE,
        sourceEntityIds: [],
        objective: 'Increase TikTok 3-second view-through rate by 15%',
        targetPlatforms: ['tiktok', 'instagram'],
        targetAudienceDescription: 'Gen Z and Millennial audiences seeking visual hacks or aesthetic products.',
        productCategories: ['beauty', 'lifestyle', 'tech'],
        tags: ['hook', 'tiktok', 'viral'],
        requiredCapabilities: ['video_rendering'],
        brandRuleIds: ['brand-rule-safety-1'],
        evidenceSummary: {
          evidenceCount: 1,
          averageScore: 85,
          liftSummary: '+22.4% relative CTR lift observed',
        },
        confidence: 85,
        usageCount: 12,
        successfulApplicationCount: 10,
        averageObservedScore: 88,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      },
      {
        id: 'rec-mock-campaign-456',
        workspaceId,
        name: '[MOCK] Holiday Product Launch Blueprint',
        description: 'Complete multi-stage campaign workflow recipe including audience research, email sequences, and ad variant structures.',
        category: CreativeRecipeCategory.CAMPAIGN,
        status: CreativeRecipeStatus.DRAFT,
        currentVersionId: 'ver-mock-campaign-456-1',
        sourceType: RecipeSourceType.IMPORTED_TEMPLATE,
        sourceEntityIds: [],
        objective: 'Drive pre-orders for new physical product lines.',
        targetPlatforms: ['meta', 'email', 'youtube'],
        targetAudienceDescription: 'Warm leads and past purchasers.',
        productCategories: ['retail', 'apparel'],
        tags: ['holiday', 'launch', 'bento-box'],
        requiredCapabilities: ['copywriting', 'multimodal_generation'],
        brandRuleIds: [],
        evidenceSummary: {
          evidenceCount: 0,
          averageScore: 0,
          liftSummary: 'No historical evidence collected.',
        },
        confidence: 0,
        usageCount: 0,
        successfulApplicationCount: 0,
        averageObservedScore: 0,
        createdBy: 'user-admin',
        createdAt: now,
        updatedAt: now,
      }
    ];
  },

  getMockVersions(recipeId: string): CreativeRecipeVersion[] {
    const now = new Date().toISOString();
    if (recipeId === 'rec-mock-hook-123') {
      return [
        {
          id: 'ver-mock-hook-123-1',
          recipeId: 'rec-mock-hook-123',
          versionNumber: 1,
          versionLabel: 'v1.0.0-mock',
          changeSummary: 'Initial baseline for TikTok visual hook structure.',
          status: RecipeVersionStatus.ACTIVE,
          structure: {
            stages: [
              {
                id: 'stg-hook-text',
                type: 'hook',
                title: 'Visual overlay copy',
                description: 'Bold text overlay placed at top-center of the first frame.',
                template: 'Why nobody is telling you about this {{product.name}} hack...',
                parameterBindings: {},
                dependencies: [],
                outputType: 'text',
                optional: false,
                order: 1,
                validationRules: {},
              },
              {
                id: 'stg-script-callout',
                type: 'script',
                title: 'Audio hook transcript',
                description: 'Verbalized CTA matched with the overlay copy.',
                template: 'Stop scrolling! If you are using {{product.name}} without {{cta}}, you are missing out on the best results...',
                parameterBindings: {},
                dependencies: ['stg-hook-text'],
                outputType: 'text',
                optional: false,
                order: 2,
                validationRules: {},
              }
            ]
          },
          parameters: [
            {
              id: 'p-product',
              key: 'product.name',
              label: 'Product Name',
              description: 'The name of the featured product.',
              parameterType: RecipeParameterType.PRODUCT,
              required: true,
              defaultValue: 'Smart Serum',
              visibility: 'visible',
              order: 1,
            },
            {
              id: 'p-cta',
              key: 'cta',
              label: 'Call to Action',
              description: 'The primary call to action verb or phrase.',
              parameterType: RecipeParameterType.TEXT,
              required: true,
              defaultValue: 'this simple step',
              visibility: 'visible',
              order: 2,
            }
          ],
          constraints: {},
          outputContract: {},
          validationRules: {},
          compatiblePlatforms: ['tiktok', 'instagram'],
          compatibleModels: ['gemini-2.5-flash'],
          evidenceIds: ['ev-mock-hook-1'],
          createdBy: 'system',
          createdAt: now,
          activatedAt: now,
        }
      ];
    }

    if (recipeId === 'rec-mock-campaign-456') {
      return [
        {
          id: 'ver-mock-campaign-456-1',
          recipeId: 'rec-mock-campaign-456',
          versionNumber: 1,
          versionLabel: 'v1.0.0-mock',
          changeSummary: 'Initial setup of holiday campaign stages.',
          status: RecipeVersionStatus.DRAFT,
          structure: {
            stages: [
              {
                id: 'stg-research',
                type: 'research',
                title: 'Market Angle',
                description: 'Identify demographic pain-points.',
                template: 'Research angles targeting {{demographics}}.',
                parameterBindings: {},
                dependencies: [],
                outputType: 'text',
                optional: false,
                order: 1,
                validationRules: {},
              }
            ]
          },
          parameters: [
            {
              id: 'p-demo',
              key: 'demographics',
              label: 'Target Demographics',
              description: 'Target demographic group description',
              parameterType: RecipeParameterType.TEXT,
              required: false,
              defaultValue: 'moms looking for quick holiday gift ideas',
              visibility: 'visible',
              order: 1,
            }
          ],
          constraints: {},
          outputContract: {},
          validationRules: {},
          compatiblePlatforms: ['meta', 'email'],
          compatibleModels: ['gemini-2.5-flash'],
          evidenceIds: [],
          createdBy: 'user-admin',
          createdAt: now,
        }
      ];
    }

    return [];
  },

  getMockEvidence(recipeId: string): RecipeEvidence[] {
    const now = new Date().toISOString();
    if (recipeId === 'rec-mock-hook-123') {
      return [
        {
          id: 'ev-mock-hook-1',
          recipeId: 'rec-mock-hook-123',
          recipeVersionId: 'ver-mock-hook-123-1',
          sourceType: RecipeEvidenceSourceType.EXPERIMENT,
          sourceEntityId: 'exp-hook-test-99',
          experimentId: 'exp-hook-test-99',
          metricName: 'ctr',
          observedValue: 0.045,
          baselineValue: 0.036,
          absoluteLift: 0.009,
          relativeLift: 0.25,
          sampleSize: 4500,
          confidence: 0.98,
          limitations: ['Mock baseline observation from sandbox tests.'],
          capturedAt: now,
        }
      ];
    }
    return [];
  },

  getMockScorecard(recipeId: string): RecipeScorecard {
    const now = new Date().toISOString();
    return {
      id: `sc-${recipeId}`,
      recipeId,
      recipeVersionId: recipeId === 'rec-mock-hook-123' ? 'ver-mock-hook-123-1' : 'ver-mock-campaign-456-1',
      evidenceStrength: recipeId === 'rec-mock-hook-123' ? 85 : 0,
      reproducibility: recipeId === 'rec-mock-hook-123' ? 90 : 10,
      platformFit: recipeId === 'rec-mock-hook-123' ? 95 : 50,
      brandFit: recipeId === 'rec-mock-hook-123' ? 95 : 50,
      parameterCompleteness: 100,
      historicalPerformance: recipeId === 'rec-mock-hook-123' ? 88 : 0,
      experimentSupport: recipeId === 'rec-mock-hook-123' ? 98 : 0,
      usageReliability: recipeId === 'rec-mock-hook-123' ? 92 : 50,
      overallScore: recipeId === 'rec-mock-hook-123' ? 92 : 25,
      confidence: recipeId === 'rec-mock-hook-123' ? 90 : 10,
      limitations: recipeId === 'rec-mock-hook-123' ? [] : ['Absent evidence base', 'Unproven blueprint'],
      generatedAt: now,
    };
  }
};
