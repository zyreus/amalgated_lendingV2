import { formatCurrencyPhp } from './applications/applicationStatus.js'
import { admin } from './AdminUi.jsx'

const CURRENCY_KEYS = new Set([
  'loan_amount',
  'market_value',
  'monthly_gross_salary',
  'monthly_net_salary',
  'monthly_income',
  'monthly_pension',
  'other_income',
  'travel_cost',
  'airfare_cost',
  'visa_cost',
  'medical_cost',
  'placement_fee',
  'processing_fee',
  'pocket_money_requirement',
  'other_expenses',
])

const FIELD_LABELS = {
  vehicle_type: 'Vehicle type',
  brand: 'Brand',
  model: 'Model',
  year_model: 'Year model',
  plate_number: 'Plate number',
  engine_number: 'Engine number',
  chassis_number: 'Chassis number',
  or_number: 'OR number',
  cr_number: 'CR number',
  loan_amount: 'Requested loan amount',
  confirmed_loan_amount: 'Confirmed loan amount',
  term_months: 'Loan term (months)',
  loan_purpose: 'Loan purpose',
  employer_name: 'Employer name',
  company_address: 'Company address',
  position: 'Position',
  employment_type: 'Employment type',
  years_of_service: 'Years of service',
  monthly_gross_salary: 'Monthly gross salary',
  monthly_net_salary: 'Monthly net salary',
  other_income: 'Other income',
  monthly_income: 'Monthly income',
  employment_status: 'Employment status',
  other_income_sources: 'Other income sources',
  pension_type: 'Pension type',
  monthly_pension: 'Monthly pension',
  sss_number: 'SSS number',
  gsis_bp_number: 'GSIS BP number',
  pension_start_date: 'Pension start date',
  bank_account_number: 'Bank account number',
  application_nature: 'Application nature',
  travel_purpose: 'Travel purpose',
  destination_country: 'Destination country',
  destination_city: 'Destination city',
  departure_date: 'Departure date',
  return_date: 'Return date',
  visa_status: 'Visa status',
  travel_agency: 'Travel agency',
  agency_name: 'Agency / employer name',
  recruitment_agency: 'Recruitment agency',
  property_type: 'Property type',
  property_address: 'Property address',
  property_description: 'Property description',
  title_number: 'Title number',
  tax_declaration_number: 'Tax declaration number',
  property_location: 'Property location',
  property_value: 'Property value',
  stencil_text: 'Stencil / identifier',
}

const COLLATERAL_SECTIONS = {
  chattel: [
    {
      title: 'Vehicle collateral',
      fields: [
        'vehicle_type',
        'brand',
        'model',
        'year_model',
        'plate_number',
        'engine_number',
        'chassis_number',
        'or_number',
        'cr_number',
      ],
    },
    {
      title: 'Loan request',
      fields: ['loan_amount', 'confirmed_loan_amount', 'term_months', 'loan_purpose'],
    },
  ],
  salary: [
    {
      title: 'Employment',
      fields: ['employer_name', 'company_address', 'position', 'employment_type', 'years_of_service'],
    },
    {
      title: 'Income',
      fields: ['monthly_gross_salary', 'monthly_net_salary', 'other_income'],
    },
    {
      title: 'Loan request',
      fields: ['loan_amount', 'confirmed_loan_amount', 'term_months', 'loan_purpose'],
    },
  ],
  real_estate: [
    {
      title: 'Property (borrower submission)',
      fields: [
        'property_type',
        'property_address',
        'property_description',
        'title_number',
        'tax_declaration_number',
        'property_location',
        'property_value',
      ],
    },
    {
      title: 'Loan request',
      fields: ['loan_amount', 'confirmed_loan_amount', 'term_months', 'loan_purpose'],
    },
  ],
  sss_pension: [
    {
      title: 'Pension details',
      fields: [
        'pension_type',
        'monthly_pension',
        'sss_number',
        'gsis_bp_number',
        'pension_start_date',
        'bank_account_number',
        'application_nature',
      ],
    },
    {
      title: 'Loan request',
      fields: ['loan_amount', 'confirmed_loan_amount', 'term_months', 'loan_purpose'],
    },
  ],
  travel_assistance: [
    {
      title: 'Travel plan',
      fields: [
        'travel_purpose',
        'destination_country',
        'destination_city',
        'departure_date',
        'return_date',
        'visa_status',
        'travel_agency',
        'agency_name',
        'recruitment_agency',
      ],
    },
    {
      title: 'Travel cost breakdown',
      fields: [
        'airfare_cost',
        'visa_cost',
        'medical_cost',
        'placement_fee',
        'processing_fee',
        'pocket_money_requirement',
        'other_expenses',
        'travel_cost',
      ],
    },
    {
      title: 'Employment & income',
      fields: ['employment_status', 'employer_name', 'company_address', 'position', 'monthly_income', 'other_income_sources'],
    },
    {
      title: 'Loan request',
      fields: ['loan_amount', 'confirmed_loan_amount', 'term_months', 'loan_purpose', 'repayment_frequency'],
    },
  ],
}

