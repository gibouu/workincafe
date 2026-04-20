'use client';

export function AttributionPill() {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-20 select-none rounded-full bg-white/70 px-2.5 py-1 text-[10px] text-[var(--text-tertiary)] backdrop-blur-ios">
      <span>Maps © Apple · Places © </span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto underline hover:text-[var(--text-primary)]"
      >
        OpenStreetMap
      </a>
    </div>
  );
}
