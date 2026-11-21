export default function DashboardLoading() {
  return (
    <div
      className="space-y-8 animate-pulse"
      role="status"
      aria-label="Loading dashboard"
    >
      <div>
        <div className="h-6 w-32 rounded-lg bg-gray-200 mb-2" />
        <div className="h-4 w-56 max-w-full rounded-lg bg-gray-100" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5 flex items-start gap-4">
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gray-100" />
            <div className="flex-1 pt-1">
              <div className="h-3 w-20 rounded bg-gray-100 mb-2" />
              <div className="h-5 w-24 max-w-full rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card p-5">
            <div className="h-4 w-32 rounded bg-gray-100 mb-5" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3">
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-3 w-36 max-w-[55%] rounded bg-gray-100 mb-2" />
                    <div className="h-2.5 w-48 max-w-[75%] rounded bg-gray-100" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
