export interface CharacterReferenceImage {
  id: string;
  url: string;
  label?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CharacterVoice {
  id: string;
  name: string;
  provider: string;
  voiceId: string;
  sampleUrl?: string;
  settings?: {
    stability?: number;
    clarity?: number;
  };
}

export interface CharacterSocial {
  platform: string;
  handle: string;
  profileUrl?: string;
  followersCount?: number;
}

export interface CharacterPrompt {
  id: string;
  name: string;
  systemInstruction?: string;
  userPromptTemplate?: string;
  negativePrompt?: string;
  createdAt: string;
}

export interface CharacterCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface CharacterTag {
  id: string;
  name: string;
  color?: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  category?: CharacterCategory;
  tags?: CharacterTag[];
  referenceImages?: CharacterReferenceImage[];
  voice?: CharacterVoice;
  socials?: CharacterSocial[];
  prompts?: CharacterPrompt[];
  avatarUrl?: string;
  status?: 'active' | 'archived' | 'draft';
}
