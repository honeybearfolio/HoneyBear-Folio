interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`}
    />
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 ${className}`}
    >
      <Skeleton className="h-4 w-1/3 mb-4" />
      <Skeleton className="h-8 w-2/3 mb-3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonChart({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 ${className}`}
    >
      <Skeleton className="h-5 w-1/4 mb-6" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/6" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-4 py-3 px-4 border-b border-slate-100 dark:border-slate-700">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-container dashboard-container animate-pulse">
      <div className="hb-header-container">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

export function ListSkeleton({ title }: { title?: string }) {
  return (
    <div className="page-container rules-container animate-pulse">
      <div className="hb-header-container mb-large">
        <div>
          {title ? (
            <h1 className="hb-header-title">{title}</h1>
          ) : (
            <Skeleton className="h-7 w-40 mb-2" />
          )}
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <SkeletonTable rows={5} />
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorStateProps) {
  return (
    <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 text-rose-700 dark:text-rose-300 p-6 rounded-2xl border-2 border-rose-200 dark:border-rose-800 shadow-md">
      <div className="flex items-center gap-3">
        <div className="bg-rose-200 dark:bg-rose-800 p-2 rounded-full flex-shrink-0">
          <svg
            className="w-6 h-6 text-rose-700 dark:text-rose-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-bold">{title}</div>
          {message && (
            <div className="text-sm text-rose-600 dark:text-rose-400 mt-1">
              {message}
            </div>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-4 py-2 text-sm font-medium bg-rose-100 dark:bg-rose-800/50 hover:bg-rose-200 dark:hover:bg-rose-700/50 text-rose-700 dark:text-rose-300 rounded-lg transition-colors cursor-pointer"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
