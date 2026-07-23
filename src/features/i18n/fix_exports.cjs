const fs = require('fs');
const path = require('path');

const pageFiles = [
  { file: 'src/features/ai-director/pages/AIDirectorPage.tsx', name: 'AIDirectorPage' },
  { file: 'src/features/analytics-feedback/pages/AnalyticsFeedbackLoopPage.tsx', name: 'AnalyticsFeedbackLoopPage' },
  { file: 'src/features/analytics/pages/AnalyticsPage.tsx', name: 'AnalyticsPage' },
  { file: 'src/features/asset-pipeline/pages/AssetPipelinePage.tsx', name: 'AssetPipelinePage' },
  { file: 'src/features/campaign-builder/pages/CampaignBuilderPage.tsx', name: 'CampaignBuilderPage' },
  { file: 'src/features/campaigns/pages/CampaignsPage.tsx', name: 'CampaignsPage' },
  { file: 'src/features/characters/pages/CharactersPage.tsx', name: 'CharactersPage' },
  { file: 'src/features/creative-library/pages/CreativeLibraryPage.tsx', name: 'CreativeLibraryPage' },
  { file: 'src/features/creative-recipes/pages/CreativeRecipesPage.tsx', name: 'CreativeRecipesPage' },
  { file: 'src/features/digital-humans/pages/DigitalHumansPage.tsx', name: 'DigitalHumansPage' },
  { file: 'src/features/execution-center/pages/ExecutionCenterPage.tsx', name: 'ExecutionCenterPage' },
  { file: 'src/features/experimentation/pages/ExperimentationPage.tsx', name: 'ExperimentationPage' },
  { file: 'src/features/poses/pages/PosesPage.tsx', name: 'PosesPage' },
  { file: 'src/features/products/pages/ProductsPage.tsx', name: 'ProductsPage' },
  { file: 'src/features/prompt-engine/pages/PromptEnginePage.tsx', name: 'PromptEnginePage' },
  { file: 'src/features/prompt-intelligence/pages/PromptIntelligencePage.tsx', name: 'PromptIntelligencePage' },
  { file: 'src/features/provider-gateway/pages/ProviderGatewayPage.tsx', name: 'ProviderGatewayPage' },
  { file: 'src/features/publishing-hub/pages/PublishingHubPage.tsx', name: 'PublishingHubPage' },
  { file: 'src/features/research-hub/pages/ResearchHubPage.tsx', name: 'ResearchHubPage' },
  { file: 'src/features/scenes/pages/ScenesPage.tsx', name: 'ScenesPage' },
  { file: 'src/features/viral-analyzer/pages/ViralAnalyzerPage.tsx', name: 'ViralAnalyzerPage' },
  { file: 'src/features/wardrobe/pages/WardrobePage.tsx', name: 'WardrobePage' },
];

pageFiles.forEach(item => {
  const filePath = path.join(process.cwd(), item.file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${item.file}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Change "export default function PageName" to "export function PageName"
  const defaultFuncStr = `export default function ${item.name}`;
  if (content.includes(defaultFuncStr)) {
    content = content.replace(defaultFuncStr, `export function ${item.name}`);
    console.log(`Changed default function to named function in ${item.file}`);
  }

  // Ensure export default PageName; is at the bottom
  const exportDefaultStr = `export default ${item.name};`;
  if (!content.includes(exportDefaultStr)) {
    content = content.trimEnd() + `\n\nexport default ${item.name};\n`;
    console.log(`Appended export default to ${item.file}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Fixed exports across all 22 page files!');
