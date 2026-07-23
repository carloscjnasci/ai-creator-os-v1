import { z } from 'zod';
import { DIGITAL_HUMAN_LIFECYCLES } from '../types';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';
import type { DigitalHumanProfile } from '../types';

export const DIGITAL_HUMAN_PROFILE_STORAGE_KEY = 'ai-creator-os.digital-human-profiles.v1';
export const digitalHumanProfileSchema = z.object({
  id: z.string().min(1),
  characterId: z.string().min(1),
  lifecycle: z.enum(DIGITAL_HUMAN_LIFECYCLES),
  personality: z.string(), voiceDNA: z.string(), appearanceDNA: z.string(), promptDNA: z.string(), negativePrompt: z.string(), memory: z.string(), brandRules: z.string(),
  catchphrases: z.array(z.string()), specialties: z.array(z.string()), referenceImages: z.array(z.string()), referenceVideos: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
export const parseStoredDigitalHumanProfiles = (value: string | null) => parseCollection(value, digitalHumanProfileSchema);
export const loadDigitalHumanProfiles = () => loadCollection(DIGITAL_HUMAN_PROFILE_STORAGE_KEY, digitalHumanProfileSchema);
export const saveDigitalHumanProfiles = (items: DigitalHumanProfile[]) => saveCollection(DIGITAL_HUMAN_PROFILE_STORAGE_KEY, items);
