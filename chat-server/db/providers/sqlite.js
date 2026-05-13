// SQLite provider (current sql.js file-based DB) wrapped in async API.
import crypto from 'crypto'
import initSqlJs from 'sql.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..', '..')

const dbPath = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(rootDir, process.env.DB_PATH)
  : path.join(rootDir, 'chat.db')

const SQL = await initSqlJs()
let db

if (fs.existsSync(dbPath)) {
  const buf = fs.readFileSync(dbPath)
  db = new SQL.Database(buf)
} else {
  db = new SQL.Database()
}

function save() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function run(sql, params = []) {
  db.run(sql, params)
  save()
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function get(sql, params = []) {
  const rows = all(sql, params)
  return rows[0] || null
}

// Schema (same as previous db.js) — use exec() so all statements run (run() only runs the first)
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    visitor_name TEXT DEFAULT 'Visitor',
    visitor_email TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','archived')),
    mode TEXT DEFAULT 'ai' CHECK(mode IN ('ai','human')),
    admin_unread_count INTEGER DEFAULT 0,
    admin_last_read_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK(sender IN ('user','ai','admin')),
    admin_name TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    inquiry_message TEXT,
    conversation_id TEXT,
    source_page TEXT,
    status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','converted','lost')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS visitor_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id TEXT NOT NULL,
    conversation_id TEXT,
    ip TEXT,
    location TEXT,
    device TEXT,
    browser TEXT,
    pages_visited TEXT,
    visit_duration_seconds INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    last_activity_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS career_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    location TEXT,
    department TEXT,
    type TEXT,
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT,
    date_label TEXT,
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    subscription_type TEXT NOT NULL DEFAULT 'both' CHECK (subscription_type IN ('careers','news','both')),
    unsubscribe_token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    resume TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lending_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    rating INTEGER NOT NULL,
    name TEXT DEFAULT 'Anonymous',
    email TEXT,
    subject TEXT,
    comment TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    UNIQUE(role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'staff',
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    "group" TEXT NOT NULL DEFAULT 'website',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS partnerships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    partnership_type TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id, id);
  CREATE INDEX IF NOT EXISTS idx_conversations_status_updated ON conversations (status, updated_at);
  CREATE INDEX IF NOT EXISTS idx_visitor_visits_visit_id ON visitor_visits (visit_id);
`)
save()
try {
  db.run(`DROP TABLE IF EXISTS ticket_notes`)
  db.run(`DROP TABLE IF EXISTS ticket_messages`)
  db.run(`DROP TABLE IF EXISTS crm_tickets`)
  db.run(`DROP TABLE IF EXISTS tickets`)
  save()
} catch {
  /* ignore */
}
try {
  run(`ALTER TABLE partnerships ADD COLUMN status TEXT DEFAULT 'new'`)
  save()
} catch {
  /* column may already exist */
}
try {
  run(`ALTER TABLE feedback ADD COLUMN subject TEXT`)
  save()
} catch {
  /* column may already exist */
}

run(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    admin_username TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)
save()

run(`
  CREATE TABLE IF NOT EXISTS cms_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    label TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cms_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,
    section_key TEXT NOT NULL,
    label TEXT,
    sort_order INTEGER DEFAULT 0,
    is_visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(page_id, section_key),
    FOREIGN KEY (page_id) REFERENCES cms_pages(id)
  );
  CREATE TABLE IF NOT EXISTS cms_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','image')),
    content_key TEXT NOT NULL,
    value TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(section_id, content_key),
    FOREIGN KEY (section_id) REFERENCES cms_sections(id)
  )
`)
save()
try {
  const pc = get(`SELECT COUNT(*) as c FROM cms_pages`)
  if (!pc?.c) {
    run(`INSERT INTO cms_pages (name, label) VALUES ('home', 'Home'), ('about', 'About'), ('services', 'Services')`)
    save()
    const homePage = get(`SELECT id FROM cms_pages WHERE name = 'home'`)
    if (homePage?.id) {
      for (const [key, label, order] of [['hero', 'Hero', 0], ['journey', 'Our Journey', 1], ['clients', 'Our Clients', 2], ['footer', 'Footer', 3]]) {
        run(`INSERT INTO cms_sections (page_id, section_key, label, sort_order) VALUES (?, ?, ?, ?)`, [homePage.id, key, label, order])
      }
      save()
      const heroSection = get(`SELECT id FROM cms_sections WHERE page_id = ? AND section_key = 'hero'`, [homePage.id])
      if (heroSection?.id) {
        const heroContents = [
          ['title', 'Amalgated Holdings'],
          ['subtitle', 'Premier Retailer & Service Provider of Lending, LPG & Leasing in the Philippines.'],
          ['description', 'Delivering excellence in Real Estate, Retail & Distribution, and Financial Services — built on heritage, driven by growth.'],
          ['video_path', '/assets/AH.mp4'],
          ['cta_explore', 'Explore Our Businesses'],
          ['cta_partner', 'Partner With Us'],
        ]
        for (const [k, v] of heroContents) {
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', ?, ?)`, [heroSection.id, k, v])
        }
        save()
        const journeySection = get(`SELECT id FROM cms_sections WHERE page_id = ? AND section_key = 'journey'`, [homePage.id])
        if (journeySection?.id) {
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', 'eyebrow', 'Our Journey')`, [journeySection.id])
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', 'title', 'Historic Milestones')`, [journeySection.id])
          save()
        }
        const clientsSection = get(`SELECT id FROM cms_sections WHERE page_id = ? AND section_key = 'clients'`, [homePage.id])
        if (clientsSection?.id) {
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', 'eyebrow', 'Our Clients')`, [clientsSection.id])
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', 'title', 'Who We Serve')`, [clientsSection.id])
          run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, 'text', 'intro', 'We serve both public and private sectors across office spaces, commercial lots, and residential units.')`, [clientsSection.id])
          save()
        }
      }
    }
  }
} catch (e) {
  console.warn('[db] cms seed:', e?.message || e)
}

run(`
  CREATE TABLE IF NOT EXISTS app_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)
