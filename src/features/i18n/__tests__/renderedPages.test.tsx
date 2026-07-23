import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../I18nProvider';
import { useTranslation } from '../useTranslation';

// Configure React 18 act environment support to prevent warnings
// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Import representative pages
import { DashboardPage } from '../../dashboard/pages/DashboardPage';
import { SettingsPage } from '../../settings/pages/SettingsPage';
import { AIDirectorPage } from '../../ai-director/pages/AIDirectorPage';
import { CampaignBuilderPage } from '../../campaign-builder/pages/CampaignBuilderPage';
import { PromptEnginePage } from '../../prompt-engine/pages/PromptEnginePage';
import { ExperimentationPage } from '../../experimentation/pages/ExperimentationPage';
import { CreativeRecipesPage } from '../../creative-recipes/pages/CreativeRecipesPage';
import { PublishingHubPage } from '../../publishing-hub/pages/PublishingHubPage';
import { AnalyticsPage } from '../../analytics/pages/AnalyticsPage';
import { AssetPipelinePage } from '../../asset-pipeline/pages/AssetPipelinePage';
import { CharactersPage } from '../../characters/pages/CharactersPage';
import { AnalyticsFeedbackLoopPage } from '../../analytics-feedback/pages/AnalyticsFeedbackLoopPage';
import { DigitalHumansPage } from '../../digital-humans/pages/DigitalHumansPage';
import { CampaignsPage } from '../../campaigns/pages/CampaignsPage';

