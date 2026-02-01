-- Seed Data for Legal AI Platform
-- Version: 1.0.0
-- Description: Initial data for testing and development

-- ============================================================================
-- ADMIN USER (password: Admin@123)
-- ============================================================================
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role, is_active, email_verified) VALUES 
(1, 'admin@legalai.com', '$2a$10$rZ8Y5LKX9vYmL0qJxBfXp.L5XOmPZqKjNxLR3Tc8JYZmXqJqKxJqK', 'Admin User', 'admin', 1, 1);

-- ============================================================================
-- TEST USERS
-- ============================================================================
INSERT OR IGNORE INTO users (email, password_hash, full_name, role, organization) VALUES 
('lawyer@lawfirm.com', '$2a$10$rZ8Y5LKX9vYmL0qJxBfXp.L5XOmPZqKjNxLR3Tc8JYZmXqJqKxJqK', 'Sarah Johnson', 'user', 'Johnson & Associates'),
('paralegal@lawfirm.com', '$2a$10$rZ8Y5LKX9vYmL0qJxBfXp.L5XOmPZqKjNxLR3Tc8JYZmXqJqKxJqK', 'Michael Chen', 'user', 'Legal Corp'),
('enterprise@biglaw.com', '$2a$10$rZ8Y5LKX9vYmL0qJxBfXp.L5XOmPZqKjNxLR3Tc8JYZmXqJqKxJqK', 'Emily Rodriguez', 'enterprise', 'BigLaw International');

-- ============================================================================
-- SAMPLE DOCUMENTS
-- ============================================================================
INSERT OR IGNORE INTO documents (user_id, title, filename, file_size, file_type, r2_key, category, status, page_count, word_count) VALUES 
(1, 'Employment Contract Template', 'employment-contract.pdf', 245678, 'application/pdf', 'docs/sample-001.pdf', 'contract', 'ready', 12, 3456),
(2, 'GDPR Compliance Guide', 'gdpr-guide.pdf', 512340, 'application/pdf', 'docs/sample-002.pdf', 'legislation', 'ready', 45, 12500),
(2, 'Case Study - Brown v. Board', 'brown-case.pdf', 189234, 'application/pdf', 'docs/sample-003.pdf', 'case_law', 'ready', 8, 2340);

-- ============================================================================
-- SAMPLE CHAT SESSIONS
-- ============================================================================
INSERT OR IGNORE INTO chat_sessions (user_id, document_id, title, model_name, message_count) VALUES 
(1, 1, 'Employment Contract Analysis', 'legal-bert', 5),
(2, 2, 'GDPR Compliance Questions', 'flan-t5-legal', 8);

-- ============================================================================
-- SAMPLE CHAT MESSAGES
-- ============================================================================
INSERT OR IGNORE INTO chat_messages (session_id, role, content, model_name, tokens_used) VALUES 
(1, 'user', 'What are the key terms in this employment contract?', 'legal-bert', 12),
(1, 'assistant', 'The key terms include: 1) Employment period of 2 years, 2) Non-compete clause for 6 months, 3) Salary of $85,000, 4) Benefits package including health insurance.', 'legal-bert', 45),
(1, 'user', 'Is the non-compete clause enforceable?', 'legal-bert', 10),
(1, 'assistant', 'Non-compete clauses are generally enforceable if they are reasonable in scope, duration, and geographic area. A 6-month period is typically considered reasonable. However, enforceability varies by jurisdiction.', 'legal-bert', 52);