run(`
  CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    role_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES app_roles(id)
  )
`)
save()

// Seed app_roles with default roles if empty
const appRoleCount = get(`SELECT COUNT(*) as c FROM app_roles`)
if (!appRoleCount?.c) {
  const defaults = [
    { id: 'super_admin', name: 'Super Admin', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: true, manage_tickets: true, manage_users: true, view_dashboard: true } },
    { id: 'admin', name: 'Admin', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: true, manage_tickets: true, manage_users: true, view_dashboard: true } },
    { id: 'staff', name: 'Staff', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: false, manage_tickets: true, manage_users: false, view_dashboard: true } },
    { id: 'support', name: 'Support', isSystem: 1, permissions: { manage_applications: false, manage_partnerships: false, manage_settings: false, manage_tickets: true, manage_users: false, view_dashboard: true } },
  ]
  for (const r of defaults) {
    run(`INSERT INTO app_roles (id, name, permissions, is_system) VALUES (?, ?, ?, ?)`, [r.id, r.name, JSON.stringify(r.permissions), r.isSystem])
  }
  save()
}

// Seed roles and permissions
const roleCount = get(`SELECT COUNT(*) as c FROM roles`)
if (!roleCount?.c) {
  run(`INSERT INTO roles (name) VALUES ('super_admin'), ('admin'), ('staff'), ('support')`)
  run(
    `INSERT INTO permissions (name) VALUES ('view_dashboard'), ('manage_users'), ('manage_settings'), ('manage_tickets'), ('manage_partnerships'), ('manage_applications')`,
  )
  const roles = all(`SELECT id, name FROM roles`)
  const perms = all(`SELECT id, name FROM permissions`)
  const rMap = Object.fromEntries(roles.map((r) => [r.name, r.id]))
  const pMap = Object.fromEntries(perms.map((p) => [p.name, p.id]))
  const allPermIds = perms.map((p) => p.id)
  const staffPermIds = [
    pMap.view_dashboard,
    pMap.manage_tickets,
    pMap.manage_partnerships,
    pMap.manage_applications,
  ].filter(Boolean)
  const supportPermIds = [pMap.view_dashboard, pMap.manage_tickets].filter(Boolean)
  const inserts = []
  for (const pid of allPermIds) inserts.push([rMap.super_admin, pid])
  for (const pid of allPermIds) inserts.push([rMap.admin, pid])
  for (const pid of staffPermIds) inserts.push([rMap.staff, pid])
  for (const pid of supportPermIds) inserts.push([rMap.support, pid])
  for (const [rid, pid] of inserts) {
    run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [rid, pid])
  }
  save()
}

// Migration: add description to roles, role_id to admin_users
try {
  const roleCols = all(`PRAGMA table_info(roles)`).filter((c) => c.name === 'description')
  if (!roleCols.length) {
    run(`ALTER TABLE roles ADD COLUMN description TEXT`)
    save()
  }
} catch (e) {
  console.warn('[db] roles description migration:', e?.message || e)
}
try {
  const userCols = all(`PRAGMA table_info(admin_users)`).filter((c) => c.name === 'role_id')
  if (!userCols.length) {
    run(`ALTER TABLE admin_users ADD COLUMN role_id INTEGER`)
    save()
    const staffId = get(`SELECT id FROM roles WHERE name = 'staff'`)?.id || 1
    const rows = all(`SELECT id, role FROM admin_users`)
    for (const r of rows) {
      const roleRow = get(`SELECT id FROM roles WHERE name = ?`, [r.role])
      run(`UPDATE admin_users SET role_id = ? WHERE id = ?`, [roleRow?.id ?? staffId, r.id])
    }
    save()
  }
} catch (e) {
  console.warn('[db] admin_users role_id migration:', e?.message || e)
}

try {
  const permDescCol = all(`PRAGMA table_info(permissions)`).find((c) => c.name === 'description')
  if (!permDescCol) {
    run(`ALTER TABLE permissions ADD COLUMN description TEXT`)
    save()
  }
} catch (e) {
  console.warn('[db] permissions description migration:', e?.message || e)
}
try {
  run(`INSERT OR IGNORE INTO permissions (name) VALUES ('manage_applications')`)
  const extraPerms = [
    ['create_user', 'Create new users'],
    ['edit_user', 'Edit existing users'],
    ['delete_user', 'Delete users'],
    ['view_users', 'View user list'],
    ['manage_roles', 'Create, edit, delete roles and assign permissions'],
    ['view_reports', 'View reports and analytics'],
    ['manage_companies', 'Manage company-operations mappings'],
    ['manage_operations', 'Manage business operations config'],
    ['edit_content', 'Edit careers, news, and site content'],
  ]
  for (const [name, desc] of extraPerms) {
    run(`INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`, [name, desc])
  }
  save()
  const perms = all(`SELECT id, name FROM permissions`)
  const pMap = Object.fromEntries(perms.map((p) => [p.name, p.id]))
  for (const rn of ['super_admin', 'admin']) {
    const rid = get(`SELECT id FROM roles WHERE name = ?`, [rn])?.id
    if (rid) {
      for (const pid of Object.values(pMap).filter(Boolean)) {
        run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [rid, pid])
      }
    }
  }
  save()
  const pid = get(`SELECT id FROM permissions WHERE name = ?`, ['manage_applications'])?.id
  if (pid) {
    for (const rn of ['super_admin', 'admin', 'staff']) {
      const rid = get(`SELECT id FROM roles WHERE name = ?`, [rn])?.id
      if (rid) run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [rid, pid])
    }
  }
  save()
} catch {
  /* migration best-effort */
}

