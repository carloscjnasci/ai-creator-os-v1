import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  User,
  ExternalLink,
  Mic,
  Tag,
  Folder,
  MessageSquare,
  Activity,
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';

import { AppButton } from '@/components/ui/AppButton';
import {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter
} from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppBadge from '@/components/ui/AppBadge';
import AppAvatar from '@/components/ui/AppAvatar';
import AppEmptyState from '@/components/ui/AppEmptyState';
import AppModal from '@/components/ui/AppModal';
import AppDivider from '@/components/ui/AppDivider';
import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';

import { Character, CharacterCategory, CharacterTag } from '../types/character';

// Mock Categories
const MOCK_CATEGORIES: CharacterCategory[] = [
  { id: 'cat-1', name: 'Lifestyle & Travel', slug: 'lifestyle-travel', description: 'Influencers and vloggers focused on daily life, tourism, and experiences.' },
  { id: 'cat-2', name: 'Tech & Gaming', slug: 'tech-gaming', description: 'Subject matter experts on hardware, software, and gaming content.' },
  { id: 'cat-3', name: 'Corporate & Training', slug: 'corporate-training', description: 'Professional narrators and presenters suitable for corporate communications.' },
  { id: 'cat-4', name: 'Sports & Adventure', slug: 'sports-adventure', description: 'High-energy athletes and trainers for active lifestyle brands.' }
];

// Mock Tags
const MOCK_TAGS: CharacterTag[] = [
  { id: 'tag-1', name: 'Energetic', color: 'primary' },
  { id: 'tag-2', name: 'Analytical', color: 'info' },
  { id: 'tag-3', name: 'Professional', color: 'warning' },
  { id: 'tag-4', name: 'Vibrant', color: 'success' },
  { id: 'tag-5', name: 'Calm', color: 'secondary' },
  { id: 'tag-6', name: 'Bold', color: 'danger' }
];

