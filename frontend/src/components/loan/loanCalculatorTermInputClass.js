/** Pill-shaped controls for the home loan calculator (white field, solid border). */

const pillShell =
  'w-full min-h-[44px] rounded-full border border-black bg-white px-4 py-2.5 text-sm font-normal text-black outline-none transition focus-visible:ring-2 focus-visible:ring-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-visible:ring-white/25'

/** Months term — native number spinners on supporting browsers */
export const loanCalculatorTermMonthsInputClass =
  `${pillShell} tabular-nums placeholder:text-black/40 dark:placeholder:text-white/40`

/** Loan amount */
export const loanCalculatorAmountInputClass =
  `${pillShell} tabular-nums placeholder:text-black/40 dark:placeholder:text-white/40`

/** Product & nature selects */
export const loanCalculatorSelectClass = `${pillShell} cursor-pointer bg-white dark:bg-neutral-950`
