'use client';

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar snap-x snap-mandatory pb-1">
      {children}
    </div>
  );
}
