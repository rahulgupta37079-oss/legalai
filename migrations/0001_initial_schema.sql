-- Legal AI Platform Database Schema
-- Enterprise-grade database structure for legal document management and AI chat

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  organization TEXT,
  is_active INTEGER DEFAULT 1,
  email_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  r2_key TEXT UNIQUE NOT NULL,
  document_type TEXT,
  ocr_processed INTEGER DEFAULT 0,
  text_content TEXT,
  metadata TEXT,
  tags TEXT,
  is_archived INTEGER DEFAULT 0,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  document_id INTEGER,
  title TEXT NOT NULL DEFAULT 'New Chat',
  ai_model TEXT NOT NULL DEFAULT 'legal-bert',
  is_archived INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  confidence_score REAL,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Models configuration table
CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT UNIQUE NOT NULL,
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  max_tokens INTEGER DEFAULT 512,
  temperature REAL DEFAULT 0.7,
  hf_model_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage analytics table
CREATE TABLE IF NOT EXISTS usage_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  resource_id INTEGER,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- Insert default AI models
INSERT OR IGNORE INTO ai_models (model_id, model_name, model_type, description, hf_model_path, max_tokens) VALUES
  ('legal-bert', 'Legal-BERT Base', 'legal-bert', 'Specialized BERT model trained on legal documents', 'nlpaueb/legal-bert-base-uncased', 512),
  ('flan-t5-base', 'FLAN-T5 Base', 'flan-t5', 'Google T5 model fine-tuned for instructions', 'google/flan-t5-base', 512),
  ('flan-t5-large', 'FLAN-T5 Large', 'flan-t5', 'Larger version with better performance', 'google/flan-t5-large', 1024);
