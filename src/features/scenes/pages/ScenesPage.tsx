import { useTranslation } from '@/features/i18n/useTranslation';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Map, PlusCircle, Search } from 'lucide-react';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  SCENE_STORAGE_KEY,
  loadScenesFromStorage,
  saveScenesToStorage,
} from '@/features/scenes/sceneStorage';
import type { Scene } from '@/features/scenes/types';

const SCENE_NAME_MAX_LENGTH = 80;
const SCENE_DESCRIPTION_MAX_LENGTH = 400;

const SCENE_SORT_OPTIONS = ['newest', 'oldest', 'name-asc', 'name-desc'] as const;
type SceneSortOption = typeof SCENE_SORT_OPTIONS[number];

function isValidSortOption(value: string): value is SceneSortOption {
  return SCENE_SORT_OPTIONS.includes(value as SceneSortOption);
}

type SceneStorageStatus = 'idle' | 'saving' | 'saved' | 'error';

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

export function ScenesPage() {
  const { t, formatDate } = useTranslation();
  const formatSceneDate = (value: string | undefined | null): string => {
    if (!value) return '';
    return formatDate(value);
  };
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary States
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hasLoadedStoredScenes, setHasLoadedStoredScenes] = useState(false);
  const [sceneStorageStatus, setSceneStorageStatus] = useState<SceneStorageStatus>('idle');
  const [successMessage, setSuccessMessage] = useState('');

  const isApplyingExternalUpdateRef = useRef(false);

  // Creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [newSceneNameError, setNewSceneNameError] = useState('');

  // Editing state
  const [sceneBeingEdited, setSceneBeingEdited] = useState<Scene | null>(null);
  const [editSceneName, setEditSceneName] = useState('');
  const [editSceneDescription, setEditSceneDescription] = useState('');
  const [editSceneNameError, setEditSceneNameError] = useState('');

  // Deletion state
  const [sceneBeingDeleted, setSceneBeingDeleted] = useState<Scene | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SceneSortOption>('newest');

  // Initial Load
  useEffect(() => {
    const loadedScenes = loadScenesFromStorage();
    setScenes(loadedScenes);
    setHasLoadedStoredScenes(true);
    setSceneStorageStatus('saved');
  }, []);

  // Automatic Persistence
  useEffect(() => {
    if (!hasLoadedStoredScenes) {
      return;
    }

    if (isApplyingExternalUpdateRef.current) {
      isApplyingExternalUpdateRef.current = false;
      return;
    }

    setSceneStorageStatus('saving');
    const wasSaved = saveScenesToStorage(scenes);
    setSceneStorageStatus(wasSaved ? 'saved' : 'error');
  }, [scenes, hasLoadedStoredScenes]);

  // Tab Synchronization
  useEffect(() => {
    function handleSceneStorageChange(event: StorageEvent) {
      if (
        event.key === SCENE_STORAGE_KEY &&
        event.storageArea === window.localStorage
      ) {
        isApplyingExternalUpdateRef.current = true;
        const loadedScenes = loadScenesFromStorage();
        setScenes(loadedScenes);

        setSceneBeingDeleted((pendingScene) => {
          if (!pendingScene) {
            return null;
          }
          const stillExists = loadedScenes.some((s) => s.id === pendingScene.id);
          if (!stillExists) {
            setSuccessMessage(t('pages.scenes.externalDeleteDeleting'));
            return null;
          }
          return pendingScene;
        });

        setSceneBeingEdited((editingScene) => {
          if (!editingScene) {
            return null;
          }
          const updatedScene = loadedScenes.find((s) => s.id === editingScene.id);
          if (!updatedScene) {
            setEditSceneName('');
            setEditSceneDescription('');
            setEditSceneNameError('');
            setSuccessMessage(t('pages.scenes.externalDeleteEditing'));
            return null;
          }
          if (
            updatedScene.name !== editingScene.name ||
            updatedScene.description !== editingScene.description
          ) {
            setEditSceneName('');
            setEditSceneDescription('');
            setEditSceneNameError('');
            setSuccessMessage(t('pages.scenes.externalUpdateEditing'));
            return null;
          }
          return updatedScene;
        });

        setSceneStorageStatus('saved');
      }
    }

    window.addEventListener('storage', handleSceneStorageChange);
    return () => {
      window.removeEventListener('storage', handleSceneStorageChange);
    };
  }, []);

  // Action=Create parameter detection
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let shouldReplaceParams = false;

    if (searchParams.get('action') === 'create') {
      openCreateScene();
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
  function openCreateScene() {
    setIsCreateModalOpen(true);
    setNewSceneName('');
    setNewSceneDescription('');
    setNewSceneNameError('');
    setSuccessMessage('');
  }

  function closeCreateScene() {
    setIsCreateModalOpen(false);
    setNewSceneName('');
    setNewSceneDescription('');
    setNewSceneNameError('');
  }

  function handleCreateScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = newSceneName.trim();
    const normalizedDescription = newSceneDescription.trim();

    if (!normalizedName) {
      setNewSceneNameError(t('pages.scenes.nameRequired'));
      return;
    }

    if (normalizedName.length > SCENE_NAME_MAX_LENGTH) {
      setNewSceneNameError(t('pages.scenes.nameTooLong'));
      return;
    }

    const sceneAlreadyExists = scenes.some(
      (s) => s.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (sceneAlreadyExists) {
      setNewSceneNameError(t('pages.scenes.duplicateName'));
      return;
    }

    const newScene: Scene = {
      id: generateSafeId(),
      name: normalizedName,
      description: normalizedDescription.slice(0, SCENE_DESCRIPTION_MAX_LENGTH),
      createdAt: new Date().toISOString(),
    };

    setScenes((currentScenes) => [newScene, ...currentScenes]);
    setSuccessMessage(t('pages.scenes.createdSuccess', { name: normalizedName }));
    closeCreateScene();
  }

  // Editing logic
  function openEditScene(scene: Scene) {
    setSceneBeingEdited(scene);
    setEditSceneName(scene.name);
    setEditSceneDescription(scene.description || '');
    setEditSceneNameError('');
    setSuccessMessage('');
  }

  function closeEditScene() {
    setSceneBeingEdited(null);
    setEditSceneName('');
    setEditSceneDescription('');
    setEditSceneNameError('');
  }

  const hasSceneEditChanges =
    sceneBeingEdited !== null &&
    (editSceneName.trim() !== sceneBeingEdited.name.trim() ||
      editSceneDescription.trim() !== (sceneBeingEdited.description || '').trim());

  function handleEditScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sceneBeingEdited === null) {
      return;
    }

    if (!hasSceneEditChanges) {
      return;
    }

    const normalizedName = editSceneName.trim();
    const normalizedDescription = editSceneDescription.trim();

    if (!normalizedName) {
      setEditSceneNameError(t('pages.scenes.nameRequired'));
      return;
    }

    if (normalizedName.length > SCENE_NAME_MAX_LENGTH) {
      setEditSceneNameError(t('pages.scenes.nameTooLong'));
      return;
    }

    const sceneAlreadyExists = scenes.some(
      (s) =>
        s.id !== sceneBeingEdited.id &&
        s.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (sceneAlreadyExists) {
      setEditSceneNameError(t('pages.scenes.duplicateName'));
      return;
    }

    setScenes((currentScenes) =>
      currentScenes.map((s) =>
        s.id === sceneBeingEdited.id
          ? {
              ...s,
              name: normalizedName,
              description: normalizedDescription.slice(0, SCENE_DESCRIPTION_MAX_LENGTH),
            }
          : s
      )
    );

    setSuccessMessage(t('pages.scenes.updatedSuccess', { name: normalizedName }));
    closeEditScene();
  }

  // Deletion logic
  function openDeleteScene(scene: Scene) {
    setSceneBeingDeleted(scene);
    setSuccessMessage('');
  }

  function closeDeleteScene() {
    setSceneBeingDeleted(null);
  }

  function handleDeleteScene() {
    if (sceneBeingDeleted === null) {
      return;
    }

    const deletedSceneName = sceneBeingDeleted.name;

    setScenes((currentScenes) =>
      currentScenes.filter((s) => s.id !== sceneBeingDeleted.id)
    );

    setSuccessMessage(t('pages.scenes.deletedSuccess', { name: deletedSceneName }));
    closeDeleteScene();
  }

  // Search filtering
  const filteredScenes = searchTerm.trim() === ''
    ? scenes
    : scenes.filter((scene) =>
        scene.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );

  // Sorting
  const sortedScenes = [...filteredScenes].sort((a, b) => {
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
            {t('scenes.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('scenes.description')}
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
              sceneStorageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {sceneStorageStatus === 'idle'
              ? t('pages.scenes.initializingScenes')
              : sceneStorageStatus === 'saving'
                ? t('pages.scenes.savingScenes')
                : sceneStorageStatus === 'error'
                  ? t('pages.scenes.unableToSaveScenes')
                  : t('pages.scenes.scenesSaved')}
          </p>

          <AppButton type="button" variant="primary" onClick={openCreateScene}>
            <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.scenes.createScene')}</AppButton>
        </div>
      </header>

      <section aria-labelledby="scenes-summary-title" className="mt-10">
        <h2
          id="scenes-summary-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.scenes.sceneSummary')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.scenes.anOverviewOfTheScenesAndEnvironmentsAvai')}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppCard className="rounded-2xl border-border bg-card p-6" shadow>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.scenes.totalScenes')}</p>
                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {scenes.length}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Map aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>
        </div>
      </section>

      <section aria-labelledby="scenes-list-title" className="mt-10">
        <h2
          id="scenes-list-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.scenes.allScenes')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.scenes.scenesCreatedInYourWorkspaceWillAppearHe')}</p>

        {!hasLoadedStoredScenes ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p role="status" className="text-sm text-muted-foreground">{t('pages.scenes.loadingScenes')}</p>
          </AppCard>
        ) : scenes.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Map
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.scenes.noScenesYet')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.scenes.createYourFirstSceneToStartBuildingYourR')}</p>
              <AppButton
                type="button"
                variant="primary"
                className="mt-5"
                onClick={openCreateScene}
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.scenes.createScene')}</AppButton>
            </div>
          </AppCard>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <AppInput
                  id="search-scenes"
                  name="searchTerm"
                  type="search"
                  label={t('pages.scenes.searchScenes')}
                  placeholder={t('pages.scenes.searchBySceneName')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  autoComplete="off"
                  fullWidth
                />
              </div>
              <div className="w-full sm:w-48">
                <AppSelect
                  id="sort-scenes"
                  label={t('pages.scenes.sortScenes')}
                  value={sortOption}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isValidSortOption(value)) {
                      setSortOption(value);
                    }
                  }}
                  options={[
                    { value: 'newest', label: t('pages.scenes.sortOption_newest') },
                    { value: 'oldest', label: t('pages.scenes.sortOption_oldest') },
                    { value: 'name-asc', label: t('pages.scenes.nameAsc') },
                    { value: 'name-desc', label: t('pages.scenes.nameDesc') },
                  ]}
                />
              </div>
            </div>

            {filteredScenes.length === 0 && searchTerm.trim() !== '' ? (
              <AppCard
                className="rounded-2xl border-border bg-card p-8 text-center"
                shadow
              >
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <Search
                    aria-hidden="true"
                    className="h-10 w-10 text-muted-foreground"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.scenes.noScenesFound')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.scenes.tryAnotherSceneName')}</p>
                  <AppButton
                    type="button"
                    variant="secondary"
                    className="mt-5"
                    onClick={() => setSearchTerm('')}
                  >{t('pages.scenes.clearSearch')}</AppButton>
                </div>
              </AppCard>
            ) : (
              <ul
                role="list"
                aria-label={t('pages.scenes.scenes')}
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              >
                {sortedScenes.map((scene) => {
                  const sceneTitleId = `scene-${scene.id}-title`;

                  return (
                    <li key={scene.id}>
                      <AppCard
                        aria-labelledby={sceneTitleId}
                        className="rounded-2xl border-border bg-card p-6"
                        shadow
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3
                            id={sceneTitleId}
                            className="text-lg font-semibold text-card-foreground"
                          >
                            {scene.name}
                          </h3>
                        </div>

                        {scene.description ? (
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {scene.description}
                          </p>
                        ) : null}

                        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                          <p className="text-xs text-muted-foreground">
                            {t('pages.scenes.created')}{' '}
                            <time dateTime={scene.createdAt}>
                              {formatSceneDate(scene.createdAt)}
                            </time>
                          </p>
                          <div className="flex items-center gap-2">
                            <AppButton
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditScene(scene)}
                              aria-label={`${t('pages.scenes.edit')} ${scene.name}`}
                            >{t('pages.scenes.edit')}</AppButton>
                            <AppButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => openDeleteScene(scene)}
                              aria-label={`${t('pages.scenes.delete')} ${scene.name}`}
                            >{t('pages.scenes.delete')}</AppButton>
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
        onClose={closeCreateScene}
        title={t('pages.scenes.createScene')}
      >
        <form onSubmit={handleCreateScene} className="space-y-5">
          <div>
            <AppInput
              id="scene-name"
              name="sceneName"
              label={t('pages.scenes.sceneName')}
              value={newSceneName}
              onChange={(event) => {
                setNewSceneName(event.target.value);
                if (newSceneNameError) {
                  setNewSceneNameError('');
                }
              }}
              errorMessage={newSceneNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={SCENE_NAME_MAX_LENGTH}
              placeholder={t('pages.scenes.enterSceneName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {newSceneName.length}/{SCENE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="scene-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.scenes.description')}</label>
            <textarea
              id="scene-description"
              name="sceneDescription"
              value={newSceneDescription}
              onChange={(event) => setNewSceneDescription(event.target.value)}
              rows={5}
              maxLength={SCENE_DESCRIPTION_MAX_LENGTH}
              placeholder={t('pages.scenes.describeThisSceneOrEnvironment')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">{t('pages.scenes.optionalDescribeTheAtmosphereVisualStyle')}</span>
              <span className="text-xs text-muted-foreground">
                {newSceneDescription.length}/{SCENE_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreateScene}
              className="w-full sm:w-auto"
            >{t('pages.scenes.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={!newSceneName.trim()}
              className="w-full sm:w-auto"
            >{t('pages.scenes.createScene')}</AppButton>
          </div>
        </form>
      </AppModal>

      {/* EDIT MODAL */}
      <AppModal
        isOpen={sceneBeingEdited !== null}
        onClose={closeEditScene}
        title={t('pages.scenes.editScene')}
      >
        <form onSubmit={handleEditScene} className="space-y-5">
          <div>
            <AppInput
              id="edit-scene-name"
              name="editSceneName"
              label={t('pages.scenes.sceneName')}
              value={editSceneName}
              onChange={(event) => {
                setEditSceneName(event.target.value);
                if (editSceneNameError) {
                  setEditSceneNameError('');
                }
              }}
              errorMessage={editSceneNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={SCENE_NAME_MAX_LENGTH}
              placeholder={t('pages.scenes.enterSceneName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editSceneName.length}/{SCENE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-scene-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.scenes.description')}</label>
            <textarea
              id="edit-scene-description"
              name="editSceneDescription"
              value={editSceneDescription}
              onChange={(event) => setEditSceneDescription(event.target.value)}
              rows={5}
              maxLength={SCENE_DESCRIPTION_MAX_LENGTH}
              placeholder={t('pages.scenes.describeThisSceneOrEnvironment')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">{t('pages.scenes.optionalDescribeTheAtmosphereVisualStyle')}</span>
              <span className="text-xs text-muted-foreground">
                {editSceneDescription.length}/{SCENE_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {hasSceneEditChanges
                ? t('pages.scenes.changesReadyToSave')
                : t('pages.scenes.makeChangeBeforeSaving')}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AppButton
                type="button"
                variant="outline"
                onClick={closeEditScene}
                className="w-full sm:w-auto"
              >{t('pages.scenes.cancel')}</AppButton>
              <AppButton
                type="submit"
                variant="primary"
                disabled={!editSceneName.trim() || !hasSceneEditChanges}
                className="w-full sm:w-auto"
              >{t('pages.scenes.saveChanges')}</AppButton>
            </div>
          </div>
        </form>
      </AppModal>

      {/* DELETE MODAL */}
      <AppModal
        isOpen={sceneBeingDeleted !== null}
        onClose={closeDeleteScene}
        title={t('pages.scenes.deleteScene')}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {t('pages.scenes.deleteConfirmation', { name: sceneBeingDeleted?.name })}
          </p>
          <p className="text-xs text-destructive">{t('pages.scenes.thisActionCannotBeUndone')}</p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeleteScene}
              className="w-full sm:w-auto"
            >{t('pages.scenes.cancel')}</AppButton>
            <AppButton
              type="button"
              variant="danger"
              onClick={handleDeleteScene}
              className="w-full sm:w-auto"
            >{t('pages.scenes.deleteScene')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default ScenesPage;
