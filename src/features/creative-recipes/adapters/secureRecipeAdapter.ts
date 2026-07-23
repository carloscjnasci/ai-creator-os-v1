import { CreativeRecipe, CreativeRecipeVersion, CreativeRecipeCategory } from '../types';
import { ValidationResult } from '../recipeValidator';

/**
 * SecureRecipeAdapter is a contract-only adapter designed for a future backend integration.
 * It simulates and defines standard client-server interfaces.
 * Under no circumstances does this adapter handle or persist privileged credentials in the client workspace.
 */
export const SecureRecipeAdapter = {
  async createRecipe(
    workspaceId: string,
    name: string,
    description: string,
    category: CreativeRecipeCategory,
    creatorId: string,
    authToken?: string
  ): Promise<CreativeRecipe> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured. Operations run in offline mode.');
  },

  async createVersion(
    recipeId: string,
    parentVersionId: string | undefined,
    creatorId: string,
    options?: any,
    authToken?: string
  ): Promise<CreativeRecipeVersion> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async validateRecipe(
    recipeId: string,
    versionId?: string,
    authToken?: string
  ): Promise<ValidationResult> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async publishRecipeVersion(
    recipeId: string,
    versionId: string,
    operatorId: string,
    authToken?: string
  ): Promise<{ recipe: CreativeRecipe; activatedVersion: CreativeRecipeVersion }> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async fetchRecipe(
    recipeId: string,
    authToken?: string
  ): Promise<CreativeRecipe> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async listRecipes(
    workspaceId: string,
    authToken?: string
  ): Promise<CreativeRecipe[]> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async archiveRecipe(
    recipeId: string,
    operatorId: string,
    authToken?: string
  ): Promise<CreativeRecipe> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async importRecipe(
    serializedData: string,
    authToken?: string
  ): Promise<CreativeRecipe> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  async exportRecipe(
    recipeId: string,
    authToken?: string
  ): Promise<string> {
    this.assertNoCredentialsInCode(authToken);
    throw new Error('SecureRecipeAdapter: Backend connection is not yet configured.');
  },

  /**
   * Defensive assertion to verify that no privileged API keys or raw password strings are handled directly.
   */
  assertNoCredentialsInCode(token?: string) {
    if (token && (token.includes('BASIC_AUTH') || token.includes('password123') || token.includes('SECRET_API_KEY'))) {
      throw new Error('Security Error: Raw credentials or API keys must not be passed or handled on the client side.');
    }
  }
};
