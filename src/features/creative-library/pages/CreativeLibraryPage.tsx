import { useTranslation } from '@/features/i18n/useTranslation';
import { useMemo, useState, useEffect } from 'react';
import { FileImage, Plus, Search, Filter, GitBranch, ShieldAlert, ArrowRight } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import { createId, loadCreativeWorkspaceSnapshot, publishCreativeEvent } from '@/core';
import { loadCampaignsFromStorage } from '@/features/campaigns/lib/campaignStorage';
import { loadPromptExperiments } from '@/features/prompt-intelligence/lib/promptExperimentStorage';
import { CREATIVE_ASSET_TYPES, type CreativeAsset, type CreativeAssetType } from '../types';
import { loadCreativeAssets, saveCreativeAssets } from '../lib/creativeAssetStorage';
import { loadAssetRecords } from '@/features/asset-pipeline/assetPipelineStorage';
import { LifecycleStatus } from '@/features/asset-pipeline/types';
import { subscribeToCreativeEvents } from '@/core/events/creativeEventBus';

export function CreativeLibraryPage() {
  const { t } = useTranslation();
  const workspace = useMemo(loadCreativeWorkspaceSnapshot, []);
  const campaigns = useMemo(loadCampaignsFromStorage, []);
  const experiments = useMemo(loadPromptExperiments, []);
  
  const [assets, setAssets] = useState<CreativeAsset[]>(loadCreativeAssets);
  const [pipelineRecords, setPipelineRecords] = useState(() => loadAssetRecords());

  // Registration Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<CreativeAssetType>('image');
  const [sourceUrl, setSourceUrl] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [digitalHumanId, setDigitalHumanId] = useState('');
  const [productId, setProductId] = useState('');
  const [wardrobeItemId, setWardrobeItemId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [promptExperimentId, setPromptExperimentId] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [model, setModel] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');

  // Search & Filter state
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCampaignId, setFilterCampaignId] = useState('all');
  const [filterDigitalHumanId, setFilterDigitalHumanId] = useState('all');
  const [filterProductId, setFilterProductId] = useState('all');
  const [filterSceneId, setFilterSceneId] = useState('all');

  // Sync with Event Bus & reload storage updates
  useEffect(() => {
    const handleReload = () => {
      setAssets(loadCreativeAssets());
      setPipelineRecords(loadAssetRecords());
    };

    handleReload();

    // Subscribe to asset pipeline events reactively
    const unsubscribe = subscribeToCreativeEvents((event) => {
      if (event.name.startsWith('asset.')) {
        handleReload();
      }
    });

    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filtered = assets.filter((asset) => {
    // Hide soft-deleted assets immediately
    if (asset.processingStatus === 'deleted') return false;

    const matchesType = filterType === 'all' || asset.type === filterType;
    const matchesCampaign = filterCampaignId === 'all' || asset.campaignId === filterCampaignId;
    const matchesDigitalHuman = filterDigitalHumanId === 'all' || asset.digitalHumanId === filterDigitalHumanId;
    const matchesProduct = filterProductId === 'all' || asset.productId === filterProductId;
    const matchesScene = filterSceneId === 'all' || asset.sceneId === filterSceneId;

    const normalized = query.trim().toLowerCase();
    const matchesQuery = !normalized || [
      asset.name, 
      asset.model, 
      asset.tags.join(' '), 
      asset.id, 
      asset.cloudAssetId || ''
    ].some((value) => value.toLowerCase().includes(normalized));

    return matchesType && matchesCampaign && matchesDigitalHuman && matchesProduct && matchesScene && matchesQuery;
  });

  function saveAsset() {
    if (!name.trim()) { 
      setMessage(t('creativeLibrary.nameRequired')); 
      return; 
    }
    
    const asset: CreativeAsset = { 
      id: createId('asset'), 
      name: name.trim(), 
      type, 
      sourceUrl: sourceUrl.trim(), 
      campaignId: campaignId || undefined, 
      digitalHumanId: digitalHumanId || undefined, 
      productId: productId || undefined, 
      wardrobeItemId: wardrobeItemId || undefined, 
      sceneId: sceneId || undefined, 
      promptExperimentId: promptExperimentId || undefined, 
      promptUsed: promptUsed.trim(), 
      model: model.trim(), 
      tags: tags.split(',').map((item) => item.trim()).filter(Boolean), 
      createdAt: new Date().toISOString() 
    };

    const next = [asset, ...assets];
    if (saveCreativeAssets(next)) { 
      setAssets(next); 
      setName(''); 
      setSourceUrl(''); 
      setPromptUsed(''); 
      setModel(''); 
      setTags(''); 
      setMessage(t('creativeLibrary.assetSaved')); 
      publishCreativeEvent('asset.created', asset); 
    } else {
      setMessage(t('creativeLibrary.unableToSaveAsset'));
    }
  }

  const linkedCount = assets.filter((asset) => asset.campaignId || asset.digitalHumanId || asset.productId).length;
  const modelCount = new Set(assets.map((asset) => asset.model).filter(Boolean)).size;

  return (
    <CosModuleShell eyebrow={t('creativeLibrary.eyebrow')} title={t('creativeLibrary.title')} description={t('creativeLibrary.description')}
    >
      {/* Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label={t('pages.creativeLibrary.assets')} value={assets.filter(a => a.processingStatus !== 'deleted').length} />
        <MetricCard label={t('pages.creativeLibrary.linkedMetadata')} value={linkedCount} detail={t('pages.creativeLibrary.connectedToCampaignOrEntity')} />
        <MetricCard label={t('pages.creativeLibrary.aiModels')} value={modelCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        
        {/* Register Asset Sidebar Form */}
        <AppCard className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">{t('pages.creativeLibrary.registerAsset')}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput label={t('pages.creativeLibrary.name')} fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <AppSelect 
              label={t('pages.creativeLibrary.type')} 
              value={type} 
              onChange={(e) => setType(e.target.value as CreativeAssetType)} 
              options={CREATIVE_ASSET_TYPES.map((val) => ({ value: val, label: val }))} 
            />
          </div>
          <AppInput label={t('pages.creativeLibrary.sourceUrlOrPath')} fullWidth value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          
          <div className="grid gap-4 sm:grid-cols-2">
            <AppSelect 
              label={t('pages.creativeLibrary.campaign')} 
              value={campaignId} 
              onChange={(e) => setCampaignId(e.target.value)} 
              options={[{ value: '', label: t('common.none') }, ...campaigns.map((item) => ({ value: item.id, label: item.name }))]} 
            />
            <AppSelect 
              label={t('pages.creativeLibrary.digitalHuman')} 
              value={digitalHumanId} 
              onChange={(e) => setDigitalHumanId(e.target.value)} 
              options={[{ value: '', label: t('common.none') }, ...workspace.characters.map((item) => ({ value: item.id, label: item.name }))]} 
            />
            <AppSelect 
              label={t('pages.creativeLibrary.product')} 
              value={productId} 
              onChange={(e) => setProductId(e.target.value)} 
              options={[{ value: '', label: t('common.none') }, ...workspace.products.map((item) => ({ value: item.id, label: item.name }))]} 
            />
            <AppSelect 
              label={t('pages.creativeLibrary.wardrobe')} 
              value={wardrobeItemId} 
              onChange={(e) => setWardrobeItemId(e.target.value)} 
              options={[{ value: '', label: t('common.none') }, ...workspace.wardrobe.map((item) => ({ value: item.id, label: item.name }))]} 
            />
            <AppSelect 
              label={t('pages.creativeLibrary.scene')} 
              value={sceneId} 
              onChange={(e) => setSceneId(e.target.value)} 
              options={[{ value: '', label: t('common.none') }, ...workspace.scenes.map((item) => ({ value: item.id, label: item.name }))]} 
            />
            <AppSelect 
              label={t('pages.creativeLibrary.promptVersion')} 
              value={promptExperimentId} 
              onChange={(e) => { 
                const id = e.target.value; 
                setPromptExperimentId(id); 
                const exp = experiments.find((item) => item.id === id); 
                if (exp) { 
                  setPromptUsed(exp.prompt); 
                  setModel(exp.model); 
                } 
              }} 
              options={[{ value: '', label: t('common.none') }, ...experiments.map((item) => ({ value: item.id, label: `${item.name} v${item.version}` }))]} 
            />
          </div>

          <AppInput label={t('pages.creativeLibrary.aiModel')} fullWidth value={model} onChange={(e) => setModel(e.target.value)} />
          <AppTextarea label={t('pages.creativeLibrary.promptUsed')} rows={4} value={promptUsed} onChange={(e) => setPromptUsed(e.target.value)} />
          <AppInput label={t('pages.creativeLibrary.tags')} helperText={t('pages.creativeLibrary.commaSeparated')} fullWidth value={tags} onChange={(e) => setTags(e.target.value)} />
          <AppButton fullWidth onClick={saveAsset}>{t('pages.creativeLibrary.saveAsset')}</AppButton>
          <p aria-live="polite" className="text-xs text-muted-foreground text-center font-medium">{message}</p>
        </AppCard>

        {/* Main Search, Filters and Assets Grid Column */}
        <div className="space-y-4">
          
          {/* Multi-faceted Search and Filters Bar */}
          <AppCard className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <AppInput 
                aria-label={t('pages.creativeLibrary.searchAssets')} 
                fullWidth 
                leftIcon={<Search className="h-4 w-4" />} 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder={t('pages.creativeLibrary.searchAssetsModelTagSha256OrId')} 
              />
              <AppSelect 
                aria-label={t('pages.creativeLibrary.filterByType')} 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)} 
                options={[{ value: 'all', label: t('pages.creativeLibrary.allAssetTypes') }, ...CREATIVE_ASSET_TYPES.map((val) => ({ value: val, label: val }))]} 
              />
            </div>

            {/* Advanced Filters Row */}
            <div className="border-t border-border pt-3.5 grid gap-3 grid-cols-2 sm:grid-cols-4 text-xs">
              <div>
                <label className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" />{t('pages.creativeLibrary.campaign')}</label>
                <select
                  value={filterCampaignId}
                  onChange={(e) => setFilterCampaignId(e.target.value)}
                  className="w-full rounded bg-muted/60 border border-input p-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">{t('pages.creativeLibrary.allCampaigns')}</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" />{t('pages.creativeLibrary.character')}</label>
                <select
                  value={filterDigitalHumanId}
                  onChange={(e) => setFilterDigitalHumanId(e.target.value)}
                  className="w-full rounded bg-muted/60 border border-input p-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">{t('pages.creativeLibrary.allCharacters')}</option>
                  {workspace.characters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" />{t('pages.creativeLibrary.product')}</label>
                <select
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="w-full rounded bg-muted/60 border border-input p-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">{t('pages.creativeLibrary.allProducts')}</option>
                  {workspace.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" />{t('pages.creativeLibrary.scene')}</label>
                <select
                  value={filterSceneId}
                  onChange={(e) => setFilterSceneId(e.target.value)}
                  className="w-full rounded bg-muted/60 border border-input p-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">{t('pages.creativeLibrary.allScenes')}</option>
                  {workspace.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </AppCard>

          {/* Asset List Grid */}
          {filtered.length === 0 ? (
            <AppCard className="p-10 text-center">
              <FileImage className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">{t('pages.creativeLibrary.noMatchingAssetsFound')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('pages.creativeLibrary.tryRelaxingYourSearchTermsOrFilterConstr')}</p>
            </AppCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((asset) => { 
                const campaign = campaigns.find((item) => item.id === asset.campaignId); 
                const human = workspace.characters.find((item) => item.id === asset.digitalHumanId); 
                const product = workspace.products.find((item) => item.id === asset.productId); 
                
                // Pedigree relationships lookup
                const record = pipelineRecords.find(r => r.id === asset.cloudAssetId || r.creativeLibraryAssetId === asset.id);
                const parentRecord = record?.parentAssetId ? pipelineRecords.find(r => r.id === record.parentAssetId) : null;
                const parentLibraryAsset = parentRecord ? assets.find(a => a.cloudAssetId === parentRecord.id || a.id === parentRecord.creativeLibraryAssetId) : null;

                const derivativeRecords = record ? pipelineRecords.filter(r => r.parentAssetId === record.id && r.lifecycleStatus !== LifecycleStatus.DELETED) : [];
                const derivativeLibraryAssets = assets.filter(a => a.processingStatus !== 'deleted' && derivativeRecords.some(dr => dr.id === a.cloudAssetId || dr.creativeLibraryAssetId === a.id));

                return (
                  <AppCard key={asset.id} className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div>
                      {/* Badge and Type */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary uppercase">
                            {asset.type}
                          </span>
                          <h3 className="mt-3 font-bold text-sm text-foreground">{asset.name}</h3>
                          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{t('creativeLibrary.assetId')}: {asset.id}</p>
                        </div>
                        <FileImage className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>

                      {/* Lineage Section to Navigate through Parent-Derivative relationships */}
                      <div className="mt-3.5 pt-3.5 border-t border-border/80 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                          <GitBranch className="h-3 w-3 text-primary" />
                          <span>{t('pages.creativeLibrary.pedigreeRelationshipLineage')}</span>
                        </div>
                        
                        <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-2 font-medium">
                          {/* Parent Link */}
                          <div>
                            <span className="text-[9px] text-muted-foreground block uppercase font-bold">{t('pages.creativeLibrary.parentNode')}</span>
                            {parentLibraryAsset ? (
                              <button
                                onClick={() => setQuery(parentLibraryAsset.id)}
                                className="text-primary hover:underline flex items-center gap-1 mt-0.5 font-semibold text-left max-w-full truncate"
                              >
                                <ArrowRight className="h-3 w-3 rotate-180 text-primary" />
                                <span className="truncate">{parentLibraryAsset.name}</span>
                              </button>
                            ) : asset.cloudAssetId && record?.parentAssetId ? (
                              <span className="text-rose-400 font-mono text-[10px] mt-0.5 block">{t('pages.creativeLibrary.tombstoneParentDeleted')}</span>
                            ) : (
                              <span className="text-muted-foreground text-[10px] mt-0.5 block">{t('pages.creativeLibrary.originalRootNode')}</span>
                            )}
                          </div>

                          {/* Derivatives links */}
                          <div>
                            <span className="text-[9px] text-muted-foreground block uppercase font-bold">{t('pages.creativeLibrary.derivedDerivatives')}</span>
                            {derivativeLibraryAssets.length > 0 ? (
                              <div className="flex flex-col gap-1 mt-1 max-h-[70px] overflow-y-auto">
                                {derivativeLibraryAssets.map(deriv => (
                                  <button
                                    key={deriv.id}
                                    onClick={() => setQuery(deriv.id)}
                                    className="text-primary hover:underline flex items-center gap-1 font-semibold text-left truncate"
                                  >
                                    <GitBranch className="h-3 w-3 shrink-0 text-indigo-400 rotate-180" />
                                    <span className="truncate">{deriv.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[10px] mt-0.5 block">{t('pages.creativeLibrary.noDerivativesGeneratedYet')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Meta info details list */}
                      <dl className="mt-4 space-y-1.5 text-xs">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{t('pages.creativeLibrary.campaign')}</dt>
                          <dd className="text-right font-semibold text-foreground">{campaign?.name ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{t('pages.creativeLibrary.digitalHuman')}</dt>
                          <dd className="text-right font-semibold text-foreground">{human?.name ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{t('pages.creativeLibrary.product')}</dt>
                          <dd className="text-right font-semibold text-foreground">{product?.name ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{t('pages.creativeLibrary.aiModel')}</dt>
                          <dd className="text-right font-mono text-[11px] text-foreground">{asset.model || '—'}</dd>
                        </div>
                        {asset.checksum && (
                          <div className="flex justify-between gap-3 pt-1 border-t border-border/40">
                            <dt className="text-[9px] text-muted-foreground font-mono">SHA-256</dt>
                            <dd className="text-right font-mono text-[10px] text-foreground truncate max-w-[150px]" title={asset.checksum}>
                              {asset.checksum}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div>
                      {/* Tags */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Source Url */}
                      {asset.sourceUrl ? (
                        <p className="mt-3.5 truncate text-[11px] text-primary font-medium" title={asset.sourceUrl}>
                          {asset.sourceUrl}
                        </p>
                      ) : null}
                    </div>
                  </AppCard>
                ); 
              })}
            </div>
          )}
        </div>

      </div>
    </CosModuleShell>
  );
}

export default CreativeLibraryPage;
