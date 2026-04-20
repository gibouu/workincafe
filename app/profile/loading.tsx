import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfileLoading() {
  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Skeleton className="h-9 w-9" rounded="rounded-full" />

        <div className="mt-8 flex flex-col items-center">
          <Skeleton className="h-20 w-20" rounded="rounded-full" />
          <Skeleton className="mt-4 h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>

        <div className="mt-8">
          <Skeleton className="h-10" rounded="rounded-2xl" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-16" rounded="rounded-2xl" />
            <Skeleton className="h-16" rounded="rounded-2xl" />
            <Skeleton className="h-16" rounded="rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
