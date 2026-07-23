import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  FileText,
  Bookmark,
  TrendingUp,
  Sliders,
  Sparkles,
  ChevronRight,
  User,
  ExternalLink,
  Download,
  Upload,
  Layers,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  loadRecipes,
  saveRecipes,
  loadRecipeVersions,
  saveRecipeVersions,
  loadRecipeApplications,
  saveRecipeApplications,
  loadRecipeRecommendations,
  saveRecipeRecommendations,
  loadRecipeEvidence,
  saveRecipeEvidence,
  loadRecipeScorecards,
  saveRecipeScorecards,
} from '../recipeStorage';
import {
  createRecipe,
  createRecipeVersion,
  duplicateVersion,
  validateRecipeVersion,
  createRecipeApplication,
  approveRecipeApplication,
  activateRecipeVersion,
  deprecateVersion,
  archiveRecipe,
  restoreRecipeThroughNewVersion,
  executeRecipeApplication,
  addRecipeEvidenceWorkflow,
  generateRecipeScorecardWorkflow,
  createRecipeRecommendationWorkflow,
  recordRecipeRecommendationDecision,
} from '../recipeWorkflows';
import {
  CreativeRecipe,
  CreativeRecipeVersion,
  RecipeApplication,
  CreativeRecipeCategory,
  RecipeSourceType,
  CreativeRecipeStatus,
  RecipeVersionStatus,
  RecipeApplicationStatus,
  RecipeParameterType,
  RecipeRecommendation,
  RecipeRecommendationStatus,
  RecipeEvidence,
  RecipeScorecard,
  RecipeRecommendationType,
  RecipeEvidenceSourceType,
} from '../types';
import { createCampaignFromRecipeApplication, recommendRecipesForObjective } from '../recipeIntegrations';

