import { useTranslation } from '@/features/i18n/useTranslation';

import type { FormEvent } from 'react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  PlusCircle,
  User,
  Users,
} from 'lucide-react';

import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';

import {
  loadCharactersFromStorage,
  saveCharactersToStorage,
  subscribeToCharacterStorage,
} from '@/features/characters/lib/characterStorage';
import type { Character } from '@/features/characters/types';

type CharacterStorageStatus = 'loading' | 'saving' | 'saved' | 'error';
type CharacterSortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const CHARACTER_NAME_MAX_LENGTH = 80;
const CHARACTER_DESCRIPTION_MAX_LENGTH = 400;

export function CharactersPage() {
  const { t, formatDate } = useTranslation();
  const formatCharacterDate = (date: string): string => {
    return formatDate(date);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [
    hasLoadedStoredCharacters,
    setHasLoadedStoredCharacters,
  ] = useState(false);
  const [
    characterStorageStatus,
    setCharacterStorageStatus,
  ] = useState<CharacterStorageStatus>('loading');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] =
    useState<CharacterSortOption>('newest');
  const [characterBeingEdited, setCharacterBeingEdited] =
    useState<Character | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const [
    characterPendingDeletion,
    setCharacterPendingDeletion,
  ] = useState<Character | null>(null);
  const externalCharacterSnapshotRef =
    useRef<string | null>(null);

  useEffect(() => {
    const storedCharacters = loadCharactersFromStorage();

    setCharacters(storedCharacters);
    setHasLoadedStoredCharacters(true);
    setCharacterStorageStatus('saved');
  }, []);

  useEffect(() => {
    return subscribeToCharacterStorage(
      (storedCharacters) => {
        externalCharacterSnapshotRef.current =
          JSON.stringify(storedCharacters);

        setCharacters(storedCharacters);

        setCharacterPendingDeletion((pendingCharacter) => {
          if (!pendingCharacter) {
            return null;
          }

          return (
            storedCharacters.find(
              (character) =>
                character.id === pendingCharacter.id,
            ) ?? null
          );
        });

        setCharacterBeingEdited((editingCharacter) => {
          if (!editingCharacter) {
            return null;
          }

          const updatedCharacter = storedCharacters.find(
            (character) =>
              character.id === editingCharacter.id,
          );

          if (!updatedCharacter) {
            setEditName('');
            setEditDescription('');
            setEditNameError('');
            return null;
          }

          setEditName(updatedCharacter.name);
          setEditDescription(updatedCharacter.description);
          setEditNameError('');

          return updatedCharacter;
        });

        setCharacterStorageStatus('saved');
        setSuccessMessage(
          t('pages.characters.synchronizedAnotherTab'),
        );
      },
    );
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredCharacters) {
      return;
    }

    const serializedCharacters =
      JSON.stringify(characters);

    if (
      externalCharacterSnapshotRef.current ===
      serializedCharacters
    ) {
      externalCharacterSnapshotRef.current = null;
      return;
    }

    externalCharacterSnapshotRef.current = null;

    const wasSaved = saveCharactersToStorage(characters);

    setCharacterStorageStatus(
      wasSaved ? 'saved' : 'error',
    );
  }, [characters, hasLoadedStoredCharacters]);

  const totalCharacters = characters.length;
  const readyCharacters = characters.length;
  const hasCharacterEditChanges =
    characterBeingEdited !== null &&
    (editName.trim() !== characterBeingEdited.name.trim() ||
      editDescription.trim() !==
        characterBeingEdited.description.trim());

  const normalizedSearchQuery =
    searchQuery.trim().toLocaleLowerCase();

  const filteredCharacters = characters.filter(
    (character) =>
      !normalizedSearchQuery ||
      character.name
        .toLocaleLowerCase()
        .includes(normalizedSearchQuery) ||
      character.description
        .toLocaleLowerCase()
        .includes(normalizedSearchQuery),
  );

  const sortedCharacters = [...filteredCharacters].sort(
    (firstCharacter, secondCharacter) => {
      if (sortOption === 'oldest') {
        return (
          new Date(firstCharacter.createdAt).getTime() -
          new Date(secondCharacter.createdAt).getTime()
        );
      }

      if (sortOption === 'name-asc') {
        return firstCharacter.name.localeCompare(
          secondCharacter.name,
          undefined,
          { sensitivity: 'base' },
        );
      }

      if (sortOption === 'name-desc') {
        return secondCharacter.name.localeCompare(
          firstCharacter.name,
          undefined,
          { sensitivity: 'base' },
        );
      }

      return (
        new Date(secondCharacter.createdAt).getTime() -
        new Date(firstCharacter.createdAt).getTime()
      );
    },
  );

  const hasActiveCharacterControls =
    searchQuery.trim().length > 0 || sortOption !== 'newest';

  function resetCharacterControls() {
    setSearchQuery('');
    setSortOption('newest');
  }

  function openCreateModal() {
    setNameError('');
    setSuccessMessage('');
    setIsCreateModalOpen(true);
  }

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let shouldReplaceParams = false;

    if (searchParams.get('action') === 'create') {
      openCreateModal();
      newParams.delete('action');
      shouldReplaceParams = true;
    }

    const incomingSearchQuery = searchParams.get('q');

    if (incomingSearchQuery !== null) {
      setSearchQuery(incomingSearchQuery);
      newParams.delete('q');
      shouldReplaceParams = true;
    }

    if (shouldReplaceParams) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setName('');
    setDescription('');
    setNameError('');
  }

  function openEditCharacter(character: Character) {
    setCharacterBeingEdited(character);
    setEditName(character.name);
    setEditDescription(character.description);
    setEditNameError('');
    setSuccessMessage('');
  }

  function closeEditCharacter() {
    setCharacterBeingEdited(null);
    setEditName('');
    setEditDescription('');
    setEditNameError('');
  }

  function openDeleteConfirmation(character: Character) {
    setCharacterPendingDeletion(character);
    setSuccessMessage('');
  }

  function closeDeleteConfirmation() {
    setCharacterPendingDeletion(null);
  }

  function confirmDeleteCharacter() {
    if (!characterPendingDeletion) {
      return;
    }

    const deletedCharacterName =
      characterPendingDeletion.name;

    if (
      characterBeingEdited?.id ===
      characterPendingDeletion.id
    ) {
      closeEditCharacter();
    }

    setCharacters((currentCharacters) =>
      currentCharacters.filter(
        (character) =>
          character.id !== characterPendingDeletion.id,
      ),
    );

    setSuccessMessage(
      t('pages.characters.deletedSuccess', { name: deletedCharacterName }),
    );

    closeDeleteConfirmation();
  }

  function handleEditCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!characterBeingEdited) {
      return;
    }

    const normalizedEditName = editName.trim();
    const normalizedEditDescription = editDescription.trim();

    if (!hasCharacterEditChanges) {
      return;
    }

    if (!normalizedEditName) {
      setEditNameError(t('pages.characters.nameRequired'));
      return;
    }

    if (normalizedEditName.length > CHARACTER_NAME_MAX_LENGTH) {
      setEditNameError(
        t('pages.characters.nameTooLong', { max: CHARACTER_NAME_MAX_LENGTH }),
      );
      return;
    }

    const characterAlreadyExists = characters.some(
      (character) =>
        character.id !== characterBeingEdited.id &&
        character.name.toLocaleLowerCase() ===
          normalizedEditName.toLocaleLowerCase(),
    );

    if (characterAlreadyExists) {
      setEditNameError(t('pages.characters.duplicateName'));
      return;
    }

    setCharacters((currentCharacters) =>
      currentCharacters.map((character) =>
        character.id === characterBeingEdited.id
          ? {
              ...character,
              name: normalizedEditName,
              description: normalizedEditDescription.slice(
                0,
                CHARACTER_DESCRIPTION_MAX_LENGTH,
              ),
            }
          : character,
      ),
    );

    setSuccessMessage(
      t('pages.characters.updatedSuccess', { name: normalizedEditName }),
    );

    closeEditCharacter();
  }

  function handleCreateCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      setNameError(t('pages.characters.nameRequired'));
      return;
    }

    if (normalizedName.length > CHARACTER_NAME_MAX_LENGTH) {
      setNameError(
        t('pages.characters.nameTooLong', { max: CHARACTER_NAME_MAX_LENGTH }),
      );
      return;
    }

    const characterAlreadyExists = characters.some(
      (character) =>
        character.name.toLocaleLowerCase() ===
        normalizedName.toLocaleLowerCase(),
    );

    if (characterAlreadyExists) {
      setNameError(t('pages.characters.duplicateName'));
      return;
    }

    const newCharacter: Character = {
      id: `${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription.slice(
        0,
        CHARACTER_DESCRIPTION_MAX_LENGTH,
      ),
      createdAt: new Date().toISOString(),
    };

    setCharacters((currentCharacters) => [
      newCharacter,
      ...currentCharacters,
    ]);

    setSuccessMessage(
      t('pages.characters.createdSuccess', { name: normalizedName }),
    );

    closeCreateModal();
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {t('creativeLibrary.title')}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {t('characters.title')}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('characters.description')}
          </p>

          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {successMessage}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p
            role="status"
            aria-live="polite"
            className={
              characterStorageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {characterStorageStatus === 'loading'
              ? t('pages.characters.loadingSaved')
              : characterStorageStatus === 'error'
                ? t('pages.characters.unableToSave')
                : t('pages.characters.savedInBrowser')}
          </p>

          <AppButton
            type="button"
            variant="primary"
            onClick={openCreateModal}
          >
            <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.characters.newCharacter')}</AppButton>
        </div>
      </header>

      <section
        aria-labelledby="character-summary-title"
        className="mt-10"
      >
        <h2
          id="character-summary-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.characters.characterSummary')}</h2>

        <p className="mt-1 text-sm text-muted-foreground">{t('pages.characters.anOverviewOfTheCharactersAvailableInYour')}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppCard
            className="rounded-2xl border-border bg-card p-6"
            shadow
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.characters.totalCharacters')}</p>

                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {totalCharacters}
                </p>
              </div>

              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Users aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>

          <AppCard
            className="rounded-2xl border-border bg-card p-6"
            shadow
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.characters.readyToUse')}</p>

                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {readyCharacters}
                </p>
              </div>

              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <User aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>
        </div>
      </section>

      <section
        aria-labelledby="characters-list-title"
        className="mt-10"
      >
        <h2
          id="characters-list-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.characters.allCharacters')}</h2>

        <p className="mt-1 text-sm text-muted-foreground">{t('pages.characters.charactersCreatedInYourWorkspaceWillAppe')}</p>

        <p
          aria-live="polite"
          className="mt-2 text-xs font-medium text-muted-foreground"
        >
          {totalCharacters === 1
            ? t('pages.characters.oneCharacterInWorkspace')
            : t('pages.characters.charactersInWorkspace', { count: totalCharacters })}
        </p>

        {hasLoadedStoredCharacters ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <AppInput
                id="character-search"
                name="characterSearch"
                label={t('pages.characters.searchCharacters')}
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder={t('pages.characters.searchByNameOrDescription')}
                autoComplete="off"
                aria-describedby={
                  characters.length > 0
                    ? 'character-results-count'
                    : undefined
                }
                fullWidth
              />

              <div>
                <label
                  htmlFor="character-sort"
                  className="mb-2 block text-sm font-medium text-foreground"
                >{t('pages.characters.sortBy')}</label>

                <select
                  id="character-sort"
                  name="characterSort"
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(
                      event.target.value as CharacterSortOption,
                    )
                  }
                  aria-describedby={
                    characters.length > 0
                      ? 'character-results-count'
                      : undefined
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="newest">{t('pages.characters.newestFirst')}</option>
                  <option value="oldest">{t('pages.characters.oldestFirst')}</option>
                  <option value="name-asc">{t('pages.characters.nameAsc')}</option>
                  <option value="name-desc">{t('pages.characters.nameDesc')}</option>
                </select>
              </div>
            </div>

            {hasActiveCharacterControls ? (
              <div className="mt-4 flex justify-end">
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetCharacterControls}
                >{t('pages.characters.resetControls')}</AppButton>
              </div>
            ) : null}

            {characters.length > 0 ? (
              <p
                id="character-results-count"
                aria-live="polite"
                aria-atomic="true"
                className="mt-3 text-xs text-muted-foreground"
              >
                {filteredCharacters.length === 1
                  ? t('pages.characters.oneCharacterMatches')
                  : t('pages.characters.charactersMatch', { count: filteredCharacters.length })}
              </p>
            ) : null}
          </>
        ) : null}

        {!hasLoadedStoredCharacters ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p
              role="status"
              className="text-sm text-muted-foreground"
            >{t('pages.characters.loadingCharacters')}</p>
          </AppCard>
        ) : characters.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <User
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />

              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.characters.noCharactersYet')}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.characters.createYourFirstReusableCharacterToMainta')}</p>

              <AppButton
                type="button"
                variant="primary"
                className="mt-5"
                onClick={openCreateModal}
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.characters.newCharacter')}</AppButton>
            </div>
          </AppCard>
        ) : filteredCharacters.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <User
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />

              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.characters.noMatchingCharacters')}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.characters.tryUsingADifferentNameOrDescription')}</p>

              <AppButton
                type="button"
                variant="outline"
                className="mt-5"
                onClick={resetCharacterControls}
              >{t('pages.characters.resetControls')}</AppButton>
            </div>
          </AppCard>
        ) : (
          <ul
            role="list"
            aria-label={t('pages.characters.characters')}
            className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            {sortedCharacters.map((character) => {
              const characterTitleId =
                `character-${character.id}-title`;

              return (
                <li key={character.id}>
                  <AppCard
                    aria-labelledby={characterTitleId}
                    className="rounded-2xl border-border bg-card p-6"
                    shadow
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        id={characterTitleId}
                        className="text-lg font-semibold text-card-foreground"
                      >
                        {character.name}
                      </h3>

                      <AppBadge variant="success" size="sm">{t('pages.characters.ready')}</AppBadge>
                    </div>

                    {character.description ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {character.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-muted-foreground">{t('pages.characters.noDescriptionProvided')}</p>
                    )}

                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      <AppButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditCharacter(character)}
                        aria-label={`${t('pages.characters.edit')} ${character.name}`}
                      >{t('pages.characters.edit')}</AppButton>

                      <AppButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openDeleteConfirmation(character)
                        }
                        aria-label={`${t('pages.characters.delete')} ${character.name}`}
                      >{t('pages.characters.delete')}</AppButton>
                    </div>

                    <p className="mt-5 text-xs text-muted-foreground">
                      {t('pages.characters.created')}{' '}
                      <time dateTime={character.createdAt}>
                        {formatCharacterDate(character.createdAt)}
                      </time>
                    </p>
                  </AppCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={t('pages.characters.createCharacter')}
      >
        <form
          onSubmit={handleCreateCharacter}
          className="space-y-5"
        >
          <div>
            <AppInput
              id="character-name"
              name="characterName"
              label={t('pages.characters.characterName')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);

                if (nameError) {
                  setNameError('');
                }
              }}
              errorMessage={nameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={CHARACTER_NAME_MAX_LENGTH}
              placeholder={t('pages.characters.exampleSofiaLifestyleCreator')}
            />

            <p className="mt-1 text-right text-xs text-muted-foreground">
              {name.length}/{CHARACTER_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="character-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.characters.description')}</label>

            <textarea
              id="character-description"
              name="characterDescription"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={5}
              maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
              aria-describedby="character-description-help character-description-count"
              placeholder={t('pages.characters.describeAppearancePersonalityStyleAndCre')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />

            <p
              id="character-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.characters.optionalAddDetailsThatHelpMaintainConsis')}</p>

            <p
              id="character-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {description.length}/{CHARACTER_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="w-full sm:w-auto"
            >{t('pages.characters.cancel')}</AppButton>

            <AppButton
              type="submit"
              variant="primary"
              disabled={!name.trim()}
              className="w-full sm:w-auto"
            >{t('pages.characters.createCharacter')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={characterBeingEdited !== null}
        onClose={closeEditCharacter}
        title={t('pages.characters.editCharacter')}
      >
        <form
          onSubmit={handleEditCharacter}
          className="space-y-5"
        >
          <p className="text-sm leading-6 text-muted-foreground">{t('pages.characters.updateTheCharacterNameAndDescription')}</p>

          <div>
            <AppInput
              id="edit-character-name"
              name="editCharacterName"
              label={t('pages.characters.characterName')}
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);

                if (editNameError) {
                  setEditNameError('');
                }
              }}
              errorMessage={editNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={CHARACTER_NAME_MAX_LENGTH}
              placeholder={t('pages.characters.exampleSofiaLifestyleCreator')}
            />

            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editName.length}/{CHARACTER_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-character-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.characters.description')}</label>

            <textarea
              id="edit-character-description"
              name="editCharacterDescription"
              value={editDescription}
              onChange={(event) =>
                setEditDescription(event.target.value)
              }
              rows={5}
              maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
              aria-describedby="edit-character-description-help edit-character-description-count"
              placeholder={t('pages.characters.describeAppearancePersonalityStyleAndCre')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />

            <p
              id="edit-character-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.characters.optionalAddDetailsThatHelpMaintainConsis')}</p>

            <p
              id="edit-character-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {editDescription.length}/
              {CHARACTER_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <p
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {hasCharacterEditChanges
              ? t('pages.characters.readyToSave')
              : t('pages.characters.noChanges')}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeEditCharacter}
              className="w-full sm:w-auto"
            >{t('pages.characters.cancel')}</AppButton>

            <AppButton
              type="submit"
              variant="primary"
              disabled={!editName.trim() || !hasCharacterEditChanges}
              className="w-full sm:w-auto"
            >{t('pages.characters.saveChanges')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={characterPendingDeletion !== null}
        onClose={closeDeleteConfirmation}
        title={t('pages.characters.deleteCharacter')}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {t('pages.characters.deleteConfirmationPrefix')}{' '}
            <strong className="font-semibold text-foreground">
              {characterPendingDeletion?.name}
            </strong>{t('pages.characters.ThisActionCannotBeUndone')}</p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeleteConfirmation}
              className="w-full sm:w-auto"
            >{t('pages.characters.cancel')}</AppButton>

            <AppButton
              type="button"
              variant="primary"
              onClick={confirmDeleteCharacter}
              className="w-full sm:w-auto"
            >{t('pages.characters.deleteCharacter')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default CharactersPage;