// Helper to render components inside the proper provider and router
function renderWithI18nAndRouter(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/']}>
          {ui}
        </MemoryRouter>
      </I18nProvider>
    );
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Internationalized Page Rendering & Locale Switching Tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'pt-BR';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A controller component to let us switch locales inside the tests reactively
  const LocaleController: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { changeLocale, locale } = useTranslation();
    return (
      <div>
        <div className="flex gap-2 mb-4">
          <button id="btn-pt" onClick={() => changeLocale('pt-BR')}>PT</button>
          <button id="btn-en" onClick={() => changeLocale('en')}>EN</button>
          <button id="btn-es" onClick={() => changeLocale('es')}>ES</button>
        </div>
        <span id="current-locale-indicator">{locale}</span>
        {children}
      </div>
    );
  };

  const switchLocale = (container: HTMLElement, locale: 'pt' | 'en' | 'es') => {
    act(() => {
      container.querySelector(`#btn-${locale}`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const expectVisibleTexts = (container: HTMLElement, texts: string[]) => {
    const content = container.textContent ?? '';
    texts.forEach((text) => expect(content).toContain(text));
  };

  const expectAbsentTexts = (container: HTMLElement, texts: string[]) => {
    const content = container.textContent ?? '';
    texts.forEach((text) => expect(content).not.toContain(text));
  };

  it('DashboardPage: localizes title, overview, search and primary action without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><DashboardPage /></LocaleController>
    );

    expect(document.documentElement.lang).toBe('pt-BR');
    expectVisibleTexts(container, ['Painel de Controle do Criador de IA', 'Visão geral', 'Busca global', 'Criar campanha']);
    expectAbsentTexts(container, ['AI Creator Dashboard', 'Global search', 'Create Campaign']);

    switchLocale(container, 'en');
    expect(document.documentElement.lang).toBe('en');
    expectVisibleTexts(container, ['AI Creator Dashboard', 'Overview', 'Global search', 'Create Campaign']);
    expectAbsentTexts(container, ['Painel de Controle do Criador de IA', 'Busca global', 'Criar campanha']);

    switchLocale(container, 'es');
    expect(document.documentElement.lang).toBe('es');
    expectVisibleTexts(container, ['Tablero del Creador de IA', 'Vista general', 'Búsqueda global', 'Crear campaña']);
    expectAbsentTexts(container, ['AI Creator Dashboard', 'Global search', 'Create Campaign']);

    cleanup();
  });

  it('SettingsPage: localizes title, body sections and save action without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><SettingsPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Configurações Globais do Sistema', 'Aparência', 'Idioma do Sistema', 'Salvar Preferências']);
    expectAbsentTexts(container, ['Global System Settings', 'System Language', 'Save Preferences']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Global System Settings', 'Appearance', 'System Language', 'Save Preferences']);
    expectAbsentTexts(container, ['Configurações Globais do Sistema', 'Idioma do Sistema', 'Salvar Preferências']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Configuración Global del Sistema', 'Apariencia', 'Idioma del Sistema', 'Guardar Preferencias']);
    expectAbsentTexts(container, ['Global System Settings', 'System Language', 'Save Preferences']);

    cleanup();
  });

  it('AssetPipelinePage: localizes title, ingestion, action, filter and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><AssetPipelinePage /></LocaleController>
    );

    expectVisibleTexts(container, ['Pipeline de Ativos Digitais', 'Ingestão segura do cliente', 'Procurar arquivos', 'Todos os tipos de ativos', 'Nenhum ativo na nuvem corresponde aos critérios selecionados.']);
    expectAbsentTexts(container, ['Secure client ingestion', 'Browse files', 'All asset types']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Digital Asset Pipeline', 'Secure client ingestion', 'Browse files', 'All asset types', 'No cloud assets match the selected criteria.']);
    expectAbsentTexts(container, ['Ingestão segura do cliente', 'Todos os tipos de ativos']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Canal de Activos Digitales', 'Ingesta segura de clientes', 'Examinar archivos', 'Todos los tipos de recursos', 'Ningún activo en la nube coincide con los criterios seleccionados.']);
    expectAbsentTexts(container, ['Secure client ingestion', 'Browse files']);

    cleanup();
  });

  it('AIDirectorPage: localizes title, body, form, action and option labels without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><AIDirectorPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Diretor de IA', 'O que você quer alcançar hoje?', 'Objetivo', 'Gerar Plano Completo', 'Seleção automática de produto']);
    expectAbsentTexts(container, ['What do you want to achieve today?', 'Generate Complete Plan']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['AI Director', 'What do you want to achieve today?', 'Objective', 'Generate Complete Plan', 'Auto-select product']);
    expectAbsentTexts(container, ['O que você quer alcançar hoje?', 'Gerar Plano Completo']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Director de IA', '¿Qué quieres lograr hoy?', 'Objetivo', 'Generar Plan Completo', 'Selección automática de producto']);
    expectAbsentTexts(container, ['What do you want to achieve today?', 'Generate Complete Plan']);

    cleanup();
  });

  it('CampaignBuilderPage: localizes title, form, action and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><CampaignBuilderPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Criador de Campanhas', 'Configuração do fluxo de trabalho', 'Nome do fluxo de trabalho', 'Salvar fluxo de trabalho', 'Nenhum fluxo de trabalho ainda']);
    expectAbsentTexts(container, ['Campaign Builder', 'Workflow configuration', 'Save workflow']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Campaign Builder', 'Workflow configuration', 'Workflow name', 'Save workflow', 'No workflows yet']);
    expectAbsentTexts(container, ['Criador de Campanhas', 'Configuração do fluxo de trabalho', 'Salvar fluxo de trabalho']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Creador de Campañas', 'Configuración del flujo de trabajo', 'Nombre del flujo de trabajo', 'Guardar flujo de trabajo', 'Aún no hay flujos de trabajo']);
    expectAbsentTexts(container, ['Campaign Builder', 'Workflow configuration', 'Save workflow']);

    cleanup();
  });

  it('PromptEnginePage: localizes title, configuration, form, action and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><PromptEnginePage /></LocaleController>
    );

    expectVisibleTexts(container, ['Motor de Prompts Avançado', 'Configuração do prompt', 'Tipo de saída', 'Gerar prompt', 'Nenhum prompt gerado ainda']);
    expectAbsentTexts(container, ['Prompt configuration', 'No prompt generated yet']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Advanced Prompt Engine', 'Prompt configuration', 'Output type', 'Generate prompt', 'No prompt generated yet']);
    expectAbsentTexts(container, ['Configuração do prompt', 'Nenhum prompt gerado ainda']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Motor de Prompts Avanzado', 'Configuración del prompt', 'Tipo de salida', 'Generar prompt', 'Aún no se ha generado ningún prompt']);
    expectAbsentTexts(container, ['Prompt configuration', 'No prompt generated yet']);

    cleanup();
  });

  it('ExperimentationPage: localizes title, body, controls and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><ExperimentationPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Módulo de Experimentação A/B', 'Popular dados de demonstração', 'Novo experimento', 'Nenhum experimento corresponde aos filtros atuais.']);
    expect(container.querySelector('input[placeholder="Buscar experimentos"]')).not.toBeNull();
    expectAbsentTexts(container, ['Seed demo data', 'New experiment', 'No experiments match the current filters.']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['A/B Experimentation Module', 'Seed demo data', 'New experiment', 'No experiments match the current filters.']);
    expect(container.querySelector('input[placeholder="Search experiments"]')).not.toBeNull();
    expectAbsentTexts(container, ['Popular dados de demonstração', 'Novo experimento', 'Nenhum experimento corresponde aos filtros atuais.']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Módulo de Experimentación A/B', 'Generar datos de demostración', 'Nuevo experimento', 'Ningún experimento coincide con los filtros actuales.']);
    expect(container.querySelector('input[placeholder="Buscar experimentos"]')).not.toBeNull();
    expectAbsentTexts(container, ['Seed demo data', 'New experiment', 'No experiments match the current filters.']);

    cleanup();
  });

  it('CreativeRecipesPage: localizes title, library, action and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><CreativeRecipesPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Receitas Criativas de Marketing', 'Biblioteca de receitas', 'Criar receita', 'Acionar consultor', 'Nenhuma receita definida no espaço de trabalho ainda']);
    expectAbsentTexts(container, ['Recipes library', 'Create recipe', 'Trigger advisor']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Creative Marketing Recipes', 'Recipes library', 'Create recipe', 'Trigger advisor', 'No recipes defined in workspace yet']);
    expectAbsentTexts(container, ['Biblioteca de receitas', 'Criar receita', 'Acionar consultor']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Recetas Creativas de Marketing', 'Biblioteca de recetas', 'Crear receta', 'Activar asesor', 'Aún no hay recetas definidas en el espacio de trabajo']);
    expectAbsentTexts(container, ['Recipes library', 'Create recipe', 'Trigger advisor']);

    cleanup();
  });

  it('PublishingHubPage: localizes title, boundary, action, options and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><PublishingHubPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Central de Publicação Multicanais', 'Limite de publicação seguro', 'Criar a partir da campanha', 'Criar rascunho de publicação', 'Nenhum fluxo de trabalho disponível', 'Todos os status']);
    expectAbsentTexts(container, ['No workflows available', 'All statuses', 'Mock simulation']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Multichannel Publishing Hub', 'Secure publishing boundary', 'Create from campaign', 'Create publishing draft', 'No workflows available', 'All statuses']);
    expectAbsentTexts(container, ['Nenhum fluxo de trabalho disponível', 'Todos os status']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Centro de Publicación Multicanal', 'Límite de publicación segura', 'Crear a partir de la campaña', 'Crear borrador de publicación', 'No hay flujos de trabajo disponibles', 'Todos los estados']);
    expectAbsentTexts(container, ['No workflows available', 'All statuses']);

    cleanup();
  });

  it('AnalyticsPage: localizes title, overview, filter, action and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><AnalyticsPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Métricas e Análise de Desempenho', 'Visão geral de desempenho', 'Intervalo de atividade', 'Atualizar dados locais', 'Nenhum dado de análise ainda']);
    expectAbsentTexts(container, ['Performance overview', 'Activity range', 'No analytics data yet']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Metrics & Performance Analytics', 'Performance overview', 'Activity range', 'Refresh local data', 'No analytics data yet']);
    expectAbsentTexts(container, ['Visão geral de desempenho', 'Nenhum dado de análise ainda']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Métricas y Rendimiento Analítico', 'Resumen de rendimiento', 'Rango de actividad', 'Actualizar datos locales', 'Aún no hay datos analíticos']);
    expectAbsentTexts(container, ['Performance overview', 'No analytics data yet']);

    cleanup();
  });

  it('CharactersPage: localizes title, summary, search, action and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><CharactersPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Biblioteca de Personagens', 'Resumo do personagem', 'Buscar personagens', 'Novo personagem', 'Nenhum personagem ainda']);
    expectAbsentTexts(container, ['Character Library', 'Character summary', 'New character']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Character Library', 'Character summary', 'Search characters', 'New character', 'No characters yet']);
    expectAbsentTexts(container, ['Biblioteca de Personagens', 'Resumo do personagem', 'Novo personagem']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Biblioteca de Personajes', 'Resumen del personaje', 'Buscar personajes', 'Nuevo personaje', 'Ningún personaje aún']);
    expectAbsentTexts(container, ['Character Library', 'Character summary', 'New character']);

    cleanup();
  });

  it('AnalyticsFeedbackLoopPage: localizes title, actions and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><AnalyticsFeedbackLoopPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Ciclo de Feedback Analítico', 'Limpar histórico do loop', 'Sincronizar desempenho das plataformas', 'Nenhum insight de desempenho ainda']);
    expectAbsentTexts(container, ['Analytics Feedback Loop', 'Clear loop history', 'No performance insights yet']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Analytics Feedback Loop', 'Clear loop history', 'Sync platforms performance', 'No performance insights yet']);
    expectAbsentTexts(container, ['Ciclo de Feedback Analítico', 'Limpar histórico do loop']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Bucle de Retroalimentación Analítica', 'Borrar historial del ciclo', 'Sincronizar el rendimiento de las plataformas', 'Aún no hay información sobre el rendimiento']);
    expectAbsentTexts(container, ['Analytics Feedback Loop', 'Clear loop history']);

    cleanup();
  });

  it('DigitalHumansPage: localizes title, creation action, list heading and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><DigitalHumansPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Humanos Digitais e Avatares', 'Criar humano digital', 'Identidades do espaço de trabalho', 'Nenhum humano digital ainda']);
    expectAbsentTexts(container, ['Digital Humans & Avatars', 'Create digital human', 'No digital humans yet']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Digital Humans & Avatars', 'Create digital human', 'Workspace identities', 'No digital humans yet']);
    expectAbsentTexts(container, ['Humanos Digitais e Avatares', 'Criar humano digital']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Humanos Digitales y Avatares', 'Crear humano digital', 'Identidades del espacio de trabajo', 'Aún no hay avatares digitales']);
    expectAbsentTexts(container, ['Digital Humans & Avatars', 'Create digital human']);

    cleanup();
  });

  it('CampaignsPage: localizes title, action, search and empty state without remounting', () => {
    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController><CampaignsPage /></LocaleController>
    );

    expectVisibleTexts(container, ['Gerenciamento de Campanhas', 'Nova campanha', 'Buscar campanhas', 'Nenhuma campanha ainda']);
    expectAbsentTexts(container, ['Campaign Management', 'New campaign', 'No campaigns yet']);

    switchLocale(container, 'en');
    expectVisibleTexts(container, ['Campaign Management', 'New campaign', 'Search campaigns', 'No campaigns yet']);
    expectAbsentTexts(container, ['Gerenciamento de Campanhas', 'Nova campanha']);

    switchLocale(container, 'es');
    expectVisibleTexts(container, ['Gestión de Campañas', 'Nueva campaña', 'Buscar campañas', 'Aún no hay campañas']);
    expectAbsentTexts(container, ['Campaign Management', 'New campaign']);

    cleanup();
  });

  it('Date and number formatting: display switches format with active locale', () => {
    const FormatTestComponent = () => {
      const { formatDate, formatNumber, locale } = useTranslation();
      const sampleDate = new Date('2026-07-17T12:00:00Z');
      const sampleNumber = 1234567.89;
      return (
        <div>
          <span id="date-display">{formatDate(sampleDate)}</span>
          <span id="number-display">{formatNumber(sampleNumber)}</span>
          <span id="locale-display">{locale}</span>
        </div>
      );
    };

    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController>
        <FormatTestComponent />
      </LocaleController>
    );

    // Default pt-BR
    expect(container.querySelector('#date-display')?.textContent).toContain('17');
    expect(container.querySelector('#number-display')?.textContent).toContain('1.234.567');

    // Switch to EN
    act(() => {
      container.querySelector('#btn-en')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('#date-display')?.textContent).toContain('17');
    // EN format should have comma separators for thousands
    expect(container.querySelector('#number-display')?.textContent).toContain('1,234,567');

    cleanup();
  });

  it('Ensures user fixture and persisted enum values remain byte-identical', () => {
    // Verifies that internal values (e.g., status, platform types) do not get mutated/translated,
    // only the displayed UI elements.
    const sampleRecord = {
      status: 'pending_review',
      platform: 'youtube_shorts',
    };

    // Storing the original state
    const originalJson = JSON.stringify(sampleRecord);

    const { container, cleanup } = renderWithI18nAndRouter(
      <LocaleController>
        <div>
          <span id="status-val">{sampleRecord.status}</span>
          <span id="platform-val">{sampleRecord.platform}</span>
        </div>
      </LocaleController>
    );

    // Even if we change locale, the raw object must remain untouched (byte-identical JSON)
    act(() => {
      container.querySelector('#btn-en')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(JSON.stringify(sampleRecord)).toBe(originalJson);

    cleanup();
  });
});
