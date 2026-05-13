import crypto from 'crypto'
import mysql from 'mysql2/promise'

function env(name, fallback = '') {
  return (process.env[name] || fallback).toString().trim()
}

/** Allowed MySQL identifiers for database name — avoid SQL injection via env. */
function safeMysqlIdentifier(name, fallback = 'amalgated_lending_chat') {
  const raw = String(name || '').trim().replace(/[^a-zA-Z0-9_]/g, '')
  return raw.length > 0 && raw.length <= 64 ? raw : fallback
}

const MYSQL_HOST = env('MYSQL_HOST', '127.0.0.1')
const MYSQL_PORT = Number(env('MYSQL_PORT', '3306')) || 3306
const MYSQL_USER = env('MYSQL_USER', 'root')
const MYSQL_PASSWORD = env('MYSQL_PASSWORD', '')
const MYSQL_DATABASE = safeMysqlIdentifier(env('MYSQL_DATABASE', 'amalgated_lending_chat'))

const MYSQL_CONNECT_RETRIES = Math.min(Math.max(Number(env('MYSQL_CONNECT_RETRIES', '30')) || 30, 1), 120)
const MYSQL_CONNECT_RETRY_MS = Math.min(Math.max(Number(env('MYSQL_CONNECT_RETRY_MS', '1000')) || 1000, 200), 30000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Connect with retries so startup survives MySQL starting slightly later (e.g. XAMPP). */
async function createConnectionWithRetry(opts) {
  let lastErr
  for (let attempt = 1; attempt <= MYSQL_CONNECT_RETRIES; attempt += 1) {
    try {
      return await mysql.createConnection(opts)
    } catch (e) {
      lastErr = e
      const transient =
        e?.code === 'ECONNREFUSED' ||
        e?.code === 'ETIMEDOUT' ||
        e?.code === 'ENOTFOUND' ||
        e?.errno === -4078
      if (!transient || attempt >= MYSQL_CONNECT_RETRIES) break
      if (attempt === 1 || attempt % 5 === 0) {
        console.warn(
          `[chat-db] Waiting for MySQL at ${opts.host}:${opts.port} (attempt ${attempt}/${MYSQL_CONNECT_RETRIES})…`,
        )
      }
      await sleep(MYSQL_CONNECT_RETRY_MS)
    }
  }
  console.error(
    `[chat-db] Cannot reach MySQL at ${MYSQL_HOST}:${MYSQL_PORT}. Start MySQL (e.g. XAMPP Control Panel → MySQL Start), then retry. Check MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD.`,
  )
  throw lastErr
}

/**
 * Ensures MYSQL_DATABASE exists (matches db/mysql-init.sql).
 * Separate from Laravel amalgated_lending_db — hosts Node CRM/socket tables only.
 */
async function ensureMysqlDatabaseExists() {
  const conn = await createConnectionWithRetry({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  })
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
  } finally {
    await conn.end().catch(() => {})
  }
}

await ensureMysqlDatabaseExists()

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(env('MYSQL_POOL_SIZE', '10')) || 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  namedPlaceholders: true,
  dateStrings: true,
  charset: 'utf8mb4',
  /** Avoid BigInt in row objects — breaks Express res.json / JSON.stringify. */
  supportBigNumbers: true,
  bigNumberStrings: true,
})

async function q(sql, params = {}) {
  const [rows] = await pool.query(sql, params)
  return rows
}

async function one(sql, params = {}) {
  const rows = await q(sql, params)
  return rows?.[0] || null
}

/** Visitor analytics — so analytics API works even if full mysql-init was not run. */
async function ensureVisitorVisitsTable() {
  await q(
    `CREATE TABLE IF NOT EXISTS visitor_visits (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      visit_id VARCHAR(128) NOT NULL,
      conversation_id VARCHAR(128) NULL,
      ip VARCHAR(64) NULL,
      location VARCHAR(255) NULL,
      device VARCHAR(64) NULL,
      browser VARCHAR(64) NULL,
      pages_visited TEXT NULL,
      visit_duration_seconds INT NOT NULL DEFAULT 0,
      message_count INT NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_visit_id (visit_id),
      KEY idx_visits_started (started_at)
    ) ENGINE=InnoDB`,
  )
}

/** Job applications table — exported so server can re-verify on startup (older DBs may lack this table). */
export async function ensureApplicationsTable() {
  await q(
    `CREATE TABLE IF NOT EXISTS applications (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      job_id BIGINT NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(64) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      resume VARCHAR(512) NOT NULL,
      created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_applications_job (job_id),
      KEY idx_applications_created (created_at)
    ) ENGINE=InnoDB`,
  )

  // Older DBs may already have the applications table without `status`.
  try {
    await q(`ALTER TABLE applications ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'new'`)
  } catch (e) {
    if (e?.code === 'ER_DUP_FIELDNAME') {
      // column already exists
    } else {
      console.warn('[db] ensureApplicationsTable status column:', e?.message || e)
    }
  }
  // Add updated_at if missing (so Laravel and Node can share the same table).
  try {
    await q(`ALTER TABLE applications ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP`)
  } catch (e) {
    if (e?.code === 'ER_DUP_FIELDNAME') {
      // column already exists
    } else {
      console.warn('[db] ensureApplicationsTable updated_at:', e?.message || e)
    }
  }
}

/** Amalgated Lending Inc. — loan application forms (JSON payload). */
export async function ensureLendingApplicationsTable() {
  await q(
    `CREATE TABLE IF NOT EXISTS lending_applications (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      payload LONGTEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_lending_created (created_at)
    ) ENGINE=InnoDB`,
  )
}

/** Remove legacy chat-linked + standalone CRM ticket tables (feature retired). Idempotent. */
async function dropRemovedSupportTicketTables() {
  const tables = ['ticket_notes', 'ticket_messages', 'crm_tickets', 'tickets']
  try {
    await q('SET FOREIGN_KEY_CHECKS = 0')
  } catch {
    /* ignore */
  }
  for (const t of tables) {
    try {
      await q(`DROP TABLE IF EXISTS \`${t}\``)
    } catch (e) {
      console.warn('[chat-db] drop table', t, e?.message || e)
    }
  }
  try {
    await q('SET FOREIGN_KEY_CHECKS = 1')
  } catch {
    /* ignore */
  }
}

/**
 * Chat & CRM persistence (server.js Socket.IO + /api/admin/conversations).
 * Matches db/mysql-init.sql so Node can run without manually importing that file.
 */
async function ensureChatCrmTables() {
  await q(
    `CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(128) PRIMARY KEY,
      visitor_name VARCHAR(255) NOT NULL DEFAULT 'Visitor',
      visitor_email VARCHAR(255) NULL,
      status ENUM('open','in_progress','resolved','archived') NOT NULL DEFAULT 'open',
      mode ENUM('ai','human') NOT NULL DEFAULT 'ai',
      admin_unread_count INT NOT NULL DEFAULT 0,
      admin_last_read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_conversations_status_updated (status, updated_at)
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS messages (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      conversation_id VARCHAR(128) NOT NULL,
      sender ENUM('user','ai','admin') NOT NULL,
      admin_name VARCHAR(255) NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_messages_convo_created (conversation_id, created_at),
      KEY idx_messages_convo_id (conversation_id, id),
      CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS leads (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(64) NULL,
      company VARCHAR(255) NULL,
      inquiry_message TEXT NULL,
      conversation_id VARCHAR(128) NULL,
      source_page VARCHAR(255) NULL,
      status ENUM('new','contacted','qualified','converted','lost') NOT NULL DEFAULT 'new',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_leads_created (created_at),
      KEY idx_leads_status_created (status, created_at),
      CONSTRAINT fk_leads_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB`,
  )
}

