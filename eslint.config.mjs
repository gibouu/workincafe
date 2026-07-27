import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Flat config (ESLint 9.x — Decision: ESLint 10 gated until eslint-config-next's
// bundled eslint-plugin-react supports it). Next core-web-vitals + TypeScript,
// plus the architecture import boundaries from Decision 13b (enforced with the
// built-in no-restricted-imports rule; eslint-plugin-boundaries stays
// governance-gated). `next lint` is not used; lint runs via `eslint .`.

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'docs/archive/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,

  // lib/domain: pure TypeScript — no IO, framework, provider, app, or UI imports.
  {
    files: ['lib/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/db',
                '@/lib/db/*',
                '@/lib/auth',
                '@/lib/auth/*',
                '@/lib/application',
                '@/lib/application/*',
                '@/lib/integrations/*',
                '@/lib/ingestion',
                '@/lib/ingestion/*',
                '@/lib/env/*',
                '@/app/*',
                '@/components/*',
              ],
              message: 'lib/domain must stay pure — no IO/provider/app/UI imports (Decision 13b).',
            },
            {
              group: [
                'next',
                'next/*',
                'react',
                'react-dom',
                'server-only',
                'client-only',
                'pg',
                'drizzle-orm',
              ],
              message: 'lib/domain must be framework- and IO-free (Decision 13b).',
            },
          ],
        },
      ],
    },
  },

  // Components: no database, server-only Google, auth internals, or ingestion.
  {
    files: ['components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/db',
                '@/lib/db/*',
                '@/lib/auth/*',
                '@/lib/integrations/google/server',
                '@/lib/integrations/google/server/*',
                '@/lib/ingestion',
                '@/lib/ingestion/*',
                '@/lib/env/server',
              ],
              message:
                'Components must not import server-only/db/ingestion modules (Decision 13b).',
            },
          ],
        },
      ],
    },
  },

  // GP-1 surface is mapless: no map components, Maps client adapter, or key.
  {
    files: ['components/gp1/**/*.{ts,tsx}', 'app/(operator)/gp1/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/map',
                '@/components/map/*',
                '@/lib/integrations/google/client',
                '@/lib/integrations/google/client/*',
              ],
              message: 'GP-1 is mapless — no map components or Maps client (Decision 13d).',
            },
          ],
        },
      ],
    },
  },

  // Google client adapter is browser-safe: no server modules or credentials.
  {
    files: ['lib/integrations/google/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/integrations/google/server',
                '@/lib/integrations/google/server/*',
                '@/lib/db',
                '@/lib/db/*',
                '@/lib/env/server',
                'server-only',
                'pg',
              ],
              message:
                'Google client must stay browser-safe — no server module/credential imports (Decision 13b).',
            },
          ],
        },
      ],
    },
  },

  // Routes/pages must not reach the database directly — go through lib/application.
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/db', '@/lib/db/*'],
              message:
                'Routes/pages must not access the database directly; use lib/application (Decision 13b/16a).',
            },
          ],
        },
      ],
    },
  },
]

export default config
