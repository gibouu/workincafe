import { Skeleton } from '@/components/ui/Skeleton';

export default function PlaceProfileLoading() {
  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="h-48 w-full bg-sys-gray-5">
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 shimmer" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-20" rounded="rounded-2xl" />
          <Skeleton className="h-20" rounded="rounded-2xl" />
        </div>

        <Skeleton className="mt-4 h-12" rounded="rounded-2xl" />
        <Skeleton className="mt-3 h-11" rounded="rounded-2xl" />
        <Skeleton className="mt-3 h-11" rounded="rounded-2xl" />

        <div className="mt-8 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-40" rounded="rounded-2xl" />
        </div>

        <div className="mt-8 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-20" rounded="rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
