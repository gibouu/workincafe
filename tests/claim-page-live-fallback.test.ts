import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  findPlace: vi.fn(),
  createClient: vi.fn(),
  notFound: vi.fn(),
  ClaimWizard: vi.fn(() => null),
}));

vi.mock('@/lib/demo/cities', () => ({ findPlace: mocks.findPlace }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/components/claim/ClaimWizard', () => ({ ClaimWizard: mocks.ClaimWizard }));

const PLACE_ID = '00000000-0000-0000-0000-000000000123';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findPlace.mockReturnValue(undefined);
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

async function renderClaimPage() {
  const { default: ClaimPage } = await import('@/app/place/[id]/claim/page');
  return ClaimPage({ params: Promise.resolve({ id: PLACE_ID }) });
}

describe('/place/[id]/claim live fallback', () => {
  it('surfaces Supabase lookup failures instead of converting them to 404', async () => {
    const dbError = new Error('db down');
    mocks.createClient.mockResolvedValue(
      createMockClient({
        tables: { places: { data: null, error: dbError } },
      }),
    );

    await expect(renderClaimPage()).rejects.toThrow('db down');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('returns not found for a successful lookup with no place row', async () => {
    mocks.createClient.mockResolvedValue(
      createMockClient({
        tables: { places: { data: null, error: null } },
      }),
    );

    await expect(renderClaimPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('maps a live place row into the claim wizard', async () => {
    mocks.createClient.mockResolvedValue(
      createMockClient({
        tables: {
          places: {
            data: {
              id: PLACE_ID,
              name: 'Live Cafe',
              address: null,
              neighborhood: 'Downtown',
              country: 'CA',
              category: 'cafe',
              lat: 43.65,
              lng: -79.38,
              brand: null,
              hours_json: { raw: 'Mon-Fri 9-5' },
            },
            error: null,
          },
        },
      }),
    );

    const element = await renderClaimPage();

    expect(element.props.place).toMatchObject({
      id: PLACE_ID,
      name: 'Live Cafe',
      address: '',
      neighborhood: 'Downtown',
      country: 'CA',
      category: 'cafe',
      hours_raw: 'Mon-Fri 9-5',
    });
  });
});
