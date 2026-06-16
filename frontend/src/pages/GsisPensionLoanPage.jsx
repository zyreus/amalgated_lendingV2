import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function GsisPensionLoanPage() {
  const config = getPublicLoanProductConfig('gsis-pension-loan')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
