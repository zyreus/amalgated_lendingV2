import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { AdminApiAuthProvider } from './admin/context/AdminApiAuthProvider.jsx'
import { ToastProvider } from './admin/context/ToastContext.jsx'
import ProtectedAdminRoute from './admin/ProtectedAdminRoute.jsx'
import { AdminMuiProvider } from './admin/theme/AdminMuiProvider.jsx'
import { BorrowerAuthProvider } from './borrower/context/BorrowerAuthProvider.jsx'
import BorrowerProtectedRoute from './borrower/BorrowerProtectedRoute.jsx'
import { resolvedChatServerOrigin } from './utils/adminChatApi.js'
import RouteLoadingFallback from './components/RouteLoadingFallback.jsx'
/** Eager: avoids a lazy-chunk hydration race that broke admin/borrower sign-in behind some CDN/caches. */
import AdminLoginPage from './admin/pages/AdminLoginPage.jsx'
import AdminForgotPasswordPage from './admin/pages/AdminForgotPasswordPage.jsx'
import BorrowerLoginPage from './borrower/pages/BorrowerLoginPage.jsx'
import BorrowerRegisterPage from './borrower/pages/BorrowerRegisterPage.jsx'
import BorrowerForgotPasswordPage from './borrower/pages/BorrowerForgotPasswordPage.jsx'
import BorrowerVerifyOtpPage from './borrower/pages/BorrowerVerifyOtpPage.jsx'
import BorrowerResetPasswordPage from './borrower/pages/BorrowerResetPasswordPage.jsx'
import BorrowerEmailVerifyPage from './borrower/pages/BorrowerEmailVerifyPage.jsx'
import UnauthorizedPage from './pages/UnauthorizedPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import CookieBanner from './components/privacy/CookieBanner.jsx'
import CookiePreferencesModal, { COOKIE_PREFERENCES_EVENT } from './components/privacy/CookiePreferencesModal.jsx'
import { LogoutConfirmProvider } from './context/LogoutConfirmProvider.jsx'
import { LoadingProvider } from './context/LoadingProvider.jsx'