export function CreativeRecipesPage() {
  const { t, formatDate } = useTranslation();
  const { translateStatus, translateCreativeRecipeCategory } = useDisplayHelpers();
  const translateScorecardMetric = (key: string): string => {
    switch (key) {
      case 'Evidence': return t('pages.creativeRecipes.evidence');
      case 'Reproducibility': return t('pages.creativeRecipes.reproducibility');
      case 'Platform Fit': return t('pages.creativeRecipes.platformFit');
      case 'Brand Fit': return t('pages.creativeRecipes.brandFit');
      case 'Parameter Completeness': return t('pages.creativeRecipes.parameterCompleteness');
      case 'Historical Perf': return t('pages.creativeRecipes.historicalPerf');
      case 'Experiment Support': return t('pages.creativeRecipes.experimentSupport');
      case 'Usage Reliability': return t('pages.creativeRecipes.usageReliability');
      default: return key;
    }
  };
  const workspaceId = 'default-workspace';
  const userId = 'user-current-creator';

  // Core Entity States
  const [recipes, setRecipes] = useState<CreativeRecipe[]>([]);
  const [versions, setVersions] = useState<CreativeRecipeVersion[]>([]);
  const [applications, setApplications] = useState<RecipeApplication[]>([]);
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>([]);
  const [evidence, setEvidence] = useState<RecipeEvidence[]>([]);
  const [scorecards, setScorecards] = useState<RecipeScorecard[]>([]);

  // Selection & UI flow States
  const [selectedRecipe, setSelectedRecipe] = useState<CreativeRecipe | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<CreativeRecipeVersion | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'recommendations' | 'evidence' | 'applications'>('library');

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<CreativeRecipeCategory>(CreativeRecipeCategory.CAMPAIGN);
  const [recipeObjective, setRecipeObjective] = useState(' awareness');
  const [recipeDesc, setRecipeDesc] = useState('');

  // Version edit/parameters template binding states
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState('1.0.0');
  const [templateText, setTemplateText] = useState('Create highly engaging campaign for {{productName}} with actor {{actorName}}.');
  const [parametersJson, setParametersJson] = useState(`[
  {
    "id": "param-product-name",
    "key": "productName",
    "label": "Product Name",
    "description": "Name of target product",
    "parameterType": "text",
    "required": true,
    "defaultValue": "Smart Sneakers Pro",
    "visibility": "visible",
    "order": 1
  },
  {
    "id": "param-actor-name",
    "key": "actorName",
    "label": "Actor Name",
    "description": "Digital Human profile actor name",
    "parameterType": "text",
    "required": false,
    "defaultValue": "Sophia",
    "visibility": "visible",
    "order": 2
  }
]`);

  // Application Preview Sandbox States
  const [previewApp, setPreviewApp] = useState<RecipeApplication | null>(null);
  const [previewResolveMsg, setPreviewResolveMsg] = useState('');
  const [parameterInputs, setParameterInputs] = useState<Record<string, string>>({});

  // Feedback notifications
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load all initial state
  useEffect(() => {
    refreshAllData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const refreshAllData = () => {
    setRecipes(loadRecipes());
    setVersions(loadRecipeVersions());
    setApplications(loadRecipeApplications());
    setRecommendations(loadRecipeRecommendations());
    setEvidence(loadRecipeEvidence());
    setScorecards(loadRecipeScorecards());
  };

  // Recipe Operations
  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim()) {
      showToast(t('pages.creativeRecipes.recipeNameRequired'), 'error');
      return;
    }
    try {
      let paramsParsed: any[] = [];
      try {
        paramsParsed = JSON.parse(parametersJson);
      } catch {
        showToast(t('pages.creativeRecipes.invalidJsonParametersUsingDefault'), 'error');
      }

      const stages = [
        {
          id: `stage-${Date.now()}`,
          name: 'Core Synthesis Stage',
          description: t('pages.creativeRecipes.synthesizing'),
          template: templateText,
          parameterBindings: paramsParsed.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.key;
            return acc;
          }, {}),
          dependencies: [],
        },
      ];

      const { recipe } = createRecipe(
        workspaceId,
        recipeName,
        recipeCategory,
        recipeObjective,
        userId,
        {
          description: recipeDesc,
          sourceType: RecipeSourceType.MANUAL,
          parameters: paramsParsed,
          structure: { stages },
        }
      );

      refreshAllData();
      setSelectedRecipe(recipe);
      setShowCreateModal(false);
      // Reset form fields
      setRecipeName('');
      setRecipeDesc('');
      showToast(t('pages.creativeRecipes.recipeCreatedSuccess', { name: recipe.name }));
    } catch (err: any) {
      showToast(err.message || t('pages.creativeRecipes.failedToCreateRecipe'), 'error');
    }
  };

  // Version Operations
  const handleCreateVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipe) return;
    try {
      let paramsParsed = [];
      try {
        paramsParsed = JSON.parse(parametersJson);
      } catch {
        showToast(t('pages.creativeRecipes.invalidJsonParameters'), 'error');
        return;
      }

      const stages = [
        {
          id: `stage-${Date.now()}`,
          name: 'Core Synthesis Stage',
          description: t('pages.creativeRecipes.synthesizing'),
          template: templateText,
          parameterBindings: paramsParsed.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.key;
            return acc;
          }, {}),
          dependencies: [],
        },
      ];

      createRecipeVersion(selectedRecipe.id, versionLabel, userId, {
        description: t('pages.creativeRecipes.versionDraftUpdate', { version: versionLabel }),
        parameters: paramsParsed,
        structure: { stages },
      });

      refreshAllData();
      setShowVersionModal(false);
      showToast(t('pages.creativeRecipes.versionCreated', { version: versionLabel }));
    } catch (err: any) {
      showToast(err.message || t('pages.creativeRecipes.failedToCreateVersion'), 'error');
    }
  };

  const handleDuplicateVersion = (verId: string) => {
    if (!selectedRecipe) return;
    try {
      const duplicated = duplicateVersion(selectedRecipe.id, verId, userId);
      refreshAllData();
      setSelectedVersion(duplicated);
      showToast(t('pages.creativeRecipes.versionDuplicated'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleValidateVersion = (verId: string) => {
    if (!selectedRecipe) return;
    try {
      const validation = validateRecipeVersion(selectedRecipe.id, verId);
      refreshAllData();
      if (validation.valid) {
        showToast(t('pages.creativeRecipes.validationSuccess', { confidence: Math.round(validation.confidence * 100) }));
      } else {
        showToast(t('pages.creativeRecipes.validationViolations', { errors: validation.errors.join(', ') }), 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleActivateVersion = (recipeId: string, verId: string) => {
    try {
      activateRecipeVersion(recipeId, verId, userId);
      refreshAllData();
      showToast(t('pages.creativeRecipes.versionActivated', { version: verId }));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeprecateRecipe = (recipeId: string, verId: string) => {
    try {
      deprecateVersion(recipeId, verId, userId);
      refreshAllData();
      showToast(t('pages.creativeRecipes.recipeDeprecated'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchiveRecipe = (recipeId: string) => {
    try {
      archiveRecipe(recipeId, userId);
      refreshAllData();
      showToast(t('pages.creativeRecipes.recipeArchived'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Preview / Application Sandbox Operations
  const handleOpenSandbox = (recipe: CreativeRecipe, ver: CreativeRecipeVersion) => {
    setSelectedRecipe(recipe);
    setSelectedVersion(ver);
    // Initialize default parameter inputs
    const initialInputs: Record<string, string> = {};
    (ver.parameters || []).forEach((p) => {
      initialInputs[p.key] = String(p.defaultValue || '');
    });
    setParameterInputs(initialInputs);
    setPreviewApp(null);
    setPreviewResolveMsg('');
  };

  const handleGenerateSandboxPreview = () => {
    if (!selectedRecipe || !selectedVersion) return;
    try {
      const application = createRecipeApplication(
        workspaceId,
        selectedRecipe.id,
        selectedVersion.id,
        parameterInputs,
        userId
      );
      setPreviewApp(application);
      
      const debugText = (application.resolvedStages || []).map((s: any) => 
        t('pages.creativeRecipes.stageDebug', { stage: s.name, output: s.resolvedTemplate })
      ).join('\n\n');
      setPreviewResolveMsg(debugText);
      showToast(t('pages.creativeRecipes.previewGenerated'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApproveAndExecuteApplication = () => {
    if (!previewApp) return;
    try {
      approveRecipeApplication(previewApp.id, userId);
      const completed = executeRecipeApplication(previewApp.id, userId, {});
      
      // If CAMPAIGN, create real campaign entity automatically on explicit user approval
      if (selectedRecipe?.category === CreativeRecipeCategory.CAMPAIGN) {
        createCampaignFromRecipeApplication(previewApp.id, t('pages.creativeRecipes.campaignFromRecipe', { name: selectedRecipe.name }), userId);
      }

      refreshAllData();
      setPreviewApp(null);
      setPreviewResolveMsg('');
      showToast(t('pages.creativeRecipes.applicationCommitted'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Recommendations
  const handleCreateAdvisoryRecommendation = () => {
    try {
      const rec = createRecipeRecommendationWorkflow(
        workspaceId,
        RecipeRecommendationType.CONVERT_WINNER,
        t('pages.creativeRecipes.advisoryTitle'),
        t('pages.creativeRecipes.advisoryDescription'),
        0.92,
        t('pages.creativeRecipes.advisoryExpectedEffect'),
        {}
      );
      refreshAllData();
      showToast(t('pages.creativeRecipes.recommendationGenerated', { title: rec.title }));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAcceptRec = (recId: string) => {
    try {
      recordRecipeRecommendationDecision(recId, 'accept');
      refreshAllData();
      showToast(t('pages.creativeRecipes.recommendationAccepted'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRejectRec = (recId: string) => {
    try {
      recordRecipeRecommendationDecision(recId, 'reject');
      refreshAllData();
      showToast(t('pages.creativeRecipes.recommendationDismissed'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Evidence & Scorecard workflows
  const handleAttachEvidence = (recipeId: string, verId: string) => {
    try {
      addRecipeEvidenceWorkflow({
        recipeId,
        recipeVersionId: verId,
        sourceType: RecipeEvidenceSourceType.MANUAL,
        sourceEntityId: 'campaign-live',
        metricName: 'CTR Lift',
        observedValue: 1.148,
        baselineValue: 1.0,
        absoluteLift: 0.148,
        relativeLift: 14.8,
        confidence: 0.95,
        sampleSize: 1000,
        limitations: ['Facebook Ads Campaign #205 Live Performance', 'Manual validation notes'],
      });
      refreshAllData();
      showToast(t('pages.creativeRecipes.evidenceAttached'));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleGenerateScorecard = (recipeId: string, verId: string) => {
    try {
      const sc = generateRecipeScorecardWorkflow(recipeId, verId);
      refreshAllData();
      showToast(t('pages.creativeRecipes.scorecardGenerated', { score: sc.overallScore }));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Calculated Stats
  const activeRecipes = recipes.filter(r => r.status === CreativeRecipeStatus.ACTIVE);
  const totalEvidence = evidence.length;
  const approvedApplications = applications.filter(a => a.status === RecipeApplicationStatus.COMPLETED);

  return (
    <div id="creative-recipes-page" className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-transform ${
            toastMsg.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-green-700 text-white'
          }`}
        >
          {toastMsg.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{toastMsg.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('creativeRecipes.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.creativeRecipes.authorVersioncontrolValidateSandboxAndEx')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCreateAdvisoryRecommendation()}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />{t('pages.creativeRecipes.triggerAdvisor')}</button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-opacity-90"
          >
            <Plus className="h-4 w-4" />{t('pages.creativeRecipes.createRecipe')}</button>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.creativeRecipes.recipesActive')}</span>
            <Bookmark className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{activeRecipes.length}</span>
            <span className="text-xs text-muted-foreground">/ {t('pages.creativeRecipes.totalCount', { count: recipes.length })}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.creativeRecipes.committedRuns')}</span>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{approvedApplications.length}</span>
            <span className="text-xs text-muted-foreground">/ {t('pages.creativeRecipes.applicationsCount', { count: applications.length })}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.creativeRecipes.relativeLiftItems')}</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{totalEvidence}</span>
            <span className="text-xs text-muted-foreground">{t('pages.creativeRecipes.verifiedSignals')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.creativeRecipes.openRecommendations')}</span>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{recommendations.filter(r => r.status === RecipeRecommendationStatus.PROPOSED).length}</span>
            <span className="text-xs text-muted-foreground">{t('pages.creativeRecipes.proposals')}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'library' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >{t('pages.creativeRecipes.recipesLibrary')}</button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'recommendations' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('pages.creativeRecipes.advisorySystemWithCount', { count: recommendations.filter(r => r.status === RecipeRecommendationStatus.PROPOSED).length })}
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'evidence' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('pages.creativeRecipes.evidenceAndScorecards')}
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'applications' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >{t('pages.creativeRecipes.executionSandboxes')}</button>
      </div>

      {/* Main Tab Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Main panels */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{t('pages.creativeRecipes.availableTemplates')}</h2>
                <span className="text-xs text-muted-foreground">{t('pages.creativeRecipes.strategyProfilesLoaded', { count: recipes.length })}</span>
              </div>

              {recipes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  <Bookmark className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2 text-sm font-medium">{t('pages.creativeRecipes.noRecipesDefinedInWorkspaceYet')}</p>
                  <p className="mt-1 text-xs">{t('pages.creativeRecipes.createYourFirstCreativeFormulaToGetStart')}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {recipes.map((recipe) => {
                    const activeVer = versions.find(v => v.recipeId === recipe.id && v.status === RecipeVersionStatus.ACTIVE);
                    return (
                      <div
                        key={recipe.id}
                        className={`rounded-xl border p-5 shadow-sm transition-all bg-card cursor-pointer hover:border-primary ${
                          selectedRecipe?.id === recipe.id ? 'border-primary ring-1 ring-primary' : 'border-border'
                        }`}
                        onClick={() => setSelectedRecipe(recipe)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
                                {translateCreativeRecipeCategory(recipe.category)}
                              </span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                recipe.status === CreativeRecipeStatus.ACTIVE
                                  ? 'bg-green-100 text-green-800'
                                  : recipe.status === CreativeRecipeStatus.DEPRECATED
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {translateStatus(recipe.status)}
                              </span>
                            </div>
                            <h3 className="mt-2 text-lg font-bold text-foreground">{recipe.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{recipe.objective}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              title={t('pages.creativeRecipes.archiveRecipe')}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveRecipe(recipe.id);
                              }}
                              className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                          <div>
                            {t('pages.creativeRecipes.activeVersion')}{' '}
                            <span className="font-semibold text-foreground">
                              {activeVer ? `v${activeVer.versionLabel}` : t('common.none')}
                            </span>
                          </div>
                          <div>{t('pages.creativeRecipes.created')}<span className="font-semibold">{formatDate(recipe.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t('pages.creativeRecipes.activeAdvisorProposals')}</h2>
              <p className="text-sm text-muted-foreground">{t('pages.creativeRecipes.recommendationsTriggeredFromCompletedExp')}</p>

              {recommendations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  <Sparkles className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2 text-sm font-medium">{t('pages.creativeRecipes.noOpenProposalsAvailable')}</p>
                  <p className="mt-1 text-xs">{t('pages.creativeRecipes.runExperimentsOrPromptOptimizationsToTri')}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-xs font-bold">
                              {rec.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t('pages.creativeRecipes.confidenceValue', { value: Math.round(rec.confidence * 100) })}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-bold text-foreground">{rec.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
                        </div>
                      </div>

                      {rec.status === RecipeRecommendationStatus.PROPOSED && (
                        <div className="flex gap-2 justify-end border-t border-border pt-3">
                          <button
                            type="button"
                            onClick={() => handleRejectRec(rec.id)}
                            className="inline-flex items-center rounded bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 text-foreground"
                          >{t('pages.creativeRecipes.dismiss')}</button>
                          <button
                            type="button"
                            onClick={() => handleAcceptRec(rec.id)}
                            className="inline-flex items-center rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-opacity-90"
                          >
                            {t('pages.creativeRecipes.acceptAndApply')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-lg font-bold">{t('pages.creativeRecipes.performanceEvidence')}</h2>
                {evidence.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                    <TrendingUp className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-2 text-sm font-medium">{t('pages.creativeRecipes.noPerformanceEvidenceSubmittedYet')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {evidence.map((evItem) => (
                      <div key={evItem.id} className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-600">+{t('pages.creativeRecipes.relativeLiftValue', { value: evItem.relativeLift })}</span>
                            <span className="text-xs text-muted-foreground">({evItem.metricName})</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{t('pages.creativeRecipes.sourceId', { id: evItem.sourceEntityId })} {evItem.limitations.length > 0 ? `- ${evItem.limitations[0]}` : ''}</p>
                        </div>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {t('pages.creativeRecipes.recipeIdShort', { id: evItem.recipeId.slice(0, 8) })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <h2 className="text-lg font-bold">{t('pages.creativeRecipes.instantiatedScorecards')}</h2>
                {scorecards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-2 text-sm font-medium">{t('pages.creativeRecipes.noScorecardsCalculated')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {scorecards.map((scItem) => (
                      <div key={scItem.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold">{t('pages.creativeRecipes.reputationScoreValue', { score: scItem.overallScore })}</span>
                          <span className="text-xs text-muted-foreground">{t('pages.creativeRecipes.confidenceValue', { value: Math.round(scItem.confidence * 100) })}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries({
                            'Evidence': scItem.evidenceStrength,
                            'Reproducibility': scItem.reproducibility,
                            'Platform Fit': scItem.platformFit,
                            'Brand Fit': scItem.brandFit,
                            'Parameter Completeness': scItem.parameterCompleteness,
                            'Historical Perf': scItem.historicalPerformance,
                            'Experiment Support': scItem.experimentSupport,
                            'Usage Reliability': scItem.usageReliability,
                          }).map(([k, v]: any) => (
                            <span key={k} className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              {translateScorecardMetric(k)}: {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t('pages.creativeRecipes.executionAndAppLogs')}</h2>
              <p className="text-sm text-muted-foreground">{t('pages.creativeRecipes.historyOfRecipeApplicationInstancesWithP')}</p>

              {applications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  <Layers className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2 text-sm font-medium">{t('pages.creativeRecipes.noApplicationsLogged')}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {applications.map((app) => (
                    <div key={app.id} className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{t('pages.creativeRecipes.idLabel')} {app.id.slice(0, 8)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          app.status === RecipeApplicationStatus.COMPLETED
                            ? 'bg-green-100 text-green-800'
                            : app.status === RecipeApplicationStatus.APPROVED
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {translateStatus(app.status)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <div className="font-semibold">{t('pages.creativeRecipes.boundParameters')}</div>
                        <pre className="mt-1 text-xs bg-muted p-2.5 rounded overflow-x-auto">
                          {JSON.stringify(app.parameterValues, null, 2)}
                        </pre>
                      </div>

                      {app.status === RecipeApplicationStatus.APPROVED && (
                        <div className="flex justify-end gap-2 border-t border-border pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                executeRecipeApplication(app.id, userId, {});
                                if (recipes.find(r => r.id === app.recipeId)?.category === CreativeRecipeCategory.CAMPAIGN) {
                                  createCampaignFromRecipeApplication(app.id, t('pages.creativeRecipes.executedCampaignName'), userId);
                                }
                                refreshAllData();
                                showToast(t('pages.creativeRecipes.applicationExecutionSaved'));
                              } catch (err: any) {
                                showToast(err.message, 'error');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-opacity-90 shadow-sm"
                          >
                            <Play className="h-3 w-3" />{t('pages.creativeRecipes.commitExecution')}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Details sidebar / Sandbox */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          {selectedRecipe ? (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">{t('pages.creativeRecipes.formulaWorkspace')}</h3>
                  <button
                    onClick={() => setSelectedRecipe(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >{t('pages.creativeRecipes.clear')}</button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('pages.creativeRecipes.idLabel')} {selectedRecipe.id}</p>
              </div>

              {/* Version History / Actions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t('pages.creativeRecipes.associatedVersions')}</span>
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />{t('pages.creativeRecipes.addDraft')}</button>
                </div>

                <div className="space-y-2">
                  {versions
                    .filter((v) => v.recipeId === selectedRecipe.id)
                    .map((ver) => (
                      <div
                        key={ver.id}
                        className={`rounded-lg border p-3 text-xs transition-colors cursor-pointer hover:bg-muted ${
                          selectedVersion?.id === ver.id ? 'border-primary bg-primary/5' : 'border-border bg-background'
                        }`}
                        onClick={() => setSelectedVersion(ver)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">v{ver.versionLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold ${
                            ver.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {translateStatus(ver.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateVersion(ver.id);
                            }}
                            className="bg-muted px-2 py-1 rounded text-muted-foreground hover:bg-border hover:text-foreground"
                          >{t('pages.creativeRecipes.duplicate')}</button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleValidateVersion(ver.id);
                            }}
                            className="bg-muted px-2 py-1 rounded text-muted-foreground hover:bg-border hover:text-foreground"
                          >{t('pages.creativeRecipes.validate')}</button>
                          {ver.status !== 'active' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateVersion(selectedRecipe.id, ver.id);
                              }}
                              className="bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 font-semibold"
                            >{t('pages.creativeRecipes.activate')}</button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttachEvidence(selectedRecipe.id, ver.id);
                            }}
                            className="bg-muted px-2 py-1 rounded text-muted-foreground hover:bg-border hover:text-foreground"
                          >
                            {t('pages.creativeRecipes.addEvidenceBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateScorecard(selectedRecipe.id, ver.id);
                            }}
                            className="bg-muted px-2 py-1 rounded text-muted-foreground hover:bg-border hover:text-foreground"
                          >{t('pages.creativeRecipes.score')}</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Parameter Sandbox / Execution Preview */}
              {selectedVersion && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-primary" /> {t('pages.creativeRecipes.applicationSandboxWithVersion', { version: selectedVersion.versionLabel })}
                  </h4>

                  <div className="space-y-3">
                    {(selectedVersion.parameters || []).map((p) => (
                      <div key={p.id} className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">{p.label}</label>
                        <input
                          type="text"
                          value={parameterInputs[p.key] || ''}
                          onChange={(e) => setParameterInputs({ ...parameterInputs, [p.key]: e.target.value })}
                          className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateSandboxPreview()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/80"
                  >{t('pages.creativeRecipes.generateSafePreview')}</button>

                  {/* Sandbox Sandbox outputs: Approved executes committed only */}
                  {previewApp && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Sparkles className="h-4 w-4 animate-pulse" />{t('pages.creativeRecipes.sandboxResolvedPreview')}</div>
                      <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-40 text-muted-foreground">
                        {previewResolveMsg}
                      </pre>
                      <div className="text-[10px] text-muted-foreground italic">
                        {t('pages.creativeRecipes.previewDisclaimer')}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApproveAndExecuteApplication()}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-opacity-90"
                      >
                        {t('pages.creativeRecipes.approveAndExecuteCommit')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bookmark className="h-12 w-12 opacity-30 mb-2" />
              <p className="text-sm font-medium">{t('pages.creativeRecipes.noRecipeSelected')}</p>
              <p className="text-xs px-4">{t('pages.creativeRecipes.selectAFormulaCardInTheLibraryPanelToEdi')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">{t('pages.creativeRecipes.createStrategyRecipe')}</h3>
            <form onSubmit={handleCreateRecipe} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.recipeName')}</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  placeholder={t('pages.creativeRecipes.smartConversationalLayout')}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">{t('pages.creativeRecipes.category')}</label>
                  <select
                    value={recipeCategory}
                    onChange={(e) => setRecipeCategory(e.target.value as CreativeRecipeCategory)}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value={CreativeRecipeCategory.CAMPAIGN}>{t('pages.creativeRecipes.campaignBlueprint')}</option>
                    <option value={CreativeRecipeCategory.PROMPT}>{t('pages.creativeRecipes.promptLayout')}</option>
                    <option value={CreativeRecipeCategory.OTHER}>{t('pages.creativeRecipes.otherLayout')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">{t('pages.creativeRecipes.targetObjective')}</label>
                  <input
                    type="text"
                    value={recipeObjective}
                    onChange={(e) => setRecipeObjective(e.target.value)}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                    placeholder={t('pages.creativeRecipes.awareness')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.description')}</label>
                <textarea
                  value={recipeDesc}
                  onChange={(e) => setRecipeDesc(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary h-20 resize-none"
                  placeholder={t('pages.creativeRecipes.formulaSummaryDetails')}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.templateTextWithPlaceholders')}</label>
                <textarea
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary h-20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.parametersArrayJson')}</label>
                <textarea
                  value={parametersJson}
                  onChange={(e) => setParametersJson(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary h-24"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
                >{t('pages.creativeRecipes.cancel')}</button>
                <button
                  type="submit"
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-opacity-90"
                >{t('pages.creativeRecipes.createFormula')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version Modal */}
      {showVersionModal && selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">{t('pages.creativeRecipes.addNewDraftVersion')}</h3>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.versionLabel')}</label>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  placeholder="1.1.0"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.templateTextWithPlaceholders')}</label>
                <textarea
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary h-24"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">{t('pages.creativeRecipes.parametersArrayJson')}</label>
                <textarea
                  value={parametersJson}
                  onChange={(e) => setParametersJson(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary h-28"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
                >{t('pages.creativeRecipes.cancel')}</button>
                <button
                  type="submit"
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-opacity-90"
                >{t('pages.creativeRecipes.saveDraftVersion')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreativeRecipesPage;
