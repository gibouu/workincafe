export type WorkFact =
  | 'staff_chill'
  | 'forced_consumption'
  | 'hours_ok'
  | 'good_for_focus'
  | 'good_for_calls';

export interface ScoreInputs {
  wifi: number | null;
  noise: number | null;
  seating: number | null;
  outlets: number | null;
  temperatureFeel: number | null;
  currentBusyness: number | null;
  workFacts: WorkFact[];
  drinkPriceValue: number | null;
  foodPriceValue: number | null;
  /** 1–10 portion / value-for-money slider, only meaningful when ateFood */
  foodValue: number | null;
  ateFood: boolean;
}

interface Weighted {
  weight: number;
  value: number;
}

function temperatureComfort(t: number): number {
  return Math.max(1, 10 - 2 * Math.abs(t - 5));
}

function busynessComfort(b: number): number {
  return Math.max(1, 10 - 1.5 * Math.abs(b - 5));
}

export function ratingFromMbps10(mbps: number): number {
  if (mbps < 2) return 1;
  if (mbps < 5) return 2;
  if (mbps < 10) return 3;
  if (mbps < 20) return 4;
  if (mbps < 40) return 5;
  if (mbps < 70) return 6;
  if (mbps < 100) return 7;
  if (mbps < 150) return 8;
  if (mbps < 250) return 9;
  return 10;
}

export function ratingFromDb10(db: number): number {
  if (db <= 35) return 10;
  if (db <= 42) return 9;
  if (db <= 48) return 8;
  if (db <= 54) return 7;
  if (db <= 60) return 6;
  if (db <= 65) return 5;
  if (db <= 70) return 4;
  if (db <= 75) return 3;
  if (db <= 80) return 2;
  return 1;
}

export function suggestOverall(i: ScoreInputs): number {
  const parts: Weighted[] = [];
  if (i.wifi !== null) parts.push({ weight: 1.5, value: i.wifi });
  if (i.noise !== null) parts.push({ weight: 1.3, value: i.noise });
  if (i.seating !== null) parts.push({ weight: 1.4, value: i.seating });
  if (i.outlets !== null) parts.push({ weight: 1.2, value: i.outlets });
  if (i.drinkPriceValue !== null) parts.push({ weight: 0.8, value: i.drinkPriceValue });
  if (i.ateFood && i.foodPriceValue !== null) {
    parts.push({ weight: 0.6, value: i.foodPriceValue });
  }
  if (i.ateFood && i.foodValue !== null) {
    parts.push({ weight: 1.0, value: i.foodValue });
  }
  if (i.temperatureFeel !== null) {
    parts.push({ weight: 0.6, value: temperatureComfort(i.temperatureFeel) });
  }
  if (i.currentBusyness !== null) {
    parts.push({ weight: 0.4, value: busynessComfort(i.currentBusyness) });
  }
  if (parts.length === 0) return 0;

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  let mean = parts.reduce((sum, p) => sum + p.weight * p.value, 0) / totalWeight;

  // Work-fact adjustments. forced_consumption is the strongest signal that a
  // place is actively hostile to remote workers — punish it harder than the
  // positive bonuses combined.
  for (const f of i.workFacts) {
    if (f === 'staff_chill') mean += 0.5;
    else if (f === 'hours_ok') mean += 0.6;
    else if (f === 'good_for_focus') mean += 0.4;
    else if (f === 'good_for_calls') mean += 0.2;
    else if (f === 'forced_consumption') mean -= 2.0;
  }

  // Weakest-link drag: any one of the core comfort axes scoring ≤3 is a
  // dealbreaker for a work spot — the weighted mean alone smooths past it.
  const weakAxes: (number | null)[] = [i.seating, i.outlets];
  if (i.ateFood) weakAxes.push(i.foodValue);
  for (const v of weakAxes) {
    if (v !== null && v <= 3) mean -= (4 - v) * 0.5;
  }

  return Math.max(1, Math.min(10, Math.round(mean)));
}

const PRICE_BUCKETS_TO_VALUE: Record<string, number> = {
  lt2: 10,
  '2_4': 9,
  '4_6': 8,
  '6_8': 7,
  '8_10': 6,
  '10_12': 5,
  '12_14': 4,
  '14_20': 3,
  gte20: 1,
};

export function priceBucketToValue(bucket: string | null): number | null {
  if (!bucket) return null;
  return PRICE_BUCKETS_TO_VALUE[bucket] ?? null;
}
