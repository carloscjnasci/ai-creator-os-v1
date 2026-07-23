import { useTranslation } from '@/features/i18n/useTranslation';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CheckCircle2, Package, PlusCircle, Search } from 'lucide-react';

import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  PRODUCT_STORAGE_KEY,
  loadProductsFromStorage,
  saveProductsToStorage,
} from '@/features/products/lib/productStorage';
import type { Product } from '@/features/products/types';

type ProductStorageStatus = 'loading' | 'saving' | 'saved' | 'error';

const PRODUCT_NAME_MAX_LENGTH = 80;
const PRODUCT_DESCRIPTION_MAX_LENGTH = 400;

export function ProductsPage() {
  const { t, formatDate } = useTranslation();
  const formatProductDate = (date: string): string => {
    return formatDate(date);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [hasLoadedStoredProducts, setHasLoadedStoredProducts] =
    useState(false);
  const [productStorageStatus, setProductStorageStatus] =
    useState<ProductStorageStatus>('loading');
  const isApplyingExternalUpdateRef = useRef(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Sort state
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');

  const filteredProducts = searchTerm.trim() === ''
    ? products
    : products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
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

  // States for product editing
  const [productBeingEdited, setProductBeingEdited] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNameError, setEditNameError] = useState('');

  // Function to initialize product editing state
  function openEditProduct(product: Product) {
    setProductBeingEdited(product);
    setEditName(product.name);
    setEditDescription(product.description || '');
    setEditNameError('');
    setSuccessMessage('');
  }

  function closeEditProduct() {
    setProductBeingEdited(null);
    setEditName('');
    setEditDescription('');
    setEditNameError('');
  }

  // States for product deletion
  const [productBeingDeleted, setProductBeingDeleted] = useState<Product | null>(null);

  function openDeleteProduct(product: Product) {
    setProductBeingDeleted(product);
    setSuccessMessage('');
  }

  function closeDeleteProduct() {
    setProductBeingDeleted(null);
  }

  function handleDeleteProduct() {
    if (productBeingDeleted === null) {
      return;
    }

    const deletedProductName = productBeingDeleted.name;

    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== productBeingDeleted.id)
    );

    setSuccessMessage(t('pages.products.deletedSuccess', { name: deletedProductName }));
    closeDeleteProduct();
  }

  const hasProductEditChanges =
    productBeingEdited !== null &&
    (editName.trim() !== productBeingEdited.name.trim() ||
      editDescription.trim() !== (productBeingEdited.description || '').trim());

  function handleEditProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (productBeingEdited === null) {
      return;
    }

    if (!hasProductEditChanges) {
      return;
    }

    const editedName = editName.trim();
    const editedDescription = editDescription.trim();

    if (!editedName) {
      setEditNameError(t('pages.products.nameRequired'));
      return;
    }

    if (editedName.length > PRODUCT_NAME_MAX_LENGTH) {
      setEditNameError(t('pages.products.nameTooLong'));
      return;
    }

    const productAlreadyExists = products.some(
      (product) =>
        product.id !== productBeingEdited.id &&
        product.name.toLocaleLowerCase() === editedName.toLocaleLowerCase(),
    );

    if (productAlreadyExists) {
      setEditNameError(t('pages.products.duplicateName'));
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((p) =>
        p.id === productBeingEdited.id
          ? {
              ...p,
              name: editedName,
              description: editedDescription,
            }
          : p,
      ),
    );

    setSuccessMessage(t('pages.products.updatedSuccess', { name: editedName }));
    closeEditProduct();
  }

  useEffect(() => {
    const storedProducts = loadProductsFromStorage();

    setProducts(storedProducts);
    setHasLoadedStoredProducts(true);
    setProductStorageStatus('saved');
  }, []);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (
        event.key === PRODUCT_STORAGE_KEY &&
        event.storageArea === window.localStorage
      ) {
        try {
          const loadedProducts = loadProductsFromStorage();
          isApplyingExternalUpdateRef.current = true;
          setProducts(loadedProducts);

          setProductBeingDeleted((pendingProduct) => {
            if (!pendingProduct) {
              return null;
            }
            const stillExists = loadedProducts.some((p) => p.id === pendingProduct.id);
            return stillExists ? pendingProduct : null;
          });

          setProductBeingEdited((editingProduct) => {
            if (!editingProduct) {
              return null;
            }
            const updatedProduct = loadedProducts.find((p) => p.id === editingProduct.id);
            if (!updatedProduct) {
              setEditName('');
              setEditDescription('');
              setEditNameError('');
              return null;
            }
            return updatedProduct;
          });

          setProductStorageStatus('saved');
        } catch {
          setProductStorageStatus('error');
        }
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredProducts) {
      return;
    }

    if (isApplyingExternalUpdateRef.current) {
      isApplyingExternalUpdateRef.current = false;
      return;
    }

    const wasSaved = saveProductsToStorage(products);

    setProductStorageStatus(wasSaved ? 'saved' : 'error');
  }, [products, hasLoadedStoredProducts]);

  const totalProducts = products.length;
  const readyProducts = products.length;

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
      setSearchTerm(incomingSearchQuery);
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

  function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      setNameError(t('pages.products.nameRequired'));
      return;
    }

    if (normalizedName.length > PRODUCT_NAME_MAX_LENGTH) {
      setNameError(
        `Product name must contain no more than ${PRODUCT_NAME_MAX_LENGTH} characters.`,
      );
      return;
    }

    const productAlreadyExists = products.some(
      (product) =>
        product.name.toLocaleLowerCase() ===
        normalizedName.toLocaleLowerCase(),
    );

    if (productAlreadyExists) {
      setNameError(t('pages.products.duplicateName'));
      return;
    }

    const newProduct: Product = {
      id: `${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription.slice(
        0,
        PRODUCT_DESCRIPTION_MAX_LENGTH,
      ),
      createdAt: new Date().toISOString(),
    };

    setProducts((currentProducts) => [newProduct, ...currentProducts]);
    setSuccessMessage(
      t('pages.products.createdSuccess', { name: normalizedName }),
    );
    closeCreateModal();
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{t('creativeLibrary.title')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {t('products.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('products.description')}
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
              productStorageStatus === 'error'
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {productStorageStatus === 'loading'
              ? t('pages.products.loadingProducts')
              : productStorageStatus === 'error'
                ? t('pages.products.unableToSaveProducts')
                : t('pages.products.productsSaved')}
          </p>

          <AppButton type="button" variant="primary" onClick={openCreateModal}>
            <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.products.newProduct')}</AppButton>
        </div>
      </header>

      <section aria-labelledby="product-summary-title" className="mt-10">
        <h2
          id="product-summary-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.products.productSummary')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.products.anOverviewOfTheProductsAvailableInYourWo')}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppCard className="rounded-2xl border-border bg-card p-6" shadow>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.products.totalProducts')}</p>
                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {totalProducts}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Package aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>

          <AppCard className="rounded-2xl border-border bg-card p-6" shadow>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('pages.products.readyToUse')}</p>
                <p className="mt-2 text-3xl font-bold text-card-foreground">
                  {readyProducts}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
              </div>
            </div>
          </AppCard>
        </div>
      </section>

      <section aria-labelledby="products-list-title" className="mt-10">
        <h2
          id="products-list-title"
          className="text-lg font-semibold text-foreground"
        >{t('pages.products.allProducts')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pages.products.productsCreatedInYourWorkspaceWillAppear')}</p>

        {!hasLoadedStoredProducts ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <p role="status" className="text-sm text-muted-foreground">{t('pages.products.loadingProducts')}</p>
          </AppCard>
        ) : products.length === 0 ? (
          <AppCard
            className="mt-6 rounded-2xl border-border bg-card p-8 text-center"
            shadow
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Package
                aria-hidden="true"
                className="h-10 w-10 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.products.noProductsYet')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.products.createYourFirstReusableProductToMaintain')}</p>
              <AppButton
                type="button"
                variant="primary"
                className="mt-5"
                onClick={openCreateModal}
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />{t('pages.products.newProduct')}</AppButton>
            </div>
          </AppCard>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <AppInput
                  id="search-products"
                  name="searchTerm"
                  label={t('pages.products.searchProducts')}
                  placeholder={t('pages.products.searchByProductName')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  autoComplete="off"
                  fullWidth
                />
              </div>
              <div className="w-full sm:w-48">
                <AppSelect
                  id="sort-products"
                  label={t('pages.products.sortProducts')}
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as any)}
                  options={[
                    { value: 'newest', label: t('pages.products.sortOption_newest') },
                    { value: 'oldest', label: t('pages.products.sortOption_oldest') },
                    { value: 'name-asc', label: t('pages.products.nameAsc') },
                    { value: 'name-desc', label: t('pages.products.nameDesc') },
                  ]}
                />
              </div>
            </div>
            {filteredProducts.length === 0 && searchTerm.trim() !== '' ? (
              <AppCard
                className="rounded-2xl border-border bg-card p-8 text-center"
                shadow
              >
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <Search
                    aria-hidden="true"
                    className="h-10 w-10 text-muted-foreground"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">{t('pages.products.noProductsFound')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('pages.products.tryAnotherProductName')}</p>
                  <AppButton
                    type="button"
                    variant="secondary"
                    className="mt-5"
                    onClick={() => setSearchTerm('')}
                  >{t('pages.products.clearSearch')}</AppButton>
                </div>
              </AppCard>
            ) : (
              <ul
                role="list"
                aria-label={t('pages.products.products')}
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              >
                {sortedProducts.map((product) => {
                  const productTitleId = `product-${product.id}-title`;

                  return (
                    <li key={product.id}>
                      <AppCard
                        aria-labelledby={productTitleId}
                        className="rounded-2xl border-border bg-card p-6"
                        shadow
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3
                            id={productTitleId}
                            className="text-lg font-semibold text-card-foreground"
                          >
                            {product.name}
                          </h3>
                          <AppBadge variant="success" size="sm">{t('pages.products.ready')}</AppBadge>
                        </div>

                        {product.description ? (
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {product.description}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm italic text-muted-foreground">{t('pages.products.noDescriptionProvided')}</p>
                        )}

                        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                          <p className="text-xs text-muted-foreground">
                            {t('pages.products.created')}{' '}
                            <time dateTime={product.createdAt}>
                              {formatProductDate(product.createdAt)}
                            </time>
                          </p>
                          <div className="flex items-center gap-2">
                            <AppButton
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditProduct(product)}
                              aria-label={`${t('pages.products.edit')} ${product.name}`}
                            >{t('pages.products.edit')}</AppButton>
                            <AppButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => openDeleteProduct(product)}
                              aria-label={`${t('pages.products.delete')} ${product.name}`}
                            >{t('pages.products.delete')}</AppButton>
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

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={t('pages.products.createProduct')}
      >
        <form onSubmit={handleCreateProduct} className="space-y-5">
          <div>
            <AppInput
              id="product-name"
              name="productName"
              label={t('pages.products.productName')}
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
              maxLength={PRODUCT_NAME_MAX_LENGTH}
              placeholder={t('pages.products.exampleRotatingCleaningBrush')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {name.length}/{PRODUCT_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="product-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.products.description')}</label>
            <textarea
              id="product-description"
              name="productDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
              aria-describedby="product-description-help product-description-count"
              placeholder={t('pages.products.describeMaterialsColorsFeaturesAndSellin')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <p
              id="product-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.products.optionalAddDetailsThatHelpPreserveProduc')}</p>
            <p
              id="product-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {description.length}/{PRODUCT_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="w-full sm:w-auto"
            >{t('pages.products.cancel')}</AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={!name.trim()}
              className="w-full sm:w-auto"
            >{t('pages.products.createProduct')}</AppButton>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={productBeingEdited !== null}
        onClose={closeEditProduct}
        title={t('pages.products.editProduct')}
      >
        <form onSubmit={handleEditProduct} className="space-y-5">
          <div>
            <AppInput
              id="edit-product-name"
              name="editProductName"
              label={t('pages.products.productName')}
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
              maxLength={PRODUCT_NAME_MAX_LENGTH}
              placeholder={t('pages.products.exampleRotatingCleaningBrush')}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {editName.length}/{PRODUCT_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-product-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >{t('pages.products.description')}</label>
            <textarea
              id="edit-product-description"
              name="editProductDescription"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={5}
              maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
              aria-describedby="edit-product-description-help edit-product-description-count"
              placeholder={t('pages.products.describeMaterialsColorsFeaturesAndSellin')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <p
              id="edit-product-description-help"
              className="mt-1 text-xs text-muted-foreground"
            >{t('pages.products.optionalAddDetailsThatHelpPreserveProduc')}</p>
            <p
              id="edit-product-description-count"
              className="mt-1 text-right text-xs text-muted-foreground"
            >
              {editDescription.length}/{PRODUCT_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {hasProductEditChanges
                ? t('pages.products.changesReadyToSave')
                : t('pages.products.makeChangeBeforeSaving')}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AppButton
                type="button"
                variant="outline"
                onClick={closeEditProduct}
                className="w-full sm:w-auto"
              >{t('pages.products.cancel')}</AppButton>
              <AppButton
                type="submit"
                variant="primary"
                disabled={!editName.trim() || !hasProductEditChanges}
                className="w-full sm:w-auto"
              >{t('pages.products.saveChanges')}</AppButton>
            </div>
          </div>
        </form>
      </AppModal>

      <AppModal
        isOpen={productBeingDeleted !== null}
        onClose={closeDeleteProduct}
        title={t('pages.products.deleteProduct')}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {t('pages.products.deleteConfirmation', { name: productBeingDeleted?.name })}
          </p>
          <p className="text-xs text-destructive">{t('pages.products.thisActionCannotBeUndone')}</p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              variant="outline"
              onClick={closeDeleteProduct}
              className="w-full sm:w-auto"
            >{t('pages.products.cancel')}</AppButton>
            <AppButton
              type="button"
              variant="danger"
              onClick={handleDeleteProduct}
              className="w-full sm:w-auto"
            >{t('pages.products.deleteProduct')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default ProductsPage;
