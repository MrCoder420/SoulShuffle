export interface AnimatedAvatar {
  id: string;
  name: string;
  category: 'Love & Romance' | 'Celestial & Cosmic' | 'Vibe & Sparks';
  url: string;
  emoji: string;
}

export const ANIMATED_AVATARS: AnimatedAvatar[] = [
  // ── Love & Romance (8 3D Rendered Avatars) ──
  {
    id: 'sparkling-heart-3d',
    name: 'Sparkling Heart',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Sparkling%20heart/3D/sparkling_heart_3d.png',
    emoji: '💖',
  },
  {
    id: 'heart-ribbon-3d',
    name: 'Gifted Heart',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Heart%20with%20ribbon/3D/heart_with_ribbon_3d.png',
    emoji: '🎀',
  },
  {
    id: 'heart-on-fire-3d',
    name: 'Heart on Fire',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Heart%20on%20fire/3D/heart_on_fire_3d.png',
    emoji: '❤️‍🔥',
  },
  {
    id: 'heart-with-arrow-3d',
    name: 'Cupid Arrow',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Heart%20with%20arrow/3D/heart_with_arrow_3d.png',
    emoji: '💘',
  },
  {
    id: 'two-hearts-3d',
    name: 'Two Hearts',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Two%20hearts/3D/two_hearts_3d.png',
    emoji: '💕',
  },
  {
    id: 'diamond-ring-3d',
    name: 'Diamond Ring',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Ring/3D/ring_3d.png',
    emoji: '💍',
  },
  {
    id: 'velvet-rose-3d',
    name: 'Velvet Rose',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Rose/3D/rose_3d.png',
    emoji: '🌹',
  },
  {
    id: 'cherry-blossom-3d',
    name: 'Sakura Petals',
    category: 'Love & Romance',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Cherry%20blossom/3D/cherry_blossom_3d.png',
    emoji: '🌸',
  },

  // ── Celestial & Cosmic (8 3D Rendered Avatars) ──
  {
    id: 'ringed-planet-3d',
    name: 'Ringed Planet',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Ringed%20planet/3D/ringed_planet_3d.png',
    emoji: '🪐',
  },
  {
    id: 'crescent-moon-3d',
    name: 'Crescent Moon',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crescent%20moon/3D/crescent_moon_3d.png',
    emoji: '🌙',
  },
  {
    id: 'sparkles-gold-3d',
    name: 'Magic Sparkles',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Sparkles/3D/sparkles_3d.png',
    emoji: '✨',
  },
  {
    id: 'glowing-star-3d',
    name: 'Glowing Star',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Glowing%20star/3D/glowing_star_3d.png',
    emoji: '🌟',
  },
  {
    id: 'shooting-star-3d',
    name: 'Shooting Star',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Shooting%20star/3D/shooting_star_3d.png',
    emoji: '🌠',
  },
  {
    id: 'crystal-ball-3d',
    name: 'Crystal Ball',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crystal%20ball/3D/crystal_ball_3d.png',
    emoji: '🔮',
  },
  {
    id: 'gem-stone-3d',
    name: 'Brilliant Gem',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Gem%20stone/3D/gem_stone_3d.png',
    emoji: '💎',
  },
  {
    id: 'rainbow-3d',
    name: 'Prism Rainbow',
    category: 'Celestial & Cosmic',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Rainbow/3D/rainbow_3d.png',
    emoji: '🌈',
  },

  // ── Vibe & Sparks (8 3D Rendered Avatars) ──
  {
    id: 'royal-crown-3d',
    name: 'Royal Crown',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crown/3D/crown_3d.png',
    emoji: '👑',
  },
  {
    id: 'wildfire-3d',
    name: 'Wildfire',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Fire/3D/fire_3d.png',
    emoji: '🔥',
  },
  {
    id: 'clinking-glasses-3d',
    name: 'Cheers Toast',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Clinking%20glasses/3D/clinking_glasses_3d.png',
    emoji: '🥂',
  },
  {
    id: 'candle-light-3d',
    name: 'Candle Light',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Candle/3D/candle_3d.png',
    emoji: '🕯️',
  },
  {
    id: 'wrapped-gift-3d',
    name: 'Mystery Gift',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Wrapped%20gift/3D/wrapped_gift_3d.png',
    emoji: '🎁',
  },
  {
    id: 'cocktail-glass-3d',
    name: 'Night Cocktail',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Cocktail%20glass/3D/cocktail_glass_3d.png',
    emoji: '🍸',
  },
  {
    id: 'musical-notes-3d',
    name: 'Melody Notes',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Musical%20notes/3D/musical_notes_3d.png',
    emoji: '🎵',
  },
  {
    id: 'party-popper-3d',
    name: 'Confetti Joy',
    category: 'Vibe & Sparks',
    url: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Party%20popper/3D/party_popper_3d.png',
    emoji: '🎉',
  },
];

export const AVATAR_CATEGORIES = [
  'All',
  'Love & Romance',
  'Celestial & Cosmic',
  'Vibe & Sparks',
] as const;




