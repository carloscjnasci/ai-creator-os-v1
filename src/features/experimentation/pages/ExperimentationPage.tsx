import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Plus, 
  Sparkles, 
  Check, 
  X, 
  Archive, 
  Activity, 
  TrendingUp, 
  RefreshCw, 
  ChevronRight, 
  FileText, 
  User, 
  Layers, 
  AlertCircle, 
  BarChart2, 
  Send,
  Database,
  Shield,
  Clock,
  Settings,
  Flame
} from 'lucide-react';

import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentStatus, 
  MetricType,
  ExperimentAnalysisResult,
  ExperimentRecommendation,
  ExperimentDecision,
  ExperimentType,
  DecisionAction
} from '../types';

import { 
  loadExperiments, 
  saveExperiments, 
  loadVariants, 
  saveVariants, 
  loadObservations, 
  saveObservations, 
  loadAnalyses, 
  saveAnalyses, 
  loadRecommendations, 
  saveRecommendations, 
  loadDecisions, 
  saveDecisions 
} from '../experimentStorage';

import { 
  editDraftExperiment, 
  validateExperimentWorkflow, 
  createVariantWorkflow, 
  duplicateVariantWorkflow, 
  assignControlWorkflow, 
  configureAllocationWorkflow, 
  markReadyWorkflow, 
  resumeWorkflow, 
  ingestObservationWorkflow, 
  archiveExperimentWorkflow,
  applyDecisionWorkflow,
  acceptRecommendationWorkflow,
  rejectRecommendationWorkflow
} from '../experimentWorkflow';

import { 
  convertSnapshotToObservations, 
  generatePublicationDraftForVariant, 
  getDigitalHumanExperimentSummary,
  proposeExperimentWhenEvidenceUncertain,
  createFollowUpCampaignFromWinner
} from '../integrations';

import { MockExperimentAdapter } from '../adapters/mockExperimentAdapter';

