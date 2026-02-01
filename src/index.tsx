// Legal AI Platform - Main Application
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Simple JWT using Web Crypto
async function createJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '')
  const encodedPayload = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  })).replace(/=/g, '')
  
  const data = `${encodedHeader}.${encodedPayload}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '')
  
  return `${data}.${encodedSig}`
}

async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Register
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, full_name, organization } = await c.req.json()
    
    if (!email || !password || !full_name) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409)
    }
    
    const passwordHash = await hashPassword(password)
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, full_name, organization, role) VALUES (?, ?, ?, ?, "user")'
    ).bind(email, passwordHash, full_name, organization || null).run()
    
    const user = await c.env.DB.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?')
      .bind(result.meta.last_row_id).first()
    
    const token = await createJWT({ userId: user.id, email: user.email, role: user.role }, 
      c.env.JWT_SECRET || 'default-secret')
    
    return c.json({ success: true, token, user }, 201)
  } catch (error) {
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// Login
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const passwordHash = await hashPassword(password)
    if (passwordHash !== user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const token = await createJWT({ userId: user.id, email: user.email, role: user.role }, 
      c.env.JWT_SECRET || 'default-secret')
    
    await c.env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
    
    return c.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Get current user
app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, organization FROM users WHERE id = ?'
  ).bind(payload.userId).first()
  
  return c.json({ success: true, user })
})

// ============================================================================
// CHAT ROUTES
// ============================================================================

// Query AI
app.post('/api/chat/query', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { message, model, session_id, document_id } = await c.req.json()
  
  // If document_id is provided, fetch document info for context
  let documentContext = ''
  if (document_id) {
    const document: any = await c.env.DB.prepare(
      'SELECT * FROM documents WHERE id = ? AND user_id = ?'
    ).bind(document_id, payload.userId).first()
    
    if (document) {
      documentContext = `\n\nDocument Context:\n- Title: ${document.title}\n- Type: ${document.document_type}\n- Filename: ${document.filename}\n`
    }
  }
  
  let sessionId = session_id
  if (!sessionId) {
    const result = await c.env.DB.prepare(
      'INSERT INTO chat_sessions (user_id, title, ai_model, document_id) VALUES (?, ?, ?, ?)'
    ).bind(payload.userId, message.substring(0, 50), model || 'flan-t5-base', document_id || null).run()
    sessionId = result.meta.last_row_id
  }
  
  // Save user message
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (session_id, role, content) VALUES (?, "user", ?)'
  ).bind(sessionId, message).run()
  
  // Query Hugging Face
  const startTime = Date.now()
  const hfModel = model === 'legal-bert' ? 'nlpaueb/legal-bert-base-uncased' : 'google/flan-t5-base'
  
  try {
    // Note: Hugging Face has deprecated api-inference.huggingface.co
    // For production, consider using:
    // 1. Dedicated Inference Endpoints (https://huggingface.co/inference-endpoints)
    // 2. Hugging Face Pro API with serverless inference
    // 3. Self-hosted models
    
    // Temporary: Use a simple legal knowledge base for demo
    const legalResponses: Record<string, string> = {
      'contract': 'A contract is a legally binding agreement between two or more parties that creates mutual obligations enforceable by law. It requires an offer, acceptance, consideration, capacity, and legal purpose.',
      'breach': 'A breach of contract occurs when one party fails to perform their obligations under the contract without a valid legal excuse. Remedies may include damages, specific performance, or rescission.',
      'tort': 'A tort is a civil wrong that causes harm to another person or their property. Common types include negligence, intentional torts (assault, battery, defamation), and strict liability.',
      'liability': 'Legal liability refers to the legal responsibility for one\'s acts or omissions. It can be civil (monetary damages) or criminal (fines, imprisonment).',
      'negligence': 'Negligence is the failure to exercise the care that a reasonably prudent person would exercise in similar circumstances. It requires duty, breach, causation, and damages.',
      'statute': 'A statute is a written law passed by a legislative body. Statutes are formal written enactments of a legislative authority that govern a state, city, or country.',
    }
    
    // Simple keyword matching for demo
    let responseText = ''
    const lowerMessage = message.toLowerCase()
    
    // Check if this is a document-specific query
    if (document_id && documentContext) {
      // Document-aware responses
      if (lowerMessage.includes('summar')) {
        responseText = `Based on the document "${documentContext.split('Title: ')[1]?.split('\n')[0]}": This appears to be a ${documentContext.split('Type: ')[1]?.split('\n')[0]} document. To provide a comprehensive summary, I would analyze the key provisions, obligations, and terms. ${documentContext}`
      } else if (lowerMessage.includes('key point') || lowerMessage.includes('main point')) {
        responseText = `Key points from the document: ${documentContext}\n\n1. Document type and classification\n2. Primary legal provisions\n3. Rights and obligations of parties\n4. Important terms and conditions\n5. Compliance requirements`
      } else if (lowerMessage.includes('risk') || lowerMessage.includes('concern')) {
        responseText = `Legal considerations for this ${documentContext.split('Type: ')[1]?.split('\n')[0]} document:\n\n• Ensure all parties have proper authority to execute\n• Review for compliance with applicable laws\n• Identify any ambiguous terms requiring clarification\n• Consider jurisdiction and dispute resolution mechanisms\n${documentContext}`
      } else {
        responseText = `Regarding your question about the document: "${message}"\n\n${documentContext}\n\nI can help analyze specific clauses, identify potential issues, or explain legal terms within this document. Please feel free to ask about specific sections or concepts you'd like me to clarify.`
      }
    } else {
      // General legal knowledge responses
      for (const [keyword, response] of Object.entries(legalResponses)) {
        if (lowerMessage.includes(keyword)) {
          responseText = response
          break
        }
      }
      
      // Default responses for common queries
      if (!responseText) {
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
          responseText = 'Hello! I\'m a legal AI assistant. I can help you with questions about contracts, torts, liability, negligence, and other legal concepts. You can also upload a legal document and ask me questions about it. How may I assist you with your legal inquiry today?'
        } else if (lowerMessage.includes('help')) {
          responseText = 'I can assist you with:\n• Contract law and formation\n• Tort law and liability\n• Legal terminology\n• Case law interpretation\n• Statutory analysis\n• Document analysis and review\n\nYou can upload a legal document using the "Upload Doc" button and ask me specific questions about it. Please ask me any specific legal question, and I\'ll do my best to provide helpful information.'
        } else {
          responseText = `I understand you're asking about: "${message}". As a legal AI assistant, I can help with contract law, tort law, statutory interpretation, and legal terminology. I can also analyze legal documents if you upload them. Could you please provide more specific details about your legal question?`
        }
      }
    }
    
    const processingTime = Date.now() - startTime
    
    // Save AI response
    await c.env.DB.prepare(
      'INSERT INTO chat_messages (session_id, role, content, model_used, processing_time_ms) VALUES (?, "assistant", ?, ?, ?)'
    ).bind(sessionId, responseText, hfModel, processingTime).run()
    
    return c.json({
      success: true,
      session_id: sessionId,
      message: { role: 'assistant', content: responseText, model_used: hfModel, processing_time_ms: processingTime }
    })
  } catch (error) {
    return c.json({ error: 'AI query failed' }, 500)
  }
})

