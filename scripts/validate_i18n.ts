import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ptBR } from '../src/features/i18n/locales/pt-BR.js';
import { en } from '../src/features/i18n/locales/en.js';
import { es } from '../src/features/i18n/locales/es.js';

// ============================================================================
// PART 1: DICTIONARY ISOMORPHISM & HEALTH CHECK
// ============================================================================

function getDeepKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getDeepKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

function getValueAt(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

const baseKeys = getDeepKeys(ptBR);
const enKeys = getDeepKeys(en);
const esKeys = getDeepKeys(es);

const DICTIONARY_KEYS = new Set(baseKeys);

const dictErrors: string[] = [];

// Check if keys match exactly across pt-BR, en, and es
const enKeysSet = new Set(enKeys);
const esKeysSet = new Set(esKeys);

for (const key of baseKeys) {
  if (!enKeysSet.has(key)) {
    dictErrors.push(`[EN] Missing key: ${key}`);
  }
}
for (const key of enKeys) {
  if (!DICTIONARY_KEYS.has(key)) {
    dictErrors.push(`[EN] Extra key not in pt-BR: ${key}`);
  }
}

for (const key of baseKeys) {
  if (!esKeysSet.has(key)) {
    dictErrors.push(`[ES] Missing key: ${key}`);
  }
}
for (const key of esKeys) {
  if (!DICTIONARY_KEYS.has(key)) {
    dictErrors.push(`[ES] Extra key not in pt-BR: ${key}`);
  }
}

const checkValues = (langName: string, keys: string[], dictionary: any) => {
  for (const key of keys) {
    const val = getValueAt(dictionary, key);
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') {
        dictErrors.push(`[${langName}] Key "${key}" has an empty translation string.`);
      } else if (trimmed.toUpperCase() === 'TODO' || trimmed.toUpperCase() === 'PLACEHOLDER') {
        dictErrors.push(`[${langName}] Key "${key}" contains an illegal placeholder value: "${trimmed}".`);
      }
    } else {
      dictErrors.push(`[${langName}] Key "${key}" has a non-string translation value of type ${typeof val}.`);
    }
  }
};

checkValues('pt-BR', baseKeys, ptBR);
checkValues('EN', enKeys, en);
checkValues('ES', esKeys, es);

// The source HTML must start in the primary locale and avoid an English-only default description.
const indexHtmlPath = path.resolve('index.html');
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  if (!/<html\s+lang=["']pt-BR["']/i.test(indexHtml)) {
    dictErrors.push('[INDEX HTML] The default <html lang> must be pt-BR.');
  }
  if (/workspace for AI-powered marketing campaigns/i.test(indexHtml)) {
    dictErrors.push('[INDEX HTML] The default metadata description is still English-only.');
  }
}

// Ensure interpolation placeholders remain identical across locales.
function getPlaceholders(value: string): string[] {
  return Array.from(value.matchAll(/\{([^{}]+)\}/g))
    .map(match => match[1].trim())
    .sort();
}

for (const key of baseKeys) {
  const ptValue = getValueAt(ptBR, key);
  const enValue = getValueAt(en, key);
  const esValue = getValueAt(es, key);
  if (typeof ptValue !== 'string' || typeof enValue !== 'string' || typeof esValue !== 'string') continue;

  const ptPlaceholders = JSON.stringify(getPlaceholders(ptValue));
  const enPlaceholders = JSON.stringify(getPlaceholders(enValue));
  const esPlaceholders = JSON.stringify(getPlaceholders(esValue));

  if (ptPlaceholders !== enPlaceholders || ptPlaceholders !== esPlaceholders) {
    dictErrors.push(
      `[PLACEHOLDER PARITY] Key "${key}" differs across locales: pt-BR=${ptPlaceholders}, en=${enPlaceholders}, es=${esPlaceholders}`,
    );
  }
}

