import { ImageSourcePropType } from 'react-native';

export interface CouplePhoto {
  id: string;
  title: string;
  source: ImageSourcePropType;
}

export const COUPLE_PHOTOS: CouplePhoto[] = [
  {
    id: 'cover',
    title: 'Romantic Moments',
    source: require('@/assets/images/couple_cover.jpeg'),
  },
  {
    id: 'sunset_picnic',
    title: 'Sunset Picnic',
    source: require('@/assets/images/sunset_picnic.jpeg'),
  },
  {
    id: 'cozy_balcony',
    title: 'Morning Coffee',
    source: { uri: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop' },
  },
  {
    id: 'beach_sunset',
    title: 'Beach Sunset Walk',
    source: { uri: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000&auto=format&fit=crop' },
  },
  {
    id: 'kitchen_cooking',
    title: 'Cooking Together',
    source: { uri: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?q=80&w=1000&auto=format&fit=crop' },
  },
  {
    id: 'golden_hour',
    title: 'Golden Hour Smile',
    source: { uri: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop' },
  },
  {
    id: 'cozy_hug',
    title: 'Warm Embrace',
    source: { uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1000&auto=format&fit=crop' },
  },
];

/**
 * Returns today's daily couple photo index based on day of year.
 * Rotates automatically every single day!
 */
export function getDailyCouplePhotoIndex(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return Math.abs(dayOfYear) % COUPLE_PHOTOS.length;
}

export function getDailyCouplePhoto(date: Date = new Date()): CouplePhoto {
  const index = getDailyCouplePhotoIndex(date);
  return COUPLE_PHOTOS[index];
}
