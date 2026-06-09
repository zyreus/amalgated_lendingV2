import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function SssPensionLoanPage() {
  const config = getPublicLoanProductConfig('sss-pension-loan')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