export async function logActivity({ action, adminUsername = null, ipAddress = null, details = null }) {
  run(
    `INSERT INTO activity_logs (action, admin_username, ip_address, details)
     VALUES (?, ?, ?, ?)`,
    [
      String(action || 'unknown').slice(0, 64),
      adminUsername ? String(adminUsername).slice(0, 128) : null,
      ipAddress ? String(ipAddress).slice(0, 64) : null,
      details != null ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    ],
  )
}

export async function getActivityLogs(limit = 100) {
  return all(
    `SELECT id, action, admin_username AS adminUsername, ip_address AS ipAddress, details, created_at AS createdAt
     FROM activity_logs ORDER BY created_at DESC LIMIT ?`,
    [limit],
  )
}

export async function createConversation(id) {
  try {
    run(`INSERT OR IGNORE INTO conversations (id) VALUES (?)`, [id])
  } catch {
    /* ignore duplicate */
  }
  return get(`SELECT * FROM conversations WHERE id = ?`, [id])
}

export async function getConversation(id) {
  return get(`SELECT * FROM conversations WHERE id = ?`, [id])
}

export async function getAllConversations(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000)
  const includeArchived = Boolean(options.includeArchived)
  const where = includeArchived ? '' : `WHERE status != 'archived'`
  return all(
    `SELECT id, visitor_name, visitor_email, status, mode, admin_unread_count, admin_last_read_at, created_at, updated_at
     FROM conversations
     ${where}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit],
  )
}

export async function updateStatus(id, status) {
  run(`UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id])
}

export async function updateMode(id, mode) {
  run(`UPDATE conversations SET mode = ?, updated_at = datetime('now') WHERE id = ?`, [mode, id])
}

export async function updateVisitor(id, name, email) {
  run(`UPDATE conversations SET visitor_name = ?, visitor_email = ?, updated_at = datetime('now') WHERE id = ?`, [name, email, id])
}

export async function touchConversation(id) {
  run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [id])
}

export async function addMessage(conversationId, sender, content, adminName = null) {
  run(`INSERT INTO messages (conversation_id, sender, admin_name, content) VALUES (?, ?, ?, ?)`, [conversationId, sender, adminName, content])
  run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [conversationId])
}

export async function incrementConversationUnread(conversationId) {
  run(`UPDATE conversations SET admin_unread_count = COALESCE(admin_unread_count, 0) + 1, updated_at = datetime('now') WHERE id = ?`, [conversationId])
}

export async function clearConversationUnread(conversationId) {
  run(`UPDATE conversations SET admin_unread_count = 0, admin_last_read_at = datetime('now') WHERE id = ?`, [conversationId])
}

export async function getMessages(conversationId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500)
  const offset = Math.max(Number(options.offset) || 0, 0)
  const afterId = Math.max(Number(options.afterId) || 0, 0)
  if (afterId > 0) {
    return all(
      `SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
      [conversationId, afterId, limit],
    )
  }
  return all(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`, [conversationId, limit, offset])
}

export async function getArchivedConversations() {
  return all(`SELECT * FROM conversations WHERE status = 'archived' ORDER BY updated_at DESC`)
}

export async function archiveConversation(id) {
  await updateStatus(id, 'archived')
}

export async function deleteConversation(id) {
  run(`DELETE FROM messages WHERE conversation_id = ?`, [id])
  run(`DELETE FROM conversations WHERE id = ?`, [id])
}

export async function createLead(data) {
  const { name, email, phone, company, inquiry_message, conversation_id, source_page } = data
  run(
    `INSERT INTO leads (name, email, phone, company, inquiry_message, conversation_id, source_page) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name || '', email || '', phone || '', company || '', inquiry_message || '', conversation_id || null, source_page || ''],
  )
  return get(`SELECT * FROM leads WHERE id = last_insert_rowid()`)
}

export async function getLeads(filter = {}) {
  let rows = all(`SELECT * FROM leads ORDER BY created_at DESC`)
  if (filter.status) rows = rows.filter((r) => r.status === filter.status)
  if (filter.search) {
    const s = String(filter.search).toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s)) ||
        (r.company && r.company.toLowerCase().includes(s)),
    )
  }
  return rows
}

export async function getLeadById(id) {
  return get(`SELECT * FROM leads WHERE id = ?`, [id])
}

export async function updateLeadStatus(id, status) {
  run(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id])
  return getLeadById(id)
}

export async function updateLead(id, data) {
  const row = await getLeadById(id)
  if (!row) return null
  const { name, email, phone, company, inquiry_message, status } = data
  run(
    `UPDATE leads SET name = ?, email = ?, phone = ?, company = ?, inquiry_message = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      name ?? row.name,
      email ?? row.email,
      phone ?? row.phone,
      company ?? row.company,
      inquiry_message ?? row.inquiry_message,
      status ?? row.status,
      id,
    ],
  )
  return getLeadById(id)
}

export async function deleteLeadById(id) {
  run(`DELETE FROM leads WHERE id = ?`, [id])
}

