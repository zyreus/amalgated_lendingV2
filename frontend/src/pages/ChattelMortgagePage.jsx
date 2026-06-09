import PublicLoanProductPage from '../components/loan/PublicLoanProductPage.jsx'
import { getPublicLoanProductConfig } from '../config/publicLoanProductConfig.js'

export default function ChattelMortgagePage() {
  const config = getPublicLoanProductConfig('chattel-mortgage')
  if (!config) return null
  return <PublicLoanProductPage config={config} />
}
