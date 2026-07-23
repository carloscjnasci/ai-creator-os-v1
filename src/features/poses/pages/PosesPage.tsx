import { useTranslation } from '@/features/i18n/useTranslation';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Accessibility, PlusCircle, Search } from 'lucide-react';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  POSE_STORAGE_KEY,
  loadPosesFromStorage,
  savePosesToStorage,
} from '@/features/poses/poseStorage';
import type { Pose } from '@/features/poses/types';

const POSE_NAME_MAX_LENGTH = 80;
const POSE_DESCRIPTION_MAX_LENGTH = 400;

const POSE_SORT_OPTIONS = ['newest', 'oldest', 'name-asc', 'name-desc'] as const;
type PoseSortOption = typeof POSE_SORT_OPTIONS[number];

function isValidSortOption(value: string): value is PoseSortOption {
  return POSE_SORT_OPTIONS.includes(value as PoseSortOption);
}

type PoseStorageStatus = 'idle' | 'saving' | 'saved' | 'error';

// Centralized formatDate from useTranslation is used inside the component instead.

function getSafeTimestamp(dateString: string | undefined | null): number {
  if (!dateString) {
    return 0;
  }
  const timestamp = new Date(dateString).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function generateSafeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const timestamp = Date.now();
  const randomVal = Math.floor(Math.random() * 1000000);
  return `${timestamp}-${randomVal}`;
}