async function ensureSchema() {
  await dropRemovedSupportTicketTables()
  // Legacy auth/content tables still used by admin stats and older endpoints.
  await q(
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_users_email (email)
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS posts (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_posts_created (created_at),
      CONSTRAINT fk_posts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS site_settings (
      \`key\` VARCHAR(191) PRIMARY KEY,
      value JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  )

  await ensureChatCrmTables()

  // Careers
  await q(
    `CREATE TABLE IF NOT EXISTS career_positions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      location VARCHAR(255) NULL,
      department VARCHAR(255) NULL,
      type VARCHAR(64) NULL,
      summary TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_career_positions_created (created_at)
    ) ENGINE=InnoDB`,
  )

  // News items (short highlights)
  await q(
    `CREATE TABLE IF NOT EXISTS news_items (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(255) NULL,
      date_label VARCHAR(64) NULL,
      summary TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_news_items_created (created_at)
    ) ENGINE=InnoDB`,
  )

  await ensureApplicationsTable()
  await ensureLendingApplicationsTable()
  await ensureVisitorVisitsTable()

  // Subscribers
  await q(
    `CREATE TABLE IF NOT EXISTS subscribers (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      subscription_type ENUM('careers','news','both') NOT NULL DEFAULT 'both',
      unsubscribe_token VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_subscribers_email (email),
      KEY idx_subscribers_type (subscription_type),
      KEY idx_subscribers_created (created_at)
    ) ENGINE=InnoDB`,
  )

  // Partnerships (Partner With Us form)
  await q(
    `CREATE TABLE IF NOT EXISTS partnerships (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      company VARCHAR(255) NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(64) NULL,
      partnership_type VARCHAR(128) NULL,
      message TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_partnerships_created (created_at),
      KEY idx_partnerships_email (email),
      KEY idx_partnerships_status (status)
    ) ENGINE=InnoDB`,
  )
  try {
    await q(`ALTER TABLE partnerships ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'new'`)
  } catch (e) {
    if (e?.code !== 'ER_DUP_FIELDNAME') throw e
  }

  // Customer feedback
  await q(
    `CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(64) PRIMARY KEY,
      conversation_id VARCHAR(128) NULL,
      rating INT NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT 'Anonymous',
      email VARCHAR(255) NULL,
      subject VARCHAR(191) NULL,
      comment TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_feedback_created (created_at),
      KEY idx_feedback_read_created (is_read, created_at)
    ) ENGINE=InnoDB`,
  )
  try {
    await q(`ALTER TABLE feedback ADD COLUMN subject VARCHAR(191) NULL AFTER email`)
  } catch (e) {
    if (e?.code !== 'ER_DUP_FIELDNAME') throw e
  }

  // Activity logs (admin actions, login, etc.)
  await q(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(64) NOT NULL,
      admin_username VARCHAR(128) NULL,
      ip_address VARCHAR(64) NULL,
      details TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_activity_logs_created (created_at),
      KEY idx_activity_logs_action (action)
    ) ENGINE=InnoDB`,
  )

  // Roles (dynamic - admin, staff, support, custom)
  await q(
    `CREATE TABLE IF NOT EXISTS roles (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  )

  await q(
    `CREATE TABLE IF NOT EXISTS permissions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  )

  await q(
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      role_id BIGINT NOT NULL,
      permission_id BIGINT NOT NULL,
      UNIQUE KEY uniq_role_perm (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  )

  // Seed roles and permissions
  const roleCount = await one(`SELECT COUNT(*) as c FROM roles`)
  if (!roleCount?.c) {
    await q(`INSERT INTO roles (name) VALUES ('super_admin'), ('admin'), ('staff'), ('support')`)
    await q(
      `INSERT INTO permissions (name) VALUES ('view_dashboard'), ('manage_users'), ('manage_settings'), ('manage_tickets'), ('manage_partnerships'), ('manage_applications')`,
    )
    const roles = await q(`SELECT id, name FROM roles`)
    const perms = await q(`SELECT id, name FROM permissions`)
    const rMap = Object.fromEntries(roles.map((r) => [r.name, r.id]))
    const pMap = Object.fromEntries(perms.map((p) => [p.name, p.id]))
    const allPermIds = perms.map((p) => p.id)
    const adminPermIds = allPermIds
    const staffPermIds = [
      pMap.view_dashboard,
      pMap.manage_tickets,
      pMap.manage_partnerships,
      pMap.manage_applications,
    ].filter(Boolean)
    const supportPermIds = [pMap.view_dashboard, pMap.manage_tickets].filter(Boolean)
    const inserts = []
    for (const pid of allPermIds) inserts.push([rMap.super_admin, pid])
    for (const pid of adminPermIds) inserts.push([rMap.admin, pid])
    for (const pid of staffPermIds) inserts.push([rMap.staff, pid])
    for (const pid of supportPermIds) inserts.push([rMap.support, pid])
    for (const [rid, pid] of inserts) {
      await q(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)`, { rid, pid })
    }
  }

  // Admin users (User Management)
  await q(
    `CREATE TABLE IF NOT EXISTS admin_users (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(64) NOT NULL DEFAULT 'staff',
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_admin_users_email (email)
    ) ENGINE=InnoDB`,
  )

  // App roles (User Management API - dynamic roles)
  await q(
    `CREATE TABLE IF NOT EXISTS app_roles (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL UNIQUE,
      permissions JSON NOT NULL,
      is_system TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  )

  // App users (User Management API)
  await q(
    `CREATE TABLE IF NOT EXISTS app_users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      role_id VARCHAR(64) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_app_users_role (role_id),
      FOREIGN KEY (role_id) REFERENCES app_roles(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`,
  )

  // Seed app_roles if empty
  const appRoleCount = await one(`SELECT COUNT(*) as c FROM app_roles`)
  if (!appRoleCount?.c) {
    const defaults = [
      { id: 'super_admin', name: 'Super Admin', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: true, manage_tickets: true, manage_users: true, view_dashboard: true } },
      { id: 'admin', name: 'Admin', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: true, manage_tickets: true, manage_users: true, view_dashboard: true } },
      { id: 'staff', name: 'Staff', isSystem: 1, permissions: { manage_applications: true, manage_partnerships: true, manage_settings: false, manage_tickets: true, manage_users: false, view_dashboard: true } },
      { id: 'support', name: 'Support', isSystem: 1, permissions: { manage_applications: false, manage_partnerships: false, manage_settings: false, manage_tickets: true, manage_users: false, view_dashboard: true } },
    ]
    for (const r of defaults) {
      await q(
        `INSERT INTO app_roles (id, name, permissions, is_system) VALUES (:id, :name, :permissions, :isSystem)`,
        { id: r.id, name: r.name, permissions: JSON.stringify(r.permissions), isSystem: r.isSystem },
      )
    }
  }

  // CMS: pages, sections, contents
  await q(
    `CREATE TABLE IF NOT EXISTS cms_pages (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      label VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS cms_sections (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      page_id BIGINT NOT NULL,
      section_key VARCHAR(64) NOT NULL,
      label VARCHAR(128) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_visible TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_page_section (page_id, section_key),
      FOREIGN KEY (page_id) REFERENCES cms_pages(id) ON DELETE CASCADE,
      KEY idx_cms_sections_page (page_id)
    ) ENGINE=InnoDB`,
  )
  await q(
    `CREATE TABLE IF NOT EXISTS cms_contents (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      section_id BIGINT NOT NULL,
      content_type ENUM('text','image') NOT NULL DEFAULT 'text',
      content_key VARCHAR(64) NOT NULL,
      value TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_section_content (section_id, content_key),
      FOREIGN KEY (section_id) REFERENCES cms_sections(id) ON DELETE CASCADE,
      KEY idx_cms_contents_section (section_id)
    ) ENGINE=InnoDB`,
  )

  // Seed CMS pages and sections
  const cmsPageCount = await one(`SELECT COUNT(*) as c FROM cms_pages`)
  if (!cmsPageCount?.c) {
    await q(`INSERT INTO cms_pages (name, label) VALUES ('home', 'Home'), ('about', 'About'), ('services', 'Services')`)
    const homePage = await one(`SELECT id FROM cms_pages WHERE name = 'home' LIMIT 1`)
    if (homePage?.id) {
      const sections = [
        { key: 'hero', label: 'Hero', order: 0 },
        { key: 'journey', label: 'Our Journey', order: 1 },
        { key: 'clients', label: 'Our Clients', order: 2 },
        { key: 'footer', label: 'Footer', order: 3 },
      ]
      for (const s of sections) {
        await q(`INSERT INTO cms_sections (page_id, section_key, label, sort_order) VALUES (:pid, :key, :label, :order)`, {
          pid: homePage.id,
          key: s.key,
          label: s.label,
          order: s.order,
        })
      }
      const heroSection = await one(`SELECT id FROM cms_sections WHERE page_id = :pid AND section_key = 'hero'`, { pid: homePage.id })
      if (heroSection?.id) {
        const contents = [
          { type: 'text', key: 'title', value: 'Amalgated Holdings' },
          { type: 'text', key: 'subtitle', value: 'Premier Retailer & Service Provider of Lending, LPG & Leasing in the Philippines.' },
          { type: 'text', key: 'description', value: 'Delivering excellence in Real Estate, Retail & Distribution, and Financial Services — built on heritage, driven by growth.' },
          { type: 'text', key: 'video_path', value: '/assets/AH.mp4' },
          { type: 'text', key: 'cta_explore', value: 'Explore Our Businesses' },
          { type: 'text', key: 'cta_partner', value: 'Partner With Us' },
        ]
        for (const c of contents) {
          await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, :type, :key, :val)`, {
            sid: heroSection.id,
            type: c.type,
            key: c.key,
            val: c.value,
          })
        }
      }
      const journeySection = await one(`SELECT id FROM cms_sections WHERE page_id = :pid AND section_key = 'journey'`, { pid: homePage.id })
      if (journeySection?.id) {
        await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, 'text', 'eyebrow', 'Our Journey')`, { sid: journeySection.id })
        await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, 'text', 'title', 'Historic Milestones')`, { sid: journeySection.id })
      }
      const clientsSection = await one(`SELECT id FROM cms_sections WHERE page_id = :pid AND section_key = 'clients'`, { pid: homePage.id })
      if (clientsSection?.id) {
        await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, 'text', 'eyebrow', 'Our Clients')`, { sid: clientsSection.id })
        await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, 'text', 'title', 'Who We Serve')`, { sid: clientsSection.id })
        await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, 'text', 'intro', 'We serve both public and private sectors across office spaces, commercial lots, and residential units.')`, { sid: clientsSection.id })
      }
    }
  }

  // Dynamic settings (key-value-store)
  await q(
    `CREATE TABLE IF NOT EXISTS settings (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`key\` VARCHAR(255) NOT NULL UNIQUE,
      value TEXT NULL,
      \`group\` VARCHAR(64) NOT NULL DEFAULT 'website',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_settings_group (\`group\`)
    ) ENGINE=InnoDB`,
  )

  // Migration: add description to roles, role_id to admin_users
  try {
    const roleCols = await q(`SHOW COLUMNS FROM roles LIKE 'description'`)
    if (!roleCols?.length) {
      await q(`ALTER TABLE roles ADD COLUMN description VARCHAR(255) NULL AFTER name`)
    }
  } catch (e) {
    console.warn('[db] roles description migration:', e?.message || e)
  }
  try {
    const userCols = await q(`SHOW COLUMNS FROM admin_users LIKE 'role_id'`)
    if (!userCols?.length) {
      await q(`ALTER TABLE admin_users ADD COLUMN role_id BIGINT NULL AFTER email`)
      const staffRole = await one(`SELECT id FROM roles WHERE name = 'staff' LIMIT 1`)
      const defaultRoleId = staffRole?.id || 1
      await q(`UPDATE admin_users au JOIN roles r ON r.name = au.role SET au.role_id = r.id WHERE au.role_id IS NULL`)
      await q(`UPDATE admin_users SET role_id = :rid WHERE role_id IS NULL`, { rid: defaultRoleId })
      await q(`ALTER TABLE admin_users MODIFY role_id BIGINT NOT NULL`)
      await q(`ALTER TABLE admin_users ADD KEY idx_admin_users_role (role_id)`)
      await q(`ALTER TABLE admin_users ADD CONSTRAINT fk_admin_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT`)
      await q(`ALTER TABLE admin_users DROP COLUMN role`)
    }
  } catch (e) {
    console.warn('[db] admin_users role_id migration:', e?.message || e)
  }

  try {
    const permDescCol = await q(`SHOW COLUMNS FROM permissions LIKE 'description'`)
    if (!permDescCol?.length) {
      await q(`ALTER TABLE permissions ADD COLUMN description VARCHAR(255) NULL AFTER name`)
    }
  } catch (e) {
    console.warn('[db] permissions description migration:', e?.message || e)
  }
  try {
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
      await q(`INSERT IGNORE INTO permissions (name, description) VALUES (:name, :description)`, { name, description: desc })
    }
  } catch (e) {
    console.warn('[db] extra permissions seed:', e?.message || e)
  }
  try {
    await q(`INSERT IGNORE INTO permissions (name) VALUES ('manage_applications')`)
    const allPerms = await q(`SELECT id, name FROM permissions`)
    const permMap = Object.fromEntries((allPerms || []).map((p) => [p.name, p.id]))
    for (const roleName of ['super_admin', 'admin']) {
      const role = await one(`SELECT id FROM roles WHERE name = :n`, { n: roleName })
      if (role?.id) {
        for (const pId of Object.values(permMap)) {
          if (pId) {
            await q(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)`, {
              rid: role.id,
              pid: pId,
            })
          }
        }
      }
    }
    const staffPermIds = [permMap.view_dashboard, permMap.manage_tickets, permMap.manage_partnerships, permMap.manage_applications, permMap.view_users].filter(Boolean)
    for (const roleName of ['staff']) {
      const role = await one(`SELECT id FROM roles WHERE name = :n`, { n: roleName })
      if (role?.id) {
        for (const pid of staffPermIds) {
          await q(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)`, { rid: role.id, pid })
        }
      }
    }
  } catch (e) {
    console.warn('[db] manage_applications / extra role_permissions:', e?.message || e)
  }
}

