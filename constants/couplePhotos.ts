import { ImageSourcePropType } from 'react-native';

export interface CouplePhoto {
  id: string;
  title: string;
  source: ImageSourcePropType;
}

export const COUPLE_PHOTOS: CouplePhoto[] = [
  {
    id: 'beach_sunset',
    title: 'Beach Sunset Walk',
    source: require('@/assets/images/couple_beach_sunset.jpg'),
  },
  {
    id: 'cozy_cafe',
    title: 'Morning Coffee',
    source: require('@/assets/images/couple_cafe_morning.jpg'),
  },
  {
    id: 'cooking_dinner',
    title: 'Cooking Together',
    source: require('@/assets/images/couple_cooking_dinner.jpg'),
  },
  {
    id: 'wildflower_sunset',
    title: 'Golden Sunset Hug',
    source: require('@/assets/images/couple_wildflower_sunset.jpg'),
  },
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
