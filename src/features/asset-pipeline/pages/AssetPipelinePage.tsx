import { useTranslation } from '@/features/i18n/useTranslation';
import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Search,
  Filter,
  UploadCloud,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  Clock,
  Shield,
  HelpCircle,
  Play,
  RotateCcw,
  XCircle,
  Archive,
  RefreshCw,
  Trash2,
  Lock,
  Compass,
  Link as LinkIcon,
  Copy,
  PlusCircle,
  AlertTriangle,
  Info,
  GitBranch,
  CheckCircle2
} from 'lucide-react';
import { assetPipelineService } from '../assetPipelineService';
import { loadAssetRecords, subscribeToAssetRecords } from '../assetPipelineStorage';
import { AssetType, LifecycleStatus, ProcessingStatus, SourceType } from '../types';
import type { CloudAssetRecord } from '../types';
import { computeSha256 } from '../utils/cryptoUtils';

export function AssetPipelinePage() {
  const { t, formatDate } = useTranslation();
  const [records, setRecords] = useState<CloudAssetRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<LifecycleStatus | 'processing' | 'all'>('all');
  
  // Real file-selection foundation states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<{ name: string; size: number; type: string } | null>(null);

  // Configurable rules
  const mimeAllowlist = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
  ];
  const maxSizeBytes = 100 * 1024 * 1024; // 100MB limit

  // Remote URL form state
  const [urlToImport, setUrlToImport] = useState('');
  
  // Signed URL interactive states
  const [signedUrlResult, setSignedUrlResult] = useState<string | null>(null);
  const [signedUrlExpiry, setSignedUrlExpiry] = useState(3600);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  // Derivative state
  const [derivativeType, setDerivativeType] = useState<AssetType>(AssetType.THUMBNAIL);

  // Subscribe to reactive updates from local storage
  useEffect(() => {
    setRecords(loadAssetRecords());
    const unsubscribe = subscribeToAssetRecords((updatedRecords) => {
      setRecords(updatedRecords);
    });
    return () => unsubscribe();
  }, []);

  const selectedAsset = records.find(r => r.id === selectedAssetId);
  const isDeleted = selectedAsset ? selectedAsset.lifecycleStatus === LifecycleStatus.DELETED : false;
  const isProtected = selectedAsset ? !!(selectedAsset.legalHold || (selectedAsset.retentionUntil && new Date(selectedAsset.retentionUntil) > new Date())) : false;

  // Stats calculation
  const totalBytes = records.reduce((sum, r) => sum + (r.byteSize || 0), 0);
  const totalAssetsCount = records.length;
  const readyAssetsCount = records.filter(r => r.lifecycleStatus === LifecycleStatus.READY).length;
  const processingCount = records.filter(r => r.lifecycleStatus === LifecycleStatus.INGESTING || r.lifecycleStatus === LifecycleStatus.PROCESSING).length;
  const failedCount = records.filter(r => r.lifecycleStatus === LifecycleStatus.FAILED).length;
  const archivedCount = records.filter(r => r.lifecycleStatus === LifecycleStatus.ARCHIVED).length;

  // Helper to format bytes
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Import URL Action
  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlToImport.trim()) return;
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const url = urlToImport.trim();
      setUrlToImport('');
      const record = await assetPipelineService.importRemoteUrl({
        url,
        displayName: url.split('/').pop()?.split('?')[0] || t('pages.assetPipeline.importedUrlAsset'),
        workspaceId: 'default-workspace',
      });
      setSelectedAssetId(record.id);
      setUploadSuccess(t('pages.assetPipeline.urlImportRegistered'));
    } catch (err: any) {
      setUploadError(t('pages.assetPipeline.importFailed', { error: err.message }));
    }
  };

  // Drag-and-drop triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  // Process the in-memory File object
  const processSelectedFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setActiveFile({ name: file.name, size: file.size, type: file.type });

    // Validate MIME type list
    if (!mimeAllowlist.includes(file.type)) {
      setUploadError(t('pages.assetPipeline.unsupportedMimeType', { type: file.type || t('pages.assetPipeline.unknownFileType') }));
      setActiveFile(null);
      return;
    }

    // Validate maximum file size limit
    if (file.size > maxSizeBytes) {
      setUploadError(t('pages.assetPipeline.sizeLimitExceeded', { size: formatBytes(file.size), limit: formatBytes(maxSizeBytes) }));
      setActiveFile(null);
      return;
    }

    try {
      setIsHashing(true);
      // Read file into memory array buffer and compute actual SHA-256 checksum through Web Crypto
      const buffer = await file.arrayBuffer();
      const hashHex = await computeSha256(buffer);
      setIsHashing(false);
      setIsUploading(true);

      const record = await assetPipelineService.registerUserSelectedFile({
        filename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        workspaceId: 'default-workspace',
        checksum: hashHex,
      });

      setSelectedAssetId(record.id);
      setUploadSuccess(t('pages.assetPipeline.metadataRegistered'));

      // Trigger the ingestion worker pipeline
      await assetPipelineService.runMockPipeline(record.id);
      setUploadSuccess(t('pages.assetPipeline.assetIngestedSuccess', { name: file.name }));
    } catch (err: any) {
      setUploadError(t('pages.assetPipeline.processingFailed', { error: err.message }));
    } finally {
      setIsHashing(false);
      setIsUploading(false);
      setActiveFile(null);
    }
  };

  // Get progressive percentage based on active state machine status
  const getProgressPercentage = (asset: CloudAssetRecord) => {
    if (asset.lifecycleStatus === LifecycleStatus.READY) return 100;
    if (asset.lifecycleStatus === LifecycleStatus.FAILED) return 0;
    
    switch (asset.processingStatus) {
      case ProcessingStatus.NOT_STARTED: return 5;
      case ProcessingStatus.VALIDATING: return 15;
      case ProcessingStatus.HASHING: return 35;
      case ProcessingStatus.UPLOADING: return 65;
      case ProcessingStatus.EXTRACTING_METADATA: return 80;
      case ProcessingStatus.GENERATING_PREVIEW: return 95;
      case ProcessingStatus.COMPLETED: return 100;
      default: return 0;
    }
  };

  // Asset action handlers
  const handleRetry = async (id: string) => {
    try {
      setUploadError(null);
      await assetPipelineService.retryFailedIngestion(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await assetPipelineService.cancelActiveIngestion(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await assetPipelineService.archiveAsset(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await assetPipelineService.restoreArchivedAsset(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm(t('pages.assetPipeline.softDeleteConfirmation'))) {
        await assetPipelineService.markAssetDeleted(id);
        if (selectedAssetId === id) {
          setSelectedAssetId(null);
        }
      }
    } catch (err: any) {
      alert(t('pages.assetPipeline.deletionRejected', { error: err.message }));
    }
  };

  const handleRequestSignedUrl = async (id: string) => {
    try {
      const url = await assetPipelineService.requestSignedUrl(id, signedUrlExpiry);
      setSignedUrlResult(url);
      setCopiedUrl(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateDerivative = async (id: string) => {
    try {
      const targetType = derivativeType;
      const cleanMeta = targetType === AssetType.THUMBNAIL 
        ? { width: 160, height: 90, mimeType: 'image/jpeg' }
        : { width: 1920, height: 1080, durationSeconds: selectedAsset?.durationSeconds, mimeType: 'video/mp4' };

      const derivative = await assetPipelineService.createDerivativeAsset(id, {
        displayName: `${selectedAsset?.displayName} (${targetType.toUpperCase()})`,
        assetType: targetType,
        mimeType: cleanMeta.mimeType,
        byteSize: Math.floor((selectedAsset?.byteSize || 1000) * 0.12),
        workspaceId: selectedAsset?.workspaceId,
        campaignId: selectedAsset?.campaignId,
      });

      setSelectedAssetId(derivative.id);
      await assetPipelineService.runMockPipeline(derivative.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = () => {
    if (signedUrlResult) {
      navigator.clipboard.writeText(signedUrlResult);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Lineage navigation queries
  const parentAsset = selectedAsset?.parentAssetId 
    ? records.find(r => r.id === selectedAsset.parentAssetId) 
    : null;

  const derivativeAssets = selectedAsset 
    ? records.filter(r => r.parentAssetId === selectedAsset.id && r.lifecycleStatus !== LifecycleStatus.DELETED) 
    : [];

  // Filter records
  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.originalFilename && rec.originalFilename.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || rec.assetType === typeFilter;

    let matchesTab = true;
    if (activeTab === 'processing') {
      matchesTab = rec.lifecycleStatus === LifecycleStatus.INGESTING || rec.lifecycleStatus === LifecycleStatus.PROCESSING;
    } else if (activeTab !== 'all') {
      matchesTab = rec.lifecycleStatus === activeTab;
    }

    return matchesSearch && matchesType && matchesTab;
  });

  // Get asset-type specific helper visual configuration
  const getAssetTypeConfig = (type: AssetType) => {
    switch (type) {
      case AssetType.IMAGE:
        return { icon: FileImage, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
      case AssetType.VIDEO:
        return { icon: FileVideo, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' };
      case AssetType.AUDIO:
        return { icon: FileAudio, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' };
      case AssetType.DOCUMENT:
        return { icon: FileText, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' };
      default:
        return { icon: FileCode, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6" id="asset-pipeline-dashboard">
      
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" />
              {t('assetPipeline.title')}
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">{t('pages.assetPipeline.activeProductionSandbox')}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.assetPipeline.provideragnosticAssetIngestionPhysicalWe')}</p>
        </div>
      </div>

      {/* Info Warning */}
      <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4 text-sm text-indigo-400 flex items-start gap-3">
        <Info className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-indigo-300">{t('pages.assetPipeline.secureClientIngestion')}</span>{t('pages.assetPipeline.allFileOperationsComputeFullSha256Digest')}</div>
      </div>

      {/* Metrics Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t('pages.assetPipeline.totalIngestedSize')}</span>
          <span className="text-2xl font-bold mt-2 font-mono text-foreground">{formatBytes(totalBytes)}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('pages.assetPipeline.activeCloudSandboxFootprint')}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t('pages.assetPipeline.readyAssets')}</span>
          <span className="text-2xl font-bold mt-2 text-emerald-500">{readyAssetsCount}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('pages.assetPipeline.availableInCreativeLibrary')}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t('pages.assetPipeline.inProcessingQueue')}</span>
          <span className="text-2xl font-bold mt-2 text-indigo-500">{processingCount}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('pages.assetPipeline.hashingTranscodingMetadata')}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t('pages.assetPipeline.failedIngestions')}</span>
          <span className="text-2xl font-bold mt-2 text-rose-500">{failedCount}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('pages.assetPipeline.requiresManualPipelineRetry')}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t('pages.assetPipeline.archivedAssets')}</span>
          <span className="text-2xl font-bold mt-2 text-slate-400">{archivedCount}</span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('pages.assetPipeline.coldStorageBackupFiles')}</span>
        </div>
      </div>

      {/* Trigger Inputs Bento Grid */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-12">
        
        {/* URL Import Box */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />{t('pages.assetPipeline.importAssetFromRemoteUrl')}</h2>
          <form onSubmit={handleImportUrl} className="space-y-3">
            <div>
              <label htmlFor="remote-url" className="sr-only">{t('pages.assetPipeline.remoteUrl')}</label>
              <input
                id="remote-url"
                type="url"
                placeholder="https://images.unsplash.com/photo-1506744038136-46273834b3fb"
                value={urlToImport}
                onChange={(e) => setUrlToImport(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Compass className="h-4 w-4" />{t('pages.assetPipeline.ingestRemoteUrl')}</button>
          </form>
          <div className="text-[11px] text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed">
            <span className="font-semibold text-foreground">{t('pages.assetPipeline.schemaGuard')}</span> {t('pages.assetPipeline.schemaGuardDescription')}
          </div>
        </div>

        {/* Local Real File Selection and Drag-and-Drop Area */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
          <div className="h-full flex flex-col justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <UploadCloud className="h-4 w-4 text-primary" />{t('pages.assetPipeline.secureDraganddropFileLoader')}</h2>

            {/* Error and Success notifications */}
            {uploadError && (
              <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadSuccess && (
              <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Drop Zone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 select-none ${isDragging ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept={mimeAllowlist.join(',')}
              />
              
              {isHashing && (
                <>
                  <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-xs font-semibold text-foreground">{t('pages.assetPipeline.computingSha256Digest')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('pages.assetPipeline.readingPhysicalFileBytesIntoSecureRuntim')}</p>
                </>
              )}
              {!isHashing && isUploading && (
                <>
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-foreground">{t('pages.assetPipeline.ingestingFile', { name: activeFile?.name })}</p>
                  <p className="text-[10px] text-muted-foreground">{t('pages.assetPipeline.streamingCloudStorageChunkBlocks')}</p>
                </>
              )}
              {!isHashing && !isUploading && (
                <>
                  <UploadCloud className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="text-xs font-semibold text-foreground">{t('pages.assetPipeline.dragDropOr')} <span className="text-primary hover:underline">{t('pages.assetPipeline.browseFiles')}</span></p>
                  <p className="text-[10px] text-muted-foreground">{t('pages.assetPipeline.supportedFormatsJpgPngWebpMp4WebmMp3WavP')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Asset Database Section */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* List and Filters Column */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Filters Bar */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              
              {/* Search */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('pages.assetPipeline.searchAssetsByNameExtensionHashId')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-transparent border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">{t('pages.assetPipeline.allAssetTypes')}</option>
                  <option value={AssetType.IMAGE}>{t('pages.assetPipeline.images')}</option>
                  <option value={AssetType.VIDEO}>{t('pages.assetPipeline.videos')}</option>
                  <option value={AssetType.AUDIO}>{t('pages.assetPipeline.audioTracks')}</option>
                  <option value={AssetType.DOCUMENT}>{t('pages.assetPipeline.documents')}</option>
                  <option value={AssetType.OTHER}>{t('pages.assetPipeline.otherFiles')}</option>
                </select>
              </div>
            </div>

            {/* Lifecycle Tabs */}
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {t('pages.assetPipeline.allCount', { count: records.length })}
              </button>
              <button
                onClick={() => setActiveTab(LifecycleStatus.READY)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === LifecycleStatus.READY ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {t('pages.assetPipeline.readyCount', { count: readyAssetsCount })}
              </button>
              <button
                onClick={() => setActiveTab('processing')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'processing' ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {t('pages.assetPipeline.processingCount', { count: processingCount })}
              </button>
              <button
                onClick={() => setActiveTab(LifecycleStatus.FAILED)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === LifecycleStatus.FAILED ? 'bg-rose-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {t('pages.assetPipeline.failedCount', { count: failedCount })}
              </button>
              <button
                onClick={() => setActiveTab(LifecycleStatus.ARCHIVED)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === LifecycleStatus.ARCHIVED ? 'bg-slate-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {t('pages.assetPipeline.archivedCount', { count: archivedCount })}
              </button>
            </div>
          </div>

          {/* Asset Records Listing */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Cloud className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium">{t('pages.assetPipeline.noCloudAssetsFoundMatchingYourCriteria')}</p>
                <p className="text-xs mt-1">{t('pages.assetPipeline.useTheLoaderOrDragFilesToTriggerSecureCl')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[550px] overflow-y-auto">
                {filteredRecords.map((asset) => {
                  const { icon: Icon, color: iconStyle } = getAssetTypeConfig(asset.assetType);
                  const isSelected = asset.id === selectedAssetId;
                  const isProcessing = asset.lifecycleStatus === LifecycleStatus.INGESTING || asset.lifecycleStatus === LifecycleStatus.PROCESSING;
                  
                  // Status Badge Styles
                  let statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      {asset.lifecycleStatus}
                    </span>
                  );
                  if (asset.lifecycleStatus === LifecycleStatus.READY) {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">{t('pages.assetPipeline.ready')}</span>
                    );
                  } else if (isProcessing) {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 animate-pulse">
                        {asset.processingStatus || t('pages.assetPipeline.processing')}
                      </span>
                    );
                  } else if (asset.lifecycleStatus === LifecycleStatus.FAILED) {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-500">{t('pages.assetPipeline.failed')}</span>
                    );
                  } else if (asset.lifecycleStatus === LifecycleStatus.ARCHIVED) {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{t('pages.assetPipeline.archived')}</span>
                    );
                  }

                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setSignedUrlResult(null); // Clear active simulation results
                      }}
                      className={`flex flex-col p-3.5 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-muted/40'}`}
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg border ${iconStyle}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{asset.displayName}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                              <span className="truncate">{asset.id}</span>
                              <span>•</span>
                              <span>{formatBytes(asset.byteSize)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {asset.legalHold && (
                            <span className="p-1 rounded bg-amber-500/10 text-amber-500" title={t('pages.assetPipeline.legalHoldActive')}>
                              <Lock className="h-3 w-3" />
                            </span>
                          )}
                          {statusBadge}
                        </div>
                      </div>

                      {/* Real-time Dynamic Progress Rendering */}
                      {isProcessing && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] text-indigo-400 font-mono">
                            <span>{t('pages.assetPipeline.ingestingStreamChunk')}</span>
                            <span>{getProgressPercentage(asset)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${getProgressPercentage(asset)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Asset Details Sidebar */}
        <div className="lg:col-span-5">
          {selectedAsset ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-6 shadow-sm">
              
              {/* Asset Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border ${getAssetTypeConfig(selectedAsset.assetType).color}`}>
                    {React.createElement(getAssetTypeConfig(selectedAsset.assetType).icon, { className: 'h-5 w-5' })}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-snug">{selectedAsset.displayName}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedAsset.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAssetId(null)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              {/* Ingestion Specs */}
              <div className="space-y-2.5 border-t border-b border-border py-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5 text-muted-foreground" />{t('pages.assetPipeline.sourceType')}</span>
                  <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full text-[10px] uppercase">
                    {selectedAsset.sourceType}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('pages.assetPipeline.originalName')}</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]" title={selectedAsset.originalFilename || t('common.none')}>
                    {selectedAsset.originalFilename || t('common.none')}
                  </span>
                </div>

                {selectedAsset.modelName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('pages.assetPipeline.aiModelDetails')}</span>
                    <span className="font-medium text-foreground text-[11px]">
                      {selectedAsset.modelProvider} ({selectedAsset.modelName})
                    </span>
                  </div>
                )}
              </div>

              {/* Lineage Section for Navigating Pedigrees */}
              <div className="space-y-3">
                <h4 className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                  {t('pages.assetPipeline.lineageRelationshipLogs')}
                </h4>
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3 text-xs">
                  {/* Parent Reference */}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{t('pages.assetPipeline.parentAncestor')}</span>
                    {parentAsset && (
                      <button
                        onClick={() => setSelectedAssetId(parentAsset.id)}
                        className="flex items-center gap-1.5 text-primary hover:underline font-medium text-left w-full truncate"
                      >
                        <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{parentAsset.displayName}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">({parentAsset.id})</span>
                      </button>
                    )}
                    {!parentAsset && selectedAsset.parentAssetId && (
                      <span className="font-mono text-[10px] text-rose-400">
                        {t('pages.assetPipeline.parentTombstoneRemoved', { id: selectedAsset.parentAssetId })}
                      </span>
                    )}
                    {!parentAsset && !selectedAsset.parentAssetId && (
                      <span className="text-muted-foreground">{t('pages.assetPipeline.originalRootNodeNoAncestors')}</span>
                    )}
                  </div>

                  {/* Derivatives Reference */}
                  <div className="flex flex-col gap-1 border-t border-border pt-2.5">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{t('pages.assetPipeline.derivativeDescendants')}</span>
                    {derivativeAssets.length > 0 ? (
                      <div className="space-y-1.5 mt-1">
                        {derivativeAssets.map(deriv => (
                          <button
                            key={deriv.id}
                            onClick={() => setSelectedAssetId(deriv.id)}
                            className="flex items-center gap-1.5 text-primary hover:underline text-left w-full truncate font-medium"
                          >
                            <GitBranch className="h-3.5 w-3.5 text-indigo-400 shrink-0 rotate-180" />
                            <span>{deriv.displayName}</span>
                            <span className="text-[9px] font-mono text-muted-foreground">({deriv.id})</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('pages.assetPipeline.noDerivativesDerivedFromThisNode')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Checksum and Dimensions Metadata */}
              <div className="space-y-3">
                <h4 className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">{t('pages.assetPipeline.verificationMetadata')}</h4>
                <div className="bg-muted/40 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[10px]">{t('pages.assetPipeline.sha256Checksum')}</span>
                    <span className="text-[10px] truncate max-w-[170px] text-foreground font-bold" title={selectedAsset.checksum}>
                      {selectedAsset.checksum || t('pages.assetPipeline.naRemoteUrl')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[10px]">{t('pages.assetPipeline.mimeType')}</span>
                    <span className="text-foreground text-[10px]">{selectedAsset.mimeType || 'N/A'}</span>
                  </div>
                  {(selectedAsset.width || selectedAsset.height) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[10px]">{t('pages.assetPipeline.dimensions')}</span>
                      <span className="text-foreground text-[10px]">{t('pages.assetPipeline.dimensionsValue', { width: selectedAsset.width, height: selectedAsset.height })}</span>
                    </div>
                  )}
                  {selectedAsset.durationSeconds && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[10px]">{t('pages.assetPipeline.duration')}</span>
                      <span className="text-foreground text-[10px]">{selectedAsset.durationSeconds}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Retention Policy details */}
              <div className="space-y-3">
                <h4 className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">{t('pages.assetPipeline.complianceDeletionGuards')}</h4>
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3 text-muted-foreground" />{t('pages.assetPipeline.retentionSchedule')}</span>
                    <span className="font-semibold text-foreground">
                      {selectedAsset.retentionPolicy || t('pages.assetPipeline.noLimitsConfigured')}
                    </span>
                  </div>

                  {selectedAsset.retentionUntil && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />{t('pages.assetPipeline.expiresOn')}</span>
                      <span className="font-mono text-foreground">
                        {formatDate(selectedAsset.retentionUntil)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-border mt-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 text-amber-500" />{t('pages.assetPipeline.activeLegalHold')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${selectedAsset.legalHold ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {selectedAsset.legalHold ? t('pages.assetPipeline.holdActive') : t('pages.assetPipeline.holdNone')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Derivative Generation tools */}
              {selectedAsset.lifecycleStatus === LifecycleStatus.READY && (
                <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3.5">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-4 w-4 text-primary" />{t('pages.assetPipeline.assetDerivativeEngine')}</h4>
                  <div className="flex gap-2">
                    <select
                      value={derivativeType}
                      onChange={(e) => setDerivativeType(e.target.value as AssetType)}
                      className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value={AssetType.THUMBNAIL}>{t('pages.assetPipeline.generateThumbnail')}</option>
                      <option value={AssetType.VIDEO}>{t('pages.assetPipeline.transcodeVideoAd')}</option>
                    </select>
                    <button
                      onClick={() => handleCreateDerivative(selectedAsset.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none"
                    >{t('pages.assetPipeline.trigger')}</button>
                  </div>
                </div>
              )}

              {/* Secure Signed URL generator */}
              {selectedAsset.lifecycleStatus === LifecycleStatus.READY && (
                <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3.5">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <LinkIcon className="h-4 w-4 text-primary" />{t('pages.assetPipeline.interactiveSignedReadUrl')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{t('pages.assetPipeline.expiresIn')}</span>
                      <span className="font-mono">{t('pages.assetPipeline.secondsCount', { count: signedUrlExpiry })}</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="86400"
                      step="60"
                      value={signedUrlExpiry}
                      onChange={(e) => setSignedUrlExpiry(Number(e.target.value))}
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <button
                      onClick={() => handleRequestSignedUrl(selectedAsset.id)}
                      className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary/20 text-xs py-1.5 text-primary font-medium focus:outline-none"
                    >{t('pages.assetPipeline.generateTemporaryUrl')}</button>
                  </div>

                  {signedUrlResult && (
                    <div className="bg-background rounded-lg border border-border p-2 mt-2 space-y-2 font-mono text-[10px]">
                      <p className="truncate text-muted-foreground select-all leading-normal" title={signedUrlResult}>{signedUrlResult}</p>
                      <button
                        onClick={copyToClipboard}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-[10px] border border-border hover:bg-muted text-foreground font-semibold rounded font-sans transition-all"
                      >
                        {copiedUrl ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />{t('pages.assetPipeline.copiedToClipboard')}</>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />{t('pages.assetPipeline.copySignedUrl')}</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* State Transitions Actions Block */}
              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">{t('pages.assetPipeline.complianceStateActions')}</h4>
                
                <div className="flex flex-col gap-2">
                  
                  {/* Retry */}
                  {selectedAsset.lifecycleStatus === LifecycleStatus.FAILED && (
                    <button
                      onClick={() => handleRetry(selectedAsset.id)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />{t('pages.assetPipeline.retryFailedIngestionPipeline')}</button>
                  )}

                  {/* Cancel */}
                  {(selectedAsset.lifecycleStatus === LifecycleStatus.INGESTING || selectedAsset.lifecycleStatus === LifecycleStatus.PROCESSING) && (
                    <button
                      onClick={() => handleCancel(selectedAsset.id)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none"
                    >
                      <XCircle className="h-3.5 w-3.5" />{t('pages.assetPipeline.abortActiveIngestionStream')}</button>
                  )}

                  {/* Archive */}
                  {selectedAsset.lifecycleStatus === LifecycleStatus.READY && (
                    <button
                      onClick={() => handleArchive(selectedAsset.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 text-xs text-foreground font-semibold hover:bg-muted focus:outline-none"
                    >
                      <Archive className="h-3.5 w-3.5" />{t('pages.assetPipeline.archiveActiveAssetColdStorage')}</button>
                  )}

                  {/* Restore */}
                  {selectedAsset.lifecycleStatus === LifecycleStatus.ARCHIVED && (
                    <button
                      onClick={() => handleRestore(selectedAsset.id)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />{t('pages.assetPipeline.restoreAssetToActiveLibrary')}</button>
                  )}

                  {/* Delete Button (Enforces Legal Hold & Retention blocks) */}
                   {!isDeleted && isProtected && (
                     <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-500/90 leading-relaxed space-y-1">
                       <div className="flex items-center gap-1.5 font-bold">
                         <Lock className="h-3.5 w-3.5 shrink-0" />
                         <span>{t('pages.assetPipeline.deletionComplianceGuardLocked')}</span>
                       </div>
                       <p>{t('pages.assetPipeline.thisAssetIsCurrentlyProtectedFromSoftdel')}</p>
                     </div>
                   )}

                   {!isDeleted && !isProtected && (
                     <button
                       onClick={() => handleDelete(selectedAsset.id)}
                       className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs text-rose-500 font-semibold focus:outline-none transition-colors"
                     >
                       <Trash2 className="h-3.5 w-3.5" />{t('pages.assetPipeline.softDeleteTombstonePreserved')}</button>
                   )}

                </div>
              </div>

            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card">
              <Compass className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-xs font-medium">{t('pages.assetPipeline.selectACloudAssetToExploreMetadataDetail')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AssetPipelinePage;
