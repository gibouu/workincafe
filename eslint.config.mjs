// ESLint 9 flat config. Migrated from .eslintrc.json (#152).
//
// `eslint-config-next` still ships as a legacy config (eslintrc-shape), so
// we wrap it via FlatCompat — the official path until upstream publishes a
// native flat export. Once it does, replace the FlatCompat block with
// `import nextConfig from 'eslint-config-next/flat'`.
//
// `next lint` is deprecated as of Next.js 16; the package.json script
// now invokes `eslint .` directly. The ignores below mirror what
// next.config.mjs `eslint.dirs` used to restrict (app / components /
// lib / types) — instead of an allowlist, we ignore everything else.

import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

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
  ...compat.extends('next/core-web-vitals'),
];

export default config;
