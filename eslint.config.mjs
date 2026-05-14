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
  {
    // React Compiler rules — newly enabled by default in next/core-web-vitals
    // 16.x. They prepare for the React Compiler, but we don't have
    // `reactCompiler: true` set, so they flag valid non-compiled patterns
    // as errors (localStorage hydration in effects, debounce-via-closure,
    // initialCenterRef.current reads during render).
    //
    // Disabling here for the #153 migration to avoid a sprawling refactor.
    // Revisit when we adopt the React Compiler — see the follow-up issue.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
];

export default config;