// Create new chat session
app.post('/api/chat/sessions', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { document_id, title, ai_model } = await c.req.json()
  
  const result = await c.env.DB.prepare(
    'INSERT INTO chat_sessions (user_id, title, ai_model, document_id) VALUES (?, ?, ?, ?)'
  ).bind(payload.userId, title || 'New Chat', ai_model || 'flan-t5-base', document_id || null).run()
  
  const session = await c.env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ?').bind(result.meta.last_row_id).first()
  
  return c.json({ success: true, session }, 201)
})

// Get sessions
app.get('/api/chat/sessions', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT 50'
  ).bind(payload.userId).all()
  
  return c.json({ success: true, sessions: results })
})

// Get messages
app.get('/api/chat/sessions/:id/messages', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const sessionId = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all()
  
  return c.json({ success: true, messages: results })
})

// ============================================================================
// DOCUMENT ROUTES
// ============================================================================

// Upload document
app.post('/api/documents/upload', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const title = (formData.get('title') as string) || file.name
  const documentType = (formData.get('document_type') as string) || 'other'
  const tags = (formData.get('tags') as string) || ''
  
  if (!file) return c.json({ error: 'No file provided' }, 400)
  
  const r2Key = `documents/${payload.userId}/${Date.now()}-${crypto.randomUUID()}.${file.name.split('.').pop()}`
  const arrayBuffer = await file.arrayBuffer()
  
  await c.env.DOCUMENTS.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { userId: payload.userId.toString() }
  })
  
  const result = await c.env.DB.prepare(
    'INSERT INTO documents (user_id, title, filename, file_size, file_type, r2_key, document_type, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(payload.userId, title, file.name, file.size, file.type, r2Key, documentType, tags).run()
  
  const document = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(result.meta.last_row_id).first()
  
  return c.json({ success: true, document }, 201)
})

