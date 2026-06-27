import { beforeEach, describe, expect, it } from 'vitest';
import { useFilters } from '@/lib/store/filters';

describe('filter store', () => {
  beforeEach(() => {
    useFilters.getState().reset();
  });

  it('does not count unsupported controls as active filters', () => {
    const filters = useFilters.getState();

    filters.setOpenNow(true);
    filters.setOutdoor(true);
    filters.setQuietNow(true);
    filters.setMaxDistanceKm(10);

    expect(useFilters.getState().activeCount()).toBe(0);
  });

  it('still counts filters backed by map result predicates', () => {
    const filters = useFilters.getState();

    filters.setOutlets(true);
    filters.setNoise('quiet');
    filters.setWifi('fast');
    filters.setSeats('plenty');
    filters.setMinRating(4.0);
    filters.setMembership('free-only');

    expect(useFilters.getState().activeCount()).toBe(6);
  });
});
