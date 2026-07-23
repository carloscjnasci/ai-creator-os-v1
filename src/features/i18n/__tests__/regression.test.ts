import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ptBR } from '../locales/pt-BR';
import { en } from '../locales/en';
import { es } from '../locales/es';

const pageFiles = [
  'src/features/ai-director/pages/AIDirectorPage.tsx',
  'src/features/analytics-feedback/pages/AnalyticsFeedbackLoopPage.tsx',
  'src/features/analytics/pages/AnalyticsPage.tsx',
  'src/features/asset-pipeline/pages/AssetPipelinePage.tsx',
  'src/features/campaign-builder/pages/CampaignBuilderPage.tsx',
  'src/features/campaigns/pages/CampaignsPage.tsx',
  'src/features/characters/pages/CharactersPage.tsx',
  'src/features/creative-library/pages/CreativeLibraryPage.tsx',
  'src/features/creative-recipes/pages/CreativeRecipesPage.tsx',
  'src/features/digital-humans/pages/DigitalHumansPage.tsx',
  'src/features/execution-center/pages/ExecutionCenterPage.tsx',
  'src/features/experimentation/pages/ExperimentationPage.tsx',
  'src/features/poses/pages/PosesPage.tsx',
  'src/features/products/pages/ProductsPage.tsx',
  'src/features/prompt-engine/pages/PromptEnginePage.tsx',
  'src/features/prompt-intelligence/pages/PromptIntelligencePage.tsx',
  'src/features/provider-gateway/pages/ProviderGatewayPage.tsx',
  'src/features/publishing-hub/pages/PublishingHubPage.tsx',
  'src/features/research-hub/pages/ResearchHubPage.tsx',
  'src/features/scenes/pages/ScenesPage.tsx',
  'src/features/viral-analyzer/pages/ViralAnalyzerPage.tsx',
  'src/features/wardrobe/pages/WardrobePage.tsx',
  'src/features/dashboard/pages/DashboardPage.tsx',
  'src/features/settings/pages/SettingsPage.tsx',
];

function flattenDictionary(value: unknown, prefix = ''): Record<string, string> {
  const flattened: Record<string, string> = {};
  if (!value || typeof value !== 'object') return flattened;

  for (const [key, child] of Object.entries(value)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') flattened[keyPath] = child;
    else Object.assign(flattened, flattenDictionary(child, keyPath));
  }
  return flattened;
}

const ptValues = flattenDictionary(ptBR);
const enValues = flattenDictionary(en);
const esValues = flattenDictionary(es);
const translationKeys = new Set(Object.keys(ptValues));


function listSourceFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', 'node_modules', 'dist'].includes(entry.name)) continue;
      results.push(...listSourceFiles(absolute));
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(absolute);
    }
  }
  return results;
}

const allSourceFiles = listSourceFiles(path.resolve('src'));

const technicalUiAllowlist = new Set([
  'AI Creator OS',
  'Google Veo 3',
  'Grok',
  'Nano Banana',
  'TikTok',
  'Instagram',
  'YouTube',
  'Facebook',
  'LinkedIn',
  'Pinterest',
  'X / Twitter',
  'SHA-256',
  'ID',
]);

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text.trim();
  return null;
}

