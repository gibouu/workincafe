import type { PhosphorIconName } from '@/components/icons/Icon';

export type PlaceCategory =
  | 'cafe'
  | 'bakery'
  | 'library'
  | 'coworking'
  | 'hotel'
  | 'restaurant'
  | 'fast_food'
  | 'fast_food_burger'
  | 'other';

export interface CategoryMeta {
  label: string;
  color: string;
  icon: PhosphorIconName;
}

export const CATEGORIES: Record<PlaceCategory, CategoryMeta> = {
  cafe:             { label: 'Café',              color: '#6B4F3B', icon: 'Coffee' },
  bakery:           { label: 'Bakery',            color: '#D4A574', icon: 'Bread' },
  library:          { label: 'Library',           color: '#2C3E50', icon: 'BookOpen' },
  coworking:        { label: 'Coworking',         color: '#16A085', icon: 'Briefcase' },
  hotel:            { label: 'Hotel',             color: '#8E44AD', icon: 'Bed' },
  restaurant:       { label: 'Restaurant',        color: '#C0392B', icon: 'ForkKnife' },
  // Legacy bucket — no rows live here after migration 020 + split script.
  // Kept in the enum so historical references and external imports still
  // resolve to a sensible label.
  fast_food:        { label: 'Fast food',         color: '#E67E22', icon: 'Hamburger' },
  fast_food_burger: { label: 'Fast food (burger)', color: '#E67E22', icon: 'Hamburger' },
  other:            { label: 'Other',             color: '#5A5A60', icon: 'MapPin' },
};

export function categoryMeta(category: PlaceCategory): CategoryMeta {
  return CATEGORIES[category] ?? CATEGORIES.other;
}
