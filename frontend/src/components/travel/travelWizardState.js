/** Default Travel Assistance wizard payload (matches Laravel TravelLoanWizardController). */

export const DRAFT_KEY = 'amalgated_travel_loan_wizard_draft_v1'

export function createEmptyWizard() {
  return {
    loan: {
      amount_of_loan: '',
      purpose_of_loan: '',
      desired_term: '1',
      country_destination: '',
      referred_by: '',
      travel_date: '',
    },
    personal: {
      email: '',
      last_name: '',
      first_name: '',
      middle_name: '',
      birthday: '',
      place_of_birth: '',
      civil_status: '',
      gender: '',
      citizenship: 'Filipino',
      mother_maiden_name: '',
      home_address: '',
      barangay: '',
      city: '',
      province: '',
      zip_code: '',
      move_in_date: '',
      residence_type: '',
      telephone_no: '',
      mobile_no: '',
      provincial_address: '',
    },
    employment: {
      employment_type: '',
      tin: '',
      sss_gsis: '',
      employer_name: '',
      employer_address: '',
      employer_tel: '',
      start_date: '',
      position: '',
    },
    spouse: {
      spouse_name: '',
      spouse_employment_type: '',
      spouse_sss: '',
      spouse_employer_name: '',
      spouse_employer_address: '',
      spouse_tel: '',
      spouse_position: '',
    },
    dependents: [],
    contact_persons: [],
  }
}

export function createEmptyDependent() {
  return { name: '', birthdate: '', school_or_work: '' }
}

export const TRAVEL_TERMS_TEXT = `TERMS AND CONDITIONS — TRAVEL ASSISTANCE LOAN

1. The borrower certifies that all information provided in this application is true and complete.
2. Amalgated Lending Inc. may verify employment, identity, and collateral information with third parties.
3. Loan approval is subject to credit evaluation and internal policies; submission does not guarantee approval.
4. Interest, fees, and repayment terms will be disclosed in the loan agreement upon approval.
5. The borrower authorizes Amalgated Lending Inc. to process personal data in accordance with applicable privacy laws.
6. Failure to disclose material facts may result in denial or cancellation of the loan.
7. Disbursement may require a designated bank account and completed KYC requirements.
8. These terms supplement the formal loan agreement executed at release of proceeds.`
