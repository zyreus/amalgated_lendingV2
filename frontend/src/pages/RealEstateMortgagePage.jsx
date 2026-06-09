import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function RealEstateMortgagePage() {
  const config = getPublicLoanProductConfig('real-estate-mortgage')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
