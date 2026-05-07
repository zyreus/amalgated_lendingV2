// DB provider facade.
//
// Set DB_PROVIDER=mysql to use MySQL; otherwise SQLite (sql.js file) is used.
// MySQL requires async calls; this facade always exports async functions.

const providerName = (process.env.DB_PROVIDER || 'sqlite').toLowerCase().trim()
if (process.env.NODE_ENV === 'production' && providerName !== 'mysql') {
  throw new Error('DB_PROVIDER=mysql is required in production for chat-server durability.');
}

const impl = providerName === 'mysql'
  ? await import('./providers/mysql.js')
  : await import('./providers/sqlite.js')

export const DB_PROVIDER = providerName

export const createConversation = impl.createConversation
export const getConversation = impl.getConversation
export const getAllConversations = impl.getAllConversations
export const updateStatus = impl.updateStatus
export const updateMode = impl.updateMode
export const updateVisitor = impl.updateVisitor
export const touchConversation = impl.touchConversation
export const addMessage = impl.addMessage
export const incrementConversationUnread = impl.incrementConversationUnread
export const clearConversationUnread = impl.clearConversationUnread
export const getMessages = impl.getMessages
export const getArchivedConversations = impl.getArchivedConversations
export const archiveConversation = impl.archiveConversation
export const deleteConversation = impl.deleteConversation

export const createLead = impl.createLead
export const getLeads = impl.getLeads
export const getLeadById = impl.getLeadById
export const updateLeadStatus = impl.updateLeadStatus
export const updateLead = impl.updateLead
export const deleteLeadById = impl.deleteLeadById

export const createOrUpdateVisit = impl.createOrUpdateVisit
export const getVisitByVisitId = impl.getVisitByVisitId
export const updateVisitLocation = impl.updateVisitLocation
export const getAllVisits = impl.getAllVisits
export const getVisitsForAnalytics = impl.getVisitsForAnalytics

export const createTicket = impl.createTicket
export const getTickets = impl.getTickets
export const getTicketById = impl.getTicketById
export const getTicketsByConvo = impl.getTicketsByConvo
export const updateTicket = impl.updateTicket
export const setTicketUnread = impl.setTicketUnread
export const getCrmTickets = impl.getCrmTickets
export const getCrmTicketById = impl.getCrmTicketById
export const createCrmTicket = impl.createCrmTicket
export const updateCrmTicket = impl.updateCrmTicket
export const deleteCrmTicket = impl.deleteCrmTicket
export const addCrmTicketReply = impl.addCrmTicketReply
export const addCrmTicketNote = impl.addCrmTicketNote
export const setCrmTicketUnread = impl.setCrmTicketUnread
export const getRecentOpenChatTickets = impl.getRecentOpenChatTickets
export const getRecentOpenCrmTickets = impl.getRecentOpenCrmTickets
export const deleteTicket = impl.deleteTicket

export const createUser = impl.createUser
export const getUserByEmail = impl.getUserByEmail
export const getUserById = impl.getUserById

export const createPost = impl.createPost
export const getPosts = impl.getPosts
export const getPostById = impl.getPostById
export const updatePost = impl.updatePost
export const deletePost = impl.deletePost

export const getSiteSettings = impl.getSiteSettings
export const setSiteSettings = impl.setSiteSettings
export const getSettings = impl.getSettings
export const setSettings = impl.setSettings
export const getAdminStats = impl.getAdminStats

// ── Careers & News content ──
export const getCareerPositions = impl.getCareerPositions
export const getCareerPositionById = impl.getCareerPositionById
export const createCareerPosition = impl.createCareerPosition
export const updateCareerPosition = impl.updateCareerPosition
export const deleteCareerPosition = impl.deleteCareerPosition
export const ensureApplicationsTable = impl.ensureApplicationsTable
export const ensureLendingApplicationsTable = impl.ensureLendingApplicationsTable
export const createApplication = impl.createApplication
export const createLendingApplication = impl.createLendingApplication
export const listApplications = impl.listApplications
export const listLendingApplications = impl.listLendingApplications
export const getApplicationById = impl.getApplicationById
export const deleteApplication = impl.deleteApplication
export const updateApplicationStatus = impl.updateApplicationStatus

export const getNewsItems = impl.getNewsItems
export const createNewsItem = impl.createNewsItem
export const updateNewsItem = impl.updateNewsItem
export const deleteNewsItem = impl.deleteNewsItem

export const getNewsletterContent = impl.getNewsletterContent
export const setNewsletterContent = impl.setNewsletterContent

// ── Subscribers ──
export const createSubscriber = impl.createSubscriber
export const getSubscriberByEmail = impl.getSubscriberByEmail
export const updateSubscriberType = impl.updateSubscriberType
export const getSubscribers = impl.getSubscribers
export const deleteSubscriber = impl.deleteSubscriber
export const getSubscriberByToken = impl.getSubscriberByToken
export const deleteSubscriberByToken = impl.deleteSubscriberByToken
export const countSubscribers = impl.countSubscribers
export const getSubscribersForNotification = impl.getSubscribersForNotification

// ── Customer feedback ──
export const createFeedback = impl.createFeedback
export const getFeedback = impl.getFeedback
export const markFeedbackRead = impl.markFeedbackRead
export const deleteFeedback = impl.deleteFeedback
export const countUnreadFeedback = impl.countUnreadFeedback

export const createPartnership = impl.createPartnership
export const getPartnerships = impl.getPartnerships
export const deletePartnership = impl.deletePartnership
export const updatePartnership = impl.updatePartnership

export const logActivity = impl.logActivity
export const getActivityLogs = impl.getActivityLogs

export const getAdminUsers = impl.getAdminUsers
export const createAdminUser = impl.createAdminUser
export const deleteAdminUser = impl.deleteAdminUser
export const getAdminUserByEmail = impl.getAdminUserByEmail
export const updateAdminUserRole = impl.updateAdminUserRole
export const getRoles = impl.getRoles
export const createRole = impl.createRole
export const updateRole = impl.updateRole
export const deleteRole = impl.deleteRole
export const getRoleById = impl.getRoleById
export const getPermissions = impl.getPermissions
export const getRolePermissions = impl.getRolePermissions
export const getPermissionsForRole = impl.getPermissionsForRole
export const createPermission = impl.createPermission
export const getPermissionIdsForRole = impl.getPermissionIdsForRole
export const assignRolePermissions = impl.assignRolePermissions
export const getRolesWithPermissions = impl.getRolesWithPermissions

export const getAppRoles = impl.getAppRoles
export const createAppRole = impl.createAppRole
export const updateAppRole = impl.updateAppRole
export const deleteAppRole = impl.deleteAppRole
export const getAppUsers = impl.getAppUsers
export const createAppUser = impl.createAppUser
export const getAppUserByUsername = impl.getAppUserByUsername
export const getAppUserByLogin = impl.getAppUserByLogin
export const getAppRoleById = impl.getAppRoleById

// ── CMS ──
export const getCmsPages = impl.getCmsPages
export const getCmsPageByName = impl.getCmsPageByName
export const getCmsSectionsByPageId = impl.getCmsSectionsByPageId
export const getCmsContentsBySectionId = impl.getCmsContentsBySectionId
export const getCmsPageContent = impl.getCmsPageContent
export const upsertCmsContent = impl.upsertCmsContent
export const getCmsSectionByPageAndKey = impl.getCmsSectionByPageAndKey
export const getCmsSectionById = impl.getCmsSectionById