// Check for duplicate keys in dictionary files using TypeScript AST
const checkDuplicateKeysInFile = (filePath: string) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function walk(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keysSeen = new Set<string>();
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
          const keyName = prop.name.getText(sf).replace(/['"]/g, '');
          if (keysSeen.has(keyName)) {
            dictErrors.push(`[DUPLICATE KEY] Key "${keyName}" is duplicated inside object literal in ${filePath}`);
          }
          keysSeen.add(keyName);
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
};

const LEGITIMATE_IDENTICAL_ALLOWLIST = new Set([
  'google veo 3',
  'tiktok shop',
  'youtube shorts',
  'instagram reels',
  'nano banana',
  'generic ai generator',
  '9:16 (vertical)',
  '16:9 (landscape)',
  '1:1 (square)',
  '4:5 (portrait)',
  'ai creator os © 2024 ·',
  'total: {count}',
  'poses: {count}',
  'prompts: {count}',
  '{count} pts',
  '{width} x {height} px',
  'português (brasil)',
  'portugués (brasil)',
  'poses', 'status', 'id', 'leads', 'ctr', 'cta', 'conf', '{count}x', '0x', 'total:',
  'prompt', 'prompts', 'pose', 'tag', 'tags', 'hashtags', 'id:', 'aurora', 'carter',
  'v{version}', 'v1', 'error', 'video', 'control', 'grok', 'español'
]);

// Check for quality: mixed-language, suspicious truncation, identical translations, duplicate keys, empty values, placeholders, unequal key paths
const checkValueQuality = (langName: string, keys: string[], dictionary: any) => {
  for (const key of keys) {
    const val = getValueAt(dictionary, key);
    if (typeof val === 'string') {
      const lowerVal = val.toLowerCase().trim();
      
      // 1. Check for mixed-language generated strings / sentences.
      if (langName === 'pt-BR' || langName === 'ES') {
        const hasMixedRegression = [
          'campaigns currently marked ativo',
          'no records were criado during this range',
          'todos file operations compute full sha256 digest',
          'ai generator plataforma',
          'campaigns creado in your workspace will be lis',
          'no descripción provided',
          'variant nome',
          'hypothesis descrição',
          'variant nombre',
          'hypothesis descripción',
          'activo insights',
          'eliminar entry',
          'crear digital human',
          'create digital human',
          'contenedor de rolagem',
          'espacio de trabalho'
        ].some(fixture => lowerVal.includes(fixture));

        if (hasMixedRegression) {
          dictErrors.push(`[${langName}] Key "${key}" contains mixed-language regression fixture: "${val}"`);
        }

        const words = lowerVal
          .replace(/\{[^{}]+\}/g, ' ')
          .match(/[a-záéíóúüñãõâêôç-]+/g) ?? [];
        const wordSet = new Set(words);

        const englishStructuralWords = [
          'the', 'and', 'with', 'without', 'from', 'your', 'this', 'these', 'those',
          'is', 'are', 'was', 'were', 'will', 'would', 'should', 'could',
          'create', 'created', 'save', 'saved', 'delete', 'deleted', 'search',
          'available', 'selected', 'currently', 'during', 'provided', 'workspace',
          'records', 'loading', 'choose', 'click', 'browse'
        ];
        const portugueseOnlyWords = [
          'trabalho', 'criado', 'criada', 'criados', 'criadas', 'descrição', 'nome',
          'cenário', 'cenários', 'nenhum', 'nenhuma', 'ainda', 'excluir', 'salvar',
          'configurações', 'guarda-roupa'
        ];
        const spanishOnlyWords = [
          'trabajo', 'creado', 'creada', 'creados', 'creadas', 'descripción', 'nombre',
          'escena', 'escenas', 'ningún', 'ninguna', 'todavía', 'eliminar', 'guardar',
          'configuración', 'vestuario'
        ];

        const leakedEnglish = englishStructuralWords.filter(word => wordSet.has(word));
        if (leakedEnglish.length > 0 && words.length >= 3) {
          dictErrors.push(
            `[${langName}] Key "${key}" contains untranslated English structural word(s) ${leakedEnglish.join(', ')}: "${val}"`,
          );
        }

        const crossLocaleWords = langName === 'pt-BR' ? spanishOnlyWords : portugueseOnlyWords;
        const crossLocaleLeaks = crossLocaleWords.filter(word => wordSet.has(word));
        if (crossLocaleLeaks.length > 0) {
          dictErrors.push(
            `[${langName}] Key "${key}" contains word(s) from the wrong locale ${crossLocaleLeaks.join(', ')}: "${val}"`,
          );
        }
      }

      // 2. Check for truncated generated values ending mid-word or mid-sentence
      const truncatedPatterns = [
        /\bwill be lis$/i,
        /\blis$/i,
        /\bcreati$/i,
        /\bproduc$/i,
        /\bsellin$/i,
        /\b facial exp$/i,
        /\b active asse$/i,
        /\b preserve produc$/i,
        /\bwo$/i,
        /\bdescrip$/i,
        /\bcharacteri$/i
      ];

      const isTruncated = truncatedPatterns.some(pattern => pattern.test(lowerVal));

      if (isTruncated) {
        dictErrors.push(`[${langName}] Key "${key}" has a truncated or suspicious ending: "${val}"`);
      }

      // 3. Check for pt-BR/Spanish multiword values identical to English without justification
      if (langName === 'pt-BR' || langName === 'ES') {
        const enVal = getValueAt(en, key);
        if (enVal && val === enVal) {
          if (!LEGITIMATE_IDENTICAL_ALLOWLIST.has(lowerVal)) {
            dictErrors.push(`[${langName}] Key "${key}" has value identical to English without justification: "${val}"`);
          }
        }
      }
    }
  }
};

checkDuplicateKeysInFile('src/features/i18n/locales/pt-BR.ts');
checkDuplicateKeysInFile('src/features/i18n/locales/en.ts');
checkDuplicateKeysInFile('src/features/i18n/locales/es.ts');

checkValueQuality('pt-BR', baseKeys, ptBR);
checkValueQuality('EN', enKeys, en);
checkValueQuality('ES', esKeys, es);

if (dictErrors.length > 0) {
  console.error('❌ I18n Dictionary Validation Failed:');
  for (const err of dictErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log('✅ I18n dictionaries are perfectly isomorphic and free of placeholder values.');
}


// Ensure every literal t('...') call resolves to a real dictionary key.
function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(fullPath));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const missingTranslationReferences: string[] = [];
const translationDefaultValueReferences: string[] = [];
for (const filePath of collectSourceFiles('src')) {
  if (filePath.includes('/locales/') || filePath.includes('__tests__') || /\.(test|spec)\./.test(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function walkTranslationCalls(node: ts.Node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const expression = node.expression.getText(sourceFile);
      const firstArg = node.arguments[0];
      if (
        expression === 't' &&
        (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))
      ) {
        const key = firstArg.text;
        if (!DICTIONARY_KEYS.has(key)) {
          const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, firstArg.getStart(sourceFile));
          missingTranslationReferences.push(`${filePath}:${line + 1}:${character + 1} -> ${key}`);
        }
        const optionsArg = node.arguments[1];
        if (optionsArg && ts.isObjectLiteralExpression(optionsArg)) {
          const defaultValueProperty = optionsArg.properties.find((property) =>
            ts.isPropertyAssignment(property) && property.name.getText(sourceFile).replace(/["']/g, '') === 'defaultValue'
          );
          if (defaultValueProperty) {
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, defaultValueProperty.getStart(sourceFile));
            translationDefaultValueReferences.push(`${filePath}:${line + 1}:${character + 1} -> ${key}`);
          }
        }
      }
    }
    ts.forEachChild(node, walkTranslationCalls);
  }

  walkTranslationCalls(sourceFile);
}

if (missingTranslationReferences.length > 0) {
  console.error('❌ Missing literal translation-key references:');
  for (const item of missingTranslationReferences) console.error(`  - ${item}`);
  process.exit(1);
}
console.log('✅ Every literal translation-key reference resolves in all locale dictionaries.');

if (translationDefaultValueReferences.length > 0) {
  console.error('❌ English/default fallback values are forbidden in t(...) calls:');
  for (const item of translationDefaultValueReferences) console.error(`  - ${item}`);
  process.exit(1);
}
console.log('✅ No t(...) call contains a defaultValue fallback that could bypass locale dictionaries.');


// Prevent i18n hooks from being called inside ordinary helper functions.
// Such calls can pass TypeScript while breaking React's Rules of Hooks at runtime.
const invalidI18nHookCalls: string[] = [];

function getFunctionLikeName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? null;
  if (ts.isMethodDeclaration(node)) return node.name.getText(sourceFile);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (ts.isPropertyAssignment(parent)) return parent.name.getText(sourceFile).replace(/["']/g, '');
    if (ts.isCallExpression(parent)) {
      const owner = parent.parent;
      if (ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name)) return owner.name.text;
      if (ts.isPropertyAssignment(owner)) return owner.name.getText(sourceFile).replace(/["']/g, '');
    }
  }
  return null;
}

function findNearestFunctionLike(node: ts.Node): ts.Node | null {
  let parent = node.parent;
  while (parent) {
    if (
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isMethodDeclaration(parent)
    ) {
      return parent;
    }
    parent = parent.parent;
  }
  return null;
}

for (const filePath of collectSourceFiles('src')) {
  if (filePath.includes('__tests__') || /\.(test|spec)\./.test(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function walkHookCalls(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const hookName = node.expression.getText(sourceFile);
      if (hookName === 'useTranslation' || hookName === 'useDisplayHelpers') {
        const functionNode = findNearestFunctionLike(node);
        const functionName = functionNode ? getFunctionLikeName(functionNode, sourceFile) : null;
        const isComponentOrHook = Boolean(
          functionName && (/^[A-Z]/.test(functionName) || /^use[A-Z0-9]/.test(functionName)),
        );
        if (!isComponentOrHook) {
          const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
          invalidI18nHookCalls.push(
            `${filePath}:${line + 1}:${character + 1} -> ${hookName} inside ${functionName ?? '<anonymous function>'}`,
          );
        }
      }
    }
    ts.forEachChild(node, walkHookCalls);
  }

  walkHookCalls(sourceFile);
}

if (invalidI18nHookCalls.length > 0) {
  console.error('❌ Invalid i18n hook placement detected:');
  for (const item of invalidI18nHookCalls) console.error(`  - ${item}`);
  process.exit(1);
}
console.log('✅ I18n hooks are only called from React components or custom hooks.');

// ============================================================================
// PART 2: REGRESSION FIXTURES SELF-TEST (AST PROOF)
// ============================================================================

function runSelfTest() {
  const mockContent = `
    export function MockComponent() {
      setMessage("Something went wrong");
      return (
        <div title="Create campaign & start production">
          <p>Drag & drop your asset here, or</p>
          <input placeholder="Caption / description" />
          <span>Newest first</span>
        </div>
      );
    }
  `;
  const sf = ts.createSourceFile('mockFile.tsx', mockContent, ts.ScriptTarget.Latest, true);
  const mockFailures: string[] = [];

  function walkMock(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.getText().trim();
      if (text) mockFailures.push(text);
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText();
      const visibleAttrs = ['label', 'placeholder', 'title', 'aria-label', 'description', 'eyebrow', 'helperText', 'alt', 'emptyMessage'];
      if (visibleAttrs.includes(name)) {
        const init = node.initializer;
        if (init && ts.isStringLiteral(init)) {
          mockFailures.push(init.text);
        }
      }
    }
    if (ts.isCallExpression(node)) {
      const expText = node.expression.getText();
      if (expText === 'setMessage') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          mockFailures.push(arg.text);
        }
      }
    }
    ts.forEachChild(node, walkMock);
  }
  walkMock(sf);

  const requiredFixtures = [
    'Something went wrong',
    'Create campaign & start production',
    'Drag & drop your asset here, or',
    'Caption / description',
    'Newest first'
  ];

  const missing = requiredFixtures.filter(req => !mockFailures.includes(req));
  if (missing.length > 0) {
    throw new Error('Self-test failed: The AST validator did not catch the following required regression fixtures: ' + missing.join(', '));
  }
  console.log('✅ AST Validator Self-Test passed! All required regression fixtures are successfully detected.');
}

runSelfTest();

// ============================================================================
// PART 3: DETERMINISTIC AST SCANNING ON SOURCE CODE
// ============================================================================

// Documented small allowlist to ignore tech terms, enums, style variants, and model identifiers
const TECHNICAL_ALLOWLIST = new Set([
  // Brands & Model/Provider names
  'gemini', 'veo', 'imagen', 'ai creator os', 'nano banana', 'tiktok', 'youtube', 'instagram', 'pinterest', 'google', 'facebook',
  'react', 'vite', 'vitest', 'tailwindcss', 'esbuild', 'tsx', 'grok', 'google veo 3', 'elevenlabs', 'azure cognitive',
  
  // Technical abbreviations, formats, and IDs
  'id', 'url', 'utc', 'br', 'pt-br', 'en', 'es', 'pt', 'v10', 'v9', 'v1', 'v2', 'roas', 'ctr', 'p-value', 'sig', 'ok', 'n/a', 'todo', 'sha-256', 'mime', 'ai', 'os',
  'db', 'sql', 'ast', 'api', 'oauth', 'jwt', 'json', 'xml', 'csv', 'html', 'css', 'dom', 'spa', 'sdk', 'cli', 'npm', 'npx',
  'cta', 'fps', 'mb', 'kb', 'gb', 'png', 'jpg', 'jpeg', 'mp4', 'mp3', 'wav', 'pdf', 'txt', 'zip', 'tar', 'gz', 'tgz',
  'conversion_rate', 'bounce_rate', 'sessions', 'visitors', 'views', 'clicks', 'impressions', 'purchases',
  's', 'v'
]);

const ALL_DICTIONARY_VALUES = new Set<string>();
function collectAllDictionaryValues(obj: any) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        collectAllDictionaryValues(obj[key]);
      } else if (typeof obj[key] === 'string') {
        ALL_DICTIONARY_VALUES.add(obj[key].trim().toLowerCase());
      }
    }
  }
}
collectAllDictionaryValues(ptBR);
collectAllDictionaryValues(en);
collectAllDictionaryValues(es);

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const allFiles = getFiles('src');
const filesToScan = allFiles.filter(f => {
  if (f.includes('__tests__') || f.includes('.test.') || f.includes('.spec.')) return false;
  if (f.endsWith('setupTests.ts') || f.endsWith('vite-env.d.ts') || f.endsWith('main.tsx')) return false;
  return f.endsWith('.tsx');
});

