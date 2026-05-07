import { LoanCalculatorComponent } from '../components/LoanCalculatorComponent'

export function PublicLoanCalculatorExamplePage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <LoanCalculatorComponent variant="public" />
    </div>
  )
}
