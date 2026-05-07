export type LoanNature = 'new' | 'reloan'

export interface LoanProductLite {
  id: number
  slug: string
  code: string | null
  name: string
  interest_rate: number
  rate_type: 'monthly' | 'annual' | 'fixed'
  max_term: number | null
  max_amount: number | null
  collateral_type?: string | null
  description?: string | null
}

export interface ComputeLoanInput {
  product_id?: number
  product_code?: string
  product_slug?: string
  loan_amount: number
  term_months: number
  application_nature: LoanNature
  age?: number
  monthly_pension?: number
}

export interface ComputeLoanResult {
  product: {
    id: number
    slug: string
    code: string | null
    name: string
    interest_rate: number
    monthly_rate_percent_effective: number
  }
  inputs: {
    loan_amount: number
    term_months: number
    application_nature: LoanNature
    age?: number | null
    monthly_pension?: number | null
  }
  breakdown: {
    service_charge: number
    insurance: number
    documentary_stamp: number
    notarial_fee: number
    mortgage_fee: number
    monthly_principal: number
    monthly_interest: number
    monthly_amortization: number
    total_add_on_interest: number
    total_payable: number
    total_miscellaneous_fees: number
    net_proceeds: number
  }
  summary: {
    loan_amount: number
    term_months: number
    monthly_rate_percent_effective: number
    total_add_on_interest: number
    total_payable: number
    total_miscellaneous_fees: number
    net_proceeds: number
  }
  schedule: Array<{
    installment_no: number
    beginning_balance: number
    principal: number
    interest: number
    amortization: number
    ending_balance: number
  }>
  notes: string[]
}

export interface LoanApplicationPayload {
  loan_product_id: number
  loan_amount: number
  term_months: number
  loan_type?: string
  application_nature: LoanNature
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
  co_maker_name?: string
  co_maker_email?: string
  co_maker_phone?: string
  age?: number
  monthly_pension?: number
  form_data?: Record<string, unknown>
  documents?: Record<string, unknown>
}
