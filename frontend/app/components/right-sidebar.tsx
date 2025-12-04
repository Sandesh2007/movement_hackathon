export function RightSidebar() {
  return (
    <div className="hidden w-80 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 xl:flex">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Recent
        </h2>
        <div className="mt-6 space-y-4">
          {/* Placeholder items for recent activity */}
          <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              💬
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Token Swap
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                2 mins ago
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              💰
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Balance Check
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                1 hour ago
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              🌉
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Bridge Assets
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Yesterday
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