export async function createOrUpdateVisit(visitId, conversationId, data) {
  const existing = await getVisitByVisitId(visitId)
  const { ip, location, device, browser, pages_visited, message_count, visit_duration_seconds } = data || {}
  if (existing) {
    run(
      `UPDATE visitor_visits SET pages_visited = ?, visit_duration_seconds = ?, message_count = ?, last_activity_at = datetime('now') WHERE visit_id = ?`,
      [
        pages_visited ?? existing.pages_visited,
        visit_duration_seconds ?? existing.visit_duration_seconds,
        message_count ?? existing.message_count,
        visitId,
      ],
    )
    return getVisitByVisitId(visitId)
  }
  run(
    `INSERT INTO visitor_visits (visit_id, conversation_id, ip, location, device, browser, pages_visited, message_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [visitId, conversationId || null, ip || '', location || '', device || '', browser || '', pages_visited || '[]', message_count || 0],
  )
  return getVisitByVisitId(visitId)
}

export async function getVisitByVisitId(visitId) {
  return get(`SELECT * FROM visitor_visits WHERE visit_id = ?`, [visitId])
}

export async function updateVisitLocation(visitId, location) {
  db.run(`UPDATE visitor_visits SET location = ? WHERE visit_id = ?`, [location, visitId])
  save()
}

export async function getAllVisits() {
  return all(`SELECT * FROM visitor_visits ORDER BY started_at DESC`)
}

export async function getVisitsForAnalytics(since = '-7 days') {
  return all(`SELECT * FROM visitor_visits WHERE started_at >= datetime('now', ?)`, [since])
}

export async function getAdminUsers() {
  try {
    const rows = all(
      `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
       FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC`
    )
    return rows.map((u) => ({ ...u, role: u.roleName, username: u.email }))
  } catch {
    const rows = all(`SELECT id, name, email, role, created_at AS createdAt FROM admin_users ORDER BY created_at DESC`)
    return rows.map((u) => ({ ...u, roleId: null, role: u.role, username: u.email }))
  }
}

export async function createAdminUser({ name, email, role_id, password_hash }) {
  run(`INSERT INTO admin_users (name, email, role_id, password_hash) VALUES (?, ?, ?, ?)`, [name, email, role_id, password_hash])
  save()
  const u = get(
    `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
     FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = ?`,
    [email]
  )
  return u ? { ...u, role: u.roleName, username: u.email } : null
}

export async function deleteAdminUser(id) {
  run(`DELETE FROM admin_users WHERE id = ?`, [id])
  save()
}

export async function getAdminUserByEmail(email) {
  try {
    return get(
      `SELECT u.id, u.name, u.email, u.role_id, r.name AS role, u.password_hash, u.created_at AS createdAt
       FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id WHERE LOWER(u.email) = ?`,
      [String(email).trim().toLowerCase()]
    )
  } catch {
    return get(`SELECT id, name, email, role, password_hash, created_at AS createdAt FROM admin_users WHERE LOWER(email) = ?`, [String(email).trim().toLowerCase()])
  }
}

export async function updateAdminUserRole(id, role_id) {
  run(`UPDATE admin_users SET role_id = ? WHERE id = ?`, [role_id, id])
  save()
  const u = get(
    `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
     FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [id]
  )
  return u ? { ...u, role: u.roleName, username: u.email } : null
}

export async function getRoles() {
  return all(`SELECT id, name, description, created_at AS createdAt FROM roles ORDER BY name`)
}

export async function createRole({ name, description }) {
  run(`INSERT INTO roles (name, description) VALUES (?, ?)`, [String(name).trim(), description ? String(description).trim() : null])
  save()
  return get(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = last_insert_rowid()`)
}

export async function updateRole(id, { name, description }) {
  const existing = get(`SELECT id FROM roles WHERE id = ?`, [id])
  if (!existing) return null
  if (name != null) {
    run(`UPDATE roles SET name = ? WHERE id = ?`, [String(name).trim(), id])
    save()
  }
  if (description !== undefined) {
    run(`UPDATE roles SET description = ? WHERE id = ?`, [description ? String(description).trim() : null, id])
    save()
  }
  return get(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = ?`, [id])
}

export async function deleteRole(id) {
  const inUse = get(`SELECT COUNT(*) AS c FROM admin_users WHERE role_id = ?`, [id])
  if (inUse?.c > 0) return { deleted: false, error: 'Cannot delete role: assigned to users' }
  run(`DELETE FROM role_permissions WHERE role_id = ?`, [id])
  run(`DELETE FROM roles WHERE id = ?`, [id])
  save()
  return { deleted: true }
}

export async function getRoleById(id) {
  return get(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = ?`, [id])
}

export async function getPermissions() {
  return all(`SELECT id, name, description, created_at AS createdAt FROM permissions ORDER BY name`)
}

export async function createPermission({ name, description }) {
  run(`INSERT INTO permissions (name, description) VALUES (?, ?)`, [String(name).trim(), description ? String(description).trim() : null])
  save()
  return get(`SELECT id, name, description, created_at AS createdAt FROM permissions WHERE id = last_insert_rowid()`)
}

export async function getPermissionIdsForRole(roleId) {
  const rows = all(`SELECT permission_id AS permissionId FROM role_permissions WHERE role_id = ?`, [roleId])
  return rows.map((r) => r.permissionId)
}

export async function assignRolePermissions(roleId, permissionIds) {
  run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId])
  save()
  if (!Array.isArray(permissionIds) || permissionIds.length === 0) return
  for (const pid of permissionIds) {
    if (Number.isFinite(Number(pid))) {
      run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [roleId, Number(pid)])
    }
  }
  save()
}

export async function getRolesWithPermissions() {
  const roles = all(`SELECT id, name, description, created_at AS createdAt FROM roles ORDER BY name`)
  const rp = all(`SELECT role_id AS roleId, permission_id AS permissionId FROM role_permissions`)
  const byRole = {}
  for (const r of rp) {
    if (!byRole[r.roleId]) byRole[r.roleId] = []
    byRole[r.roleId].push(r.permissionId)
  }
  return roles.map((r) => ({ ...r, permissionIds: byRole[r.id] || [] }))
}

export async function getRolePermissions() {
  return all(`SELECT rp.role_id, rp.permission_id, r.name AS roleName, p.name AS permissionName FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id ORDER BY r.id, p.id`)
}

export async function getPermissionsForRole(roleName) {
  const rows = all(`SELECT p.name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.name = ?`, [roleName])
  return rows.map((r) => r.name)
}

export async function createUser({ email, password_hash }) {
  run(`INSERT INTO users (email, password_hash) VALUES (?, ?)`, [email, password_hash])
  return get(`SELECT id, email, created_at FROM users WHERE id = last_insert_rowid()`)
}

export async function getUserByEmail(email) {
  return get(`SELECT * FROM users WHERE email = ?`, [email])
}

export async function getUserById(id) {
  return get(`SELECT id, email, created_at FROM users WHERE id = ?`, [id])
}

export async function createPost({ user_id, title, body }) {
  run(`INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)`, [user_id, title, body || ''])
  return get(`SELECT * FROM posts WHERE id = last_insert_rowid()`)
}

export async function getPosts() {
  return all(
    `SELECT p.*, u.email AS author_email
     FROM posts p
     LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC`,
  )
}

export async function getPostById(id) {
  return get(
    `SELECT p.*, u.email AS author_email
     FROM posts p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [id],
  )
}