describe('Untranslated-UI Regression Safeguard (Sprint 14C)', () => {
  it('keeps all locale dictionaries isomorphic and placeholder-compatible', () => {
    expect(Object.keys(enValues).sort()).toEqual(Object.keys(ptValues).sort());
    expect(Object.keys(esValues).sort()).toEqual(Object.keys(ptValues).sort());

    const placeholders = (value: string) =>
      Array.from(value.matchAll(/\{([^{}]+)\}/g)).map((match) => match[1].trim()).sort();

    for (const key of translationKeys) {
      expect(placeholders(enValues[key]), `English placeholders for ${key}`).toEqual(placeholders(ptValues[key]));
      expect(placeholders(esValues[key]), `Spanish placeholders for ${key}`).toEqual(placeholders(ptValues[key]));
    }
  });

  it('resolves every literal t(...) reference used by route pages', () => {
    const failures: string[] = [];

    for (const pagePath of pageFiles) {
      const content = fs.readFileSync(path.resolve(pagePath), 'utf8');
      const sourceFile = ts.createSourceFile(pagePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      function walk(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 't') {
          const firstArgument = node.arguments[0];
          const key = firstArgument ? literalText(firstArgument) : null;
          if (key && !translationKeys.has(key)) failures.push(`${pagePath}:${lineOf(sourceFile, firstArgument)} -> ${key}`);
        }
        ts.forEachChild(node, walk);
      }
      walk(sourceFile);
    }

    expect(failures).toEqual([]);
  });

  it('resolves every literal t(...) reference across application source', () => {
    const failures: string[] = [];

    for (const sourcePath of allSourceFiles) {
      const content = fs.readFileSync(sourcePath, 'utf8');
      const kind = sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(sourcePath, content, ts.ScriptTarget.Latest, true, kind);

      function walk(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 't') {
          const firstArgument = node.arguments[0];
          const key = firstArgument ? literalText(firstArgument) : null;
          if (key && !translationKeys.has(key)) failures.push(`${sourcePath}:${lineOf(sourceFile, firstArgument)} -> ${key}`);
        }
        ts.forEachChild(node, walk);
      }
      walk(sourceFile);
    }

    expect(failures).toEqual([]);
  });

  it('forbids defaultValue fallbacks in every t(...) call', () => {
    const failures: string[] = [];

    for (const sourcePath of allSourceFiles) {
      const content = fs.readFileSync(sourcePath, 'utf8');
      const kind = sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(sourcePath, content, ts.ScriptTarget.Latest, true, kind);

      function walk(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 't') {
          for (const argument of node.arguments.slice(1)) {
            if (!ts.isObjectLiteralExpression(argument)) continue;
            for (const property of argument.properties) {
              if (ts.isPropertyAssignment(property) && property.name.getText(sourceFile).replace(/["']/g, '') === 'defaultValue') {
                failures.push(`${sourcePath}:${lineOf(sourceFile, property)} -> defaultValue`);
              }
            }
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(sourceFile);
    }

    expect(failures).toEqual([]);
  });

  it('blocks direct user-visible literals in route pages', () => {
    const failures: string[] = [];
    const visibleAttributes = new Set([
      'label', 'placeholder', 'title', 'aria-label', 'description', 'eyebrow',
      'helperText', 'alt', 'emptyMessage', 'tooltip', 'emptyText',
    ]);
    const messageCalls = new Set(['setMessage', 'setError', 'setSuccess', 'alert', 'confirm', 'window.alert', 'window.confirm']);

    const check = (text: string, pagePath: string, sourceFile: ts.SourceFile, node: ts.Node) => {
      const trimmed = text.trim();
      if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;
      if (/^(?:s|v)$/.test(trimmed)) return;
      if (technicalUiAllowlist.has(trimmed)) return;
      if (/^(?:https?:\/\/|\/|\.\/|\.\.\/)/.test(trimmed)) return;
      failures.push(`${pagePath}:${lineOf(sourceFile, node)} -> ${trimmed}`);
    };

    for (const pagePath of pageFiles) {
      const content = fs.readFileSync(path.resolve(pagePath), 'utf8');
      const sourceFile = ts.createSourceFile(pagePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      function walk(node: ts.Node) {
        if (ts.isJsxText(node)) check(node.getText(sourceFile), pagePath, sourceFile, node);

        if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(sourceFile))) {
          const initializer = node.initializer;
          if (initializer && ts.isStringLiteral(initializer)) check(initializer.text, pagePath, sourceFile, initializer);
        }

        if (ts.isCallExpression(node) && messageCalls.has(node.expression.getText(sourceFile))) {
          const firstArgument = node.arguments[0];
          const text = firstArgument ? literalText(firstArgument) : null;
          if (text) check(text, pagePath, sourceFile, firstArgument);
        }

        ts.forEachChild(node, walk);
      }
      walk(sourceFile);
    }

    expect(failures).toEqual([]);
  });

  it('rejects known mixed-language and truncation regressions', () => {
    const malformedFixtures = [
      'Campaigns currently marked Ativo',
      'No records were Criado during this range',
      'Todos file operations compute full sha256 digest',
      'Ai generator Plataforma',
      'Campaigns Creado in your workspace will be lis',
      'No DescripciÃ³n provided',
      'Criar from campaign',
      'Criar recipe',
      'Todos asset types',
      'Variant Nome',
      'Hypothesis DescriÃ§Ã£o',
      'Variant Nombre',
      'Hypothesis DescripciÃ³n',
      'Activo insights',
      'Eliminar entry',
      'Criar digital human',
      'Create digital human',
      'Contenedor de rolagem',
      'Espacio de trabalho',
    ];

    const localizedValues = [...Object.values(ptValues), ...Object.values(esValues)];
    for (const fixture of malformedFixtures) {
      expect(localizedValues.some((value) => value.toLowerCase().includes(fixture.toLowerCase()))).toBe(false);
    }
  });

  it('rejects cross-locale words in Portuguese and Spanish dictionaries', () => {
    const portugueseOnlyWords = [
      'trabalho', 'criado', 'criada', 'descriÃ§Ã£o', 'nome', 'cenÃ¡rio',
      'nenhum', 'nenhuma', 'ainda', 'excluir', 'salvar', 'configuraÃ§Ãµes',
    ];
    const spanishOnlyWords = [
      'trabajo', 'creado', 'creada', 'descripciÃ³n', 'nombre', 'escena',
      'ningÃºn', 'ninguna', 'todavÃ­a', 'eliminar', 'guardar', 'configuraciÃ³n',
    ];

    const tokenizes = (value: string) =>
      new Set(value.toLowerCase().replace(/\{[^{}]+\}/g, ' ').match(/[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±Ã£ÃµÃ¢ÃªÃ´Ã§-]+/g) ?? []);

    const failures: string[] = [];
    for (const [key, value] of Object.entries(ptValues)) {
      const words = tokenizes(value);
      const leaks = spanishOnlyWords.filter((word) => words.has(word));
      if (leaks.length > 0) failures.push(`pt-BR ${key}: ${leaks.join(', ')}`);
    }
    for (const [key, value] of Object.entries(esValues)) {
      const words = tokenizes(value);
      const leaks = portugueseOnlyWords.filter((word) => words.has(word));
      if (leaks.length > 0) failures.push(`es ${key}: ${leaks.join(', ')}`);
    }

    expect(failures).toEqual([]);
  });


  it('keeps the source HTML defaulted to pt-BR metadata', () => {
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(indexHtml).toMatch(/<html\s+lang=["']pt-BR["']/i);
    expect(indexHtml).not.toMatch(/workspace for AI-powered marketing campaigns/i);
  });

});
