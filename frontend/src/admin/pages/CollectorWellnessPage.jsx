import { admin } from '../components/AdminUi.jsx'
import CollectorWellnessView from '../../components/wellness/CollectorWellnessView.jsx'
import WellnessReportsPanel from '../../components/wellness/WellnessReportsPanel.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'

export default function CollectorWellnessPage() {
  const { can } = useAdminApiAuth()
  const canViewPortfolio = can('reports.view')

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Collector wellness view</h1>
        <p className={admin.pageSubtitle}>
          Monitor at-risk accounts, missed payments, and collection priorities aligned with borrower wellness scores.
        </p>
      </div>

      <CollectorWellnessView canViewPortfolio={canViewPortfolio} />

      {canViewPortfolio ? <WellnessReportsPanel roleLabel="Collector" /> : null}
    </div>
  )
}
