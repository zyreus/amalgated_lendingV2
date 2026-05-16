import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center page-shell-bg px-6 text-gray-900 transition-colors duration-300 dark:bg-[#0F172A] dark:[background-image:none] dark:text-gray-100">
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Unauthorized</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You do not have permission to access this page.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/borrower/login"
            className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Borrower Login
          </Link>
          <Link
            to="/admin/login"
            className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#1F2937]"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  )
}
