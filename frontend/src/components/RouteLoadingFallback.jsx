/**
 * Shown while lazy route chunks load. Replacing `Suspense` fallback={null} avoids a blank white screen on /admin and other code-split routes.
 */
export default function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-700">
      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#C41E3A] border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    </div>
  )
}
