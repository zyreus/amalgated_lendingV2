-- ============================================================================
-- Amalgated Lending — Recommended composite indexes (perf hardening)
-- ============================================================================
--
-- These are SAFE additive indexes that target the hottest queries in the
-- borrower / admin portals. They are NOT applied automatically; review them
-- against your current `SHOW INDEX FROM ...` output before running.
--
-- Apply via:
--    mysql -u <user> -p amalgated_lending < docs/perf-recommended-indexes.sql
--
-- Each statement uses `CREATE INDEX IF NOT EXISTS` (MySQL 8+) /
-- `ALTER TABLE ... ADD INDEX` patterns. If your MySQL version is < 8.0.29,
-- replace `CREATE INDEX IF NOT EXISTS` with the conditional ALTER form.
--
-- Behaviour note: indexes ONLY speed up reads and (very slightly) slow down
-- writes. They do not change query results.
-- ============================================================================

-- Borrower dashboard: "my loans" + status filter ---------------------------------
CREATE INDEX IF NOT EXISTS loans_borrower_status_idx
  ON loans (borrower_id, status);

-- Admin loans table: filter by status, sort by created_at DESC ------------------
CREATE INDEX IF NOT EXISTS loans_status_created_idx
  ON loans (status, created_at);

-- Officer assignment workload ----------------------------------------------------
CREATE INDEX IF NOT EXISTS loans_assigned_status_idx
  ON loans (assigned_officer_id, status);

-- Payment schedule rendering (per-loan, by due date) ----------------------------
CREATE INDEX IF NOT EXISTS payments_loan_due_idx
  ON payments (loan_id, due_date);

-- "Pending payments" widgets (status filter for a loan) -------------------------
CREATE INDEX IF NOT EXISTS payments_loan_status_idx
  ON payments (loan_id, status);

-- Admin search by borrower name / email -----------------------------------------
CREATE INDEX IF NOT EXISTS users_name_idx
  ON users (name);

-- Borrower notifications: unread count, latest first ----------------------------
CREATE INDEX IF NOT EXISTS borrower_notif_user_read_idx
  ON borrower_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS admin_notif_user_read_idx
  ON admin_notifications (user_id, read_at);

-- Activity timeline for a subject ------------------------------------------------
CREATE INDEX IF NOT EXISTS activity_subject_created_idx
  ON activity_logs (subject_type, subject_id, created_at);

-- Loan applications listing (admin filter by status, recent first) --------------
CREATE INDEX IF NOT EXISTS loan_apps_status_created_idx
  ON loan_applications (status, created_at);

-- Document loan applications listing (admin filter by status, recent first) -----
CREATE INDEX IF NOT EXISTS doc_loan_apps_status_created_idx
  ON document_loan_applications (status, created_at);

-- Lead funnel by status, last activity (admin CRM) ------------------------------
CREATE INDEX IF NOT EXISTS leads_status_last_msg_idx
  ON leads (status, last_message_at);

-- Optional: TEXT search via FULLTEXT on borrower-facing search fields -----------
-- Run only if the table is InnoDB and you actually want FULLTEXT search:
-- ALTER TABLE users ADD FULLTEXT INDEX users_name_email_ft (name, email);