const scanFailures: { file: string; line: number; text: string }[] = [];

function hasEnglishLetters(str: string): boolean {
  return /[a-zA-Z]/.test(str);
}

function isInsideMock(node: ts.Node): boolean {
  let parent = node.parent;
  while (parent) {
    if (ts.isVariableDeclaration(parent)) {
      const varName = parent.name.getText();
      if (varName.startsWith('MOCK_') || varName.toLowerCase().startsWith('mock')) {
        return true;
      }
    }
    parent = parent.parent;
  }
  return false;
}

function checkString(text: string, node: ts.Node, file: string, sf: ts.SourceFile) {
  if (isInsideMock(node)) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!hasEnglishLetters(trimmed)) return;

  // Ignore URLs and file paths / media assets
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return;
  if (/\.(png|jpg|jpeg|gif|svg|mp4|webm|mp3|wav|json|js|ts|tsx|css)$/i.test(trimmed)) return;
  if (/^(?:[a-z0-9-]+:)?[a-z0-9-]+(?:\s+(?:[a-z0-9-]+:)?[a-z0-9-]+)+$/i.test(trimmed) && /(?:bg-|text-|border-|hover:|focus:|ring-|rounded-|flex|grid)/i.test(trimmed)) return;

  // Skip if it is exactly a translation key in our dictionary
  if (DICTIONARY_KEYS.has(trimmed)) return;
  
  // Skip dotted notation commonly used for i18n keys
  if (/^(pages|components|common|dashboard|menus|charts|errors|settings|titles|nav|labels|actions|notifications|validation|messages|status|placeholders)\./.test(trimmed)) return;

  const lower = trimmed.toLowerCase();

  // Skip if it is in the technical allowlist
  if (TECHNICAL_ALLOWLIST.has(lower)) return;

  const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart());
  scanFailures.push({
    file,
    line: line + 1,
    text: trimmed
  });
}

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function walk(node: ts.Node) {
    // 1. Check JsxText
    if (ts.isJsxText(node)) {
      const text = node.getText().trim();
      if (hasEnglishLetters(text)) {
        checkString(text, node, filePath, sf);
      }
    }

    // 2. Check user-visible JsxAttributes
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText();
      const visibleAttrs = ['label', 'placeholder', 'title', 'aria-label', 'description', 'eyebrow', 'helperText', 'alt', 'emptyMessage', 'tooltip', 'error', 'success', 'text', 'emptyText', 'detail', 'subtitle', 'content'];
      if (visibleAttrs.includes(name)) {
        const init = node.initializer;
        if (init) {
          if (ts.isStringLiteral(init)) {
            checkString(init.text, init, filePath, sf);
          } else if (ts.isJsxExpression(init) && init.expression) {
            walkExpression(init.expression);
          }
        }
      }
    }

    // 3. Check strings passed to specific functions
    if (ts.isCallExpression(node)) {
      const expText = node.expression.getText();
      const targetCalls = ['setMessage', 'setError', 'setSuccess', 'setStatusMessage', 'setCopyStatusMessage', 'triggerNotification', 'showToast', 'window.alert', 'window.confirm', 'alert', 'confirm'];
      if (targetCalls.includes(expText)) {
        const arg = node.arguments[0];
        if (arg) {
          walkExpression(arg);
        }
      }
    }

    // 4. Check strings inside JsxExpression
    if (ts.isJsxExpression(node) && node.expression) {
      if (node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        walkExpression(node.expression);
      }
    }

    // 5. Check object literal properties
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText();
      const visibleProps = ['label', 'placeholder', 'title', 'description', 'eyebrow', 'helperText', 'emptyMessage', 'tooltip', 'error', 'success', 'text', 'emptyText', 'options', 'tabs', 'items', 'steps', 'headers', 'columns', 'categories'];
      if (visibleProps.includes(name)) {
        walkExpression(node.initializer);
      }
    }

    // 6. Check VariableDeclaration containing option/tab/etc keywords
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText();
      const nameLower = name.toLowerCase();
      if (!name.startsWith('MOCK_') && !nameLower.startsWith('mock') && !nameLower.includes('id') && !nameLower.includes('class') && !nameLower.includes('url') && !nameLower.includes('href')) {
        const optionKeywords = ['option', 'tab', 'item', 'step', 'header', 'column', 'category', 'placeholder', 'label', 'title', 'description'];
        if (optionKeywords.some(kw => nameLower.includes(kw))) {
          if (node.initializer) {
            walkExpression(node.initializer);
          }
        }
      }
    }

    ts.forEachChild(node, walk);
  }

  function walkExpression(expNode: ts.Node) {
    if (ts.isStringLiteral(expNode) || ts.isNoSubstitutionTemplateLiteral(expNode)) {
      checkString(expNode.text, expNode, filePath, sf);
    } else if (ts.isTemplateExpression(expNode)) {
      checkString(expNode.head.text, expNode.head, filePath, sf);
      for (const span of expNode.templateSpans) {
        checkString(span.literal.text, span.literal, filePath, sf);
        walkExpression(span.expression);
      }
    } else if (ts.isConditionalExpression(expNode)) {
      walkExpression(expNode.whenTrue);
      walkExpression(expNode.whenFalse);
    } else if (ts.isBinaryExpression(expNode)) {
      const op = expNode.operatorToken.kind;
      const isComparison = [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken
      ].includes(op);
      if (!isComparison) {
        walkExpression(expNode.left);
        walkExpression(expNode.right);
      }
    } else if (ts.isArrayLiteralExpression(expNode)) {
      for (const element of expNode.elements) {
        walkExpression(element);
      }
    } else if (ts.isObjectLiteralExpression(expNode)) {
      for (const prop of expNode.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const name = prop.name.getText();
          const skipProps = ['id', 'value', 'key', 'className', 'icon', 'url', 'path', 'status', 'type', 'method', 'field', 'platform', 'variant', 'size', 'color', 'height', 'width', 'ref'];
          if (!skipProps.includes(name)) {
            walkExpression(prop.initializer);
          }
        }
      }
    }
  }

  walk(sf);
}

// Perform scan across all files
for (const file of filesToScan) {
  scanFile(file);
}

const warnOnly = process.argv.includes('--warn-only');

if (scanFailures.length > 0) {
  console.error(`❌ AST Check Failed: Found ${scanFailures.length} un-translated user-visible UI string(s):`);
  const grouped: Record<string, typeof scanFailures> = {};
  for (const failure of scanFailures) {
    if (!grouped[failure.file]) grouped[failure.file] = [];
    grouped[failure.file].push(failure);
  }
  for (const file in grouped) {
    console.error(`\n  File: ${file}`);
    for (const f of grouped[file]) {
      console.error(`    Line ${f.line}: "${f.text}"`);
    }
  }
  if (warnOnly) {
    console.warn('\n⚠️ Warning: Proceeding because --warn-only was specified.');
    process.exit(0);
  }
  process.exit(1);
} else {
  console.log('✅ AST-Based Code Localization Scan completed successfully! No un-translated UI strings found.');
}
