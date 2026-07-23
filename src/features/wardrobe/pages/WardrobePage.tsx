import { useTranslation } from '@/features/i18n/useTranslation';
import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shirt, Calendar } from 'lucide-react';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import type { WardrobeItem } from '@/features/wardrobe/types';
import {
  loadWardrobeItemsFromStorage,
  saveWardrobeItemsToStorage,
  WARDROBE_STORAGE_KEY,
} from '@/features/wardrobe/wardrobeStorage';

type WardrobeStorageStatus = 'idle' | 'saving' | 'saved' | 'error';

const WARDROBE_NAME_MAX_LENGTH = 80;
const WARDROBE_DESCRIPTION_MAX_LENGTH = 400;

export function WardrobePage() {
  const { t, formatDate } = useTranslation();
  const formatWardrobeDate = (date: string): string => {
    return formatDate(date);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [hasLoadedStoredItems, setHasLoadedStoredItems] = useState(false);
  const [wardrobeStorageStatus, setWardrobeStorageStatus] =
    useState<WardrobeStorageStatus>('idle');

  // Create item states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemNameError, setNewItemNameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit item states
  const [wardrobeItemBeingEdited, setWardrobeItemBeingEdited] =
    useState<WardrobeItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemNameError, setEditItemNameError] = useState('');

  // Delete item states
  const [wardrobeItemBeingDeleted, setWardrobeItemBeingDeleted] =
    useState<WardrobeItem | null>(null);

  // External update ref
  const isApplyingExternalUpdateRef = useRef(false);

  // Search and Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');

  const filteredWardrobeItems = wardrobeItems.filter((item) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return true;
    }
    return item.name.toLowerCase().includes(normalizedSearch);
  });

  const sortedWardrobeItems = [...filteredWardrobeItems].sort((a, b) => {
    if (sortOption === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortOption === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOption === 'name-asc') {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    if (sortOption === 'name-desc') {
      return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
    }
    return 0;
  });

  // Helper functions to open and close creation view
  const openCreateWardrobeItem = () => {
    setIsCreateModalOpen(true);
    setNewItemName('');
    setNewItemDescription('');
    setNewItemNameError('');
    setSuccessMessage('');
  };

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let shouldReplaceParams = false;

    if (searchParams.get('action') === 'create') {
      openCreateWardrobeItem();
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

  const closeCreateWardrobeItem = () => {
    setIsCreateModalOpen(false);
    setNewItemName('');
    setNewItemDescription('');
    setNewItemNameError('');
  };

  const openEditWardrobeItem = (item: WardrobeItem) => {
    setWardrobeItemBeingEdited(item);
    setEditItemName(item.name);
    setEditItemDescription(item.description);
    setEditItemNameError('');
    setSuccessMessage('');
  };

  const closeEditWardrobeItem = () => {
    setWardrobeItemBeingEdited(null);
    setEditItemName('');
    setEditItemDescription('');
    setEditItemNameError('');
  };

  const openDeleteWardrobeItem = (item: WardrobeItem) => {
    setWardrobeItemBeingDeleted(item);
    setSuccessMessage('');
  };

  const closeDeleteWardrobeItem = () => {
    setWardrobeItemBeingDeleted(null);
  };

  const handleDeleteWardrobeItem = () => {
    if (wardrobeItemBeingDeleted === null) {
      return;
    }

    const itemName = wardrobeItemBeingDeleted.name;

    setWardrobeItems((currentItems) =>
      currentItems.filter((item) => item.id !== wardrobeItemBeingDeleted.id)
    );

    setSuccessMessage(t('pages.wardrobe.itemDeletedSuccess', { name: itemName }));
    closeDeleteWardrobeItem();
  };

  const hasWardrobeItemEditChanges =
    wardrobeItemBeingEdited !== null &&
    (editItemName.trim() !== wardrobeItemBeingEdited.name.trim() ||
      editItemDescription.trim() !== wardrobeItemBeingEdited.description.trim());

  const handleEditWardrobeItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (wardrobeItemBeingEdited === null) {
      return;
    }
    if (!hasWardrobeItemEditChanges) {
      return;
    }

    const editedItemName = editItemName.trim();
    const editedItemDescription = editItemDescription.trim();

    if (!editedItemName) {
      setEditItemNameError(t('pages.wardrobe.itemNameRequired'));
      return;
    }

    if (editedItemName.length > WARDROBE_NAME_MAX_LENGTH) {
      setEditItemNameError(t('pages.wardrobe.itemNameTooLong'));
      return;
    }

    const itemAlreadyExists = wardrobeItems.some(
      (item) =>
        item.id !== wardrobeItemBeingEdited.id &&
        item.name.toLowerCase() === editedItemName.toLowerCase()
    );

    if (itemAlreadyExists) {
      setEditItemNameError(t('pages.wardrobe.duplicateItemName'));
      return;
    }

    setWardrobeItems((currentItems) =>
      currentItems.map((item) =>
        item.id === wardrobeItemBeingEdited.id
          ? {
              ...item,
              name: editedItemName,
              description: editedItemDescription.slice(0, WARDROBE_DESCRIPTION_MAX_LENGTH),
            }
          : item
      )
    );

    setSuccessMessage(t('pages.wardrobe.itemUpdatedSuccess', { name: editedItemName }));
    closeEditWardrobeItem();
  };

  const handleCreateWardrobeItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = newItemName.trim();
    const normalizedDescription = newItemDescription.trim();

    if (!normalizedName) {
      setNewItemNameError(t('pages.wardrobe.itemNameRequired'));
      return;
    }

    if (normalizedName.length > WARDROBE_NAME_MAX_LENGTH) {
      setNewItemNameError(t('pages.wardrobe.itemNameTooLong'));
      return;
    }

    const itemAlreadyExists = wardrobeItems.some(
      (item) => item.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (itemAlreadyExists) {
      setNewItemNameError(t('pages.wardrobe.duplicateItemName'));
      return;
    }

    const newItem: WardrobeItem = {
      id: `${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription.slice(0, WARDROBE_DESCRIPTION_MAX_LENGTH),
      createdAt: new Date().toISOString(),
    };

    setWardrobeItems((currentItems) => [newItem, ...currentItems]);
    setSuccessMessage(t('pages.wardrobe.itemCreatedSuccess', { name: normalizedName }));
    closeCreateWardrobeItem();
  };

  // Load items on mount
  useEffect(() => {
    const stored = loadWardrobeItemsFromStorage();
    setWardrobeItems(stored);
    setHasLoadedStoredItems(true);
    setWardrobeStorageStatus('saved');
  }, []);

  // Sync with localStorage across tabs
  useEffect(() => {
    function handleWardrobeStorageChange(event: StorageEvent) {
      if (
        event.key === WARDROBE_STORAGE_KEY &&
        event.storageArea === window.localStorage
      ) {
        try {
          const loadedItems = loadWardrobeItemsFromStorage();
          isApplyingExternalUpdateRef.current = true;
          setWardrobeItems(loadedItems);

          // Handle deletion modal sync
          setWardrobeItemBeingDeleted((pendingItem) => {
            if (!pendingItem) {
              return null;
            }
            const stillExists = loadedItems.some((item) => item.id === pendingItem.id);
            return stillExists ? pendingItem : null;
          });

          // Handle edit modal sync
          setWardrobeItemBeingEdited((editingItem) => {
            if (!editingItem) {
              return null;
            }
            const stillExists = loadedItems.some((item) => item.id === editingItem.id);
            if (!stillExists) {
              setEditItemName('');
              setEditItemDescription('');
              setEditItemNameError('');
              return null;
            }
            return editingItem;
          });

          setWardrobeStorageStatus('saved');
        } catch {
          setWardrobeStorageStatus('error');
        }
      }
    }

    window.addEventListener('storage', handleWardrobeStorageChange);
    return () => {
      window.removeEventListener('storage', handleWardrobeStorageChange);
    };
  }, []);

  // Save items automatically when they change
  useEffect(() => {
    if (!hasLoadedStoredItems) {
      return;
    }

    if (isApplyingExternalUpdateRef.current) {
      isApplyingExternalUpdateRef.current = false;
      return;
    }

    setWardrobeStorageStatus('saving');
    const wasSaved = saveWardrobeItemsToStorage(wardrobeItems);
    setWardrobeStorageStatus(wasSaved ? 'saved' : 'error');
  }, [wardrobeItems, hasLoadedStoredItems]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{t('creativeLibrary.title')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground" id="wardrobe-title">
            {t('wardrobe.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('wardrobe.description')}
          </p>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {successMessage}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <AppButton
            type="button"
            onClick={openCreateWardrobeItem}
          >{t('pages.wardrobe.createItem')}</AppButton>
          <p
            role="status"
            aria-live="polite"
            className={
              wardrobeStorageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {wardrobeStorageStatus === 'saving'
              ? t('pages.wardrobe.savingWardrobe')
              : wardrobeStorageStatus === 'error'
                ? t('pages.wardrobe.unableToSaveWardrobe')
                : t('pages.wardrobe.wardrobeSaved')}
          </p>
        </div>
      </header>

      {/* Summary Section */}
      <section aria-labelledby="wardrobe-summary-title" className="mt-10">
        <h2
          id="wardrobe-summary-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.wardrobe.wardrobeSummary')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.wardrobe.anOverviewOfClothingAndOutfitItemsInYour')}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppCard className="rounded-2xl border-border bg-card p-6" shadow>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.wardrobe.totalItems')}</p>
                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {wardrobeItems.length}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Shirt aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>
        </div>
      </section>

      {/* Items Section */}
      <section aria-labelledby="wardrobe-items-title" className="mt-10">
        <h2
          id="wardrobe-items-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.wardrobe.allItems')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.wardrobe.clothingItemsCreatedInYourWorkspaceWillA')}</p>

        {hasLoadedStoredItems && wardrobeItems.length > 0 && (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 max-w-md">
              <AppInput
                id="search-wardrobe-items"
                name="searchWardrobeItems"
                type="search"
                label={t('pages.wardrobe.searchWardrobeItems')}
                placeholder={t('pages.wardrobe.searchByItemName')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                fullWidth
              />
            </div>
            <div className="w-full sm:w-64">
              <AppSelect
                id="sort-wardrobe-items"
                name="sortWardrobeItems"
                label={t('pages.wardrobe.sortWardrobeItems')}
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as 'newest' | 'oldest' | 'name-asc' | 'name-desc')}
                options={[
                  { value: 'newest', label: t('pages.wardrobe.sortOption_newest') },
                  { value: 'oldest', label: t('pages.wardrobe.sortOption_oldest') },
                  { value: 'name-asc', label: t('pages.wardrobe.nameAsc') },
                  { value: 'name-desc', label: t('pages.wardrobe.nameDesc') },
                ]}
              />
            </div>
          </div>
        )}

        {!hasLoadedStoredItems ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p role="status" className="text-sm text-muted-foreground">{t('pages.wardrobe.loadingWardrobe')}</p>
          </AppCard>
        ) : wardrobeItems.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Shirt
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.wardrobe.noWardrobeItemsYet')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.wardrobe.createYourFirstWardrobeItemToStartBuildi')}</p>
            </div>
          </AppCard>
        ) : sortedWardrobeItems.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Shirt
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.wardrobe.noWardrobeItemsFound')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.wardrobe.tryAnotherWardrobeItemName')}</p>
              <div className="mt-4">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                >{t('pages.wardrobe.clearSearch')}</AppButton>
              </div>
            </div>
          </AppCard>
        ) : (
          <div className="mt-6">
            <ul
              role="list"
              aria-label={t('pages.wardrobe.wardrobeItems')}
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            >
              {sortedWardrobeItems.map((item) => {
                const itemTitleId = `wardrobe-item-${item.id}-title`;

                return (
                  <li key={item.id}>
                    <AppCard
                      aria-labelledby={itemTitleId}
                      className="rounded-2xl border-border bg-card p-6"
                      shadow
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h3
                          id={itemTitleId}
                          className="text-lg font-semibold text-card-foreground"
                        >
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <AppButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditWardrobeItem(item)}
                            aria-label={`${t('pages.wardrobe.edit')} ${item.name}`}
                          >{t('pages.wardrobe.edit')}</AppButton>
                          <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteWardrobeItem(item)}
                            aria-label={`${t('pages.wardrobe.delete')} ${item.name}`}
                          >{t('pages.wardrobe.delete')}</AppButton>
                        </div>
                      </div>

                      {item.description ? (
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm italic text-muted-foreground">{t('pages.wardrobe.noDescriptionProvided')}</p>
                      )}

                      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {t('pages.wardrobe.created')}{' '}
                          <time dateTime={item.createdAt}>
                            {formatWardrobeDate(item.createdAt)}
                          </time>
                        </p>
                      </div>
                    </AppCard>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateWardrobeItem}
        title={t('pages.wardrobe.createWardrobeItem')}
      >
        <form onSubmit={handleCreateWardrobeItem} className="space-y-5">
          <div>
            <AppInput
              id="wardrobe-item-name"
              name="wardrobeItemName"
              label={t('pages.wardrobe.itemName')}
              value={newItemName}
              onChange={(event) => {
                setNewItemName(event.target.value);
                if (newItemNameError) {
                  setNewItemNameError('');
                }
              }}
              errorMessage={newItemNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={WARDROBE_NAME_MAX_LENGTH}
              placeholder={t('pages.wardrobe.enterWardrobeItemName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {newItemName.length}/{WARDROBE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="wardrobe-item-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.wardrobe.description')}</label>
            <textarea
              id="wardrobe-item-description"
              name="wardrobeItemDescription"
              value={newItemDescription}
              onChange={(event) => setNewItemDescription(event.target.value)}
              rows={5}
              maxLength={WARDROBE_DESCRIPTION_MAX_LENGTH}
              aria-describedby="wardrobe-item-description-help wardrobe-item-description-count"
              placeholder={t('pages.wardrobe.describeThisClothingOrOutfitItem')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <p
              id="wardrobe-item-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.wardrobe.optionalAddDetailsThatHelpPreserveClothi')}</p>
            <p
              id="wardrobe-item-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {newItemDescription.length}/{WARDROBE_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreateWardrobeItem}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={!newItemName.trim()}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.createItem')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={wardrobeItemBeingEdited !== null}
        onClose={closeEditWardrobeItem}
        title={t('pages.wardrobe.editWardrobeItem')}
      >
        <form onSubmit={handleEditWardrobeItem} className="space-y-5">
          <div>
            <AppInput
              id="edit-wardrobe-item-name"
              name="editWardrobeItemName"
              label={t('pages.wardrobe.itemName')}
              value={editItemName}
              onChange={(event) => {
                setEditItemName(event.target.value);
                if (editItemNameError) {
                  setEditItemNameError('');
                }
              }}
              errorMessage={editItemNameError}
              required
              fullWidth
              autoFocus
              autoComplete="off"
              maxLength={WARDROBE_NAME_MAX_LENGTH}
              placeholder={t('pages.wardrobe.enterWardrobeItemName')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editItemName.length}/{WARDROBE_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-wardrobe-item-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.wardrobe.description')}</label>
            <textarea
              id="edit-wardrobe-item-description"
              name="editWardrobeItemDescription"
              value={editItemDescription}
              onChange={(event) => setEditItemDescription(event.target.value)}
              rows={5}
              maxLength={WARDROBE_DESCRIPTION_MAX_LENGTH}
              aria-describedby="edit-wardrobe-item-description-help edit-wardrobe-item-description-count"
              placeholder={t('pages.wardrobe.describeThisClothingOrOutfitItem')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <p
              id="edit-wardrobe-item-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.wardrobe.optionalAddDetailsThatHelpPreserveClothi')}</p>
            <p
              id="edit-wardrobe-item-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {editItemDescription.length}/{WARDROBE_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div aria-live="polite" className="text-xs text-muted-foreground">
            {hasWardrobeItemEditChanges
              ? t('pages.wardrobe.changesReadyToSave')
              : t('pages.wardrobe.makeChangeBeforeSaving')}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeEditWardrobeItem}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={!editItemName.trim() || !hasWardrobeItemEditChanges}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.saveChanges')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={wardrobeItemBeingDeleted !== null}
        onClose={closeDeleteWardrobeItem}
        title={t('pages.wardrobe.deleteWardrobeItem')}
      >
        <div className="space-y-6">
          <div className="text-sm text-foreground">
            <p>
              {t('pages.wardrobe.deleteConfirmation', { name: wardrobeItemBeingDeleted?.name })}
            </p>
            <p className="mt-2 text-muted-foreground">{t('pages.wardrobe.thisActionCannotBeUndone')}</p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeleteWardrobeItem}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.cancel')}</AppButton>
            <AppButton
              type="button"
              variant="danger"
              onClick={handleDeleteWardrobeItem}
              className="w-full sm:w-auto"
            >{t('pages.wardrobe.deleteItem')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default WardrobePage;