export async function updatePost(id, { title, body }) {
  run(`UPDATE posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?`, [title, body || '', id])
  return getPostById(id)
}

export async function deletePost(id) {
  run(`DELETE FROM posts WHERE id = ?`, [id])
}

export async function getSiteSettings() {
  const rows = all(`SELECT key, value FROM site_settings`)
  const out = {}
  rows.forEach((r) => {
    try {
      out[r.key] = JSON.parse(r.value)
    } catch {
      out[r.key] = r.value
    }
  })
  return out
}

export async function setSiteSettings(patch) {
  const entries = Object.entries(patch || {})
  entries.forEach(([key, value]) => {
    run(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
      [key, JSON.stringify(value)],
    )
  })
  return getSiteSettings()
}

export async function getAdminStats() {
  const users = get(`SELECT COUNT(1) AS count FROM users`)?.count ?? 0
  const messages = get(`SELECT COUNT(1) AS count FROM messages`)?.count ?? 0
  const posts = get(`SELECT COUNT(1) AS count FROM posts`)?.count ?? 0
  const activeChats =
    get(
      `SELECT COUNT(1) AS count
       FROM conversations
       WHERE status IN ('open','in_progress')`,
    )?.count ?? 0

  const unreadChat = get(`SELECT COALESCE(SUM(admin_unread_count), 0) AS count FROM conversations`)?.count ?? 0
  const subscribers = get(`SELECT COUNT(1) AS count FROM subscribers`)?.count ?? 0

  let jobApplications = 0
  try {
    jobApplications = get(`SELECT COUNT(1) AS count FROM applications`)?.count ?? 0
  } catch {
    /* no table */
  }

  return {
    users,
    messages,
    posts,
    activeChats,
    unreadChat,
    subscribers,
    jobApplications,
  }
}

// ── CMS ──
export async function getCmsPages() {
  try {
    return all(`SELECT id, name, label, created_at AS createdAt, updated_at AS updatedAt FROM cms_pages ORDER BY name`)
  } catch {
    return []
  }
}

export async function getCmsPageByName(name) {
  try {
    return get(`SELECT id, name, label FROM cms_pages WHERE name = ?`, [name])
  } catch {
    return null
  }
}

export async function getCmsSectionsByPageId(pageId) {
  try {
    return all(
      `SELECT id, page_id AS pageId, section_key AS sectionKey, label, sort_order AS sortOrder, is_visible AS isVisible
       FROM cms_sections WHERE page_id = ? ORDER BY sort_order, id`,
      [pageId],
    )
  } catch {
    return []
  }
}

export async function getCmsContentsBySectionId(sectionId) {
  try {
    return all(
      `SELECT id, section_id AS sectionId, content_type AS contentType, content_key AS contentKey, value
       FROM cms_contents WHERE section_id = ? ORDER BY content_key`,
      [sectionId],
    )
  } catch {
    return []
  }
}

export async function getCmsPageContent(pageName) {
  try {
    const page = await getCmsPageByName(pageName)
    if (!page) return null
    const sections = await getCmsSectionsByPageId(page.id)
    const result = {}
    for (const sec of sections) {
      if (!sec.isVisible) continue
      const contents = await getCmsContentsBySectionId(sec.id)
      const byKey = {}
      for (const c of contents) {
        byKey[c.contentKey] = c.value ?? ''
      }
      result[sec.sectionKey] = byKey
    }
    return result
  } catch {
    return null
  }
}

