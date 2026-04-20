export interface DemoReview {
  id: string;
  author: string;
  initials: string;
  trust: number;
  rating: number;
  wifi?: number;
  noise?: number;
  seating?: number;
  comment: string;
  createdAgo: string;
  geoVerified: boolean;
}

const REVIEW_POOL: Omit<DemoReview, 'id'>[] = [
  {
    author: 'Amélie P.',
    initials: 'AP',
    trust: 82,
    rating: 5,
    wifi: 5,
    noise: 4,
    seating: 4,
    comment:
      'Quiet corner in the back is a laptop haven. Wi-Fi held 60 Mbps through a 3-hour call.',
    createdAgo: '2d ago',
    geoVerified: true,
  },
  {
    author: 'Marco S.',
    initials: 'MS',
    trust: 54,
    rating: 4,
    wifi: 4,
    noise: 3,
    seating: 3,
    comment: 'Baristas are kind about table time until the noon rush. Outlets only on two tables.',
    createdAgo: '5d ago',
    geoVerified: true,
  },
  {
    author: 'Rafaela T.',
    initials: 'RT',
    trust: 71,
    rating: 4,
    wifi: 3,
    noise: 2,
    seating: 3,
    comment: 'Weekend brunch crowd is loud but weekday mornings are calm.',
    createdAgo: '1w ago',
    geoVerified: true,
  },
  {
    author: 'Jonas K.',
    initials: 'JK',
    trust: 37,
    rating: 3,
    wifi: 3,
    noise: 2,
    seating: 2,
    comment: 'Good espresso. Seating turns over fast at lunch — get there before 11.',
    createdAgo: '2w ago',
    geoVerified: false,
  },
  {
    author: 'Saoirse D.',
    initials: 'SD',
    trust: 91,
    rating: 5,
    wifi: 5,
    noise: 5,
    seating: 4,
    comment:
      'Zoom-friendly nook by the window, nobody bothers you. Matcha is legit. Veteran-approved.',
    createdAgo: '3w ago',
    geoVerified: true,
  },
];

// Deterministic pick of N reviews per place so the demo is stable across reloads.
export function reviewsForPlace(placeId: string, count = 3): DemoReview[] {
  const seed = placeId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = Math.min(count, REVIEW_POOL.length);
  const out: DemoReview[] = [];
  for (let i = 0; i < n; i++) {
    const src = REVIEW_POOL[(seed + i * 7) % REVIEW_POOL.length];
    out.push({ ...src, id: `${placeId}-review-${i}` });
  }
  return out;
}
