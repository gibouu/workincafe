// ESLint 9 flat config (#152 + #153).
//
// As of eslint-config-next 16.x, the package ships native flat-config
// exports — no more FlatCompat shim needed. Import the array of config
// objects directly and spread.
//
// `next lint` was removed in Next.js 16; the package.json script runs
// `eslint .` directly. Ignores below mirror the old next.config.mjs
// `eslint.dirs` allowlist by exclusion.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'public/**',
      'supabase/**',
      'scripts/**',
      '.claude/**',
      '.vercel/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  // React Compiler rules (set-state-in-effect / immutability / refs) ship
  // enabled by default in next/core-web-vitals 16.x and are kept ON (#171).
  // Genuinely effect-driven sites (SSR-safe hydration, OAuth replay,
  // debounced fetch, deliberate prop→state resets) carry a scoped,
  // commented eslint-disable-next-line rather than a blanket override.
];

export default config;
