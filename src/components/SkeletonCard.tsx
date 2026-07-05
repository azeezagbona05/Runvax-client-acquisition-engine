export default function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-white/8 rounded-2xl p-4 flex flex-col gap-3 animate-pulse">
      {/* Category badge */}
      <div className="h-5 w-28 bg-white/8 rounded-full" />

      {/* Name */}
      <div className="space-y-1.5">
        <div className="h-4 bg-white/8 rounded-lg w-3/4" />
        <div className="h-4 bg-white/6 rounded-lg w-1/2" />
      </div>

      {/* Address */}
      <div className="h-3.5 bg-white/6 rounded-lg w-5/6" />

      {/* Phone */}
      <div className="h-3.5 bg-white/6 rounded-lg w-2/3" />

      {/* Rating */}
      <div className="h-3.5 bg-white/5 rounded-lg w-1/3" />

      {/* Footer */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="h-5 w-16 bg-white/6 rounded-full" />
        <div className="flex gap-1.5">
          <div className="h-7 w-20 bg-white/6 rounded-xl" />
          <div className="h-7 w-8 bg-white/6 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
