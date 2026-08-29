export interface AnimatedAvatar {
  id: string;
  name: string;
  category: 'Romantic & Love' | 'Funny & Playful';
  url: string;
  emoji: string;
}

export const ANIMATED_AVATARS: AnimatedAvatar[] = [
  // ── Romantic & Love (13 Unique Avatars) ──
  {
    id: 'cupid-golden-pup',
    name: 'Cupid Golden',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&auto=format&fit=crop&q=80',
    emoji: '🐶',
  },
  {
    id: 'love-bunny-meadow',
    name: 'Love Bunny',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&auto=format&fit=crop&q=80',
    emoji: '🐰',
  },
  {
    id: 'cozy-cuddle-cat',
    name: 'Cozy Cat',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80',
    emoji: '😻',
  },
  {
    id: 'blushing-red-panda',
    name: 'Red Panda',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1547407139-3c921a66005c?w=400&auto=format&fit=crop&q=80',
    emoji: '🐼',
  },
  {
    id: 'baby-penguin-hug',
    name: 'Baby Penguin',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1598439210625-5067c578f3f6?w=400&auto=format&fit=crop&q=80',
    emoji: '🐧',
  },
  {
    id: 'sweet-river-otter',
    name: 'Sweet Otter',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&auto=format&fit=crop&q=80',
    emoji: '🦦',
  },
  {
    id: 'cloud-samoyed-smile',
    name: 'Cloud Samoyed',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&auto=format&fit=crop&q=80',
    emoji: '🐕',
  },
  {
    id: 'gentle-forest-fawn',
    name: 'Gentle Fawn',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=400&auto=format&fit=crop&q=80',
    emoji: '🦌',
  },
  {
    id: 'honey-hamster-cheeks',
    name: 'Honey Hamster',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&auto=format&fit=crop&q=80',
    emoji: '🐹',
  },
  {
    id: 'sweet-meadow-bunny',
    name: 'Meadow Bunny',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=400&auto=format&fit=crop&q=80',
    emoji: '🌸',
  },
  {
    id: 'fluffy-smiling-alpaca',
    name: 'Fluffy Alpaca',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?w=400&auto=format&fit=crop&q=80',
    emoji: '🦙',
  },
  {
    id: 'pure-white-kitten',
    name: 'Sweet Kitten',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400&auto=format&fit=crop&q=80',
    emoji: '🐱',
  },
  {
    id: 'sweet-yellow-duckling',
    name: 'Sweet Duckling',
    category: 'Romantic & Love',
    url: 'https://images.unsplash.com/photo-1555852095-64e7428df0fa?w=400&auto=format&fit=crop&q=80',
    emoji: '🐥',
  },

  // ── Funny & Playful (13 Unique Avatars) ──
  {
    id: 'cool-shades-cat',
    name: 'Cool Shades Cat',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&auto=format&fit=crop&q=80',
    emoji: '😎',
  },
  {
    id: 'wink-bowtie-corgi',
    name: 'Happy Corgi',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&auto=format&fit=crop&q=80',
    emoji: '🦊',
  },
  {
    id: 'playful-beagle-pup',
    name: 'Playful Beagle',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
    emoji: '🐶',
  },
  {
    id: 'flirty-fox-cub',
    name: 'Flirty Fox',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=400&auto=format&fit=crop&q=80',
    emoji: '🦊',
  },
  {
    id: 'derpy-pug-face',
    name: 'Derpy Pug',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&auto=format&fit=crop&q=80',
    emoji: '🐾',
  },
  {
    id: 'hoodie-frenchie-pup',
    name: 'Hoodie Frenchie',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80',
    emoji: '🧥',
  },
  {
    id: 'cheeky-tabby-cat',
    name: 'Cheeky Tabby',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&auto=format&fit=crop&q=80',
    emoji: '😺',
  },
  {
    id: 'happy-running-doggo',
    name: 'Joyful Doggo',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=400&auto=format&fit=crop&q=80',
    emoji: '🐕',
  },
  {
    id: 'sassy-calico-cat',
    name: 'Sassy Calico',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&auto=format&fit=crop&q=80',
    emoji: '😸',
  },
  {
    id: 'sleepy-golden-pup',
    name: 'Sleepy Pup',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&auto=format&fit=crop&q=80',
    emoji: '💤',
  },
  {
    id: 'curious-frenchie-face',
    name: 'Curious Frenchie',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=400&auto=format&fit=crop&q=80',
    emoji: '🐾',
  },
  {
    id: 'happy-golden-smile',
    name: 'Sunny Golden',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=400&auto=format&fit=crop&q=80',
    emoji: '🎾',
  },
  {
    id: 'cozy-scarf-kitty',
    name: 'Scarf Kitty',
    category: 'Funny & Playful',
    url: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=400&auto=format&fit=crop&q=80',
    emoji: '🧣',
  },
];

export const AVATAR_CATEGORIES = [
  'All',
  'Romantic & Love',
  'Funny & Playful',
] as const;