export async function upsertCmsContent(sectionId, contentType, contentKey, value) {
  const existing = get(`SELECT id FROM cms_contents WHERE section_id = ? AND content_key = ?`, [sectionId, contentKey])
  if (existing) {
    run(`UPDATE cms_contents SET content_type = ?, value = ? WHERE id = ?`, [contentType, value ?? '', existing.id])
  } else {
    run(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (?, ?, ?, ?)`, [sectionId, contentType, contentKey, value ?? ''])
  }
  save()
}

export async function getCmsSectionByPageAndKey(pageId, sectionKey) {
  return get(`SELECT id FROM cms_sections WHERE page_id = ? AND section_key = ?`, [pageId, sectionKey])
}

export async function getCmsSectionById(sectionId) {
  return get(`SELECT id, page_id AS pageId, section_key AS sectionKey, label FROM cms_sections WHERE id = ?`, [sectionId])
}

// ── Careers & News ──

export async function getCareerPositions() {
  return all(`SELECT id, title, location, department, type, summary FROM career_positions ORDER BY id DESC`)
}

export async function createCareerPosition(data = {}) {
  const { title, location, department, type, summary } = data || {}
  run(
    `INSERT INTO career_positions (title, location, department, type, summary) VALUES (?, ?, ?, ?, ?)`,
    [title || '', location || null, department || null, type || null, summary || null],
  )
  return get(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = last_insert_rowid()`)
}

export async function updateCareerPosition(id, data = {}) {
  const row = get(`SELECT * FROM career_positions WHERE id = ?`, [id])
  if (!row) return null
  const next = {
    title: data.title ?? row.title,
    location: data.location ?? row.location,
    department: data.department ?? row.department,
    type: data.type ?? row.type,
    summary: data.summary ?? row.summary,
  }
  run(
    `UPDATE career_positions SET title = ?, location = ?, department = ?, type = ?, summary = ?, updated_at = datetime('now') WHERE id = ?`,
    [next.title, next.location, next.department, next.type, next.summary, id],
  )
  return get(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = ?`, [id])
}

export async function deleteCareerPosition(id) {
  run(`DELETE FROM career_positions WHERE id = ?`, [id])
  return true
}

export async function getCareerPositionById(id) {
  return get(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = ?`, [id])
}

export async function ensureApplicationsTable() {
  // Older DBs may already have `applications` table without `status`.
  try {
    run(`ALTER TABLE applications ADD COLUMN status TEXT NOT NULL DEFAULT 'new'`)
  } catch (e) {
    const msg = e?.message || String(e || '')
    if (msg.includes('duplicate column name') || msg.includes('already exists')) {
      // status column already exists
    } else {
      // Ignore to avoid breaking startup for unexpected SQLite variants.
      console.warn('[db] ensureApplicationsTable status column:', msg)
    }
  }
}

export async function createApplication(data) {
  const { job_id, full_name, email, phone, resume } = data
  run(
    `INSERT INTO applications (job_id, full_name, email, phone, resume) VALUES (?, ?, ?, ?, ?)`,
    [job_id, full_name, email, phone || null, resume],
  )
  return { ok: true }
}

export async function listApplications({ search = '', limit = 300 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 300, 1), 500)
  const s = (search || '').trim()
  if (s) {
    const term = `%${s}%`
    return all(
      `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
        p.title AS job_title
       FROM applications a
       LEFT JOIN career_positions p ON p.id = a.job_id
       WHERE a.full_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR CAST(a.job_id AS TEXT) LIKE ? OR IFNULL(p.title,'') LIKE ?
       ORDER BY datetime(a.created_at) DESC
       LIMIT ?`,
      [term, term, term, term, term, lim],
    )
  }
  return all(
    `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
      p.title AS job_title
     FROM applications a
     LEFT JOIN career_positions p ON p.id = a.job_id
     ORDER BY datetime(a.created_at) DESC
     LIMIT ?`,
    [lim],
  )
}

export async function getApplicationById(id) {
  return get(
    `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
      p.title AS job_title
     FROM applications a
     LEFT JOIN career_positions p ON p.id = a.job_id
     WHERE a.id = ?`,
    [id],
  )
}

export async function updateApplicationStatus(id, status) {
  run(`UPDATE applications SET status = ? WHERE id = ?`, [status, id])
  return true
}

export async function deleteApplication(id) {
  run(`DELETE FROM applications WHERE id = ?`, [id])
  return true
}

export async function ensureLendingApplicationsTable() {
  try {
    run(`
      CREATE TABLE IF NOT EXISTS lending_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
  } catch (e) {
    console.warn('[db] ensureLendingApplicationsTable:', e?.message || e)
  }
}

export async function createLendingApplication(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  run(`INSERT INTO lending_applications (payload, status) VALUES (?, 'new')`, [payload])
  const row = get(`SELECT last_insert_rowid() AS id`)
  return { ok: true, id: row?.id }
}

export async function listLendingApplications({ limit = 300 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 300, 1), 500)
  const rows = all(
    `SELECT id, payload, status, created_at FROM lending_applications ORDER BY datetime(created_at) DESC LIMIT ?`,
    [lim],
  )
  return rows.map((r) => {
    let parsed = {}
    try {
      parsed = JSON.parse(r.payload || '{}')
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      submittedAt: r.created_at,
      ...parsed,
    }
  })
}

export async function getNewsItems() {
  return all(`SELECT id, title, category, date_label AS date, summary FROM news_items ORDER BY id DESC`)
}

export async function createNewsItem(data = {}) {
  const { title, category, date, summary } = data || {}
  run(
    `INSERT INTO news_items (title, category, date_label, summary) VALUES (?, ?, ?, ?)`,
    [title || '', category || null, date || null, summary || null],
  )
  return get(`SELECT id, title, category, date_label AS date, summary FROM news_items WHERE id = last_insert_rowid()`)
}

export async function updateNewsItem(id, data = {}) {
  const row = get(`SELECT * FROM news_items WHERE id = ?`, [id])
  if (!row) return null
  const next = {
    title: data.title ?? row.title,
    category: data.category ?? row.category,
    date_label: data.date ?? row.date_label,
    summary: data.summary ?? row.summary,
  }
  run(
    `UPDATE news_items SET title = ?, category = ?, date_label = ?, summary = ?, updated_at = datetime('now') WHERE id = ?`,
    [next.title, next.category, next.date_label, next.summary, id],
  )
  return get(`SELECT id, title, category, date_label AS date, summary FROM news_items WHERE id = ?`, [id])
}

export async function deleteNewsItem(id) {
  run(`DELETE FROM news_items WHERE id = ?`, [id])
  return true
}

export async function getNewsletterContent() {
  const row = get(`SELECT value FROM site_settings WHERE key = ?`, ['newsletter_content'])
  try {
    return row ? JSON.parse(row.value) : null
  } catch {
    return row?.value || null
  }
}

export async function setNewsletterContent(content) {
  run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
    ['newsletter_content', JSON.stringify(content || {})],
  )
  return (await getNewsletterContent()) || {}
}

// ── Customer feedback ──

export async function createFeedback(data = {}) {
  const { id, conversationId = null, rating, name = 'Anonymous', email = null, subject = null, comment } = data || {}
  run(
    `INSERT INTO feedback (id, conversation_id, rating, name, email, subject, comment, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, conversationId, rating, name, email, subject, comment],
  )
  return get(
    `SELECT id, conversation_id, rating, name, email, subject, comment, is_read, created_at FROM feedback WHERE id = ?`,
    [id],
  )
}

/**
 * @param {{ limit?: number, offset?: number }} [opts]
 */
export async function getFeedback(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 500)
  const offset = Math.max(Number(opts.offset) || 0, 0)
  return all(
    `SELECT id, conversation_id, rating, name, email, subject, comment, is_read, created_at
     FROM feedback
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  )
}

export async function markFeedbackRead(ids = [], isRead = true) {
  const arr = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (arr.length === 0) return 0
  const placeholders = arr.map(() => '?').join(',')
  run(`UPDATE feedback SET is_read = ? WHERE id IN (${placeholders})`, [isRead ? 1 : 0, ...arr])
  return arr.length
}

export async function deleteFeedback(id) {
  run(`DELETE FROM feedback WHERE id = ?`, [id])
  return true
}

export async function countUnreadFeedback() {
  return (get(`SELECT COUNT(1) AS count FROM feedback WHERE is_read = 0`)?.count ?? 0)
}

// ── Partnerships ──

export async function createPartnership(data = {}) {
  const { full_name, company, email, phone, partnership_type, message } = data || {}
  if (!full_name?.trim() || !email?.trim()) return null
  run(
    `INSERT INTO partnerships (full_name, company, email, phone, partnership_type, message) VALUES (?, ?, ?, ?, ?, ?)`,
    [full_name.trim(), company?.trim() || null, email.trim(), phone?.trim() || null, partnership_type?.trim() || null, message?.trim() || null],
  )
  return get(`SELECT * FROM partnerships WHERE id = last_insert_rowid()`)
}

export async function getPartnerships(filters = {}) {
  let rows = all(`SELECT * FROM partnerships ORDER BY created_at DESC`)
  const { search } = filters || {}
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.full_name && r.full_name.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s)) ||
        (r.company && r.company?.toLowerCase().includes(s)) ||
        (r.partnership_type && r.partnership_type.toLowerCase().includes(s)),
    )
  }
  return rows
}

export async function deletePartnership(id) {
  run(`DELETE FROM partnerships WHERE id = ?`, [id])
  return true
}

export async function updatePartnership(id, data) {
  const { status } = data || {}
  if (!status) return null
  const valid = ['new', 'contacted', 'in_progress', 'approved', 'rejected'].includes(status)
  if (!valid) return null
  run(`UPDATE partnerships SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id])
  return get(`SELECT * FROM partnerships WHERE id = ?`, [id])
}

