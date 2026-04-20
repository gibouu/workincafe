export function Skeleton({
  className,
  rounded = 'rounded-lg',
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-sys-gray-5 ${rounded} ${className ?? ''}`}
    >
      <div className="absolute inset-0 shimmer" />
    </div>
  );
}
