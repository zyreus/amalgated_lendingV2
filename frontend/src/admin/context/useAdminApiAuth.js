import { useContext } from 'react'
import { AdminApiAuthContext } from './adminApiAuthContext.js'

export function useAdminApiAuth() {
  const ctx = useContext(AdminApiAuthContext)
  if (ctx == null) {
    throw new Error(
      'useAdminApiAuth must be used inside AdminApiAuthProvider. ' +
        'In Root.jsx, ensure AdminApiAuthProvider wraps <Routes> and is an ancestor of ProtectedAdminRoute. ' +
        'If the tree is correct, you may have duplicate React copies — run `npm ls react` and `npm dedupe`.',
    )
  }
  return ctx
}