function pickDetail(app) {
  return (
    app?.chattel_mortgage_detail ||
    app?.chattelMortgageDetail ||
    app?.salary_loan_detail ||
    app?.salaryLoanDetail ||
    app?.pension_loan_detail ||
    app?.pensionLoanDetail ||
    app?.travel_assistance_detail ||
    app?.travelAssistanceDetail ||
    app?.real_estate_detail ||
    app?.realEstateDetail ||
    null
  )
}

function resolveRawValue(app, key) {
  if (!app) return null
  const form = app.form_data || {}

  if (key === 'confirmed_loan_amount') {
    return app.loan_amount != null && Number(app.loan_amount) > 0 ? app.loan_amount : null
  }

  const detail = pickDetail(app)
  if (detail && detail[key] != null && detail[key] !== '') return detail[key]
  if (form[key] != null && form[key] !== '') return form[key]
  if (app[key] != null && app[key] !== '') return app[key]
  return null
}

function formatFieldValue(key, value) {
  if (value == null || value === '') return null
  if (CURRENCY_KEYS.has(key)) {
    const n = Number(String(value).replace(/,/g, ''))
    return Number.isFinite(n) ? formatCurrencyPhp(n) : String(value)
  }
  if (key.includes('date') || key === 'birthdate') {
    const s = String(value)
    return s.length >= 10 ? s.slice(0, 10) : s
  }
  return String(value)
}

function buildSections(app) {
  const loanType = app?.loan_type || 'chattel'
  const templates = COLLATERAL_SECTIONS[loanType] || []
  const sections = []

  for (const template of templates) {
    const items = template.fields
      .map((key) => {
        const raw = resolveRawValue(app, key)
        const formatted = formatFieldValue(key, raw)
        if (!formatted) return null
        return {
          key,
          label: FIELD_LABELS[key] || key.replace(/_/g, ' '),
          value: formatted,
        }
      })
      .filter(Boolean)

    if (items.length) sections.push({ title: template.title, items })
  }

  return sections
}

export default function CollateralInformationPanel({ application }) {
  const sections = buildSections(application)
  const loanType = application?.loan_type

  if (!sections.length) {
    return (
      <div className={`text-sm ${admin.cardNoHover}`}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Collateral information</h2>
        <p className={`mt-3 text-sm ${admin.textMuted}`}>
          {loanType === 'salary'
            ? 'No employment or income collateral details were submitted on this application.'
            : loanType === 'sss_pension'
              ? 'No pension collateral details were submitted on this application.'
              : loanType === 'travel_assistance'
                ? 'No travel plan or cost details were submitted on this application.'
                : 'No vehicle or collateral details were submitted on this application.'}
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 text-sm ${admin.cardNoHover}`}>
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Collateral information</h2>
        <p className={`mt-1 text-xs ${admin.textMuted}`}>
          Application #{application.id} · {String(loanType || '').replace(/_/g, ' ')}
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
            {section.title}
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <div key={item.key}>
                <dt className={`text-xs ${admin.textMuted}`}>{item.label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