const ContactPage = lazy(() => import('./pages/ContactPage.jsx'))
const LoanProductsPage = lazy(() => import('./pages/LoanProductsPage.jsx'))
const FeaturesPage = lazy(() => import('./pages/FeaturesPage.jsx'))
const BranchesPage = lazy(() => import('./pages/BranchesPage.jsx'))
const ChattelMortgagePage = lazy(() => import('./pages/ChattelMortgagePage.jsx'))
const RealEstateMortgagePage = lazy(() => import('./pages/RealEstateMortgagePage.jsx'))
const SalaryLoanPage = lazy(() => import('./pages/SalaryLoanPage.jsx'))
const ApplianceLoanPage = lazy(() => import('./pages/ApplianceLoanPage.jsx'))
const TravelAssistanceLoanPage = lazy(() => import('./pages/TravelAssistanceLoanPage.jsx'))
const SssPensionLoanPage = lazy(() => import('./pages/SssPensionLoanPage.jsx'))
const GsisPensionLoanPage = lazy(() => import('./pages/GsisPensionLoanPage.jsx'))
const ApplyAuthRedirect = lazy(() => import('./pages/ApplyAuthRedirect.jsx'))
const DocumentLoanApplicationsPage = lazy(() => import('./admin/pages/DocumentLoanApplicationsPage.jsx'))
const DocumentLoanApplicationDetailPage = lazy(() => import('./admin/pages/DocumentLoanApplicationDetailPage.jsx'))
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))
const DashboardPage = lazy(() => import('./admin/pages/DashboardPage.jsx'))
const UsersPage = lazy(() => import('./admin/pages/UsersPage.jsx'))
const RolesPage = lazy(() => import('./admin/pages/RolesPage.jsx'))
const LoansPage = lazy(() => import('./admin/pages/LoansPage.jsx'))
const ArchivedApplicationsPage = lazy(() => import('./admin/pages/ArchivedApplicationsPage.jsx'))
const AdminNewLoanPage = lazy(() => import('./admin/pages/AdminNewLoanPage.jsx'))
const LoanDetailPage = lazy(() => import('./admin/pages/LoanDetailPage.jsx'))
const TravelLoanApplicationsPage = lazy(() => import('./admin/pages/TravelLoanApplicationsPage.jsx'))
const PaymentsPage = lazy(() => import('./admin/pages/PaymentsPage.jsx'))
const AdminSoaManagementPage = lazy(() => import('./admin/pages/AdminSoaManagementPage.jsx'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage.jsx'))
const ActivityPage = lazy(() => import('./admin/pages/ActivityPage.jsx'))
const BorrowersPage = lazy(() => import('./admin/pages/BorrowersPage.jsx'))
const ArchivedBorrowersPage = lazy(() => import('./admin/pages/ArchivedBorrowersPage.jsx'))
const BorrowerDetailPage = lazy(() => import('./admin/pages/BorrowerDetailPage.jsx'))
const ReportsPage = lazy(() => import('./admin/pages/ReportsPage.jsx'))
const AdminChatCRM = lazy(() => import('./admin/pages/AdminChatCRM.jsx'))
const NewsletterPage = lazy(() => import('./admin/pages/NewsletterPage.jsx'))
const AdminFeedbackPage = lazy(() => import('./admin/pages/AdminFeedbackPage.jsx'))
const NotificationsPage = lazy(() => import('./admin/pages/NotificationsPage.jsx'))
const BorrowerLayout = lazy(() => import('./borrower/BorrowerLayout.jsx'))
const BorrowerDashboardPage = lazy(() => import('./borrower/pages/BorrowerDashboardPage.jsx'))
const BorrowerPaymentsPage = lazy(() => import('./borrower/pages/BorrowerPaymentsPage.jsx'))
const BorrowerChatPage = lazy(() => import('./borrower/pages/BorrowerChatPage.jsx'))
const BorrowerSecurityPage = lazy(() => import('./borrower/pages/BorrowerSecurityPage.jsx'))
const BorrowerProfilePage = lazy(() => import('./borrower/pages/BorrowerProfilePage.jsx'))
const BorrowerLoanWizardPage = lazy(() => import('./borrower/pages/BorrowerLoanWizardPage.jsx'))
const SalaryLoanApplicationPage = lazy(() => import('./borrower/pages/loanApplications/SalaryLoanApplicationPage.jsx'))
const ChattelMortgageApplicationPage = lazy(() => import('./borrower/pages/loanApplications/ChattelMortgageApplicationPage.jsx'))
const RealEstateMortgageApplicationPage = lazy(() => import('./borrower/pages/loanApplications/RealEstateMortgageApplicationPage.jsx'))
const PensionLoanApplicationPage = lazy(() => import('./borrower/pages/loanApplications/PensionLoanApplicationPage.jsx'))
const TravelAssistanceApplicationPage = lazy(() => import('./borrower/pages/loanApplications/TravelAssistanceApplicationPage.jsx'))
const BorrowerApplicationsPage = lazy(() => import('./borrower/pages/BorrowerApplicationsPage.jsx'))
const AdminLoanProductsPage = lazy(() => import('./admin/pages/AdminLoanProductsPage.jsx'))
const PrintableFormsPage = lazy(() => import('./admin/pages/PrintableFormsPage.jsx'))
const ApplicationFlowPage = lazy(() => import('./pages/ApplicationFlowPage.jsx'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'))
const AdminCollectionsPipelinePage = lazy(() => import('./admin/pages/AdminCollectionsPipelinePage.jsx'))
const AdminCreditWellnessPage = lazy(() => import('./admin/pages/AdminCreditWellnessPage.jsx'))
const CollectorWellnessPage = lazy(() => import('./admin/pages/CollectorWellnessPage.jsx'))
const LoanOfficerDashboardPage = lazy(() => import('./pages/LoanOfficerDashboardPage.jsx'))
const CollectorDashboardPage = lazy(() => import('./pages/CollectorDashboardPage.jsx'))
const BorrowerCreditHealthPage = lazy(() => import('./borrower/pages/BorrowerCreditHealthPage.jsx'))
const BorrowerHelpCenterPage = lazy(() => import('./borrower/pages/BorrowerHelpCenterPage.jsx'))
const BorrowerTicketsPage = lazy(() => import('./borrower/pages/BorrowerTicketsPage.jsx'))
const BorrowerStatementsPage = lazy(() => import('./borrower/pages/BorrowerStatementsPage.jsx'))
const BorrowerPrivacyPrefsPage = lazy(() => import('./borrower/pages/BorrowerPrivacyPrefsPage.jsx'))
const BorrowerNotificationsPage = lazy(() => import('./borrower/pages/BorrowerNotificationsPage.jsx'))

/** Lazy on public pages only — chat UI is not needed for admin/borrower shells. */
const LendingChatWidget = lazy(() => import('./components/LendingChatWidget.jsx'))

/** Lowercase first segment for `/admin` and `/borrower` only (fixes `/ADMIN`, `/BORROWER/login`, …). */
function normalizePortalPath(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return pathname
  const head = parts[0].toLowerCase()
  if (head !== 'admin' && head !== 'borrower') return pathname
  const prefix = head === 'admin' ? '/admin' : '/borrower'
  const rest = parts.slice(1)
  return rest.length ? `${prefix}/${rest.join('/')}` : prefix
}

function isAdminAreaPath(pathname) {
  const first = pathname.split('/').filter(Boolean)[0]
  return first != null && first.toLowerCase() === 'admin'
}

function isBorrowerAreaPath(pathname) {
  const first = pathname.split('/').filter(Boolean)[0]
  return first != null && first.toLowerCase() === 'borrower'
}

/** Redirects synchronously so wrong-case portal URLs still match nested routes. */
function MaybeNormalizePortalUrl({ children }) {
  const { pathname, search, hash } = useLocation()
  const canonical = normalizePortalPath(pathname)
  if (canonical !== pathname) {
    return <Navigate to={`${canonical}${search}${hash}`} replace />
  }
  return children
}

/** Visitor site chat — hidden in admin and borrower portal (borrower has /borrower/chat). */
function LendingChatWidgetGate() {
  const { pathname } = useLocation()
  if (isAdminAreaPath(pathname) || isBorrowerAreaPath(pathname)) return null
  const chatOrigin = resolvedChatServerOrigin()
  if (import.meta.env.PROD && !chatOrigin) return null
  return (
    <Suspense fallback={null}>
      <LendingChatWidget />
    </Suspense>
  )
}

/** Cookie controls appear on public + borrower pages, never in admin portal. */
function CookieConsentGate({ cookieModalOpen, setCookieModalOpen }) {
  const { pathname } = useLocation()
  if (isAdminAreaPath(pathname)) return null

  return (
    <>
      <CookieBanner onOpenPreferences={() => setCookieModalOpen(true)} />
      <CookiePreferencesModal isOpen={cookieModalOpen} onClose={() => setCookieModalOpen(false)} />
    </>
  )
}

export default function Root() {
  const [cookieModalOpen, setCookieModalOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return true
    const p = window.location.pathname
    if (
      p === '/login' ||
      p === '/unauthorized' ||
      p === '/reset-password' ||
      p.startsWith('/loans/') ||
      p.startsWith('/loan-products/') ||
      p.startsWith('/apply/documents/') ||
      /^\/borrower\/apply-loan/i.test(p) ||
      /^\/admin(\/|$)/i.test(p) ||
      /^\/borrower\/email\/verify/i.test(p) ||
      /^\/borrower(\/|$)/i.test(p)
    ) {
      return false
    }
    return true
  })

  useEffect(() => {
    const onOpenPreferences = () => setCookieModalOpen(true)
    window.addEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences)
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences)
  }, [])

  return (
    <>
      <BrowserRouter>
        <MaybeNormalizePortalUrl>
        <AdminMuiProvider>
          <BorrowerAuthProvider>
            <AdminApiAuthProvider>
              <LogoutConfirmProvider>
              <LoadingProvider>
              <ToastProvider>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                <Route path="/admin" element={<Outlet />}>
                <Route path="login" element={<AdminLoginPage />} />
                <Route path="forgot-password" element={<AdminForgotPasswordPage />} />
                <Route element={<ProtectedAdminRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="roles" element={<RolesPage />} />
                    <Route path="borrowers" element={<BorrowersPage />} />
                    <Route path="borrowers/archived" element={<ArchivedBorrowersPage />} />
                    <Route path="borrowers/:id" element={<BorrowerDetailPage />} />
                    <Route path="applications" element={<LoansPage />} />
                    <Route path="applications/archived" element={<ArchivedApplicationsPage />} />
                    <Route path="loans" element={<Navigate to="/admin/applications" replace />} />
                    <Route path="travel-loans" element={<TravelLoanApplicationsPage />} />
                    <Route path="document-loan-applications" element={<DocumentLoanApplicationsPage />} />
                    <Route path="document-loan-applications/:id" element={<DocumentLoanApplicationDetailPage />} />
                    <Route path="loans/new" element={<AdminNewLoanPage />} />
                    <Route path="loans/:id" element={<LoanDetailPage />} />
                    <Route path="loan-products" element={<AdminLoanProductsPage />} />
                    <Route path="printable-forms" element={<PrintableFormsPage />} />
                    <Route path="collections" element={<AdminCollectionsPipelinePage />} />
                    <Route path="credit-wellness" element={<AdminCreditWellnessPage />} />
                    <Route path="collector-wellness" element={<CollectorWellnessPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="leads" element={<Navigate to="/admin/chat-crm?view=leads" replace />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="soa" element={<AdminSoaManagementPage />} />
                    <Route path="newsletter" element={<NewsletterPage />} />
                    <Route path="cms" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="activity" element={<ActivityPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="chat-crm" element={<AdminChatCRM />} />
                    <Route path="feedback" element={<AdminFeedbackPage />} />
                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                  </Route>
                </Route>
              </Route>
              <Route path="/borrower/email/verify/*" element={<BorrowerEmailVerifyPage />} />
              <Route path="/borrower/login" element={<BorrowerLoginPage />} />
              <Route path="/borrower/register" element={<BorrowerRegisterPage />} />
              <Route path="/borrower/verify-otp" element={<BorrowerVerifyOtpPage />} />
              <Route path="/borrower/forgot-password" element={<BorrowerForgotPasswordPage />} />
              <Route path="/borrower/reset-password" element={<BorrowerResetPasswordPage />} />
              <Route path="/borrower" element={<BorrowerProtectedRoute />}>
                <Route element={<BorrowerLayout />}>
                  <Route index element={<Navigate to="/borrower/dashboard" replace />} />
                  <Route path="dashboard" element={<BorrowerDashboardPage />} />
                  <Route path="credit-health" element={<BorrowerCreditHealthPage />} />
                  <Route path="offers" element={<Navigate to="/borrower/dashboard" replace />} />
                  <Route path="documents" element={<Navigate to="/borrower/statements" replace />} />
                  <Route path="autopay" element={<Navigate to="/borrower/payments" replace />} />
                  <Route path="statements" element={<BorrowerStatementsPage />} />
                  <Route path="tools" element={<Navigate to="/borrower/dashboard" replace />} />
                  <Route path="help" element={<BorrowerHelpCenterPage />} />
                  <Route path="tickets" element={<BorrowerTicketsPage />} />
                  <Route path="banking" element={<Navigate to="/borrower/profile" replace />} />
                  <Route path="settings/privacy" element={<BorrowerPrivacyPrefsPage />} />
                  <Route path="applications" element={<BorrowerApplicationsPage />} />
                  <Route path="notifications" element={<BorrowerNotificationsPage />} />
                  <Route path="payments" element={<BorrowerPaymentsPage />} />
                  <Route path="chat" element={<BorrowerChatPage />} />
                  <Route path="profile" element={<BorrowerProfilePage />} />
                  <Route path="security" element={<BorrowerSecurityPage />} />
                  <Route path="loan-application/salary-loan" element={<SalaryLoanApplicationPage />} />
                  <Route path="loan-application/chattel-mortgage" element={<ChattelMortgageApplicationPage />} />
                  <Route path="loan-application/real-estate-mortgage" element={<RealEstateMortgageApplicationPage />} />
                  <Route path="loan-application/pension-loan" element={<PensionLoanApplicationPage />} />
                  <Route path="loan-application/travel-assistance" element={<TravelAssistanceApplicationPage />} />
                  <Route path="apply-loan/:applicationId" element={<BorrowerLoanWizardPage />} />
                  <Route path="apply-loan" element={<BorrowerLoanWizardPage />} />
                  <Route path="*" element={<Navigate to="/borrower/dashboard" replace />} />
                </Route>
              </Route>
              <Route path="/" element={<App />} />
              <Route path="/products" element={<Navigate to="/loan-products" replace />} />
              <Route path="/loan-products" element={<LoanProductsPage />} />
              <Route path="/loan-products/salary-loan" element={<SalaryLoanPage />} />
              <Route path="/loan-products/chattel-mortgage" element={<ChattelMortgagePage />} />
              <Route path="/loan-products/real-estate-mortgage" element={<RealEstateMortgagePage />} />
              <Route path="/loan-products/appliance-loan" element={<ApplianceLoanPage />} />
              <Route path="/loan-products/appliance" element={<Navigate to="/loan-products/appliance-loan" replace />} />
              <Route path="/loan-products/sss-pension-loan" element={<SssPensionLoanPage />} />
              <Route path="/loan-products/gsis-pension-loan" element={<GsisPensionLoanPage />} />
              <Route path="/loan-products/travel-assistance-loan" element={<TravelAssistanceLoanPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/apply" element={<Navigate to="/borrower/login" replace />} />
              <Route path="/application-flow" element={<ApplicationFlowPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/apply/documents/:slug" element={<ApplyAuthRedirect />} />
              <Route path="/loans/chattel-mortgage" element={<ChattelMortgagePage />} />
              <Route path="/loans/real-estate-mortgage" element={<RealEstateMortgagePage />} />
              <Route path="/loans/salary-loan" element={<SalaryLoanPage />} />
              <Route path="/loans/appliance-loan" element={<ApplianceLoanPage />} />
              <Route path="/loans/travel-assistance-loan" element={<TravelAssistanceLoanPage />} />
              <Route path="/loans/sss-pension-loan" element={<SssPensionLoanPage />} />
              <Route path="/loans/gsis-pension-loan" element={<GsisPensionLoanPage />} />
              <Route path="/login" element={<BorrowerLoginPage />} />
              <Route path="/officer/dashboard" element={<LoanOfficerDashboardPage />} />
              <Route path="/collector/dashboard" element={<CollectorDashboardPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
                  </Routes>
                </Suspense>
                <LendingChatWidgetGate />
                <CookieConsentGate cookieModalOpen={cookieModalOpen} setCookieModalOpen={setCookieModalOpen} />
              </ToastProvider>
              </LoadingProvider>
              </LogoutConfirmProvider>
            </AdminApiAuthProvider>
          </BorrowerAuthProvider>
        </AdminMuiProvider>
        </MaybeNormalizePortalUrl>
      </BrowserRouter>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </>
  )
}
