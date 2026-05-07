import { useContext } from 'react'
import { BorrowerAuthContext } from './borrowerAuthContext.js'

export function useBorrowerAuth() {
  const ctx = useContext(BorrowerAuthContext)
  if (ctx == null) {
    throw new Error(
      'useBorrowerAuth must be used inside BorrowerAuthProvider. ' +
        'In Root.jsx, ensure BorrowerAuthProvider wraps <Routes> and is an ancestor of BorrowerProtectedRoute. ' +
        'If the tree is correct, you may have duplicate React copies — run `npm ls react` and `npm dedupe`.',
    )
  }
  return ctx
}
