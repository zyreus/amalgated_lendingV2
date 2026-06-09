import { borrowerLoginApplyPath } from './borrowerAuthApplyPath.js'

/** Map public loan product slug to borrower portal apply entry (auth required). */
export function loanProductApplyPath(slug) {
  return borrowerLoginApplyPath(slug)
}
