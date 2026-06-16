import { PUBLIC_LOAN_PRODUCT_CONFIG } from '../config/publicLoanProductConfig.js'

const DISPLAY_ORDER = [
  'salary-loan',
  'chattel-mortgage',
  'real-estate-mortgage',
  'appliance',
  'sss-pension-loan',
  'gsis-pension-loan',
  'travel-assistance-loan',
]

const CARD_OVERRIDES = {
  'salary-loan': {
    name: 'Salary Loan',
  },
  'chattel-mortgage': {
    name: 'Chattel Mortgage Loan',
  },
  'real-estate-mortgage': {
    name: 'Real Estate Mortgage Loan',
  },
  appliance: {
    slug: 'appliance-loan',
    source_slug: 'appliance',
    name: 'Appliance Loan',
    icon_key: 'appliance',
    description: 'Retail financing for appliances, electronics, and approved partner purchases.',
    features: ['Fast Processing', 'Flexible Terms', 'Partner Purchase Support', 'Household Essentials'],
  },
  'sss-pension-loan': {
    name: 'SSS Pension Loan',
  },
  'gsis-pension-loan': {
    slug: 'gsis-pension-loan',
    source_slug: 'sss-pension-loan',
    name: 'GSIS Pension Loan',
    icon_key: 'shield',
    tier: 'green',
    description: 'Pension-based financing pathway for qualified GSIS members and retirees.',
    features: ['Pension Friendly', 'Flexible Terms', 'Secure Uploads', 'Application Tracking'],
  },
  'travel-assistance-loan': {
    name: 'Travel Assistance Loan',
    icon_key: 'plane',
    tier: 'orange',
    description:
      'Financial assistance designed for OFWs, seafarers, students, tourists, and professionals requiring travel-related funding for deployment, education, medical travel, visa processing, and overseas opportunities.',
    loanAmountLabel: 'PHP 10,000 - PHP 500,000',
    termLabel: '3 - 36 Months',
    features: ['Fast Approval', 'Flexible Terms', 'OFW Friendly', 'Travel Cost Financing'],
    purposes: [
      'OFW Deployment',
      'Seafarer Deployment',
      'Tourist Travel',
      'Educational Travel',
      'Medical Travel',
      'Immigration Processing',
      'Business Travel',
    ],
  },
}

function enrichProduct(product, override = {}) {
  const slug = override.slug || product.slug
  const config = PUBLIC_LOAN_PRODUCT_CONFIG[product.slug] || PUBLIC_LOAN_PRODUCT_CONFIG[slug] || {}
  return {
    ...product,
    description: config.description || product.description,
    features: config.features?.map((f) => f.title) || [],
    ...override,
    id: override.slug ? `${product.id}-${override.slug}` : product.id,
    slug,
    apply_slug: override.source_slug || product.slug,
    display_slug: slug,
    icon_key: override.icon_key || config.iconKey || product.icon_key,
    tier: override.tier || config.tier || product.tier,
    name: override.name || config.title || product.name,
  }
}

export function buildLoanProductDisplayCards(products) {
  const bySlug = new Map((products || []).map((product) => [String(product.slug || '').toLowerCase(), product]))
  const cards = []

  for (const slug of DISPLAY_ORDER) {
    if (slug === 'gsis-pension-loan') {
      const pension = bySlug.get('sss-pension-loan')
      if (pension) cards.push(enrichProduct(pension, CARD_OVERRIDES[slug]))
      continue
    }

    const product = bySlug.get(slug)
    if (product) cards.push(enrichProduct(product, CARD_OVERRIDES[slug]))
  }

  for (const product of products || []) {
    const slug = String(product.slug || '').toLowerCase()
    if (!DISPLAY_ORDER.includes(slug)) cards.push(enrichProduct(product, CARD_OVERRIDES[slug] || {}))
  }

  return cards
}