// ── Subscribers ──

export async function createSubscriber(data) {
  const { email, subscription_type = 'both', unsubscribe_token } = data || {}
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return null
  const type = ['careers', 'news', 'both'].includes(subscription_type) ? subscription_type : 'both'
  const token = unsubscribe_token || crypto.randomUUID().replace(/-/g, '')
  try {
    run(
      `INSERT INTO subscribers (email, subscription_type, unsubscribe_token) VALUES (?, ?, ?)`,
      [normalized, type, token],
    )
    return get(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE email = ?`, [normalized])
  } catch (err) {
    if (err?.message?.includes('UNIQUE')) return null
    throw err
  }
}

export async function getSubscriberByEmail(email) {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return null
  return get(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE email = ?`, [normalized])
}

export async function updateSubscriberType(id, subscription_type) {
  const type = ['careers', 'news', 'both'].includes(subscription_type) ? subscription_type : 'both'
  run(`UPDATE subscribers SET subscription_type = ? WHERE id = ?`, [type, id])
  return get(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE id = ?`, [id])
}

export async function getSubscribers(filters = {}) {
  const { subscription_type, search } = filters || {}
  let sql = `SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE 1=1`
  const params = []
  if (subscription_type && subscription_type !== 'all') {
    sql += ` AND subscription_type = ?`
    params.push(subscription_type)
  }
  if (search && typeof search === 'string' && search.trim()) {
    sql += ` AND (email LIKE ?)`
    params.push(`%${search.trim()}%`)
  }
  sql += ` ORDER BY created_at DESC`
  return params.length ? all(sql, params) : all(sql)
}

export async function deleteSubscriber(id) {
  run(`DELETE FROM subscribers WHERE id = ?`, [id])
  return true
}

export async function countSubscribers(filters = {}) {
  const { subscription_type } = filters || {}
  let sql = `SELECT COUNT(1) AS count FROM subscribers WHERE 1=1`
  const params = []
  if (subscription_type && subscription_type !== 'all') {
    sql += ` AND subscription_type = ?`
    params.push(subscription_type)
  }
  const row = params.length ? get(sql, params) : get(sql)
  return row?.count ?? 0
}

export async function getSubscribersForNotification(type) {
  if (type === 'careers') {
    return all(`SELECT id, email, unsubscribe_token FROM subscribers WHERE subscription_type IN ('careers','both')`)
  }
  if (type === 'news') {
    return all(`SELECT id, email, unsubscribe_token FROM subscribers WHERE subscription_type IN ('news','both')`)
  }
  return []
}

export async function getSubscriberByToken(token) {
  if (!token) return null
  return get(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE unsubscribe_token = ?`, [token])
}

export async function deleteSubscriberByToken(token) {
  run(`DELETE FROM subscribers WHERE unsubscribe_token = ?`, [token])
  return true
}

// ── Dynamic settings ──

const GROUP_MAP = {
  display_name: 'profile', theme: 'profile', accent_color: 'profile', profile_avatar: 'profile',
  contact_email: 'website', contact_phone: 'website', address: 'website', website_name: 'website', logo_url: 'website',
  tagline: 'website', favicon_url: 'website', timezone: 'website', language: 'website',
  partnership_types: 'partnerships', auto_reply_toggle: 'partnerships', admin_notification_toggle: 'partnerships',
  email_notifications: 'notifications', new_partnership_alert: 'notifications', new_chat_alert: 'notifications',
  new_ticket_alert: 'notifications', auto_reply_messages: 'notifications',
  chat_auto_reply: 'chat', chat_availability: 'chat', chat_working_hours: 'chat', chat_auto_assign: 'chat', chat_enabled: 'chat',
  session_timeout: 'security', '2fa_toggle': 'security', ip_restriction: 'security',
  default_pagination: 'system', date_format: 'system', time_format: 'system', currency: 'system',
  branding_logo_url: 'branding', primary_color: 'branding', sidebar_style: 'branding', font_style: 'branding',
  maintenance_mode: 'backup',
}

function inferGroup(key) {
  return GROUP_MAP[key] ?? 'website'
}

function castValue(key, value) {
  if (value == null) return null
  const bools = ['auto_reply_toggle', 'admin_notification_toggle', 'email_notifications', 'new_partnership_alert', 'new_chat_alert', 'new_ticket_alert', '2fa_toggle', 'chat_auto_assign', 'chat_enabled', 'maintenance_mode']
  if (bools.includes(key)) return ['1', 'true', 'yes'].includes(String(value).toLowerCase())
  if (key === 'partnership_types') {
    try {
      const d = JSON.parse(value)
      return Array.isArray(d) ? d : String(value || '').split(',').map(s => s.trim()).filter(Boolean)
    } catch {
      return String(value || '').split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  if (key === 'session_timeout') return parseInt(value, 10) || 60
  return value
}

export async function getSettings() {
  const rows = all(`SELECT key, value, "group" FROM settings`)
  const grouped = {}
  const flat = {}
  for (const r of rows) {
    const g = r.group || 'website'
    if (!grouped[g]) grouped[g] = {}
    grouped[g][r.key] = castValue(r.key, r.value)
    flat[r.key] = castValue(r.key, r.value)
  }
  return { grouped, flat }
}

export async function setSettings(items) {
  const entries = Object.entries(items || {})
  for (const [key, value] of entries) {
    const group = inferGroup(key)
    let val = value
    if (typeof value === 'boolean') val = value ? '1' : '0'
    else if (Array.isArray(value)) val = JSON.stringify(value)
    else val = String(value ?? '')
    run(
      `INSERT INTO settings (key, value, "group", updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, "group" = excluded."group", updated_at = datetime('now')`,
      [key, val, group],
    )
  }
  return getSettings()
}

// ── App Roles & Users (User Management API) ──
const PERM_KEYS = ['manage_applications', 'manage_partnerships', 'manage_settings', 'manage_tickets', 'manage_users', 'view_dashboard']

export async function getAppRoles() {
  const rows = all(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles ORDER BY name`)
  return rows.map((r) => ({
    ...r,
    id: String(r.id),
    permissions: parsePerms(r.permissions),
  }))
}

function parsePerms(raw) {
  if (!raw) return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {})
  try {
    const p = JSON.parse(raw)
    return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: !!p[k] }), {})
  } catch {
    return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {})
  }
}

export async function createAppRole({ name, permissions }) {
  const id = crypto.randomUUID()
  const perms = { ...PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {}), ...(permissions ?? {}) }
  run(`INSERT INTO app_roles (id, name, permissions, is_system) VALUES (?, ?, ?, 0)`, [id, name, JSON.stringify(perms)])
  const r = get(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles WHERE id = ?`, [id])
  return { ...r, permissions: parsePerms(r?.permissions) }
}

export async function updateAppRole(id, { name, permissions }) {
  const existing = get(`SELECT id FROM app_roles WHERE id = ?`, [id])
  if (!existing) return null
  if (name != null) run(`UPDATE app_roles SET name = ? WHERE id = ?`, [name, id])
  if (permissions != null) run(`UPDATE app_roles SET permissions = ? WHERE id = ?`, [JSON.stringify(permissions), id])
  const r = get(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles WHERE id = ?`, [id])
  return r ? { ...r, permissions: parsePerms(r.permissions) } : null
}

export async function deleteAppRole(id) {
  const r = get(`SELECT is_system FROM app_roles WHERE id = ?`, [id])
  if (!r) return { deleted: false, error: 'Not found' }
  if (r.is_system) return { deleted: false, error: 'Cannot delete system role' }
  run(`DELETE FROM app_roles WHERE id = ?`, [id])
  return { deleted: true }
}

export async function getAppUsers() {
  const rows = all(`SELECT id, name, username, email, role_id AS roleId, created_at AS createdAt FROM app_users ORDER BY created_at DESC`)
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

export async function createAppUser({ name, username, email, password_hash, role_id }) {
  const id = crypto.randomUUID()
  run(`INSERT INTO app_users (id, name, username, email, role_id, password_hash) VALUES (?, ?, ?, ?, ?, ?)`, [
    id,
    name,
    username.trim().toLowerCase(),
    email.trim().toLowerCase(),
    role_id,
    password_hash,
  ])
  const u = get(`SELECT id, name, username, email, role_id AS roleId, created_at AS createdAt FROM app_users WHERE id = ?`, [id])
  return u ? { ...u, id: String(u.id) } : null
}

export async function getAppUserByUsername(username) {
  return get(`SELECT id FROM app_users WHERE LOWER(username) = ?`, [String(username).trim().toLowerCase()])
}

/** Find app_user by username OR email (for login) */
export async function getAppUserByLogin(login) {
  const key = String(login).trim().toLowerCase()
  return get(
    `SELECT u.id, u.name, u.username, u.email, u.role_id AS roleId, u.password_hash
     FROM app_users u WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?`,
    [key, key]
  )
}

/** Get app_role by id with parsed permissions */
export async function getAppRoleById(id) {
  const r = get(`SELECT id, name, permissions FROM app_roles WHERE id = ?`, [id])
  return r ? { ...r, permissions: parsePerms(r.permissions) } : null
}

