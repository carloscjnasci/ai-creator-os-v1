import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useMemo, useState } from 'react';
import { BrainCircuit, Plus, Save, UserRoundCog } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import { createId, publishCreativeEvent } from '@/core';
import { loadCharactersFromStorage, saveCharactersToStorage } from '@/features/characters/lib/characterStorage';
import type { Character } from '@/features/characters/types';
import { loadCampaignsFromStorage } from '@/features/campaigns/lib/campaignStorage';
import { loadPromptHistoryFromStorage } from '@/features/prompt-engine/promptHistoryStorage';
import { DIGITAL_HUMAN_LIFECYCLES, type DigitalHumanLifecycle, type DigitalHumanProfile } from '../types';
import { loadDigitalHumanProfiles, saveDigitalHumanProfiles } from '../lib/digitalHumanStorage';

const emptyProfile = (characterId: string): DigitalHumanProfile => ({
  id: createId('dh'), characterId, lifecycle: 'draft', personality: '', voiceDNA: '', appearanceDNA: '', promptDNA: '', negativePrompt: '', memory: '', brandRules: '', catchphrases: [], specialties: [], referenceImages: [], referenceVideos: [], updatedAt: new Date().toISOString(),
});

export function DigitalHumansPage() {
  const { t } = useTranslation();
  const { getStatusLabel } = useDisplayHelpers();
  const [characters, setCharacters] = useState<Character[]>(loadCharactersFromStorage);
  const [profiles, setProfiles] = useState<DigitalHumanProfile[]>(loadDigitalHumanProfiles);
  const [selectedId, setSelectedId] = useState(characters[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const campaigns = useMemo(loadCampaignsFromStorage, []);
  const promptHistory = useMemo(loadPromptHistoryFromStorage, []);
  const selectedCharacter = characters.find((item) => item.id === selectedId);
  const storedProfile = profiles.find((item) => item.characterId === selectedId);
  const [draft, setDraft] = useState<DigitalHumanProfile>(() => selectedId ? storedProfile ?? emptyProfile(selectedId) : emptyProfile(''));

  function selectCharacter(id: string) {
    setSelectedId(id);
    setDraft(profiles.find((item) => item.characterId === id) ?? emptyProfile(id));
    setMessage('');
  }

  function createDigitalHuman() {
    const normalized = newName.trim();
    if (!normalized) { setMessage(t('pages.digitalHumans.enterNameError')); return; }
    if (characters.some((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) { setMessage(t('pages.digitalHumans.alreadyExistsError')); return; }
    const character: Character = { id: createId('character'), name: normalized, description: t('pages.digitalHumans.defaultDescription'), createdAt: new Date().toISOString() };
    const nextCharacters = [character, ...characters];
    if (!saveCharactersToStorage(nextCharacters)) { setMessage(t('pages.digitalHumans.unableToSaveError')); return; }
    const profile = emptyProfile(character.id);
    const nextProfiles = [profile, ...profiles];
    saveDigitalHumanProfiles(nextProfiles); setCharacters(nextCharacters); setProfiles(nextProfiles); setSelectedId(character.id); setDraft(profile); setNewName(''); setMessage(t('pages.digitalHumans.createdSuccess'));
  }

  function updateField<K extends keyof DigitalHumanProfile>(key: K, value: DigitalHumanProfile[K]) { setDraft((current) => ({ ...current, [key]: value })); }

  function saveProfile() {
    if (!selectedCharacter) { setMessage(t('pages.digitalHumans.selectFirstError')); return; }
    const nextProfile = { ...draft, characterId: selectedCharacter.id, updatedAt: new Date().toISOString() };
    const next = [nextProfile, ...profiles.filter((item) => item.characterId !== selectedCharacter.id)];
    if (saveDigitalHumanProfiles(next)) { setProfiles(next); setDraft(nextProfile); setMessage(t('pages.digitalHumans.dnaSavedSuccess')); publishCreativeEvent('digital-human.updated', nextProfile); } else setMessage(t('pages.digitalHumans.unableToSaveDnaError'));
  }

  const campaignCount = selectedId ? campaigns.filter((item) => item.characterId === selectedId).length : 0;
  const promptCount = selectedId ? promptHistory.filter((item) => item.configuration.characterId === selectedId).length : 0;
  const completenessFields = [draft.personality, draft.voiceDNA, draft.appearanceDNA, draft.promptDNA, draft.memory, draft.brandRules];
  const completeness = Math.round((completenessFields.filter((value) => value.trim()).length / completenessFields.length) * 100);

  return <CosModuleShell eyebrow={t('digitalHumans.eyebrow')} title={t('digitalHumans.title')} description={t('digitalHumans.description')}>
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4"><AppCard className="space-y-3 p-5"><div className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.digitalHumans.createIdentity')}</h2></div><AppInput label={t('pages.digitalHumans.name')} fullWidth value={newName} onChange={(e) => setNewName(e.target.value)} /><AppButton fullWidth onClick={createDigitalHuman}>{t('pages.digitalHumans.createDigitalHuman')}</AppButton></AppCard><AppCard className="p-3"><p className="px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground">{t('pages.digitalHumans.workspaceIdentities')}</p><div className="space-y-1">{characters.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t('pages.digitalHumans.noDigitalHumansYet')}</p> : characters.map((item) => <button key={item.id} type="button" onClick={() => selectCharacter(item.id)} className={`w-full rounded-md px-3 py-3 text-left transition-colors ${selectedId === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><p className="text-sm font-semibold">{item.name}</p><p className={`mt-1 truncate text-xs ${selectedId === item.id ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{getStatusLabel(profiles.find((profile) => profile.characterId === item.id)?.lifecycle ?? 'draft')} · {t('pages.digitalHumans.intelligentProfile')}</p></button>)}</div></AppCard></div>
      {!selectedCharacter ? <AppCard className="flex min-h-[600px] items-center justify-center p-8 text-center"><div><UserRoundCog className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-4 text-xl font-semibold">{t('pages.digitalHumans.createYourFirstDigitalHuman')}</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('pages.digitalHumans.theProfileWillBecomeAReusableCreativeIde')}</p></div></AppCard> : <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-4"><MetricCard label={t('pages.digitalHumans.dnaCompleteness')} value={`${completeness}%`} /><MetricCard label={t('pages.digitalHumans.campaigns')} value={campaignCount} /><MetricCard label={t('pages.digitalHumans.promptHistory')} value={promptCount} /><MetricCard label={t('pages.digitalHumans.lifecycle')} value={getStatusLabel(draft.lifecycle)} /></div><AppCard className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">{selectedCharacter.name}</h2></div><p className="mt-1 text-sm text-muted-foreground">{selectedCharacter.description}</p></div><AppButton leftIcon={<Save className="h-4 w-4" />} onClick={saveProfile}>{t('pages.digitalHumans.saveDna')}</AppButton></div><p aria-live="polite" className="mt-3 text-xs text-muted-foreground">{message}</p></AppCard><div className="grid gap-5 lg:grid-cols-2"><AppCard className="space-y-4 p-5"><h3 className="font-semibold">{t('pages.digitalHumans.identityAndBehavior')}</h3><AppSelect label={t('pages.digitalHumans.lifecycle')} value={draft.lifecycle} onChange={(e) => updateField('lifecycle', e.target.value as DigitalHumanLifecycle)} options={DIGITAL_HUMAN_LIFECYCLES.map((value) => ({ value, label: getStatusLabel(value) }))} /><AppTextarea label={t('pages.digitalHumans.personality')} rows={5} value={draft.personality} onChange={(e) => updateField('personality', e.target.value)} /><AppTextarea label={t('pages.digitalHumans.voiceDna')} rows={5} value={draft.voiceDNA} onChange={(e) => updateField('voiceDNA', e.target.value)} /><AppInput label={t('pages.digitalHumans.catchphrases')} helperText={t('pages.digitalHumans.commaSeparated')} fullWidth value={draft.catchphrases.join(', ')} onChange={(e) => updateField('catchphrases', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /><AppInput label={t('pages.digitalHumans.specialties')} helperText={t('pages.digitalHumans.commaSeparated')} fullWidth value={draft.specialties.join(', ')} onChange={(e) => updateField('specialties', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></AppCard><AppCard className="space-y-4 p-5"><h3 className="font-semibold">{t('pages.digitalHumans.visualAndPromptDna')}</h3><AppTextarea label={t('pages.digitalHumans.appearanceDna')} rows={5} value={draft.appearanceDNA} onChange={(e) => updateField('appearanceDNA', e.target.value)} /><AppTextarea label={t('pages.digitalHumans.promptDna')} rows={5} value={draft.promptDNA} onChange={(e) => updateField('promptDNA', e.target.value)} /><AppTextarea label={t('pages.digitalHumans.negativePrompt')} rows={5} value={draft.negativePrompt} onChange={(e) => updateField('negativePrompt', e.target.value)} /></AppCard><AppCard className="space-y-4 p-5"><h3 className="font-semibold">{t('pages.digitalHumans.knowledgeAndMemory')}</h3><AppTextarea label={t('pages.digitalHumans.memory')} rows={8} value={draft.memory} onChange={(e) => updateField('memory', e.target.value)} /><AppTextarea label={t('pages.digitalHumans.brandRules')} rows={6} value={draft.brandRules} onChange={(e) => updateField('brandRules', e.target.value)} /></AppCard><AppCard className="space-y-4 p-5"><h3 className="font-semibold">{t('pages.digitalHumans.references')}</h3><AppTextarea label={t('pages.digitalHumans.referenceImageUrls')} rows={6} value={draft.referenceImages.join('\n')} onChange={(e) => updateField('referenceImages', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /><AppTextarea label={t('pages.digitalHumans.referenceVideoUrls')} rows={6} value={draft.referenceVideos.join('\n')} onChange={(e) => updateField('referenceVideos', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /></AppCard></div></div>}
    </div>
  </CosModuleShell>;
}

export default DigitalHumansPage;
