import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function SalaryLoanPage() {
  const config = getPublicLoanProductConfig('salary-loan')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
