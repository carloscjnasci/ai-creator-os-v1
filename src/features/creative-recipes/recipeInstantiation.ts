import {
  CreativeRecipeVersion,
  RecipeApplicationPreview,
  RecipeStage,
} from './types';
import { findUnknownPlaceholders } from './recipeValidator';

/**
 * Resolves a single placeholder from parameter values or workspace context.
 */
export function resolvePlaceholder(
  placeholder: string,
  parameterValues: Record<string, any>,
  workspaceContext: Record<string, any>
): string | undefined {
  // 1. Direct match in parameterValues
  if (parameterValues[placeholder] !== undefined) {
    return String(parameterValues[placeholder]);
  }

  // 2. Nested lookup in workspaceContext
  const parts = placeholder.split('.');
  let current: any = workspaceContext;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (current !== undefined) {
    return String(current);
  }

  // 3. Nested lookup in parameterValues
  current = parameterValues;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (current !== undefined) {
    return String(current);
  }

  return undefined;
}

/**
 * Resolves placeholders in a template string, with safety guards:
 * - Bounded recursion (max 5 iterations)
 * - Circular bindings rejection
 * - No HTML/script injection
 * - No eval usage
 */
export function resolveTemplate(
  template: string,
  parameterValues: Record<string, any>,
  workspaceContext: Record<string, any>,
  errors: string[]
): string {
  let currentText = template;
  let iterations = 0;
  const maxIterations = 5;

  while (true) {
    const matches = currentText.match(/\{\{([^}]+)\}\}/g);
    if (!matches) {
      break;
    }

    iterations++;
    if (iterations > maxIterations) {
      errors.push('Circular bindings or overly deep recursive substitutions detected in template.');
      break;
    }

    let nextText = currentText;
    for (const match of matches) {
      const key = match.replace(/\{\{|\}\}/g, '').trim();
      const resolved = resolvePlaceholder(key, parameterValues, workspaceContext);
      if (resolved !== undefined) {
        // Strip executable HTML/scripts to prevent script injection
        const safeValue = resolved.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '[Script Blocked]');
        nextText = nextText.replace(match, safeValue);
      }
    }

    if (nextText === currentText) {
      break; // No change, avoid infinite spin
    }
    currentText = nextText;
  }

  return currentText;
}

/**
 * Generates a stable, deterministic fingerprint hash for a specific version and normalized parameter values.
 * No Math.random or timestamps are used.
 */
export function generateRecipeFingerprint(
  versionId: string,
  parameterValues: Record<string, any>
): string {
  const sortedParams: Record<string, any> = {};
  Object.keys(parameterValues)
    .sort()
    .forEach(key => {
      sortedParams[key] = parameterValues[key];
    });

  const serialized = `${versionId}:${JSON.stringify(sortedParams)}`;
  
  // Deterministic djb2 hashing algorithm
  let hash = 5381;
  for (let i = 0; i < serialized.length; i++) {
    hash = (hash * 33) ^ serialized.charCodeAt(i);
  }
  return 'fp_' + (hash >>> 0).toString(16);
}

/**
 * Pure deterministic instantiation engine.
 */
export function instantiateRecipeVersion(
  version: CreativeRecipeVersion,
  parameterValues: Record<string, any>,
  workspaceContext: Record<string, any>,
  brandRules?: any[]
): RecipeApplicationPreview {
  const validationErrors: string[] = [];
  const warnings: string[] = [];
  const unresolvedParameters: string[] = [];
  
  const resolvedStages: {
    stageId: string;
    resolvedTemplate: string;
    bindings: Record<string, any>;
  }[] = [];

  // 1. Verify parameter completeness and type validation
  const normalizedParams: Record<string, any> = {};

  for (const param of version.parameters) {
    const providedVal = parameterValues[param.key];
    
    if (providedVal === undefined || providedVal === null || providedVal === '') {
      if (param.required) {
        unresolvedParameters.push(param.key);
        validationErrors.push(`Required parameter '${param.key}' is missing or empty.`);
      } else {
        // Use default value if specified
        normalizedParams[param.key] = param.defaultValue !== undefined ? param.defaultValue : '';
      }
    } else {
      // Type validation
      if (param.parameterType === 'number') {
        const num = Number(providedVal);
        if (!Number.isFinite(num)) {
          validationErrors.push(`Parameter '${param.key}' must be a finite number.`);
        } else {
          if (param.minimum !== undefined && num < param.minimum) {
            validationErrors.push(`Parameter '${param.key}' value ${num} is less than minimum ${param.minimum}.`);
          }
          if (param.maximum !== undefined && num > param.maximum) {
            validationErrors.push(`Parameter '${param.key}' value ${num} is greater than maximum ${param.maximum}.`);
          }
          normalizedParams[param.key] = num;
        }
      } else if (param.parameterType === 'boolean') {
        normalizedParams[param.key] = String(providedVal) === 'true' || providedVal === true;
      } else if (param.parameterType === 'select' || param.parameterType === 'multi_select') {
        if (param.allowedValues && param.allowedValues.length > 0) {
          const isAllowed = Array.isArray(providedVal)
            ? providedVal.every(val => param.allowedValues!.includes(val))
            : param.allowedValues.includes(providedVal);
          if (!isAllowed) {
            validationErrors.push(`Parameter '${param.key}' has unallowed value: ${JSON.stringify(providedVal)}`);
          }
        }
        normalizedParams[param.key] = providedVal;
      } else {
        // Standard text, platforms, etc.
        if (param.pattern) {
          const regex = new RegExp(param.pattern);
          if (!regex.test(String(providedVal))) {
            validationErrors.push(`Parameter '${param.key}' does not match pattern '${param.pattern}'.`);
          }
        }
        normalizedParams[param.key] = providedVal;
      }
    }
  }

  // 2. Resolve stage templates
  for (const stage of version.structure.stages) {
    // Collect local bindings
    const stageBindings: Record<string, any> = {};
    for (const [bindingName, paramKey] of Object.entries(stage.parameterBindings)) {
      const val = normalizedParams[paramKey];
      stageBindings[bindingName] = val !== undefined ? val : '';
    }

    // Merge normalizedParams, stageBindings, and workspaceContext for template lookup
    const lookupContext = {
      ...workspaceContext,
      ...normalizedParams,
      ...stageBindings,
    };

    // Check unknown placeholders before substituting
    const unknowns = findUnknownPlaceholders(stage.template);
    if (unknowns.length > 0) {
      validationErrors.push(`Stage '${stage.id}' contains unknown placeholders: ${unknowns.join(', ')}`);
    }

    const resolvedTemplate = resolveTemplate(
      stage.template,
      lookupContext,
      workspaceContext,
      validationErrors
    );

    resolvedStages.push({
      stageId: stage.id,
      resolvedTemplate,
      bindings: stageBindings,
    });
  }

  // 3. Generate deterministic fingerprint
  const fingerprint = generateRecipeFingerprint(version.id, normalizedParams);

  return {
    fingerprint,
    resolvedStages,
    unresolvedParameters,
    validationErrors,
    warnings,
    lineage: {
      recipeId: version.recipeId,
      recipeVersionId: version.id,
      parentVersionId: version.parentVersionId,
    },
  };
}
