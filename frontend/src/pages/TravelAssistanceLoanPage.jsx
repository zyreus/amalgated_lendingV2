import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function TravelAssistanceLoanPage() {
  const config = getPublicLoanProductConfig('travel-assistance-loan')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
