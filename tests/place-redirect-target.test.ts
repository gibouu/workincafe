import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/place/[id] redirect target', () => {
  it('preserves the place id for the map page to open', async () => {
    const { default: PlaceRedirect } = await import('@/app/place/[id]/page');

    await PlaceRedirect({ params: Promise.resolve({ id: 'cafe 123' }) });

    expect(mocks.redirect).toHaveBeenCalledWith('/?place=cafe%20123');
  });
});