await ensureSchema()

function parseJson(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export async function createConversation(id) {
  await q(
    `INSERT INTO conversations (id) VALUES (:id)
     ON DUPLICATE KEY UPDATE id = id`,
    { id },
  )
  return getConversation(id)
}

export async function getConversation(id) {
  return one(`SELECT * FROM conversations WHERE id = :id`, { id })
}

export async function getAllConversations(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
  const includeArchived = Boolean(options.includeArchived);
  const where = includeArchived ? '' : `WHERE status <> 'archived'`;
  return q(
    `SELECT id, visitor_name, visitor_email, status, mode, admin_unread_count, admin_last_read_at, created_at, updated_at
     FROM conversations
     ${where}
     ORDER BY updated_at DESC
     LIMIT :limit`,
    { limit },
  );
}

export async function updateStatus(id, status) {
  await q(`UPDATE conversations SET status = :status WHERE id = :id`, { id, status })
}

export async function updateMode(id, mode) {
  await q(`UPDATE conversations SET mode = :mode WHERE id = :id`, { id, mode })
}

export async function updateVisitor(id, name, email) {
  await q(
    `UPDATE conversations SET visitor_name = :name, visitor_email = :email WHERE id = :id`,
    { id, name, email },
  )
}

export async function touchConversation(id) {
  await q(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = :id`, { id })
}

export async function addMessage(conversationId, sender, content, adminName = null) {
  await q(
    `INSERT INTO messages (conversation_id, sender, admin_name, content)
     VALUES (:conversationId, :sender, :adminName, :content)`,
    { conversationId, sender, adminName, content },
  )
  await touchConversation(conversationId)
}

export async function incrementConversationUnread(conversationId) {
  await q(
    `UPDATE conversations
     SET admin_unread_count = COALESCE(admin_unread_count, 0) + 1
     WHERE id = :conversationId`,
    { conversationId },
  )
}

export async function clearConversationUnread(conversationId) {
  await q(
    `UPDATE conversations
     SET admin_unread_count = 0, admin_last_read_at = CURRENT_TIMESTAMP
     WHERE id = :conversationId`,
    { conversationId },
  )
}

export async function getMessages(conversationId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const afterId = Math.max(Number(options.afterId) || 0, 0);
  if (afterId > 0) {
    return q(
      `SELECT * FROM messages
       WHERE conversation_id = :conversationId AND id > :afterId
       ORDER BY id ASC
       LIMIT :limit`,
      { conversationId, afterId, limit },
    );
  }
  return q(
    `SELECT * FROM messages WHERE conversation_id = :conversationId ORDER BY created_at ASC LIMIT :limit OFFSET :offset`,
    { conversationId, limit, offset },
  )
}

export async function getArchivedConversations() {
  return q(`SELECT * FROM conversations WHERE status = 'archived' ORDER BY updated_at DESC`)
}

export async function archiveConversation(id) {
  await updateStatus(id, 'archived')
}

export async function deleteConversation(id) {
  await q(`DELETE FROM conversations WHERE id = :id`, { id })
}

export async function createLead(data) {
  const {
    name,
    email,
    phone = '',
    company = '',
    inquiry_message = '',
    conversation_id = null,
    source_page = '',
  } = data || {}

  const res = await q(
    `INSERT INTO leads (name, email, phone, company, inquiry_message, conversation_id, source_page)
     VALUES (:name, :email, :phone, :company, :inquiry_message, :conversation_id, :source_page)`,
    { name, email, phone, company, inquiry_message, conversation_id, source_page },
  )
  return getLeadById(res.insertId)
}

export async function getLeads(filter = {}) {
  const { status, search } = filter || {}
  const s = (search || '').toString().trim()
  const like = s ? `%${s}%` : null

  if (status && like) {
    return q(
      `SELECT * FROM leads
       WHERE status = :status AND (name LIKE :like OR email LIKE :like OR company LIKE :like)
       ORDER BY created_at DESC`,
      { status, like },
    )
  }
  if (status) {
    return q(`SELECT * FROM leads WHERE status = :status ORDER BY created_at DESC`, { status })
  }
  if (like) {
    return q(
      `SELECT * FROM leads
       WHERE name LIKE :like OR email LIKE :like OR company LIKE :like
       ORDER BY created_at DESC`,
      { like },
    )
  }
  return q(`SELECT * FROM leads ORDER BY created_at DESC`)
}

export async function getLeadById(id) {
  return one(`SELECT * FROM leads WHERE id = :id`, { id })
}

export async function updateLeadStatus(id, status) {
  await q(`UPDATE leads SET status = :status WHERE id = :id`, { id, status })
  return getLeadById(id)
}

export async function updateLead(id, data) {
  const row = await getLeadById(id)
  if (!row) return null
  const next = {
    name: data?.name ?? row.name,
    email: data?.email ?? row.email,
    phone: data?.phone ?? row.phone,
    company: data?.company ?? row.company,
    inquiry_message: data?.inquiry_message ?? row.inquiry_message,
    status: data?.status ?? row.status,
  }
  await q(
    `UPDATE leads
     SET name=:name, email=:email, phone=:phone, company=:company, inquiry_message=:inquiry_message, status=:status
     WHERE id=:id`,
    { id, ...next },
  )
  return getLeadById(id)
}

export async function deleteLeadById(id) {
  await q(`DELETE FROM leads WHERE id = :id`, { id })
}

export async function createOrUpdateVisit(visitId, conversationId, data) {
  const existing = await getVisitByVisitId(visitId)
  const {
    ip = '',
    location = '',
    device = '',
    browser = '',
    pages_visited = '[]',
    message_count = 0,
    visit_duration_seconds = 0,
  } = data || {}

  if (existing) {
    await q(
      `UPDATE visitor_visits
       SET pages_visited = :pages_visited,
           visit_duration_seconds = :visit_duration_seconds,
           message_count = :message_count,
           last_activity_at = CURRENT_TIMESTAMP
       WHERE visit_id = :visitId`,
      { visitId, pages_visited, visit_duration_seconds, message_count },
    )
    return getVisitByVisitId(visitId)
  }

  await q(
    `INSERT INTO visitor_visits
      (visit_id, conversation_id, ip, location, device, browser, pages_visited, message_count)
     VALUES
      (:visitId, :conversationId, :ip, :location, :device, :browser, :pages_visited, :message_count)`,
    { visitId, conversationId: conversationId || null, ip, location, device, browser, pages_visited, message_count },
  )
  return getVisitByVisitId(visitId)
}

export async function getVisitByVisitId(visitId) {
  return one(`SELECT * FROM visitor_visits WHERE visit_id = :visitId`, { visitId })
}

export async function updateVisitLocation(visitId, location) {
  await q(`UPDATE visitor_visits SET location = :location WHERE visit_id = :visitId`, { visitId, location })
}

export async function getAllVisits() {
  return q(`SELECT * FROM visitor_visits ORDER BY started_at DESC`)
}

export async function getVisitsForAnalytics(since = '-7 days') {
  // Expect `since` to be like "-7 days" from existing API.
  // Convert to MySQL interval: -7 day(s)
  const m = String(since).match(/^-(\d+)\s+days?$/i)
  const days = m ? Number(m[1]) : 7
  return q(`SELECT * FROM visitor_visits WHERE started_at >= DATE_SUB(NOW(), INTERVAL :days DAY)`, { days })
}

export async function getAdminUsers() {
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
     FROM admin_users u
     LEFT JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`
  )
  if (!rows?.length) return []
  return rows.map((u) => ({ ...u, role: u.roleName, username: u.email }))
}

export async function createAdminUser({ name, email, role_id, password_hash }) {
  await q(
    `INSERT INTO admin_users (name, email, role_id, password_hash) VALUES (:name, :email, :role_id, :password_hash)`,
    { name, email, role_id, password_hash },
  )
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
     FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = :email`,
    { email },
  )
  const u = rows[0]
  return u ? { ...u, role: u.roleName, username: u.email } : null
}

export async function deleteAdminUser(id) {
  await q(`DELETE FROM admin_users WHERE id = :id`, { id })
}

export async function getAdminUserByEmail(email) {
  const u = await one(
    `SELECT u.id, u.name, u.email, u.role_id, r.name AS role, u.password_hash, u.created_at AS createdAt
     FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = :email`,
    { email: String(email).trim().toLowerCase() }
  )
  return u
}

export async function updateAdminUserRole(id, role_id) {
  await q(`UPDATE admin_users SET role_id = :role_id WHERE id = :id`, { id, role_id })
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.role_id AS roleId, r.name AS roleName, u.created_at AS createdAt
     FROM admin_users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = :id`,
    { id },
  )
  const u = rows[0]
  return u ? { ...u, role: u.roleName, username: u.email } : null
}

