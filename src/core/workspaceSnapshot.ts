import { loadCharactersFromStorage } from '@/features/characters/lib/characterStorage';
import { loadProductsFromStorage } from '@/features/products/lib/productStorage';
import { loadWardrobeItemsFromStorage } from '@/features/wardrobe/wardrobeStorage';
import { loadScenesFromStorage } from '@/features/scenes/sceneStorage';
import { loadPosesFromStorage } from '@/features/poses/poseStorage';
import type { CreativeWorkspaceSnapshot } from './types';

export function loadCreativeWorkspaceSnapshot(): CreativeWorkspaceSnapshot {
  return {
    characters: loadCharactersFromStorage(),
    products: loadProductsFromStorage(),
    wardrobe: loadWardrobeItemsFromStorage(),
    scenes: loadScenesFromStorage(),
    poses: loadPosesFromStorage(),
  };
}
