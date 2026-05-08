import type { SliderAnchor } from '@/components/review/SliderRow';

export const SEATING_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Uncomfortable wooden stools' },
  { at: 3, text: 'Basic café chairs — ok for an hour' },
  { at: 5, text: 'Decent padded chairs' },
  { at: 7, text: 'Fancy four-legged chairs, good back support' },
  { at: 9, text: 'Armchairs and benches' },
  { at: 10, text: 'Sofas, library lounge — could nap here' },
];

export const OUTLETS_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'No outlets in sight' },
  { at: 3, text: 'One or two near the counter' },
  { at: 5, text: 'Scattered — find one if you’re lucky' },
  { at: 7, text: 'Most window seats have one' },
  { at: 10, text: 'An outlet at every seat' },
];

export const TEMPERATURE_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Shivering — coat stays on' },
  { at: 3, text: 'Chilly' },
  { at: 5, text: 'Just right' },
  { at: 7, text: 'Warm' },
  { at: 10, text: 'Sweating — too hot' },
];

export const BUSY_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Empty' },
  { at: 3, text: 'A few people' },
  { at: 5, text: 'Comfortable hum' },
  { at: 7, text: 'Lively' },
  { at: 9, text: 'Packed' },
  { at: 10, text: 'Wait at the door' },
];

export const OVERALL_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Avoid — bad spot to work' },
  { at: 3, text: 'Wouldn’t come back to work' },
  { at: 5, text: 'Works in a pinch' },
  { at: 7, text: 'Solid spot' },
  { at: 9, text: 'Great — would come back often' },
  { at: 10, text: 'Top-tier work spot' },
];

export const WIFI_FALLBACK_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'No Wi-Fi or unusable' },
  { at: 3, text: 'Slow — fine for email' },
  { at: 5, text: 'Ok for browsing, sluggish for video' },
  { at: 7, text: 'Smooth video calls' },
  { at: 10, text: 'Fiber-grade — fast everything' },
];

export const NOISE_FALLBACK_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Loud — can’t focus' },
  { at: 3, text: 'Busy chatter and music' },
  { at: 5, text: 'Background hum' },
  { at: 7, text: 'Mostly quiet' },
  { at: 10, text: 'Library-quiet' },
];

export const FOOD_VALUE_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Tiny portion — overpriced' },
  { at: 3, text: 'Small for the price' },
  { at: 5, text: 'Fair for the price' },
  { at: 7, text: 'Generous, good value' },
  { at: 10, text: 'Huge portion — great value' },
];

export const COFFEE_QUALITY_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Burnt or bitter — couldn’t finish' },
  { at: 3, text: 'Drinkable, nothing special' },
  { at: 5, text: 'Solid daily cup' },
  { at: 7, text: 'Genuinely good — could taste the roast' },
  { at: 10, text: 'Best coffee I’ve had in months' },
];

export const COFFEE_ART_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'A blob, no shape' },
  { at: 3, text: 'Basic heart, wobbly' },
  { at: 5, text: 'Clean rosetta' },
  { at: 7, text: 'Detailed swan or tulip' },
  { at: 10, text: 'Showpiece — would screenshot it' },
];

export const COFFEE_MUG_ANCHORS: SliderAnchor[] = [
  { at: 1, text: 'Chipped, mismatched, sad' },
  { at: 3, text: 'Generic ceramic' },
  { at: 5, text: 'Nice enough — heavy and warm' },
  { at: 7, text: 'Custom branded, fits the place' },
  { at: 10, text: 'Beautiful — handmade, distinctive' },
];