export async function getRoles() {
  return q(`SELECT id, name, description, created_at AS createdAt FROM roles ORDER BY name`)
}

export async function createRole({ name, description }) {
  const [header] = await pool.query(
    `INSERT INTO roles (name, description) VALUES (:name, :description)`,
    { name: String(name).trim(), description: description ? String(description).trim() : null }
  )
  const id = header?.insertId
  return one(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = :id`, { id })
}

export async function updateRole(id, { name, description }) {
  const existing = await one(`SELECT id FROM roles WHERE id = :id`, { id })
  if (!existing) return null
  if (name != null) await q(`UPDATE roles SET name = :name WHERE id = :id`, { name: String(name).trim(), id })
  if (description !== undefined) await q(`UPDATE roles SET description = :desc WHERE id = :id`, { desc: description ? String(description).trim() : null, id })
  return one(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = :id`, { id })
}

export async function deleteRole(id) {
  const inUse = await one(`SELECT COUNT(*) AS c FROM admin_users WHERE role_id = :id`, { id })
  if (inUse?.c > 0) return { deleted: false, error: 'Cannot delete role: assigned to users' }
  await q(`DELETE FROM role_permissions WHERE role_id = :id`, { id })
  await q(`DELETE FROM roles WHERE id = :id`, { id })
  return { deleted: true }
}