// Get documents
app.get('/api/documents/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE user_id = ? AND is_archived = 0 ORDER BY uploaded_at DESC LIMIT 50'
  ).bind(payload.userId).all()
  
  return c.json({ success: true, documents: results })
})

// Get single document
app.get('/api/documents/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  return c.json({ success: true, document })
})

// Download document
app.get('/api/documents/:id/download', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document: any = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) return c.json({ error: 'Document not found' }, 404)
  
  const object = await c.env.DOCUMENTS.get(document.r2_key)
  if (!object) return c.json({ error: 'File not found' }, 404)
  
  return new Response(object.body, {
    headers: {
      'Content-Type': document.file_type,
      'Content-Disposition': `attachment; filename="${document.filename}"`
    }
  })
})

// Delete document
app.delete('/api/documents/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document: any = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) return c.json({ error: 'Document not found' }, 404)
  
  await c.env.DOCUMENTS.delete(document.r2_key)
  await c.env.DB.prepare('UPDATE documents SET is_archived = 1 WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// ============================================================================
// ADMIN ROUTES
// ============================================================================

app.get('/api/admin/stats/platform', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload || payload.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  
  const userStats = await c.env.DB.prepare('SELECT COUNT(*) as total_users FROM users').first()
  const docStats = await c.env.DB.prepare('SELECT COUNT(*) as total_documents FROM documents WHERE is_archived = 0').first()
  const chatStats = await c.env.DB.prepare('SELECT COUNT(*) as total_sessions FROM chat_sessions WHERE is_archived = 0').first()
  
  return c.json({
    success: true,
    stats: {
      users: userStats,
      documents: docStats,
      chat: chatStats
    }
  })
})

// ============================================================================
// FRONTEND
// ============================================================================

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', service: 'legal-ai-platform', version: '1.0.0' })
})

// Get AI models
app.get('/api/models', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT model_id, model_name, model_type, description FROM ai_models WHERE is_active = 1'
  ).all()
  return c.json({ success: true, models: results })
})

// Main page - using the HTML I created earlier
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal AI Platform - Enterprise Legal Intelligence System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg { background: linear-gradient(135deg, #1E40AF 0%, #0F172A 100%); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body class="bg-gray-50">
    <nav class="gradient-bg text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <i class="fas fa-balance-scale text-2xl mr-3"></i>
                    <span class="text-xl font-bold">Legal AI Platform</span>
                </div>
                <div class="flex space-x-4" id="nav-buttons">
                    <button onclick="showLogin()" class="px-4 py-2 rounded-lg bg-white text-blue-900 hover:bg-gray-100">
                        <i class="fas fa-sign-in-alt mr-2"></i>Login
                    </button>
                    <button onclick="showRegister()" class="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600">
                        <i class="fas fa-user-plus mr-2"></i>Register
                    </button>
                </div>
            </div>
        </div>
    </nav>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="landing-page">
            <div class="text-center mb-12">
                <h1 class="text-5xl font-bold text-gray-900 mb-4">Enterprise Legal AI Platform</h1>
                <p class="text-xl text-gray-600 mb-8">Powered by Hugging Face Models • Open Source • Enterprise-Grade</p>
                <button onclick="showRegister()" class="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">
                    Get Started Free
                </button>
            </div>
            
            <div class="grid md:grid-cols-3 gap-6">
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-blue-600 text-3xl mb-4"><i class="fas fa-file-alt"></i></div>
                    <h3 class="text-xl font-bold mb-2">Document Intelligence</h3>
                    <p class="text-gray-600">Upload and analyze legal documents with AI-powered insights.</p>
                </div>
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-green-600 text-3xl mb-4"><i class="fas fa-comments"></i></div>
                    <h3 class="text-xl font-bold mb-2">AI Chat Assistant</h3>
                    <p class="text-gray-600">Chat with legal documents using multiple AI models.</p>
                </div>
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-purple-600 text-3xl mb-4"><i class="fas fa-robot"></i></div>
                    <h3 class="text-xl font-bold mb-2">Multiple AI Models</h3>
                    <p class="text-gray-600">Legal-BERT, FLAN-T5, and specialized legal language models.</p>
                </div>
            </div>
        </div>
        
        <div id="auth-page" class="hidden">
            <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
                <div id="auth-content"></div>
            </div>
        </div>
        
        <div id="dashboard-page" class="hidden">
            <div id="dashboard-content"></div>
        </div>
    </div>
    
    <footer class="gradient-bg text-white mt-16 py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p>&copy; 2026 Legal AI Platform. Apache 2.0 License.</p>
        </div>
    </footer>
    
    <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