// Mock Characters list
const MOCK_CHARACTERS: Character[] = [
  {
    id: 'char-1',
    name: 'Sofia Silva',
    description: 'A vibrant lifestyle and travel content creator. She connects with young audiences through her authentic tone, focusing on sustainable living, fashion trends, and hidden travel gems.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    createdAt: '2025-11-10T14:30:00Z',
    updatedAt: '2026-02-15T09:12:00Z',
    category: MOCK_CATEGORIES[0],
    tags: [MOCK_TAGS[0], MOCK_TAGS[3]],
    status: 'active',
    voice: {
      id: 'v-1',
      name: 'Sofia (Portuguese-Accent-EN)',
      provider: 'ElevenLabs',
      voiceId: 'eleven-sofia-991',
      settings: { stability: 0.75, clarity: 0.85 }
    },
    socials: [
      { platform: 'Instagram', handle: '@sofia_travels', profileUrl: '#' },
      { platform: 'TikTok', handle: '@sofia_silva_creates', profileUrl: '#' }
    ],
    prompts: [
      {
        id: 'p-1',
        name: 'Standard Dialogue',
        systemInstruction: 'You are Sofia, a warm, outgoing, and eco-conscious 26-year-old traveler. Use occasional casual slang and express curiosity about world cultures. Never sound preachy.',
        userPromptTemplate: 'Introduce {product_name} in a casual, vlog-style transition while discussing your trip to Lisbon.',
        createdAt: '2025-11-12T10:00:00Z'
      }
    ],
    referenceImages: [
      { id: 'img-1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', label: 'Casual Outdoor', isPrimary: true, createdAt: '2025-11-10T14:35:00Z' },
      { id: 'img-2', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80', label: 'Studio Portrait', isPrimary: false, createdAt: '2025-11-10T14:36:00Z' }
    ]
  },
  {
    id: 'char-2',
    name: 'Marcus Vance',
    description: 'An analytical gaming host and hardware reviewer. Marcus has a deep tech background and explains complex software/hardware integration with clarity, enthusiasm, and dry wit.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    createdAt: '2025-12-01T10:15:00Z',
    updatedAt: '2026-03-01T16:45:00Z',
    category: MOCK_CATEGORIES[1],
    tags: [MOCK_TAGS[1], MOCK_TAGS[0]],
    status: 'active',
    voice: {
      id: 'v-2',
      name: 'Marcus Tech Pro',
      provider: 'ElevenLabs',
      voiceId: 'eleven-marcus-004',
      settings: { stability: 0.8, clarity: 0.9 }
    },
    socials: [
      { platform: 'YouTube', handle: '@MarcusReviewsTech', profileUrl: '#' },
      { platform: 'Twitter', handle: '@marcus_vance_tech', profileUrl: '#' }
    ],
    prompts: [
      {
        id: 'p-2',
        name: 'Technical Review',
        systemInstruction: 'You are Marcus, a sharp, tech-fluent content reviewer. Focus on benchmark statistics, design ergonomics, and cost-benefit trade-offs. Avoid generic marketing fluff.',
        userPromptTemplate: 'Give a comprehensive breakdown of {product_name} after a 48-hour intense test-run.',
        createdAt: '2025-12-02T11:00:00Z'
      }
    ],
    referenceImages: [
      { id: 'img-3', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80', label: 'Desk Setup Look', isPrimary: true, createdAt: '2025-12-01T10:20:00Z' }
    ]
  },
  {
    id: 'char-3',
    name: 'Dr. Elena Rostova',
    description: 'A poised and professional corporate speaker and educator. Elena specializes in executive communication, training modules, compliance briefs, and formal presentations.',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    createdAt: '2026-01-15T08:00:00Z',
    category: MOCK_CATEGORIES[2],
    tags: [MOCK_TAGS[2], MOCK_TAGS[4]],
    status: 'active',
    voice: {
      id: 'v-3',
      name: 'Elena Professional Warm',
      provider: 'Azure Cognitive',
      voiceId: 'en-US-ElenaNeural',
      settings: { stability: 0.9, clarity: 0.95 }
    },
    socials: [
      { platform: 'LinkedIn', handle: 'elena-rostova-phd', profileUrl: '#' }
    ],
    prompts: [
      {
        id: 'p-3',
        name: 'Corporate Compliance',
        systemInstruction: 'You are Dr. Elena Rostova, a respectful, clear-speaking professional. Use flawless English, present details logically, and maintain an engaging, professional tone.',
        userPromptTemplate: 'Present the training guidelines on safety standards for {product_name}.',
        createdAt: '2026-01-16T09:00:00Z'
      }
    ],
    referenceImages: [
      { id: 'img-4', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80', label: 'Office Setting', isPrimary: true, createdAt: '2026-01-15T08:05:00Z' }
    ]
  },
  {
    id: 'char-4',
    name: 'Zack "Aero" Miller',
    description: 'A daring skateboarder and stunt coordinator. Zack is casual, raw, and high-impact. He communicates with massive energy, inspiring audiences to push past their physical limits.',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
    createdAt: '2026-02-28T17:40:00Z',
    category: MOCK_CATEGORIES[3],
    tags: [MOCK_TAGS[5], MOCK_TAGS[0]],
    status: 'draft',
    voice: {
      id: 'v-4',
      name: 'Zack Action Heavy',
      provider: 'ElevenLabs',
      voiceId: 'eleven-zack-982'
    },
    socials: [
      { platform: 'Instagram', handle: '@zack_skates_aero', profileUrl: '#' }
    ],
    prompts: [
      {
        id: 'p-4',
        name: 'Adrenaline High',
        systemInstruction: 'You are Zack, a pumped-up stunt rider. Focus heavily on speed, courage, style, and extreme challenges. Keep the vocabulary high-octane.',
        createdAt: '2026-02-28T17:50:00Z'
      }
    ],
    referenceImages: [
      { id: 'img-5', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80', label: 'Skater Profile', isPrimary: true, createdAt: '2026-02-28T17:45:00Z' }
    ]
  }
];

export function CharacterListPage() {
  const { t, formatDate } = useTranslation();
  const { getStatusLabel } = useDisplayHelpers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest'>('name');

  // Modal active character detail state
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Filter & Search Logic
  const filteredCharacters = useMemo(() => {
    return MOCK_CHARACTERS.filter((char) => {
      // Search text match
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        char.name.toLowerCase().includes(query) ||
        char.description.toLowerCase().includes(query) ||
        (char.category && char.category.name.toLowerCase().includes(query));

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' ||
        (char.category && char.category.id === selectedCategory);

      // Tag filter
      const matchesTag =
        selectedTag === 'all' ||
        (char.tags && char.tags.some((tag) => tag.id === selectedTag));

      // Status filter
      const matchesStatus =
        selectedStatus === 'all' || char.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesTag && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  }, [searchQuery, selectedCategory, selectedTag, selectedStatus, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTag('all');
    setSelectedStatus('all');
    setSortBy('name');
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'linkedin':
        return <Linkedin className="h-4 w-4" />;
      case 'youtube':
        return <Youtube className="h-4 w-4" />;
      case 'twitter':
      case 'x':
        return <Twitter className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (color?: string): 'primary' | 'info' | 'warning' | 'success' | 'secondary' | 'danger' | 'default' => {
    switch (color) {
      case 'primary': return 'primary';
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'secondary': return 'secondary';
      case 'danger': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            {t('pages.characters.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            {t('pages.characters.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AppButton
            variant="primary"
            onClick={() => alert(t('pages.characters.creatingInterfacePhaseMsg'))}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {t('pages.characters.newCharacter')}
          </AppButton>
        </div>
      </div>

      {/* Control Panel / Filter & Search Area */}
      <AppCard className="bg-card/50 backdrop-blur-sm border-border p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Search bar */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Search className="h-3 w-3" /> {t('common.search')}
            </label>
            <div className="relative">
              <AppInput
                id="search-input"
                placeholder={t('pages.characters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Folder className="h-3 w-3" /> {t('common.category')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t('pages.characters.allCategories')}</option>
              {MOCK_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tag filter */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Tag className="h-3 w-3" /> {t('pages.characters.tagLabel')}
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t('pages.characters.allTags')}</option>
              {MOCK_TAGS.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Activity className="h-3 w-3" /> {t('common.status')}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t('pages.characters.allStatuses')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="draft">{t('common.draft')}</option>
            </select>
          </div>

          {/* Sort field */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Filter className="h-3 w-3" /> {t('pages.characters.sortBy')}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'newest' | 'oldest')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="name">{t('pages.characters.alphabetical')}</option>
              <option value="newest">{t('pages.characters.newestCreated')}</option>
              <option value="oldest">{t('pages.characters.oldestCreated')}</option>
            </select>
          </div>
        </div>

        {/* Clear filters label */}
        {(searchQuery || selectedCategory !== 'all' || selectedTag !== 'all' || selectedStatus !== 'all' || sortBy !== 'name') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={resetFilters}
              className="text-xs text-primary hover:underline font-medium transition-colors"
            >
              {t('pages.characters.clearFiltersReset')}
            </button>
          </div>
        )}
      </AppCard>

      {/* Grid of Characters */}
      {filteredCharacters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharacters.map((character) => {
            const primaryImg = character.referenceImages?.find((img) => img.isPrimary) || character.referenceImages?.[0];
            return (
              <AppCard
                key={character.id}
                className="group flex flex-col h-full border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 rounded-xl overflow-hidden cursor-pointer"
                onClick={() => setSelectedCharacter(character)}
              >
                {/* Reference Banner Header */}
                <div className="h-44 w-full relative bg-muted overflow-hidden">
                  {primaryImg ? (
                    <img
                      src={primaryImg.url}
                      alt={character.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {character.category && (
                      <AppBadge variant="primary" size="sm" radius="pill">
                        {character.category.name}
                      </AppBadge>
                    )}
                  </div>

                  <div className="absolute top-3 right-3">
                    <AppBadge
                      variant={character.status === 'active' ? 'success' : 'warning'}
                      size="sm"
                      radius="pill"
                    >
                      {getStatusLabel(character.status)}
                    </AppBadge>
                  </div>
                </div>

                {/* Character Meta Content */}
                <AppCardContent className="flex-1 flex flex-col p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <AppAvatar
                      src={character.avatarUrl}
                      alt={character.name}
                      size="md"
                      className="border-2 border-background shadow-sm"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {character.name}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {t('pages.characters.created')} {formatDate(character.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {character.description}
                  </p>

                  {/* Character Tags */}
                  {character.tags && character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {character.tags.map((tag) => (
                        <AppBadge
                          key={tag.id}
                          variant={getBadgeVariant(tag.color)}
                          size="sm"
                        >
                          #{tag.name}
                        </AppBadge>
                      ))}
                    </div>
                  )}

                  {/* Voice Settings preview */}
                  {character.voice && (
                    <div className="bg-muted/50 rounded-lg p-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Mic className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold text-foreground">{t('pages.characters.voiceLabel')}</span>
                      <span className="truncate">{character.voice.name}</span>
                    </div>
                  )}
                </AppCardContent>

                {/* Footer Social actions */}
                <AppCardFooter className="bg-muted/20 border-t border-border p-4 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    {character.socials?.map((social, idx) => (
                      <span
                        key={idx}
                        title={`${social.platform}: ${social.handle}`}
                        className="p-1.5 rounded-full bg-muted/60 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {getSocialIcon(social.platform)}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium group-hover:underline">
                    {t('pages.characters.viewFullProfile')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                </AppCardFooter>
              </AppCard>
            );
          })}
        </div>
      ) : (
        <AppCard className="border-border bg-card p-12 text-center">
          <AppEmptyState
            icon={<User className="h-12 w-12 text-muted-foreground" />}
            title={t('pages.characters.noCharactersMatchFilters')}
            description={t('pages.characters.noCharactersMatchFiltersDesc')}
            action={
              <AppButton variant="outline" onClick={resetFilters}>
                {t('pages.characters.resetAllFilters')}
              </AppButton>
            }
          />
        </AppCard>
      )}

      {/* Character Profile Detail Modal */}
      {selectedCharacter && (
        <AppModal
          isOpen={!!selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          title={`${t('pages.characters.characterProfileLabel')} ${selectedCharacter.name}`}
        >
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            {/* Modal Hero Banner */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <AppAvatar
                src={selectedCharacter.avatarUrl}
                alt={selectedCharacter.name}
                size="lg"
                className="ring-4 ring-primary/20"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedCharacter.name}
                  </h2>
                  <AppBadge
                    variant={selectedCharacter.status === 'active' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {selectedCharacter.status === 'active' ? t('common.active') : t('common.draft')}
                  </AppBadge>
                </div>
                {selectedCharacter.category && (
                  <p className="text-sm font-semibold text-primary">
                    {selectedCharacter.category.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('pages.characters.lastUpdated')} {selectedCharacter.updatedAt ? formatDate(selectedCharacter.updatedAt) : formatDate(selectedCharacter.createdAt)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> {t('pages.characters.biographyCoreConcept')}
              </h4>
              <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-lg p-3 border border-border/40">
                {selectedCharacter.description}
              </p>
            </div>

            <AppDivider />

            {/* Voice Settings Detailed */}
            {selectedCharacter.voice && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mic className="h-4 w-4 text-primary" /> {t('pages.characters.voiceConfigurationTts')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 border border-border p-3 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">{t('pages.characters.voiceName')}</span>
                    <span className="font-semibold text-foreground">{selectedCharacter.voice.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">{t('pages.characters.provider')}</span>
                    <span className="font-semibold text-foreground">{selectedCharacter.voice.provider}</span>
                  </div>
                  {selectedCharacter.voice.settings && (
                    <>
                      <div>
                        <span className="text-muted-foreground text-xs block">{t('pages.characters.stability')}</span>
                        <span className="font-semibold text-foreground">
                          {Math.round(selectedCharacter.voice.settings.stability! * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">{t('pages.characters.clarityTargetQuality')}</span>
                        <span className="font-semibold text-foreground">
                          {Math.round(selectedCharacter.voice.settings.clarity! * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <AppDivider />

            {/* System Prompts Section */}
            {selectedCharacter.prompts && selectedCharacter.prompts.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-primary" /> {t('pages.characters.systemInstructionsAiPrompts')}
                </h4>
                {selectedCharacter.prompts.map((p) => (
                  <div key={p.id} className="border border-border rounded-lg bg-card overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-xs font-bold border-b border-border flex justify-between items-center">
                      <span>{t('pages.characters.promptTemplate', { name: p.name })}</span>
                      <AppBadge variant="outline" size="sm">
                        <Sparkles className="h-3 w-3 text-amber-500 mr-1" /> {t('common.ready')}
                      </AppBadge>
                    </div>
                    <div className="p-3 space-y-3 text-xs">
                      {p.systemInstruction && (
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-1">{t('pages.characters.systemInstructionLabel')}</span>
                          <code className="block bg-muted/60 p-2.5 rounded border border-border/40 text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                            {p.systemInstruction}
                          </code>
                        </div>
                      )}
                      {p.userPromptTemplate && (
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-1">{t('pages.characters.userPromptTemplateLabel')}</span>
                          <code className="block bg-muted/60 p-2.5 rounded border border-border/40 text-foreground font-mono leading-relaxed">
                            {p.userPromptTemplate}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <AppDivider />

            {/* Reference Images Gallery */}
            {selectedCharacter.referenceImages && selectedCharacter.referenceImages.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('pages.characters.referenceVisualAssets', { count: selectedCharacter.referenceImages.length })}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCharacter.referenceImages.map((img) => (
                    <div key={img.id} className="space-y-1.5 border border-border rounded-lg overflow-hidden p-1.5 bg-muted/10">
                      <div className="aspect-square relative rounded overflow-hidden bg-muted">
                        <img
                           src={img.url}
                           alt={img.label || t('pages.characters.referenceAlt')}
                           referrerPolicy="no-referrer"
                           className="w-full h-full object-cover"
                        />
                        {img.isPrimary && (
                          <span className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {t('pages.characters.primaryPose')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-center font-medium text-foreground truncate">
                        {img.label || t('pages.characters.standardPose')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social Accounts list */}
            {selectedCharacter.socials && selectedCharacter.socials.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('pages.characters.linkedCreatorAccounts')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCharacter.socials.map((social, idx) => (
                    <a
                      key={idx}
                      href={social.profileUrl || '#'}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground border border-border/60 px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                      {getSocialIcon(social.platform)}
                      <span>{social.platform}: {social.handle}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <AppButton variant="outline" onClick={() => setSelectedCharacter(null)}>
              {t('pages.characters.closeProfile')}
            </AppButton>
          </div>
        </AppModal>
      )}
    </div>
  );
}

export default CharacterListPage;