export async function getRoleById(id) {
  return one(`SELECT id, name, description, created_at AS createdAt FROM roles WHERE id = :id`, { id })
}

export async function getPermissions() {
  return q(`SELECT id, name, description, created_at AS createdAt FROM permissions ORDER BY name`)
}

export async function createPermission({ name, description }) {
  const [header] = await pool.query(
    `INSERT INTO permissions (name, description) VALUES (:name, :description)`,
    { name: String(name).trim(), description: description ? String(description).trim() : null }
  )
  const id = header?.insertId
  return one(`SELECT id, name, description, created_at AS createdAt FROM permissions WHERE id = :id`, { id })
}

export async function getPermissionIdsForRole(roleId) {
  const rows = await q(`SELECT permission_id AS permissionId FROM role_permissions WHERE role_id = :roleId`, { roleId })
  return rows.map((r) => r.permissionId)
}

export async function assignRolePermissions(roleId, permissionIds) {
  await q(`DELETE FROM role_permissions WHERE role_id = :roleId`, { roleId })
  if (!Array.isArray(permissionIds) || permissionIds.length === 0) return
  for (const pid of permissionIds) {
    if (Number.isFinite(Number(pid))) {
      await q(`INSERT INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)`, {
        roleId,
        permissionId: Number(pid),
      })
    }
  }
}

export async function getRolesWithPermissions() {
  const roles = await q(`SELECT id, name, description, created_at AS createdAt FROM roles ORDER BY name`)
  const rp = await q(`SELECT role_id AS roleId, permission_id AS permissionId FROM role_permissions`)
  const byRole = {}
  for (const r of rp) {
    if (!byRole[r.roleId]) byRole[r.roleId] = []
    byRole[r.roleId].push(r.permissionId)
  }
  return roles.map((r) => ({ ...r, permissionIds: byRole[r.id] || [] }))
}

export async function getRolePermissions() {
  const rows = await q(`SELECT rp.role_id, rp.permission_id, r.name AS roleName, p.name AS permissionName FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id ORDER BY r.id, p.id`)
  return rows
}

export async function getPermissionsForRole(roleName) {
  const rows = await q(
    `SELECT p.name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.name = :roleName`,
    { roleName },
  )
  return rows.map((r) => r.name)
}

export async function createUser({ email, password_hash }) {
  const res = await q(`INSERT INTO users (email, password_hash) VALUES (:email, :password_hash)`, { email, password_hash })
  return one(`SELECT id, email, created_at FROM users WHERE id = :id`, { id: res.insertId })
}

export async function getUserByEmail(email) {
  return one(`SELECT * FROM users WHERE email = :email`, { email })
}

export async function getUserById(id) {
  return one(`SELECT id, email, created_at FROM users WHERE id = :id`, { id })
}

export async function createPost({ user_id, title, body }) {
  const res = await q(`INSERT INTO posts (user_id, title, body) VALUES (:user_id, :title, :body)`, { user_id, title, body: body || '' })
  return getPostById(res.insertId)
}

export async function getPosts() {
  return q(
    `SELECT p.*, u.email AS author_email
     FROM posts p
     LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC`,
  )
}

export async function getPostById(id) {
  return one(
    `SELECT p.*, u.email AS author_email
     FROM posts p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = :id`,
    { id },
  )
}

export async function updatePost(id, { title, body }) {
  await q(`UPDATE posts SET title=:title, body=:body WHERE id=:id`, { id, title, body: body || '' })
  return getPostById(id)
}

export async function deletePost(id) {
  await q(`DELETE FROM posts WHERE id=:id`, { id })
}

export async function getSiteSettings() {
  const rows = await q(`SELECT \`key\`, value FROM site_settings`)
  const out = {}
  rows.forEach((r) => {
    out[r.key] = parseJson(r.value)
  })
  return out
}

export async function setSiteSettings(patch) {
  const entries = Object.entries(patch || {})
  for (const [key, value] of entries) {
    await q(
      `INSERT INTO site_settings (\`key\`, value) VALUES (:key, :value)
       ON DUPLICATE KEY UPDATE value=VALUES(value)`,
      { key, value: JSON.stringify(value) },
    )
  }
  return getSiteSettings()
}

