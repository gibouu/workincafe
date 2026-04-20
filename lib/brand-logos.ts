/**
 * Brand logo registry for known café / bakery / coworking / hotel chains.
 *
 * For MVP we render a monogram on a brand-tinted bubble. Swap the `initials`
 * field for an `imageSrc` field later if/when we host real logo files under
 * /public/brand-logos/.
 */

export interface BrandLogo {
  initials: string;
  bg: string;
  fg?: string;
}

const LOGOS: Record<string, BrandLogo> = {
  // --- Paris ---
  'anticafé':           { initials: 'A',   bg: '#F2994A' },
  'anticafe':           { initials: 'A',   bg: '#F2994A' },
  'the hoxton':         { initials: 'H',   bg: '#1F2A44' },
  'poilâne':            { initials: 'P',   bg: '#D4A574', fg: '#1F1008' },
  'poilane':            { initials: 'P',   bg: '#D4A574', fg: '#1F1008' },
  'terres de café':     { initials: 'TdC', bg: '#3E2A1A' },
  'terres de cafe':     { initials: 'TdC', bg: '#3E2A1A' },
  'ten belles':         { initials: '10',  bg: '#C2410C' },
  'holybelly 5':        { initials: 'HB',  bg: '#0F172A' },
  'boot café':          { initials: 'B',   bg: '#8D6E55' },
  'boot cafe':          { initials: 'B',   bg: '#8D6E55' },
  'télescope':          { initials: 'T',   bg: '#2C3E50' },
  'telescope':          { initials: 'T',   bg: '#2C3E50' },
  'remix coworking':    { initials: 'R',   bg: '#16A085' },

  // --- Toronto ---
  'boxcar social harbourfront': { initials: 'BC',  bg: '#1E3A5F' },
  'de mello coffee':            { initials: 'DM',  bg: '#6B4F3B' },
  "balzac's coffee roasters":   { initials: 'B',   bg: '#9A3B2A' },
  'balzacs':                    { initials: 'B',   bg: '#9A3B2A' },
  'workhaus':                   { initials: 'WH',  bg: '#16A085' },
  'pilot coffee te aro':        { initials: 'P',   bg: '#102A43' },
  'the drake hotel':            { initials: 'D',   bg: '#4B0082' },
  'nadège pâtisserie':          { initials: 'N',   bg: '#C48A4B' },
  'nadege patisserie':          { initials: 'N',   bg: '#C48A4B' },
  'fahrenheit coffee':          { initials: 'F',   bg: '#C0392B' },
  'sam james coffee bar':       { initials: 'SJ',  bg: '#0B2545' },
  'gladstone house':            { initials: 'G',   bg: '#5E2C7A' },
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function brandLogoFor(name: string): BrandLogo | null {
  const direct = LOGOS[name.toLowerCase()];
  if (direct) return direct;
  const norm = normalize(name);
  if (LOGOS[norm]) return LOGOS[norm];
  // Partial match so 'Balzac' matches 'Balzacs Coffee Roasters' etc.
  for (const key of Object.keys(LOGOS)) {
    if (norm.includes(normalize(key))) return LOGOS[key];
  }
  return null;
}