export function PosesPage() {
  const { t, formatDate } = useTranslation();
  const formatPoseDate = (value: string | undefined | null): string => {
    if (!value) return '';
    return formatDate(value);
  };
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary States
  const [poses, setPoses] = useState<Pose[]>([]);
  const [hasLoadedStoredPoses, setHasLoadedStoredPoses] = useState(false);
  const [poseStorageStatus, setPoseStorageStatus] = useState<PoseStorageStatus>('idle');
  const [successMessage, setSuccessMessage] = useState('');

  const isApplyingExternalUpdateRef = useRef(false);

  // Creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPoseName, setNewPoseName] = useState('');
  const [newPoseDescription, setNewPoseDescription] = useState('');
  const [newPoseNameError, setNewPoseNameError] = useState('');

  // Editing state
  const [poseBeingEdited, setPoseBeingEdited] = useState<Pose | null>(null);
  const [editPoseName, setEditPoseName] = useState('');
  const [editPoseDescription, setEditPoseDescription] = useState('');
  const [editPoseNameError, setEditPoseNameError] = useState('');

  // Deletion state
  const [poseBeingDeleted, setPoseBeingDeleted] = useState<Pose | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<PoseSortOption>('newest');

  // Initial Load
  useEffect(() => {
    const loadedPoses = loadPosesFromStorage();
    setPoses(loadedPoses);
    setHasLoadedStoredPoses(true);
    setPoseStorageStatus('saved');
  }, []);

  // Automatic Persistence
  useEffect(() => {
    if (!hasLoadedStoredPoses) {
      return;
    }

    if (isApplyingExternalUpdateRef.current) {
      isApplyingExternalUpdateRef.current = false;
      return;
    }

    setPoseStorageStatus('saving');
    const wasSaved = savePosesToStorage(poses);
    setPoseStorageStatus(wasSaved ? 'saved' : 'error');
  }, [poses, hasLoadedStoredPoses]);

  // Tab Synchronization
  useEffect(() => {
    function handlePoseStorageChange(event: StorageEvent) {
      if (
        event.key === POSE_STORAGE_KEY &&
        event.storageArea === window.localStorage
      ) {
        isApplyingExternalUpdateRef.current = true;
        const loadedPoses = loadPosesFromStorage();
        setPoses(loadedPoses);

        setPoseBeingDeleted((pendingPose) => {
          if (!pendingPose) {
            return null;
          }
          const updatedPose = loadedPoses.find((p) => p.id === pendingPose.id);
          if (!updatedPose) {
            setSuccessMessage(t('pages.poses.externalDeleteDeleting'));
            return null;
          }
          return updatedPose;
        });

        setPoseBeingEdited((editingPose) => {
          if (!editingPose) {
            return null;
          }
          const updatedPose = loadedPoses.find((p) => p.id === editingPose.id);
          if (!updatedPose) {
            setEditPoseName('');
            setEditPoseDescription('');
            setEditPoseNameError('');
            setSuccessMessage(t('pages.poses.externalDeleteEditing'));
            return null;
          }
          if (
            updatedPose.name !== editingPose.name ||
            updatedPose.description !== editingPose.description
          ) {
            setEditPoseName('');
            setEditPoseDescription('');
            setEditPoseNameError('');
            setSuccessMessage(t('pages.poses.externalUpdateEditing'));
            return null;
          }
          return updatedPose;
        });

        setPoseStorageStatus('saved');
      }
    }

    window.addEventListener('storage', handlePosePoseStorageChange);
    function handlePosePoseStorageChange(event: StorageEvent) {
      handlePoseStorageChange(event);
    }

    return () => {
      window.removeEventListener('storage', handlePosePoseStorageChange);
    };
  }, []);

  // Action=Create parameter detection
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let shouldReplaceParams = false;

    if (searchParams.get('action') === 'create') {
      openCreatePose();
      newParams.delete('action');
      shouldReplaceParams = true;
    }

    const incomingSearchQuery = searchParams.get('q');

    if (incomingSearchQuery !== null) {
      setSearchTerm(incomingSearchQuery);
      newParams.delete('q');
      shouldReplaceParams = true;
    }

    if (shouldReplaceParams) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Actions creators
  function openCreatePose() {
    setIsCreateModalOpen(true);
    setNewPoseName('');
    setNewPoseDescription('');
    setNewPoseNameError('');
    setSuccessMessage('');
  }

  function closeCreatePose() {
    setIsCreateModalOpen(false);
    setNewPoseName('');
    setNewPoseDescription('');
    setNewPoseNameError('');
  }

  function handleCreatePose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = newPoseName.trim();
    const normalizedDescription = newPoseDescription.trim();

    if (!normalizedName) {
      setNewPoseNameError(t('pages.poses.nameRequired'));
      return;
    }

    if (normalizedName.length > POSE_NAME_MAX_LENGTH) {
      setNewPoseNameError(t('pages.poses.nameTooLong'));
      return;
    }

    const poseAlreadyExists = poses.some(
      (p) => p.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (poseAlreadyExists) {
      setNewPoseNameError(t('pages.poses.duplicateName'));
      return;
    }

    const newPose: Pose = {
      id: generateSafeId(),
      name: normalizedName,
      description: normalizedDescription.slice(0, POSE_DESCRIPTION_MAX_LENGTH),
      createdAt: new Date().toISOString(),
    };

    setPoses((currentPoses) => [newPose, ...currentPoses]);
    setSuccessMessage(t('pages.poses.createdSuccess', { name: normalizedName }));
    closeCreatePose();
  }

  // Editing logic
  function openEditPose(pose: Pose) {
    setPoseBeingEdited(pose);
    setEditPoseName(pose.name);
    setEditPoseDescription(pose.description || '');
    setEditPoseNameError('');
    setSuccessMessage('');
  }

  function closeEditPose() {
    setPoseBeingEdited(null);
    setEditPoseName('');
    setEditPoseDescription('');
    setEditPoseNameError('');
  }

  const hasPoseEditChanges =
    poseBeingEdited !== null &&
    (editPoseName.trim() !== poseBeingEdited.name.trim() ||
      editPoseDescription.trim() !== (poseBeingEdited.description || '').trim());

  function handleEditPose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (poseBeingEdited === null) {
      return;
    }

    if (!hasPoseEditChanges) {
      return;
    }

    const normalizedName = editPoseName.trim();
    const normalizedDescription = editPoseDescription.trim();

    if (!normalizedName) {
      setEditPoseNameError(t('pages.poses.nameRequired'));
      return;
    }

    if (normalizedName.length > POSE_NAME_MAX_LENGTH) {
      setEditPoseNameError(t('pages.poses.nameTooLong'));
      return;
    }

    const poseAlreadyExists = poses.some(
      (p) =>
        p.id !== poseBeingEdited.id &&
        p.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (poseAlreadyExists) {
      setEditPoseNameError(t('pages.poses.duplicateName'));
      return;
    }

    setPoses((currentPoses) =>
      currentPoses.map((p) =>
        p.id === poseBeingEdited.id
          ? {
              ...p,
              name: normalizedName,
              description: normalizedDescription.slice(0, POSE_DESCRIPTION_MAX_LENGTH),
            }
          : p
      )
    );

    setSuccessMessage(t('pages.poses.updatedSuccess', { name: normalizedName }));
    closeEditPose();
  }

  // Deletion logic
  function openDeletePose(pose: Pose) {
    setPoseBeingDeleted(pose);
    setSuccessMessage('');
  }

  // Clear filters
  function handleClearFilters() {
    setSearchTerm('');
    setSortOption('newest');
  }

  function closeDeletePose() {
    setPoseBeingDeleted(null);
  }

  function handleDeletePose() {
    if (poseBeingDeleted === null) {
      return;
    }

    const deletedPoseName = poseBeingDeleted.name;

    setPoses((currentPoses) =>
      currentPoses.filter((p) => p.id !== poseBeingDeleted.id)
    );

    setSuccessMessage(t('pages.poses.deletedSuccess', { name: deletedPoseName }));
    closeDeletePose();
  }

  // Search filtering
  const filteredPoses = searchTerm.trim() === ''
    ? poses
    : poses.filter((pose) =>
        pose.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        pose.description.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );

  // Sorting
  const sortedPoses = [...filteredPoses].sort((a, b) => {
    if (sortOption === 'newest') {
      return getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt);
    }
    if (sortOption === 'oldest') {
      return getSafeTimestamp(a.createdAt) - getSafeTimestamp(b.createdAt);
    }
    if (sortOption === 'name-asc') {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    if (sortOption === 'name-desc') {
      return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
    }
    return 0;
  });

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{t('creativeLibrary.title')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {t('poses.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('poses.description')}
          </p>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {successMessage}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p
            role="status"
            aria-live="polite"
            className={
              poseStorageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {poseStorageStatus === 'idle'
              ? t('pages.poses.initializingPoses')
              : poseStorageStatus === 'saving'
                ? t('pages.poses.savingPoses')
                : poseStorageStatus === 'error'
                  ? t('pages.poses.unableToSavePoses')
                  : t('pages.poses.posesSaved')}
          </p>

          <AppButton type="button" variant="primary" onClick={openCreatePose}>
            <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.poses.createPose')}</AppButton>
        </div>
      </header>

      {/* Overview stats */}
      <section className="mt-8 border-t border-border pt-8">
        <h2 className="sr-only">{t('pages.poses.poseSummary')}</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <AppCard className="rounded-2xl border-border bg-card p-6" shadow>
            <p className="text-sm font-medium text-muted-foreground">{t('pages.poses.totalPoses')}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {poses.length}
            </p>
          </AppCard>
        </div>
      </section>

      {/* Main library listing */}
      <section className="mt-10">
        <div className="border-b border-border pb-5">
          <h2 className="text-xl font-semibold text-foreground">{t('pages.poses.allPoses')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.poses.posesCreatedInYourWorkspaceWillAppearHer')}</p>
        </div>

        {!hasLoadedStoredPoses ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p role="status" className="text-sm text-muted-foreground">{t('pages.poses.loadingPoses')}</p>
          </AppCard>
        ) : poses.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Accessibility
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.poses.noPosesYet')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.poses.createYourFirstReusablePoseToStartBuildi')}</p>
              <AppButton
                type="button"
                variant="primary"
                className="mt-5"
                onClick={openCreatePose}
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.poses.createPose')}</AppButton>
            </div>
          </AppCard>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <AppInput
                  id="search-poses"
                  name="searchTerm"
                  type="search"
                  label={t('pages.poses.searchPoses')}
                  placeholder={t('pages.poses.searchPoses')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  autoComplete="off"
                  fullWidth
                />
              </div>
              <div className="w-full sm:w-48">
                <AppSelect
                  id="sort-poses"
                  label={t('pages.poses.sortPoses')}
                  value={sortOption}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isValidSortOption(value)) {
                      setSortOption(value);
                    }
                  }}
                  options={[
                    { value: 'newest', label: t('pages.poses.sortOption_newest') },
                    { value: 'oldest', label: t('pages.poses.sortOption_oldest') },
                    { value: 'name-asc', label: t('pages.poses.nameAsc') },
                    { value: 'name-desc', label: t('pages.poses.nameDesc') },
                  ]}
                />
              </div>
            </div>

            {filteredPoses.length === 0 && searchTerm.trim() !== '' ? (
              <AppCard
                className="rounded-2xl border-border bg-card p-8 text-center"
                shadow
              >
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <Search
                    aria-hidden="true"
                    className="h-10 w-10 text-muted-foreground"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.poses.noPosesFound')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.poses.tryChangingYourSearchOrSortingOptions')}</p>
                  <AppButton
                    type="button"
                    variant="secondary"
                    className="mt-5"
                    onClick={handleClearFilters}
                  >{t('pages.poses.clearFilters')}</AppButton>
                </div>
              </AppCard>
            ) : (
              <ul
                role="list"
                aria-label={t('pages.poses.poses')}
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              >
                {sortedPoses.map((pose) => {
                  const poseTitleId = `pose-${pose.id}-title`;

                  return (
                    <li key={pose.id}>
                      <AppCard
                        aria-labelledby={poseTitleId}
                        className="rounded-2xl border-border bg-card p-6"
                        shadow
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3
                            id={poseTitleId}
                            className="text-lg font-semibold text-card-foreground"
                          >
                            {pose.name}
                          </h3>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {pose.description ? pose.description : t('pages.poses.noDescriptionProvided')}
                        </p>

                        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                          <p className="text-xs text-muted-foreground">
                            {t('pages.poses.created')}{' '}
                            <time dateTime={pose.createdAt}>
                              {formatPoseDate(pose.createdAt)}
                            </time>
                          </p>
                          <div className="flex items-center gap-2">
                            <AppButton
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditPose(pose)}
                              aria-label={`${t('pages.poses.edit')} ${pose.name}`}
                            >{t('pages.poses.edit')}</AppButton>
                            <AppButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => openDeletePose(pose)}
                              aria-label={`${t('pages.poses.delete')} ${pose.name}`}
                            >{t('pages.poses.delete')}</AppButton>
                          </div>
                        </div>
                      </AppCard>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* CREATE MODAL */}
      <AppModal
        isOpen={isCreateModalOpen}
        onClose={closeCreatePose}
        title={t('pages.poses.createPose')}
      >
        <form onSubmit={handleCreatePose} className="space-y-5">
          <div>
            <AppInput
              id="pose-name"
              name="poseName"
              label={t('pages.poses.poseName')}
              value={newPoseName}
              onChange={(event) => {
                setNewPoseName(event.target.value);
                if (newPoseNameError) {
                  setNewPoseNameError('');
                }
              }}
              errorMessage={newPoseNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={POSE_NAME_MAX_LENGTH}
              placeholder={t('pages.poses.enterPoseName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {newPoseName.length}/{POSE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="pose-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.poses.description')}</label>
            <textarea
              id="pose-description"
              name="poseDescription"
              value={newPoseDescription}
              onChange={(event) => setNewPoseDescription(event.target.value)}
              rows={5}
              maxLength={POSE_DESCRIPTION_MAX_LENGTH}
              placeholder={t('pages.poses.describeThisPose')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">{t('pages.poses.optionalDescribeTheBodyPositionFacialExp')}</span>
              <span className="text-xs text-muted-foreground">
                {newPoseDescription.length}/{POSE_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreatePose}
              className="w-full sm:w-auto"
            >{t('pages.poses.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={!newPoseName.trim()}
              className="w-full sm:w-auto"
            >{t('pages.poses.createPose')}</AppButton>
          </div>
        </form>
      </AppModal>

      {/* EDIT MODAL */}
      <AppModal
        isOpen={poseBeingEdited !== null}
        onClose={closeEditPose}
        title={t('pages.poses.editPose')}
      >
        <form onSubmit={handleEditPose} className="space-y-5">
          <div>
            <AppInput
              id="edit-pose-name"
              name="editPoseName"
              label={t('pages.poses.poseName')}
              value={editPoseName}
              onChange={(event) => {
                setEditPoseName(event.target.value);
                if (editPoseNameError) {
                  setEditPoseNameError('');
                }
              }}
              errorMessage={editPoseNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={POSE_NAME_MAX_LENGTH}
              placeholder={t('pages.poses.enterPoseName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editPoseName.length}/{POSE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-pose-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.poses.description')}</label>
            <textarea
              id="edit-pose-description"
              name="editPoseDescription"
              value={editPoseDescription}
              onChange={(event) => setEditPoseDescription(event.target.value)}
              rows={5}
              maxLength={POSE_DESCRIPTION_MAX_LENGTH}
              placeholder={t('pages.poses.describeThisPose')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">{t('pages.poses.optionalDescribeTheBodyPositionFacialExp')}</span>
              <span className="text-xs text-muted-foreground">
                {editPoseDescription.length}/{POSE_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {hasPoseEditChanges
                ? t('pages.poses.changesReadyToSave')
                : t('pages.poses.makeChangeBeforeSaving')}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AppButton
                type="button"
                variant="outline"
                onClick={closeEditPose}
                className="w-full sm:w-auto"
              >{t('pages.poses.cancel')}</AppButton>
              <AppButton
                type="submit"
                variant="primary"
                disabled={!editPoseName.trim() || !hasPoseEditChanges}
                className="w-full sm:w-auto"
              >{t('pages.poses.saveChanges')}</AppButton>
            </div>
          </div>
        </form>
      </AppModal>

      {/* DELETE MODAL */}
      <AppModal
        isOpen={poseBeingDeleted !== null}
        onClose={closeDeletePose}
        title={t('pages.poses.deletePose')}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {t('pages.poses.deleteConfirmation', { name: poseBeingDeleted?.name })}
          </p>
          <p className="text-xs text-destructive">{t('pages.poses.thisActionCannotBeUndone')}</p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeletePose}
              className="w-full sm:w-auto"
            >{t('pages.poses.cancel')}</AppButton>
            <AppButton
              type="button"
              variant="danger"
              onClick={handleDeletePose}
              className="w-full sm:w-auto"
            >{t('pages.poses.deletePose')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default PosesPage;