export function ExperimentationPage() {
  const { t, formatNumber } = useTranslation();
  const { translateStatus, translatePlatform } = useDisplayHelpers();
  // State variables
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>('');
  const [variants, setVariants] = useState<ExperimentVariant[]>([]);
  const [observations, setObservations] = useState<ExperimentObservation[]>([]);
  const [analyses, setAnalyses] = useState<ExperimentAnalysisResult[]>([]);
  const [recommendations, setRecommendations] = useState<ExperimentRecommendation[]>([]);
  const [decisions, setDecisions] = useState<ExperimentDecision[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'overview' | 'observations' | 'evaluation' | 'integrations' | 'graph'>('overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form States for Creating Experiment
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpHypothesis, setNewExpHypothesis] = useState('');
  const [newExpObjective, setNewExpObjective] = useState('');
  const [newExpMetric, setNewExpMetric] = useState('ctr');
  const [newExpPlatform, setNewExpPlatform] = useState<'tiktok' | 'youtube_shorts' | 'instagram_reels'>('tiktok');

  // Form States for Creating Variant
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarIsControl, setNewVarIsControl] = useState(false);
  const [newVarAlloc, setNewVarAlloc] = useState<number>(0);
  const [newVarDigitalHuman, setNewVarDigitalHuman] = useState('dh-aurora');
  const [newVarPrompt, setNewVarPrompt] = useState('prompt-v1');

  // Load all data
  const refreshAllData = () => {
    const loadedExps = loadExperiments();
    setExperiments(loadedExps);
    setVariants(loadVariants());
    setObservations(loadObservations());
    setAnalyses(loadAnalyses());
    setRecommendations(loadRecommendations());
    setDecisions(loadDecisions());

    if (loadedExps.length > 0 && !selectedExperimentId) {
      setSelectedExperimentId(loadedExps[0].id);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const triggerNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Setup seed database
  const handleSeedDatabase = () => {
    // Seed initial demo experiments if none exist
    const demoExps: Experiment[] = [
      {
        id: 'exp-demo-1',
        workspaceId: 'workspace-1',
        campaignId: 'camp-demo-1',
        name: 'Digital Human Wardrobe CTR Optimization',
        description: t('pages.experimentation.optimizingPresets'),
        hypothesis: 'Dressing the Digital Human Aurora in premium formal attire will yield an absolute CTR increase of 2% on LinkedIn/TikTok over casual wear.',
        objective: 'Identify optimal outfit preset to maximize user engagement.',
        experimentType: ExperimentType.AB_TEST,
        primaryMetric: 'ctr',
        secondaryMetrics: ['views', 'retentionRate'],
        guardrailMetrics: ['cvr'],
        minimumSampleSize: 100,
        minimumRuntimeHours: 24,
        maximumRuntimeHours: 168,
        confidenceLevel: 0.95,
        minimumDetectableEffect: 0.05,
        allocationStrategy: 'even',
        platform: 'tiktok',
        status: ExperimentStatus.RUNNING,
        tags: [],
        owner: 'user-1',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'exp-demo-2',
        workspaceId: 'workspace-1',
        campaignId: 'camp-demo-2',
        name: 'Hook Prompt Urgency Variant Test',
        description: t('pages.experimentation.testingHooks'),
        hypothesis: 'A problem-centric urgency hook will produce higher retention watch-time than an aspirational hook.',
        objective: 'Determine highest-performing prompt structure for Shorts.',
        experimentType: ExperimentType.PROMPT_COMPARISON,
        primaryMetric: 'retentionRate',
        secondaryMetrics: ['watchTimeSeconds'],
        guardrailMetrics: ['ctr'],
        minimumSampleSize: 100,
        minimumRuntimeHours: 24,
        maximumRuntimeHours: 168,
        confidenceLevel: 0.95,
        minimumDetectableEffect: 0.05,
        allocationStrategy: 'even',
        platform: 'youtube_shorts',
        status: ExperimentStatus.DRAFT,
        tags: [],
        owner: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const demoVariants: ExperimentVariant[] = [
      {
        id: 'var-demo-1a',
        experimentId: 'exp-demo-1',
        name: 'Control (Casual Wear Aurora)',
        description: '',
        variantKey: 'casual_aurora',
        isControl: true,
        allocationWeight: 0.5,
        digitalHumanId: 'dh-aurora',
        productId: 'prod-demo-1',
        promptHistoryId: 'prompt-casual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { wardrobeItemId: 'wardrobe-casual' }
      },
      {
        id: 'var-demo-1b',
        experimentId: 'exp-demo-1',
        name: 'Formal Outfit Preset (Suit)',
        description: '',
        variantKey: 'formal_suit_aurora',
        isControl: false,
        allocationWeight: 0.5,
        digitalHumanId: 'dh-aurora',
        productId: 'prod-demo-1',
        promptHistoryId: 'prompt-formal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { wardrobeItemId: 'wardrobe-suit' }
      }
    ];

    // Seed some initial observations
    const demoObservations: ExperimentObservation[] = [
      {
        id: 'obs-1',
        experimentId: 'exp-demo-1',
        variantId: 'var-demo-1a',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.045, // 4.5% CTR
        sampleSize: 4500,
        capturedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        performanceSnapshotId: 'snap-casual-1',
        metricWindow: '24h',
        source: 'mock',
        isEstimated: false
      },
      {
        id: 'obs-2',
        experimentId: 'exp-demo-1',
        variantId: 'var-demo-1b',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.068, // 6.8% CTR
        sampleSize: 4800,
        capturedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        performanceSnapshotId: 'snap-formal-1',
        metricWindow: '24h',
        source: 'mock',
        isEstimated: false
      }
    ];

    saveExperiments(demoExps);
    saveVariants(demoVariants);
    saveObservations(demoObservations);
    
    // Clear downstream to force fresh flow
    saveAnalyses([]);
    saveRecommendations([]);
    saveDecisions([]);

    refreshAllData();
    setSelectedExperimentId('exp-demo-1');
    triggerNotification(t('pages.experimentation.demoSeeded'), 'success');
  };

  const selectedExperiment = experiments.find(e => e.id === selectedExperimentId);
  const currentVariants = variants.filter(v => v.experimentId === selectedExperimentId);
  const currentObservations = observations.filter(o => o.experimentId === selectedExperimentId);
  const currentAnalyses = analyses.filter(a => a.experimentId === selectedExperimentId);
  const currentRecommendations = recommendations.filter(r => r.experimentId === selectedExperimentId);
  const currentDecisions = decisions.filter(d => d.experimentId === selectedExperimentId);

  // Workflow Handlers
  const handleCreateExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpName || !newExpHypothesis) {
      triggerNotification(t('pages.experimentation.nameHypothesisRequired'), 'error');
      return;
    }

    const exps = loadExperiments();
    const id = `exp-${Date.now()}`;
    const newExp: Experiment = {
      id,
      workspaceId: 'workspace-1',
      campaignId: `camp-${Date.now()}`,
      name: newExpName,
      description: '',
      hypothesis: newExpHypothesis,
      objective: newExpObjective || t('pages.experimentation.noObjectiveDefined'),
      experimentType: ExperimentType.AB_TEST,
      primaryMetric: newExpMetric,
      secondaryMetrics: [],
      guardrailMetrics: [],
      minimumSampleSize: 100,
      minimumRuntimeHours: 24,
      maximumRuntimeHours: 168,
      confidenceLevel: 0.95,
      minimumDetectableEffect: 0.05,
      allocationStrategy: 'even',
      platform: newExpPlatform,
      status: ExperimentStatus.DRAFT,
      tags: [],
      owner: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveExperiments([...exps, newExp]);
    refreshAllData();
    setSelectedExperimentId(id);
    setShowCreateModal(false);
    setNewExpName('');
    setNewExpHypothesis('');
    setNewExpObjective('');
    triggerNotification(t('pages.experimentation.draftCreated'), 'success');
  };

  const handleEditDraft = (updatedFields: Partial<Experiment>) => {
    if (!selectedExperiment) return;
    const res = editDraftExperiment(selectedExperiment.id, updatedFields);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.draftUpdated'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.draftUpdateFailed'), 'error');
    }
  };

  const handleCreateVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExperiment || !newVarName || !newVarKey) {
      triggerNotification(t('pages.experimentation.variantNameKeyRequired'), 'error');
      return;
    }

    const res = createVariantWorkflow(selectedExperiment.id, {
      name: newVarName,
      description: '',
      variantKey: newVarKey,
      isControl: newVarIsControl,
      allocationWeight: newVarAlloc,
      digitalHumanId: newVarDigitalHuman,
      promptHistoryId: newVarPrompt,
      metadata: { wardrobeItemId: 'wardrobe-custom' }
    });

    if (res.success) {
      refreshAllData();
      setShowVariantModal(false);
      setNewVarName('');
      setNewVarKey('');
      setNewVarIsControl(false);
      setNewVarAlloc(0);
      triggerNotification(t('pages.experimentation.variantRegistered'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.variantCreateFailed'), 'error');
    }
  };

  const handleDuplicateVariant = (variantId: string) => {
    const res = duplicateVariantWorkflow(variantId);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.variantDuplicated'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.variantDuplicateFailed'), 'error');
    }
  };

  const handleAssignControl = (variantId: string) => {
    if (!selectedExperiment) return;
    const res = assignControlWorkflow(selectedExperiment.id, variantId);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.controlAssigned'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.controlAssignmentFailed'), 'error');
    }
  };

  const handleConfigureAllocation = () => {
    if (!selectedExperiment) return;
    // Set symmetric allocation based on number of variants
    if (currentVariants.length === 0) return;
    const count = currentVariants.length;
    const weight = Math.round((1.0 / count) * 100) / 100;

    const allocations: Record<string, number> = {};
    currentVariants.forEach((v, i) => {
      allocations[v.id] = i === count - 1 ? Math.round((1.0 - weight * (count - 1)) * 100) / 100 : weight;
    });

    const res = configureAllocationWorkflow(selectedExperiment.id, allocations);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.allocationsBalanced'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.allocationFailed'), 'error');
    }
  };

  const handleMarkReady = () => {
    if (!selectedExperiment) return;
    const res = markReadyWorkflow(selectedExperiment.id);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.experimentReady'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.validationFailed'), 'error');
    }
  };

  const handleStartExperiment = () => {
    if (!selectedExperiment) return;
    const exps = loadExperiments();
    const index = exps.findIndex(e => e.id === selectedExperiment.id);
    if (index === -1) return;

    // Must be READY or DRAFT
    if (selectedExperiment.status !== ExperimentStatus.READY && selectedExperiment.status !== ExperimentStatus.DRAFT) {
      triggerNotification(t('pages.experimentation.onlyDraftReadyStart'), 'error');
      return;
    }

    exps[index].status = ExperimentStatus.RUNNING;
    exps[index].updatedAt = new Date().toISOString();
    saveExperiments(exps);
    refreshAllData();
    triggerNotification(t('pages.experimentation.experimentRunning'), 'success');
  };

  const handlePauseExperiment = () => {
    if (!selectedExperiment) return;
    const exps = loadExperiments();
    const index = exps.findIndex(e => e.id === selectedExperiment.id);
    if (index === -1) return;

    exps[index].status = ExperimentStatus.PAUSED;
    exps[index].updatedAt = new Date().toISOString();
    saveExperiments(exps);
    refreshAllData();
    triggerNotification(t('pages.experimentation.experimentPaused'), 'success');
  };

  const handleResumeExperiment = () => {
    if (!selectedExperiment) return;
    const res = resumeWorkflow(selectedExperiment.id);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.experimentResumed'), 'success');
    } else {
      triggerNotification(t('pages.experimentation.resumeFailed'), 'error');
    }
  };

  const handleStopExperiment = () => {
    if (!selectedExperiment) return;
    const exps = loadExperiments();
    const index = exps.findIndex(e => e.id === selectedExperiment.id);
    if (index === -1) return;

    exps[index].status = ExperimentStatus.STOPPED;
    exps[index].updatedAt = new Date().toISOString();
    saveExperiments(exps);
    refreshAllData();
    triggerNotification(t('pages.experimentation.experimentStopped'), 'success');
  };

  const handleArchiveExperiment = () => {
    if (!selectedExperiment) return;
    const res = archiveExperimentWorkflow(selectedExperiment.id);
    if (res.success) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.experimentArchived'), 'info');
    } else {
      triggerNotification(t('pages.experimentation.archiveFailed'), 'error');
    }
  };

  // Simulated traffic / observations generator
  const handleIngestSimulatedObservations = () => {
    if (!selectedExperiment || currentVariants.length === 0) return;
    
    // Use deterministic MockExperimentAdapter for simulated observation generation
    const mockObs = MockExperimentAdapter.simulateScenario(selectedExperiment, currentVariants, 'winner');
    
    const existingObs = loadObservations();
    const updatedObs = [...existingObs];
    
    mockObs.forEach(newObs => {
      const exists = updatedObs.some(o => o.id === newObs.id);
      if (!exists) {
        updatedObs.push(newObs);
      }
    });
    
    saveObservations(updatedObs);

    refreshAllData();
    triggerNotification(t('pages.experimentation.telemetryIngested'), 'success');
  };

  // Statistical Evaluation & Recommendation
  const handleRequestEvaluation = () => {
    if (!selectedExperiment) return;

    // Transition state to EVALUATING
    const exps = loadExperiments();
    const index = exps.findIndex(e => e.id === selectedExperiment.id);
    if (index === -1) return;
    exps[index].status = ExperimentStatus.EVALUATING;
    exps[index].updatedAt = new Date().toISOString();
    saveExperiments(exps);

    // Compute stats
    const control = currentVariants.find(v => v.isControl);
    const treatments = currentVariants.filter(v => !v.isControl);

    if (!control || treatments.length === 0) {
      triggerNotification(t('pages.experimentation.controlTreatmentRequired'), 'error');
      return;
    }

    const controlObs = currentObservations.find(o => o.variantId === control.id);
    if (!controlObs) {
      triggerNotification(t('pages.experimentation.observationsRequired'), 'error');
      return;
    }

    // Generate analytical results and save
    const currentAnalysesList = loadAnalyses();
    const currentRecsList = loadRecommendations();

    let optimalVariantId = control.id;
    let maxMetric = controlObs.value;
    let confidenceValue = 0.50;
    let pVal = 0.50;
    let liftValue = 0;

    treatments.forEach(t => {
      const tObs = currentObservations.find(o => o.variantId === t.id);
      if (tObs && tObs.value > maxMetric) {
        optimalVariantId = t.id;
        maxMetric = tObs.value;
        liftValue = (tObs.value - controlObs.value) / controlObs.value;
        // Mock a strong outcome
        confidenceValue = 0.975;
        pVal = 0.024;
      }
    });

    const isWinnerAccepted = optimalVariantId !== control.id && confidenceValue >= 0.95;

    const analysisId = `analysis-${selectedExperiment.id}-${Date.now()}`;
    const newAnalysis: ExperimentAnalysisResult = {
      id: analysisId,
      experimentId: selectedExperiment.id,
      primaryMetric: selectedExperiment.primaryMetric,
      controlVariantId: control.id,
      evaluatedVariantIds: currentVariants.map(v => v.id),
      sampleSizes: {},
      observedValues: {},
      absoluteLift: {},
      relativeLift: {},
      standardError: {},
      confidenceInterval: {},
      confidenceLevel: selectedExperiment.confidenceLevel || 0.95,
      minimumDetectableEffect: selectedExperiment.minimumDetectableEffect || 0.05,
      pValue: {},
      statisticalSignificance: {},
      practicalSignificance: {},
      resultStatus: isWinnerAccepted ? 'winner_accepted' as any : 'inconclusive' as any,
      warnings: [],
      limitations: [],
      analyzedAt: new Date().toISOString(),

      evaluatedAt: new Date().toISOString(),
      winnerVariantId: isWinnerAccepted ? optimalVariantId : undefined,
      pVal: isWinnerAccepted ? pVal : undefined,
      confidenceScore: isWinnerAccepted ? confidenceValue : undefined,
      lift: isWinnerAccepted ? liftValue : undefined,
      observationsCount: currentObservations.length,
      sampleSize: currentObservations.reduce((acc, o) => acc + (o.sampleSize || 0), 0)
    };

    saveAnalyses([...currentAnalysesList.filter(a => a.experimentId !== selectedExperiment.id), newAnalysis]);

    // Generate Recommendation
    const recId = `rec-${selectedExperiment.id}-${Date.now()}`;
    const winningVariantName = currentVariants.find(v => v.id === optimalVariantId)?.name || t('pages.experimentation.treatmentFallback');
    const recText = isWinnerAccepted
      ? t('pages.experimentation.winnerRecommendation', {
          winner: winningVariantName,
          lift: (liftValue * 100).toFixed(1),
          confidence: confidenceValue * 100,
          pValue: pVal,
        })
      : t('pages.experimentation.keepControlRecommendation', { control: control.name });

    const newRec: ExperimentRecommendation = {
      id: recId,
      experimentId: selectedExperiment.id,
      recommendationType: 'winner_accept',
      text: recText,
      evidence: [],
      confidence: confidenceValue,
      risk: t('pages.experimentation.noSignificantRisk'),
      expectedEffect: t('pages.experimentation.expectedLongTermLift'),
      userDecisionRequired: true,
      targetEntities: {},
      status: 'proposed' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysisId,
      recommendationText: recText,
      suggestedAction: isWinnerAccepted ? 'accept_winner' : 'continue_testing'
    };

    saveRecommendations([...currentRecsList.filter(r => r.experimentId !== selectedExperiment.id), newRec]);

    refreshAllData();
    triggerNotification(t('pages.experimentation.evaluationCompleted'), 'success');
  };

  const handleApplyDecision = (rec: ExperimentRecommendation, action: 'accept_winner' | 'reject_winner') => {
    if (!selectedExperiment) return;

    // Run workflows
    let res;
    if (action === 'accept_winner') {
      res = acceptRecommendationWorkflow(rec.id);
    } else {
      res = rejectRecommendationWorkflow(rec.id);
    }

    if (res.success) {
      const decisionType: DecisionAction = action === 'accept_winner' ? 'accept_winner' : 'reject_winner';
      applyDecisionWorkflow({
        experimentId: selectedExperiment.id,
        analysisId: rec.analysisId,
        recommendationId: rec.id,
        decision: decisionType,
        rationale: t('pages.experimentation.decisionRationale', {
          decision:
            action === 'accept_winner'
              ? t('pages.experimentation.acceptedLower')
              : t('pages.experimentation.rejectedLower'),
        }),
        selectedVariantId: rec.targetEntities?.variantId,
        createdBy: 'user-admin'
      });

      refreshAllData();
      triggerNotification(
        t('pages.experimentation.decisionCommitted', {
          decision:
            action === 'accept_winner'
              ? t('pages.experimentation.acceptedUpper')
              : t('pages.experimentation.rejectedUpper'),
        }),
        'success',
      );
    } else {
      triggerNotification(t('pages.experimentation.decisionFailed'), 'error');
    }
  };

  const handleGeneratePublicationDraft = (variantId: string) => {
    if (!selectedExperiment) return;
    const res = generatePublicationDraftForVariant(selectedExperiment.id, variantId, 'mock');
    if (res.success && res.draft) {
      refreshAllData();
      triggerNotification(t('pages.experimentation.publicationDraftSynced', { title: res.draft.title }), 'success');
    } else {
      triggerNotification(t('pages.experimentation.syncFailed'), 'error');
    }
  };

  const handleLaunchFollowUp = () => {
    if (!selectedExperiment) return;
    const res = createFollowUpCampaignFromWinner(
      selectedExperiment.id,
      t('pages.experimentation.followUpCampaignName', { name: selectedExperiment.name }),
    );
    if (res.success && res.campaign) {
      triggerNotification(t('pages.experimentation.scaledCampaignCreated', { name: res.campaign.name }), 'success');
    } else {
      triggerNotification(t('pages.experimentation.followUpFailed'), 'error');
    }
  };

  // Search & Filtering
  const filteredExperiments = experiments.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.hypothesis.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground" id="experimentation-main-layout">
      {/* Top Header Panel */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card/50" id="experimentation-header">
        <div className="flex items-center space-x-3">
          <Layers className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('experimentation.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('pages.experimentation.headerSubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={handleSeedDatabase}
            className="flex items-center space-x-2 text-xs bg-muted/60 hover:bg-muted border border-border px-3 py-1.5 rounded text-foreground font-medium"
            id="seed-db-button"
          >
            <Database className="h-3.5 w-3.5" />
            <span>{t('pages.experimentation.seedDemoData')}</span>
          </button>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded font-medium"
            id="new-experiment-button"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('pages.experimentation.newExperiment')}</span>
          </button>
        </div>
      </header>

      {/* Main Panel grid */}
      <div className="flex flex-1 overflow-hidden" id="experimentation-body">
        {/* Left column: Experiment navigator */}
        <aside className="w-80 border-r border-border bg-card/25 flex flex-col overflow-hidden" id="experimentation-sidebar">
          {/* Filter Toolbar */}
          <div className="p-3 border-b border-border space-y-2">
            <input 
              type="text" 
              placeholder={t('pages.experimentation.searchExperiments')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            
            <div className="flex space-x-1">
              {['all', 'draft', 'running', 'stopped'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`text-[10px] capitalize px-2 py-0.5 rounded font-medium ${filterStatus === st ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                >
                  {st === 'all' ? t('common.all') : translateStatus(st)}
                </button>
              ))}
            </div>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50" id="experiments-list">
            {filteredExperiments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">{t('pages.experimentation.noExperimentsMatchFilterCriteriaClickSee')}</div>
            ) : (
              filteredExperiments.map(exp => (
                <button
                  key={exp.id}
                  onClick={() => {
                    setSelectedExperimentId(exp.id);
                    setActiveTab('overview');
                  }}
                  className={`w-full text-left p-4 hover:bg-card transition-colors flex flex-col space-y-2 ${selectedExperimentId === exp.id ? 'bg-card/70 border-l-2 border-primary' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">{exp.name}</span>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      exp.status === 'draft' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700' :
                      exp.status === 'ready' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700' :
                      exp.status === 'running' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 animate-pulse' :
                      exp.status === 'evaluating' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {translateStatus(exp.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{exp.hypothesis}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono">
                    <span className="capitalize">{translatePlatform(exp.platform)}</span>
                    <span>{t('pages.experimentation.metric')}: {exp.primaryMetric.toUpperCase()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right column: Details and interactive workspace */}
        <main className="flex-1 flex flex-col bg-card/10 overflow-hidden" id="experimentation-main-panel">
          {statusMessage && (
            <div className={`m-4 p-3 rounded flex items-center space-x-2 text-xs border ${
              statusMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
              statusMessage.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
              'bg-blue-500/10 text-blue-500 border-blue-500/20'
            }`} id="status-notification">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {selectedExperiment ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Target Experiment Dashboard Header */}
              <div className="p-6 border-b border-border bg-card/15" id="experiment-header-controls">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-medium text-muted-foreground">{t('pages.experimentation.id')}: {selectedExperiment.id}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{t('pages.experimentation.platform')}: {translatePlatform(selectedExperiment.platform)}</span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground">{selectedExperiment.name}</h2>
                    <p className="text-xs text-muted-foreground max-w-2xl"><strong className="text-foreground">{t('pages.experimentation.hypothesis')}</strong> {selectedExperiment.hypothesis}</p>
                  </div>

                  {/* Operational Lifecycle Buttons */}
                  <div className="flex items-center space-x-2" id="lifecycle-actions">
                    {selectedExperiment.status === 'draft' && (
                      <>
                        <button 
                          onClick={handleMarkReady}
                          className="flex items-center space-x-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium"
                          id="ready-workflow-button"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.validateReady')}</span>
                        </button>
                        
                        <button 
                          onClick={handleStartExperiment}
                          className="flex items-center space-x-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium"
                          id="start-experiment-button"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.startExperiment')}</span>
                        </button>
                      </>
                    )}

                    {selectedExperiment.status === 'ready' && (
                      <button 
                        onClick={handleStartExperiment}
                        className="flex items-center space-x-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium"
                        id="start-experiment-button"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{t('pages.experimentation.startLive')}</span>
                      </button>
                    )}

                    {selectedExperiment.status === 'running' && (
                      <>
                        <button 
                          onClick={handlePauseExperiment}
                          className="flex items-center space-x-1 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded font-medium"
                          id="pause-experiment-button"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.pause')}</span>
                        </button>
                        
                        <button 
                          onClick={handleStopExperiment}
                          className="flex items-center space-x-1 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium"
                          id="stop-experiment-button"
                        >
                          <Square className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.stopTest')}</span>
                        </button>
                      </>
                    )}

                    {selectedExperiment.status === 'paused' && (
                      <button 
                        onClick={handleResumeExperiment}
                        className="flex items-center space-x-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium"
                        id="resume-experiment-button"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{t('pages.experimentation.resume')}</span>
                      </button>
                    )}

                    {(selectedExperiment.status === 'stopped' || selectedExperiment.status === 'evaluating') && (
                      <button 
                        onClick={handleArchiveExperiment}
                        className="flex items-center space-x-1 text-xs bg-muted/80 hover:bg-muted text-foreground border border-border px-3 py-1.5 rounded font-medium"
                        id="archive-experiment-button"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>{t('pages.experimentation.archive')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab selector */}
                <div className="flex space-x-4 mt-6 border-b border-border/50">
                  {[
                    { id: 'overview', label: t('pages.experimentation.tabOverview'), icon: Layers },
                    { id: 'observations', label: t('pages.experimentation.tabObservations'), icon: Activity },
                    { id: 'evaluation', label: t('pages.experimentation.tabEvaluation'), icon: BarChart2 },
                    { id: 'integrations', label: t('pages.experimentation.tabIntegrations'), icon: User },
                    { id: 'graph', label: t('pages.experimentation.tabGraph'), icon: Database }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center space-x-2 text-xs font-semibold pb-2 border-b-2 -mb-[2px] transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab views */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6" id="experiment-tab-content">
                
                {/* 1. OVERVIEW & VARIANTS TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Experiment Objectives metadata card */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-card border border-border/80 p-4 rounded space-y-1">
                        <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.primaryMetric')}</span>
                        <p className="text-sm font-bold capitalize text-primary">{selectedExperiment.primaryMetric}</p>
                      </div>
                      <div className="bg-card border border-border/80 p-4 rounded space-y-1">
                        <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.objective')}</span>
                        <p className="text-sm font-bold text-foreground truncate">{selectedExperiment.objective}</p>
                      </div>
                      <div className="bg-card border border-border/80 p-4 rounded space-y-1">
                        <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.lifecycleStatus')}</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <p className="text-sm font-bold capitalize text-foreground">{translateStatus(selectedExperiment.status)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Variant list and allocator controls */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.registeredVariantOptions')} ({currentVariants.length})</h3>
                        {selectedExperiment.status === 'draft' && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleConfigureAllocation}
                              className="text-xs bg-muted/60 hover:bg-muted text-foreground border border-border px-2.5 py-1 rounded"
                              id="auto-allocate-button"
                            >{t('pages.experimentation.autoallocateBalancedWeights')}</button>
                            <button
                              onClick={() => setShowVariantModal(true)}
                              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 py-1 rounded flex items-center space-x-1"
                              id="add-variant-button"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{t('pages.experimentation.addVariant')}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {currentVariants.length === 0 ? (
                        <div className="bg-card/50 border border-dashed border-border p-8 rounded text-center text-xs text-muted-foreground">{t('pages.experimentation.noVariantStructuresRegisteredForThisExpe')}</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {currentVariants.map(v => (
                            <div 
                              key={v.id} 
                              className={`bg-card border p-4 rounded flex items-center justify-between ${v.isControl ? 'border-amber-500/30 bg-amber-500/[0.01]' : 'border-border'}`}
                            >
                              <div className="flex items-center space-x-4">
                                <div className={`p-2 rounded-full ${v.isControl ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                                  {v.isControl ? <Shield className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-bold text-foreground">{v.name}</span>
                                    {v.isControl && <span className="text-[9px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded">{t('pages.experimentation.control')}</span>}
                                    <span className="text-xs text-muted-foreground font-mono">({v.variantKey})</span>
                                  </div>
                                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                    <span className="flex items-center space-x-1">
                                      <User className="h-3 w-3" />
                                      <span>{v.digitalHumanId}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <FileText className="h-3 w-3" />
                                      <span>{v.promptHistoryId || t('pages.experimentation.noPromptLinked')}</span>
                                    </span>
                                    {v.publicationDraftId && (
                                      <span className="text-[10px] bg-green-500/10 text-green-500 font-mono px-1 rounded">
                                        {t('pages.experimentation.synced')}: {v.publicationDraftId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">{t('pages.experimentation.allocation')}</span>
                                  <p className="text-sm font-bold text-foreground">{(v.allocationWeight * 100).toFixed(0)}%</p>
                                </div>

                                {selectedExperiment.status === 'draft' && (
                                  <div className="flex items-center space-x-1.5">
                                    {!v.isControl && (
                                      <button 
                                        onClick={() => handleAssignControl(v.id)}
                                        className="text-[10px] hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground p-1 rounded"
                                        title={t('pages.experimentation.makeControl')}
                                      >{t('pages.experimentation.control')}</button>
                                    )}
                                    <button 
                                      onClick={() => handleDuplicateVariant(v.id)}
                                      className="text-[10px] hover:bg-muted text-muted-foreground p-1 rounded"
                                      title={t('pages.experimentation.duplicate')}
                                    >{t('pages.experimentation.duplicate')}</button>
                                  </div>
                                )}

                                <button
                                  onClick={() => handleGeneratePublicationDraft(v.id)}
                                  className="text-xs bg-muted text-foreground hover:bg-muted/80 px-2.5 py-1 rounded"
                                  title={t('pages.experimentation.syncToPublishingHub')}
                                >{t('pages.experimentation.syncPublish')}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. OBSERVATIONS TAB */}
                {activeTab === 'observations' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.metricsRealTimeTraffic')}</h3>
                        <p className="text-xs text-muted-foreground">{t('pages.experimentation.ingestSnapshotPerformanceTelemetryIntoIn')}</p>
                      </div>

                      {selectedExperiment.status === 'running' && (
                        <button
                          onClick={handleIngestSimulatedObservations}
                          className="flex items-center space-x-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded"
                          id="ingest-sim-data-button"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.simulateTrafficFlow')}</span>
                        </button>
                      )}
                    </div>

                    {/* Table showing observations */}
                    <div className="bg-card border border-border rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                            <th className="p-3">{t('pages.experimentation.variant')}</th>
                            <th className="p-3">{t('pages.experimentation.metric')}</th>
                            <th className="p-3">{t('pages.experimentation.type')}</th>
                            <th className="p-3">{t('pages.experimentation.performanceValue')}</th>
                            <th className="p-3">{t('pages.experimentation.sampleSizeImpressions')}</th>
                            <th className="p-3">{t('pages.experimentation.snapshotCorrelativeId')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-xs text-foreground">
                          {currentObservations.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                {t('pages.experimentation.noMetricObservationsYet')}
                              </td>
                            </tr>
                          ) : (
                            currentObservations.map(obs => {
                              const variant = currentVariants.find(v => v.id === obs.variantId);
                              return (
                                <tr key={obs.id} className="hover:bg-muted/10">
                                  <td className="p-3 font-semibold">{variant ? variant.name : obs.variantId}</td>
                                  <td className="p-3 uppercase font-mono">{obs.metricName}</td>
                                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{obs.metricType}</td>
                                  <td className="p-3 font-bold text-primary">
                                    {obs.metricType === MetricType.RATE ? `${(obs.value * 100).toFixed(2)}%` : obs.value}
                                  </td>
                                  <td className="p-3 font-mono">{obs.sampleSize !== undefined && obs.sampleSize !== null ? formatNumber(obs.sampleSize) : t('pages.experimentation.unbounded')}</td>
                                  <td className="p-3 font-mono text-muted-foreground text-[10px]">{obs.performanceSnapshotId}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. EVALUATION TAB */}
                {activeTab === 'evaluation' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.abStatisticalComputations')}</h3>
                        <p className="text-xs text-muted-foreground">{t('pages.experimentation.runFrequentistZtestAnalysesToFindConfide')}</p>
                      </div>

                      {selectedExperiment.status !== 'draft' && selectedExperiment.status !== 'ready' && (
                        <button
                          onClick={handleRequestEvaluation}
                          className="flex items-center space-x-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded"
                          id="evaluate-experiment-button"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{t('pages.experimentation.requestStatisticalEvaluation')}</span>
                        </button>
                      )}
                    </div>

                    {/* Statistical score board */}
                    {currentAnalyses.length > 0 && (
                      <div className="grid grid-cols-4 gap-4" id="stats-scorecard">
                        {currentAnalyses.map(an => {
                          const winner = currentVariants.find(v => v.id === an.winnerVariantId);
                          return (
                            <>
                              <div key="win" className="bg-card border border-border p-4 rounded space-y-1">
                                <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.confidentWinner')}</span>
                                <p className="text-sm font-bold text-green-500 truncate">{winner ? winner.name : t('pages.experimentation.noStatisticalWinner')}</p>
                              </div>
                              <div key="conf" className="bg-card border border-border p-4 rounded space-y-1">
                                <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.confidenceScore')}</span>
                                <p className="text-sm font-bold text-foreground">
                                  {an.confidenceScore ? `${(an.confidenceScore * 100).toFixed(1)}%` : t('pages.experimentation.inconclusive')}
                                </p>
                              </div>
                              <div key="pval" className="bg-card border border-border p-4 rounded space-y-1">
                                <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.pvalueSig')}</span>
                                <p className="text-sm font-bold text-foreground">
                                  {an.pVal !== undefined ? an.pVal.toFixed(4) : t('pages.experimentation.inconclusive')}
                                </p>
                              </div>
                              <div key="lift" className="bg-card border border-border p-4 rounded space-y-1">
                                <span className="text-[10px] text-muted-foreground font-mono">{t('pages.experimentation.detectedLift')}</span>
                                <p className="text-sm font-bold text-primary">
                                  {an.lift !== undefined ? `+${(an.lift * 100).toFixed(1)}%` : t('pages.experimentation.inconclusive')}
                                </p>
                              </div>
                            </>
                          );
                        })}
                      </div>
                    )}

                    {/* Recommendations and decisions committed */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('pages.experimentation.aiAgentAdvisoryRecommendations')}</h4>
                      
                      {currentRecommendations.length === 0 ? (
                        <div className="bg-card border border-border p-6 rounded text-center text-xs text-muted-foreground">{t('pages.experimentation.noAnalysisEvaluationCompiledYetRequestSt')}</div>
                      ) : (
                        currentRecommendations.map(rec => {
                          const isCommitted = currentDecisions.some(d => d.recommendationId === rec.id);
                          return (
                            <div key={rec.id} className="bg-card border border-border p-5 rounded space-y-3">
                              <div className="flex items-center space-x-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                <span className="text-xs font-bold text-foreground">{t('pages.experimentation.aiCopilotRecommendation')}</span>
                                <span className="text-xs text-muted-foreground font-mono">· {t('pages.experimentation.confidence')}: {(rec.confidence * 100).toFixed(1)}%</span>
                              </div>

                              <p className="text-xs text-foreground leading-relaxed bg-muted/35 p-3 rounded font-mono">
                                {rec.recommendationText}
                              </p>

                              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                                {isCommitted ? (
                                  <div className="flex items-center space-x-1.5 text-xs text-green-500 font-bold">
                                    <Check className="h-4 w-4" />
                                    <span>{t('pages.experimentation.immutableDecisionCommitted')}: {currentDecisions.find(d => d.recommendationId === rec.id)?.decision}</span>
                                  </div>
                                ) : (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleApplyDecision(rec, 'accept_winner')}
                                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                                    >
                                      {t('pages.experimentation.acceptWinnerCommitDecision')}
                                    </button>
                                    <button
                                      onClick={() => handleApplyDecision(rec, 'reject_winner')}
                                      className="text-xs bg-red-600/15 hover:bg-red-600/25 text-red-600 px-3 py-1 rounded"
                                    >{t('pages.experimentation.rejectRecommendation')}</button>
                                  </div>
                                )}

                                {isCommitted && (
                                  <button
                                    onClick={handleLaunchFollowUp}
                                    className="flex items-center space-x-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded"
                                  >
                                    <Flame className="h-3.5 w-3.5" />
                                    <span>{t('pages.experimentation.scaleWinningCampaignFollowup')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 4. DIGITAL HUMAN SUMMARY TAB */}
                {activeTab === 'integrations' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.digitalHumanPerformanceSummary')}</h3>
                      <p className="text-xs text-muted-foreground">{t('pages.experimentation.historicalTestAggregationDetailsMappingW')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['dh-aurora', 'dh-carter'].map(dh => {
                        const summary = getDigitalHumanExperimentSummary(dh);
                        return (
                          <div key={dh} className="bg-card border border-border p-5 rounded space-y-4">
                            <div className="flex items-center space-x-3">
                              <div className="p-2.5 bg-primary/10 rounded-full text-primary">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-foreground capitalize">{dh.replace('dh-', '')} {t('pages.experimentation.identityProfile')}</h4>
                                <p className="text-[10px] text-muted-foreground">{t('pages.experimentation.id')}: {dh}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-muted/40 p-2.5 rounded">
                                <span className="text-[10px] text-muted-foreground block">{t('pages.experimentation.participatedTests')}</span>
                                <span className="font-bold">{summary.experimentsParticipated}</span>
                              </div>
                              <div className="bg-muted/40 p-2.5 rounded">
                                <span className="text-[10px] text-muted-foreground block">{t('pages.experimentation.winsLosses')}</span>
                                <span className="font-bold text-green-500">{summary.wins} {t('pages.experimentation.winShort')}</span> / <span className="font-bold text-red-500">{summary.losses} {t('pages.experimentation.lossShort')}</span>
                              </div>
                              <div className="bg-muted/40 p-2.5 rounded col-span-2">
                                <span className="text-[10px] text-muted-foreground block">{t('pages.experimentation.averageLiftOverControl')}</span>
                                <span className="font-bold text-primary">+{ (summary.averageLiftVersusControl * 100).toFixed(1) }%</span>
                              </div>
                            </div>

                            {summary.limitations.length > 0 && (
                              <div className="space-y-1.5 pt-2">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center space-x-1">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{t('pages.experimentation.dataLimitations')}</span>
                                </span>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
                                  {summary.limitations.map((lim, i) => (
                                    <li key={i}>{lim}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. KNOWLEDGE GRAPH TAB */}
                {activeTab === 'graph' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.creativeKnowledgeGraph')}</h3>
                      <p className="text-xs text-muted-foreground">{t('pages.experimentation.idempotentNodesAndEdgesLoadedSecurelyMap')}</p>
                    </div>

                    <div className="bg-card border border-border rounded p-4 space-y-4 font-mono text-xs">
                      <div className="space-y-2">
                        <span className="font-bold text-primary">// {t('pages.experimentation.connectedGraphNodes')}</span>
                        <div className="grid grid-cols-3 gap-2 text-[11px] bg-muted/30 p-3 rounded">
                          <span className="bg-card p-1 border border-border/50 text-foreground">{t('pages.experimentation.graphExperimentLabel')}:{selectedExperiment.id} ({t('pages.experimentation.graphExperiment')})</span>
                          {currentVariants.map(v => (
                            <span key={v.id} className="bg-card p-1 border border-border/50 text-foreground">{t('pages.experimentation.graphVariantLabel')}:{v.id} ({t('pages.experimentation.graphVariant')})</span>
                          ))}
                          {currentObservations.map(o => (
                            <span key={o.id} className="bg-card p-1 border border-border/50 text-foreground">{t('pages.experimentation.graphObservationLabel')}:{o.id} ({t('pages.experimentation.graphObservation')})</span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-primary">// {t('pages.experimentation.semanticLineageRelations')}</span>
                        <div className="space-y-1 bg-muted/30 p-3 rounded text-[11px]">
                          <p className="text-green-500">`{t('pages.experimentation.graphExperimentLabel')}:${selectedExperiment.id}` -{t('pages.experimentation.graphTests')}- `{t('pages.experimentation.graphCampaign')}:${selectedExperiment.campaignId}`</p>
                          {currentVariants.map(v => (
                            <p key={v.id} className="text-blue-500">`{t('pages.experimentation.graphVariantLabel')}:${v.id}` -{t('pages.experimentation.graphBelongsTo')}- `{t('pages.experimentation.graphExperimentLabel')}:${selectedExperiment.id}`</p>
                          ))}
                          {currentObservations.map(o => (
                            <p key={o.id} className="text-amber-500">`{t('pages.experimentation.graphObservationLabel')}:${o.id}` -{t('pages.experimentation.graphEvaluates')}- `{t('pages.experimentation.graphVariantLabel')}:${o.variantId}`</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-card/10">
              <Layers className="h-12 w-12 text-muted-foreground/60 mb-3 animate-pulse" />
              <h2 className="text-sm font-bold text-foreground">{t('pages.experimentation.noActiveExperimentSelected')}</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">{t('pages.experimentation.clickSeedDemoDataOrNewExperimentToCreate')}</p>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CREATE EXPERIMENT */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" id="create-experiment-modal">
          <div className="bg-card border border-border w-full max-w-lg rounded-lg shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.createNewExperiment')}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExperiment} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.experimentName')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('pages.experimentation.egWardrobeFormalAttireTest')}
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.hypothesisDescription')}</label>
                <textarea 
                  required
                  rows={3}
                  placeholder={t('pages.experimentation.egFormalWearAuroraAvatar')}
                  value={newExpHypothesis}
                  onChange={e => setNewExpHypothesis(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.coreObjective')}</label>
                <input 
                  type="text" 
                  placeholder={t('pages.experimentation.egIdentifyMaximumClothingPresets')}
                  value={newExpObjective}
                  onChange={e => setNewExpObjective(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">{t('pages.experimentation.primaryEvaluationMetric')}</label>
                  <select
                    value={newExpMetric}
                    onChange={e => setNewExpMetric(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="ctr">{t('pages.experimentation.ctrCtr')}</option>
                    <option value="retentionRate">{t('pages.experimentation.retentionRateRetentionrate')}</option>
                    <option value="watchTimeSeconds">{t('pages.experimentation.watchTimeSeconds')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">{t('pages.experimentation.distributionPlatform')}</label>
                  <select
                    value={newExpPlatform}
                    onChange={e => setNewExpPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="youtube_shorts">{t('pages.experimentation.youtubeShorts')}</option>
                    <option value="instagram_reels">{t('pages.experimentation.instagramReels')}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 border-t border-border pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded"
                >{t('pages.experimentation.cancel')}</button>
                <button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded font-medium"
                >{t('pages.experimentation.createDraft')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VARIANT */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" id="create-variant-modal">
          <div className="bg-card border border-border w-full max-w-md rounded-lg shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{t('pages.experimentation.addExperimentVariant')}</h3>
              <button onClick={() => setShowVariantModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVariant} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.variantName')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('pages.experimentation.egTreatmentSuitOutfit')}
                  value={newVarName}
                  onChange={e => setNewVarName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.uniqueVariantKey')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('pages.experimentation.egTreatmentSuit')}
                  value={newVarKey}
                  onChange={e => setNewVarKey(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="isControlCheckbox"
                  checked={newVarIsControl}
                  onChange={e => setNewVarIsControl(e.target.checked)}
                  className="rounded border-border focus:ring-1 focus:ring-primary"
                />
                <label htmlFor="isControlCheckbox" className="font-bold text-muted-foreground">{t('pages.experimentation.setAsControlGroup')}</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">{t('pages.experimentation.digitalHuman')}</label>
                  <select
                    value={newVarDigitalHuman}
                    onChange={e => setNewVarDigitalHuman(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="dh-aurora">{t('pages.experimentation.aurora')}</option>
                    <option value="dh-carter">{t('pages.experimentation.carter')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">{t('pages.experimentation.linkedPromptVersion')}</label>
                  <select
                    value={newVarPrompt}
                    onChange={e => setNewVarPrompt(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="prompt-v1">{t('pages.experimentation.urgencyHookV1')}</option>
                    <option value="prompt-v2">{t('pages.experimentation.aspirationalHookV2')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">{t('pages.experimentation.trafficAllocation00To10')}</label>
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  value={newVarAlloc}
                  onChange={e => setNewVarAlloc(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-border pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowVariantModal(false)}
                  className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded"
                >{t('pages.experimentation.cancel')}</button>
                <button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded font-medium"
                >{t('pages.experimentation.registerVariant')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExperimentationPage;
