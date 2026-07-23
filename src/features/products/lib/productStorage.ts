import type { Product } from '@/features/products/types';

export const PRODUCT_STORAGE_KEY = 'ai-creator-os.products.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) {
    return false;
  }

  const { id, name, description, createdAt } = value;

  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof name === 'string' &&
    name.length > 0 &&
    typeof description === 'string' &&
    typeof createdAt === 'string' &&
    !Number.isNaN(Date.parse(createdAt))
  );
}

export function parseStoredProducts(
  serializedProducts: string | null,
): Product[] {
  if (!serializedProducts) {
    return [];
  }

  try {
    const parsedProducts: unknown = JSON.parse(serializedProducts);

    if (!Array.isArray(parsedProducts)) {
      return [];
    }

    return parsedProducts.filter(isProduct);
  } catch {
    return [];
  }
}

export function loadProductsFromStorage(): Product[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedProducts = window.localStorage.getItem(
      PRODUCT_STORAGE_KEY,
    );

    return parseStoredProducts(storedProducts);
  } catch {
    return [];
  }
}

export function saveProductsToStorage(
  products: Product[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      PRODUCT_STORAGE_KEY,
      JSON.stringify(products),
    );

    return true;
  } catch {
    return false;
  }
}
