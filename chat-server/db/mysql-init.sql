-- MySQL initialization for Amalgated Lending (chat / CRM Node server only).
-- Keep this database separate from:
--   • amalgated_lending_db — Laravel lending API (amalgated-lending-api)
--   • amalgated_holdings — Amalgated Holdings corporate site (different project)
-- Tables are also ensured on startup when DB_PROVIDER=mysql (see db/providers/mysql.js).

CREATE DATABASE IF NOT EXISTS `amalgated_lending_chat`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `amalgated_lending_chat`;

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
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
) ENGINE=InnoDB;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(128) NOT NULL,
  sender ENUM('user','ai','admin') NOT NULL,
  admin_name VARCHAR(255) NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messages_convo_created (conversation_id, created_at),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Leads (inquiries + captured leads)
CREATE TABLE IF NOT EXISTS leads (
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
) ENGINE=InnoDB;

-- Visitor analytics
CREATE TABLE IF NOT EXISTS visitor_visits (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visit_id VARCHAR(128) NOT NULL,
  conversation_id VARCHAR(128) NULL,
  ip VARCHAR(64) NULL,
  location VARCHAR(255) NULL,
  device VARCHAR(64) NULL,
  browser VARCHAR(64) NULL,
  pages_visited JSON NULL,
  visit_duration_seconds INT NOT NULL DEFAULT 0,
  message_count INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_visit_id (visit_id),
  KEY idx_visits_started (started_at),
  CONSTRAINT fk_visits_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(128) NOT NULL,
  conversation_id VARCHAR(128) NOT NULL,
  priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status ENUM('open','pending','closed') NOT NULL DEFAULT 'open',
  assigned_staff VARCHAR(255) NULL,
  notes TEXT NULL,
  is_unread TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ticket_id (ticket_id),
  KEY idx_tickets_status_created (status, created_at),
  KEY idx_tickets_convo_created (conversation_id, created_at),
  CONSTRAINT fk_tickets_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB;

-- Posts (example blog)
CREATE TABLE IF NOT EXISTS posts (
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
) ENGINE=InnoDB;

-- Site settings (key/value JSON)
CREATE TABLE IF NOT EXISTS site_settings (
  `key` VARCHAR(191) PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Careers positions
CREATE TABLE IF NOT EXISTS career_positions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  type VARCHAR(64) NULL,
  summary TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_career_positions_created (created_at)
) ENGINE=InnoDB;

-- News items (short highlights)
CREATE TABLE IF NOT EXISTS news_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255) NULL,
  date_label VARCHAR(64) NULL,
  summary TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_news_items_created (created_at)
) ENGINE=InnoDB;

-- Job applications (apply form submissions)
CREATE TABLE IF NOT EXISTS applications (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  resume VARCHAR(512) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_applications_job (job_id),
  KEY idx_applications_created (created_at)
) ENGINE=InnoDB;

-- Subscribers (Careers & News updates)
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  subscription_type ENUM('careers','news','both') NOT NULL DEFAULT 'both',
  unsubscribe_token VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_subscribers_email (email),
  KEY idx_subscribers_type (subscription_type),
  KEY idx_subscribers_created (created_at)
) ENGINE=InnoDB;

-- CMS: pages, sections, contents
CREATE TABLE IF NOT EXISTS cms_pages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cms_sections (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cms_contents (
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
) ENGINE=InnoDB;

-- Customer feedback
CREATE TABLE IF NOT EXISTS feedback (
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
) ENGINE=InnoDB;

