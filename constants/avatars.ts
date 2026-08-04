export interface AnimatedAvatar {
  id: string;
  name: string;
  category: 'Romantic & Love' | 'Funny & Playful';
  url: string;
  emoji: string;
}

export const ANIMATED_AVATARS: AnimatedAvatar[] = [
  // ── Romantic & Love ──
  {
    id: 'cupid-teddy-bear',
    name: 'Cupid Bear',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&auto=format&fit=crop&q=80',
    emoji: '🧸',
  },
  {
    id: 'cuddle-bunnies-pair',
    name: 'Love Bunnies',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1591154669695-5f2a8d20c089?w=500&auto=format&fit=crop&q=80',
    emoji: '🐰',
  },
  {
    id: 'cozy-penguins-hug',
    name: 'Cozy Penguins',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1551986782-d016903f856f?w=500&auto=format&fit=crop&q=80',
    emoji: '🐧',
  },

  // ── Funny & Playful ──
  {
    id: 'funny-kiss-cat',
    name: 'Winking Kiss Cat',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80',
    emoji: '🐱',
  },
  {
    id: 'funny-bowtie-shiba',
    name: 'Bowtie Shiba',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop&q=80',
    emoji: '🐕',
  },
  {
    id: 'flirty-wink-fox',
    name: 'Flirty Fox',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=500&auto=format&fit=crop&q=80',
    emoji: '🦊',
  },
];

export const AVATAR_CATEGORIES = [
  'All',
  'Romantic & Love',
  'Funny & Playful',
] as const;