const SETTINGS_GROUP_MAP = {
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

function settingsInferGroup(key) {
  return SETTINGS_GROUP_MAP[key] ?? 'website'
}

function settingsCastValue(key, value) {
  if (value == null) return null
  const bools = ['auto_reply_toggle', 'admin_notification_toggle', 'email_notifications', 'new_partnership_alert', 'new_chat_alert', 'new_ticket_alert', '2fa_toggle', 'chat_auto_assign', 'chat_enabled', 'maintenance_mode']
  if (bools.includes(key)) return ['1', 'true', 'yes'].includes(String(value).toLowerCase())
  if (key === 'partnership_types') {
    try {
      const d = JSON.parse(value)
      return Array.isArray(d) ? d : String(value || '').split(',').map((s) => s.trim()).filter(Boolean)
    } catch {
      return String(value || '').split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  if (key === 'session_timeout') return parseInt(value, 10) || 60
  return value
}

export async function getSettings() {
  const rows = await q(`SELECT \`key\`, value, \`group\` FROM settings`)
  const grouped = {}
  const flat = {}
  for (const r of rows) {
    const g = r.group || 'website'
    if (!grouped[g]) grouped[g] = {}
    grouped[g][r.key] = settingsCastValue(r.key, r.value)
    flat[r.key] = settingsCastValue(r.key, r.value)
  }
  return { grouped, flat }
}

export async function setSettings(items) {
  const entries = Object.entries(items || {})
  for (const [key, value] of entries) {
    const group = settingsInferGroup(key)
    let val = value
    if (typeof value === 'boolean') val = value ? '1' : '0'
    else if (Array.isArray(value)) val = JSON.stringify(value)
    else val = String(value ?? '')
    await q(
      `INSERT INTO settings (\`key\`, value, \`group\`) VALUES (:key, :value, :group)
       ON DUPLICATE KEY UPDATE value = VALUES(value), \`group\` = VALUES(\`group\`)`,
      { key, value: val, group },
    )
  }
  return getSettings()
}

export async function logActivity({ action, adminUsername = null, ipAddress = null, details = null }) {
  await q(
    `INSERT INTO activity_logs (action, admin_username, ip_address, details)
     VALUES (:action, :adminUsername, :ipAddress, :details)`,
    {
      action: String(action || 'unknown').slice(0, 64),
      adminUsername: adminUsername ? String(adminUsername).slice(0, 128) : null,
      ipAddress: ipAddress ? String(ipAddress).slice(0, 64) : null,
      details: details != null ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    },
  )
}

export async function getActivityLogs(limit = 100) {
  return q(
    `SELECT id, action, admin_username AS adminUsername, ip_address AS ipAddress, details, created_at AS createdAt
     FROM activity_logs ORDER BY created_at DESC LIMIT :limit`,
    { limit },
  )
}

export async function getAdminStats() {
  const safeCount = async (sql) => {
    try {
      return Number((await one(sql))?.count ?? 0)
    } catch {
      // Keep dashboard/chat server alive even when optional/legacy tables are missing.
      return 0
    }
  }

  /** One round-trip per query, but all independent — parallel cuts wall-clock vs sequential awaits. */
  const [users, messages, posts, activeChats, unreadChat, subscribers, jobApplications] = await Promise.all([
    safeCount(`SELECT COUNT(1) AS count FROM users`),
    safeCount(`SELECT COUNT(1) AS count FROM messages`),
    safeCount(`SELECT COUNT(1) AS count FROM posts`),
    safeCount(`SELECT COUNT(1) AS count FROM conversations WHERE status IN ('open','in_progress')`),
    safeCount(`SELECT COALESCE(SUM(admin_unread_count), 0) AS count FROM conversations`),
    safeCount(`SELECT COUNT(1) AS count FROM subscribers`),
    safeCount(`SELECT COUNT(1) AS count FROM applications`),
  ])
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
  return q(`SELECT id, name, label, created_at AS createdAt, updated_at AS updatedAt FROM cms_pages ORDER BY name`)
}

export async function getCmsPageByName(name) {
  return one(`SELECT id, name, label FROM cms_pages WHERE name = :name`, { name })
}

export async function getCmsSectionsByPageId(pageId) {
  return q(
    `SELECT id, page_id AS pageId, section_key AS sectionKey, label, sort_order AS sortOrder, is_visible AS isVisible
     FROM cms_sections WHERE page_id = :pageId ORDER BY sort_order, id`,
    { pageId },
  )
}

export async function getCmsContentsBySectionId(sectionId) {
  return q(
    `SELECT id, section_id AS sectionId, content_type AS contentType, content_key AS contentKey, value
     FROM cms_contents WHERE section_id = :sectionId ORDER BY content_key`,
    { sectionId },
  )
}

export async function getCmsPageContent(pageName) {
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
}

export async function upsertCmsContent(sectionId, contentType, contentKey, value) {
  const existing = await one(`SELECT id FROM cms_contents WHERE section_id = :sid AND content_key = :key`, { sid: sectionId, key: contentKey })
  if (existing) {
    await q(`UPDATE cms_contents SET content_type = :type, value = :val WHERE id = :id`, { type: contentType, val: value ?? '', id: existing.id })
  } else {
    await q(`INSERT INTO cms_contents (section_id, content_type, content_key, value) VALUES (:sid, :type, :key, :val)`, { sid: sectionId, type: contentType, key: contentKey, val: value ?? '' })
  }
}

export async function getCmsSectionByPageAndKey(pageId, sectionKey) {
  return one(`SELECT id FROM cms_sections WHERE page_id = :pageId AND section_key = :sectionKey`, { pageId, sectionKey })
}

export async function getCmsSectionById(sectionId) {
  return one(`SELECT id, page_id AS pageId, section_key AS sectionKey, label FROM cms_sections WHERE id = :id`, { id: sectionId })
}

// ── Careers & News ──

export async function getCareerPositions() {
  return q(`SELECT id, title, location, department, type, summary FROM career_positions ORDER BY id DESC`)
}

export async function createCareerPosition(data = {}) {
  const { title, location = null, department = null, type = null, summary = null } = data
  const res = await q(
    `INSERT INTO career_positions (title, location, department, type, summary)
     VALUES (:title, :location, :department, :type, :summary)`,
    { title, location, department, type, summary },
  )
  return one(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = :id`, { id: res.insertId })
}

export async function updateCareerPosition(id, data = {}) {
  const row = await one(`SELECT * FROM career_positions WHERE id = :id`, { id })
  if (!row) return null
  const next = {
    title: data.title ?? row.title,
    location: data.location ?? row.location,
    department: data.department ?? row.department,
    type: data.type ?? row.type,
    summary: data.summary ?? row.summary,
  }
  await q(
    `UPDATE career_positions
     SET title=:title, location=:location, department=:department, type=:type, summary=:summary
     WHERE id=:id`,
    { id, ...next },
  )
  return one(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = :id`, { id })
}

export async function deleteCareerPosition(id) {
  await q(`DELETE FROM career_positions WHERE id = :id`, { id })
  return true
}

export async function getCareerPositionById(id) {
  return one(`SELECT id, title, location, department, type, summary FROM career_positions WHERE id = :id`, { id })
}

export async function createApplication(data) {
  const { job_id, full_name, email, phone, resume } = data
  /** Use :resume_path — some mysql2 builds misparse :resume next to column `resume` */
  const params = {
    job_id,
    full_name,
    email,
    phone: phone || null,
    resume_path: resume,
  }
  const insertMinimal = `INSERT INTO applications (job_id, full_name, email, phone, \`resume\`)
    VALUES (:job_id, :full_name, :email, :phone, :resume_path)`
  const insertWithTs = `INSERT INTO applications (job_id, full_name, email, phone, \`resume\`, created_at, updated_at)
    VALUES (:job_id, :full_name, :email, :phone, :resume_path, NOW(), NOW())`

  async function doInsert() {
    try {
      await q(insertMinimal, params)
    } catch (e) {
      const msg = (e && (e.sqlMessage || e.message)) || ''
      const needTs =
        e?.errno === 1364 ||
        /created_at|updated_at|doesn't have a default value/i.test(msg)
      if (needTs) {
        await q(insertWithTs, params)
        return
      }
      if (e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146) {
        await ensureApplicationsTable()
        await q(insertMinimal, params)
        return
      }
      if (e?.errno === 1054 && /phone/i.test(msg)) {
        await q(
          `INSERT INTO applications (job_id, full_name, email, \`resume\`) VALUES (:job_id, :full_name, :email, :resume_path)`,
          { job_id, full_name, email, resume_path: resume },
        )
        return
      }
      if (e?.errno === 1364 && /status/i.test(msg)) {
        await q(
          `INSERT INTO applications (job_id, full_name, email, phone, \`resume\`, status) VALUES (:job_id, :full_name, :email, :phone, :resume_path, 'new')`,
          params,
        )
        return
      }
      throw e
    }
  }

  await doInsert()
  return { ok: true }
}

export async function listApplications({ search = '', limit = 300 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 300, 1), 500)
  const s = (search || '').trim().slice(0, 120).replace(/[%_]/g, '')
  if (s) {
    const term = `%${s}%`
    return q(
      `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
        p.title AS job_title
       FROM applications a
       LEFT JOIN career_positions p ON p.id = a.job_id
       WHERE a.full_name LIKE :term OR a.email LIKE :term OR a.phone LIKE :term
         OR CAST(a.job_id AS CHAR) LIKE :term OR IFNULL(p.title,'') LIKE :term
       ORDER BY a.created_at DESC
       LIMIT ${lim}`,
      { term },
    )
  }
  return q(
    `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
      p.title AS job_title
     FROM applications a
     LEFT JOIN career_positions p ON p.id = a.job_id
     ORDER BY a.created_at DESC
     LIMIT ${lim}`,
  )
}

export async function getApplicationById(id) {
  return one(
    `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.status, a.resume, a.created_at,
      p.title AS job_title
     FROM applications a
     LEFT JOIN career_positions p ON p.id = a.job_id
     WHERE a.id = :id`,
    { id },
  )
}

export async function updateApplicationStatus(id, status) {
  await q(`UPDATE applications SET status = :status WHERE id = :id`, { id, status })
  return true
}

export async function deleteApplication(id) {
  await q(`DELETE FROM applications WHERE id = :id`, { id })
  return true
}

export async function createLendingApplication(data) {
  const payload = typeof data === 'object' ? JSON.stringify(data) : String(data)
  await q(`INSERT INTO lending_applications (payload, status) VALUES (:payload, 'new')`, { payload })
  const row = await one(`SELECT LAST_INSERT_ID() AS id`)
  return { ok: true, id: row?.id }
}

export async function listLendingApplications({ limit = 300 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 300, 1), 500)
  const rows = await q(
    `SELECT id, payload, status, created_at FROM lending_applications ORDER BY created_at DESC LIMIT ${lim}`,
  )
  return (rows || []).map((r) => {
    let parsed = {}
    try {
      const p = r.payload
      parsed = typeof p === 'string' ? JSON.parse(p) : p && typeof p === 'object' ? { ...p } : JSON.parse(String(p))
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
  return q(
    `SELECT id, title, category, date_label AS date, summary
     FROM news_items
     ORDER BY id DESC`,
  )
}

export async function createNewsItem(data = {}) {
  const { title, category = null, date = null, summary = null } = data
  const res = await q(
    `INSERT INTO news_items (title, category, date_label, summary)
     VALUES (:title, :category, :date_label, :summary)`,
    { title, category, date_label: date, summary },
  )
  return one(
    `SELECT id, title, category, date_label AS date, summary
     FROM news_items
     WHERE id = :id`,
    { id: res.insertId },
  )
}

export async function updateNewsItem(id, data = {}) {
  const row = await one(`SELECT * FROM news_items WHERE id = :id`, { id })
  if (!row) return null
  const next = {
    title: data.title ?? row.title,
    category: data.category ?? row.category,
    date_label: data.date ?? row.date_label,
    summary: data.summary ?? row.summary,
  }
  await q(
    `UPDATE news_items
     SET title=:title, category=:category, date_label=:date_label, summary=:summary
     WHERE id=:id`,
    { id, ...next },
  )
  return one(
    `SELECT id, title, category, date_label AS date, summary
     FROM news_items
     WHERE id = :id`,
    { id },
  )
}

export async function deleteNewsItem(id) {
  await q(`DELETE FROM news_items WHERE id = :id`, { id })
  return true
}

export async function getNewsletterContent() {
  const settings = await getSiteSettings()
  return settings.newsletter_content || null
}

export async function setNewsletterContent(content) {
  const next = await setSiteSettings({ newsletter_content: content || {} })
  return next.newsletter_content || {}
}

// ── Customer feedback ──

export async function createFeedback(data = {}) {
  const {
    id,
    conversationId = null,
    rating,
    name = 'Anonymous',
    email = null,
    subject = null,
    comment,
  } = data || {}
  await q(
    `INSERT INTO feedback (id, conversation_id, rating, name, email, subject, comment, is_read)
     VALUES (:id, :conversation_id, :rating, :name, :email, :subject, :comment, 0)`,
    {
      id,
      conversation_id: conversationId,
      rating,
      name,
      email,
      subject,
      comment,
    },
  )
  return one(
    `SELECT id, conversation_id, rating, name, email, subject, comment, is_read, created_at
     FROM feedback
     WHERE id = :id`,
    { id },
  )
}

/**
 * @param {{ limit?: number, offset?: number }} [opts]
 * Caps payload size for admin inbox (large tables were causing multi-second responses).
 */
export async function getFeedback(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 500)
  const offset = Math.max(Number(opts.offset) || 0, 0)
  return q(
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
  // Build IN list safely with named placeholders.
  const params = {}
  const names = arr.map((v, i) => {
    const key = `id${i}`
    params[key] = v
    return `:${key}`
  })
  const res = await q(
    `UPDATE feedback SET is_read = :is_read WHERE id IN (${names.join(',')})`,
    { is_read: isRead ? 1 : 0, ...params },
  )
  return res?.affectedRows ?? 0
}

export async function deleteFeedback(id) {
  const res = await q(`DELETE FROM feedback WHERE id = :id`, { id })
  return res?.affectedRows ? true : false
}

export async function countUnreadFeedback() {
  const row = await one(`SELECT COUNT(1) AS count FROM feedback WHERE is_read = 0`)
  return row?.count ?? 0
}

// ── Partnerships ──

export async function createPartnership(data = {}) {
  const { full_name, company, email, phone, partnership_type, message } = data || {}
  if (!full_name?.trim() || !email?.trim()) return null
  await q(
    `INSERT INTO partnerships (full_name, company, email, phone, partnership_type, message)
     VALUES (:full_name, :company, :email, :phone, :partnership_type, :message)`,
    {
      full_name: full_name.trim(),
      company: company?.trim() || null,
      email: email.trim(),
      phone: phone?.trim() || null,
      partnership_type: partnership_type?.trim() || null,
      message: message?.trim() || null,
    },
  )
  const row = await one(`SELECT id, full_name, company, email, phone, partnership_type, message, status, created_at, updated_at FROM partnerships ORDER BY id DESC LIMIT 1`)
  return row
}

export async function getPartnerships(filters = {}) {
  const { search } = filters || {}
  let sql = `SELECT id, full_name, company, email, phone, partnership_type, message, status, created_at, updated_at FROM partnerships WHERE 1=1`
  const params = {}
  if (search && typeof search === 'string' && search.trim()) {
    const s = `%${search.trim()}%`
    sql += ` AND (full_name LIKE :search OR email LIKE :search OR company LIKE :search OR partnership_type LIKE :search)`
    params.search = s
  }
  sql += ` ORDER BY created_at DESC`
  return q(sql, Object.keys(params).length ? params : undefined)
}

export async function deletePartnership(id) {
  const res = await q(`DELETE FROM partnerships WHERE id = :id`, { id })
  return res?.affectedRows ? true : false
}

export async function updatePartnership(id, data) {
  const { status } = data || {}
  if (!status) return null
  const valid = ['new', 'contacted', 'in_progress', 'approved', 'rejected'].includes(status)
  if (!valid) return null
  await q(`UPDATE partnerships SET status = :status WHERE id = :id`, { id, status })
  return one(`SELECT id, full_name, company, email, phone, partnership_type, message, status, created_at, updated_at FROM partnerships WHERE id = :id`, { id })
}

// ── Subscribers ──

export async function createSubscriber(data) {
  const { email, subscription_type = 'both', unsubscribe_token } = data || {}
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return null
  const type = ['careers', 'news', 'both'].includes(subscription_type) ? subscription_type : 'both'
  const token = unsubscribe_token || crypto.randomUUID().replace(/-/g, '')
  try {
    await q(
      `INSERT INTO subscribers (email, subscription_type, unsubscribe_token)
       VALUES (:email, :subscription_type, :unsubscribe_token)`,
      { email: normalized, subscription_type: type, unsubscribe_token: token },
    )
    return one(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE email = :email`, { email: normalized })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return null
    throw err
  }
}

export async function getSubscriberByEmail(email) {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return null
  return one(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE email = :email`, { email: normalized })
}

export async function updateSubscriberType(id, subscription_type) {
  const type = ['careers', 'news', 'both'].includes(subscription_type) ? subscription_type : 'both'
  await q(`UPDATE subscribers SET subscription_type = :type WHERE id = :id`, { id, type })
  return one(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE id = :id`, { id })
}

export async function getSubscribers(filters = {}) {
  const { subscription_type, search } = filters || {}
  let sql = `SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE 1=1`
  const params = {}
  if (subscription_type && subscription_type !== 'all') {
    sql += ` AND subscription_type = :subscription_type`
    params.subscription_type = subscription_type
  }
  if (search && typeof search === 'string' && search.trim()) {
    sql += ` AND (email LIKE :search)`
    params.search = `%${search.trim()}%`
  }
  sql += ` ORDER BY created_at DESC`
  return q(sql, Object.keys(params).length ? params : undefined)
}

export async function deleteSubscriber(id) {
  const res = await q(`DELETE FROM subscribers WHERE id = :id`, { id })
  return res?.affectedRows ? true : false
}

export async function countSubscribers(filters = {}) {
  const { subscription_type } = filters || {}
  let sql = `SELECT COUNT(1) AS count FROM subscribers WHERE 1=1`
  const params = {}
  if (subscription_type && subscription_type !== 'all') {
    sql += ` AND subscription_type = :subscription_type`
    params.subscription_type = subscription_type
  }
  const row = await one(sql, Object.keys(params).length ? params : undefined)
  return row?.count ?? 0
}

export async function getSubscribersForNotification(type) {
  if (type === 'careers') {
    return q(`SELECT id, email, unsubscribe_token FROM subscribers WHERE subscription_type IN ('careers','both')`)
  }
  if (type === 'news') {
    return q(`SELECT id, email, unsubscribe_token FROM subscribers WHERE subscription_type IN ('news','both')`)
  }
  return []
}

export async function getSubscriberByToken(token) {
  if (!token) return null
  return one(`SELECT id, email, subscription_type, unsubscribe_token, created_at FROM subscribers WHERE unsubscribe_token = :token`, { token })
}

export async function deleteSubscriberByToken(token) {
  const res = await q(`DELETE FROM subscribers WHERE unsubscribe_token = :token`, { token })
  return res?.affectedRows ? true : false
}

// ── App Roles & Users (User Management API) ──
const PERM_KEYS = ['manage_applications', 'manage_partnerships', 'manage_settings', 'manage_tickets', 'manage_users', 'view_dashboard']

function parsePerms(raw) {
  if (!raw) return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {})
  if (typeof raw === 'object') return { ...PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {}), ...raw }
  try {
    const p = JSON.parse(raw)
    return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: !!p[k] }), {})
  } catch {
    return PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {})
  }
}

export async function getAppRoles() {
  const rows = await q(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles ORDER BY name`)
  return rows.map((r) => ({ ...r, id: String(r.id), permissions: parsePerms(r.permissions) }))
}

export async function createAppRole({ name, permissions }) {
  const id = crypto.randomUUID()
  const perms = { ...PERM_KEYS.reduce((o, k) => ({ ...o, [k]: false }), {}), ...(permissions ?? {}) }
  await q(`INSERT INTO app_roles (id, name, permissions, is_system) VALUES (:id, :name, :permissions, 0)`, {
    id,
    name,
    permissions: JSON.stringify(perms),
  })
  const r = await one(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles WHERE id = :id`, { id })
  return r ? { ...r, permissions: parsePerms(r.permissions) } : null
}

export async function updateAppRole(id, { name, permissions }) {
  const existing = await one(`SELECT id FROM app_roles WHERE id = :id`, { id })
  if (!existing) return null
  if (name != null) await q(`UPDATE app_roles SET name = :name WHERE id = :id`, { name, id })
  if (permissions != null) await q(`UPDATE app_roles SET permissions = :permissions WHERE id = :id`, { permissions: JSON.stringify(permissions), id })
  const r = await one(`SELECT id, name, permissions, is_system AS isSystem, created_at AS createdAt FROM app_roles WHERE id = :id`, { id })
  return r ? { ...r, permissions: parsePerms(r.permissions) } : null
}

export async function deleteAppRole(id) {
  const r = await one(`SELECT is_system FROM app_roles WHERE id = :id`, { id })
  if (!r) return { deleted: false, error: 'Not found' }
  if (r.is_system) return { deleted: false, error: 'Cannot delete system role' }
  await q(`DELETE FROM app_roles WHERE id = :id`, { id })
  return { deleted: true }
}

export async function getAppUsers() {
  const rows = await q(`SELECT id, name, username, email, role_id AS roleId, created_at AS createdAt FROM app_users ORDER BY created_at DESC`)
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

export async function createAppUser({ name, username, email, password_hash, role_id }) {
  const id = crypto.randomUUID()
  await q(
    `INSERT INTO app_users (id, name, username, email, role_id, password_hash) VALUES (:id, :name, :username, :email, :role_id, :password_hash)`,
    {
      id,
      name,
      username: String(username).trim().toLowerCase(),
      email: String(email).trim().toLowerCase(),
      role_id,
      password_hash,
    },
  )
  const u = await one(`SELECT id, name, username, email, role_id AS roleId, created_at AS createdAt FROM app_users WHERE id = :id`, { id })
  return u ? { ...u, id: String(u.id) } : null
}

export async function getAppUserByUsername(username) {
  return one(`SELECT id FROM app_users WHERE LOWER(username) = :username`, { username: String(username).trim().toLowerCase() })
}

/** Find app_user by username OR email (for login) */
export async function getAppUserByLogin(login) {
  const key = String(login).trim().toLowerCase()
  return one(
    `SELECT u.id, u.name, u.username, u.email, u.role_id AS roleId, u.password_hash
     FROM app_users u WHERE LOWER(u.username) = :k OR LOWER(u.email) = :k`,
    { k: key }
  )
}

/** Get app_role by id with parsed permissions */
export async function getAppRoleById(id) {
  const r = await one(`SELECT id, name, permissions FROM app_roles WHERE id = :id`, { id })
  return r ? { ...r, permissions: parsePerms(r.permissions) } : null
}

