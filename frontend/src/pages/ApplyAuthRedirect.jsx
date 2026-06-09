import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { borrowerLoginApplyPath } from '../utils/borrowerAuthApplyPath.js'

/** Redirect legacy `/apply` and document-upload entry points to borrower authentication. */
export default function ApplyAuthRedirect() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const product = slug || searchParams.get('product') || ''
  return <Navigate to={borrowerLoginApplyPath(product)} replace />
}
