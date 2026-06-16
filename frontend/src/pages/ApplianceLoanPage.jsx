import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function ApplianceLoanPage() {
  const config = getPublicLoanProductConfig('appliance')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
