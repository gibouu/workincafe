import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isEmailAllowlisted: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: mocks.isEmailAllowlisted,
}));

vi.mock('@/components/icons/Icon', () => ({
  Icon: () => null,
}));

const ADMIN = { id: 'admin-1', email: 'admin@example.com' };

function makeAuthedClient() {
  return {
    ...createMockClient({
      tables: {
        users: { data: { is_admin: true }, error: null },
      },
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: ADMIN }, error: null })),
    },
  };
}

async function renderPage(): Promise<string> {
  const { default: FlaggedReviewsPage } = await import('@/app/admin/flagged-reviews/page');
  return renderToStaticMarkup(await FlaggedReviewsPage());
}

describe('admin flagged reviews page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(makeAuthedClient());
    mocks.isEmailAllowlisted.mockReturnValue(true);
  });

  it('surfaces non-missing-table flagged review query failures instead of rendering an empty queue', async () => {
    mocks.createAdminClient.mockReturnValue(
      createMockClient({
        tables: {
          flagged_reviews: {
            data: null,
            error: { code: '57014', message: 'statement timeout' },
          },
        },
      }),
    );

    const html = await renderPage();

    expect(html).toContain('Unable to load flagged reviews');
    expect(html).toContain('statement timeout');
    expect(html).not.toContain('Nothing flagged. Reports from users land here.');
  });

  it('keeps the demo-mode missing-table fallback as an empty queue', async () => {
    mocks.createAdminClient.mockReturnValue(
      createMockClient({
        tables: {
          flagged_reviews: {
            data: null,
            error: { code: '42P01', message: 'relation "flagged_reviews" does not exist' },
          },
        },
      }),
    );

    const html = await renderPage();

    expect(html).toContain('Nothing flagged. Reports from users land here.');
    expect(html).not.toContain('Unable to load flagged reviews');
  });
});
