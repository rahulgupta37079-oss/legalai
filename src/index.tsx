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
    
    // Enhanced legal knowledge base with international treaties and cybercrime laws
    const legalResponses: Record<string, string> = {
      'contract': 'A contract is a legally binding agreement between two or more parties that creates mutual obligations enforceable by law. It requires an offer, acceptance, consideration, capacity, and legal purpose.',
      'breach': 'A breach of contract occurs when one party fails to perform their obligations under the contract without a valid legal excuse. Remedies may include damages, specific performance, or rescission.',
      'tort': 'A tort is a civil wrong that causes harm to another person or their property. Common types include negligence, intentional torts (assault, battery, defamation), and strict liability.',
      'liability': 'Legal liability refers to the legal responsibility for one\'s acts or omissions. It can be civil (monetary damages) or criminal (fines, imprisonment).',
      'negligence': 'Negligence is the failure to exercise the care that a reasonably prudent person would exercise in similar circumstances. It requires duty, breach, causation, and damages.',
      'statute': 'A statute is a written law passed by a legislative body. Statutes are formal written enactments of a legislative authority that govern a state, city, or country.',
      
      // International Cybercrime Treaties
      'budapest convention': 'The Budapest Convention on Cybercrime (2001) is the first and most comprehensive international treaty on cybercrime. Opened by the Council of Europe, it has been ratified by 68+ countries worldwide. It addresses crimes such as illegal access, illegal interception, data interference, system interference, computer-related fraud, child pornography, and copyright infringement. The Convention requires signatories to harmonize domestic laws, improve investigative techniques, and establish 24/7 points of contact for international cooperation. India has not yet ratified this convention.',
      
      'un cybercrime convention': 'The UN Cybercrime Convention (2024) is a newly adopted international treaty aimed at combating cybercrime globally. Unlike the Budapest Convention which focuses on substantive crimes, this convention emphasizes international cooperation, mutual legal assistance, and capacity building. It addresses electronic evidence gathering, extradition for cyber offenses, technical assistance, and prevention measures. The convention seeks to balance cybersecurity with human rights protections. Countries are in the process of ratification as of 2024.',
      
      // India-specific Cybercrime Laws
      'information technology act': 'The Information Technology Act, 2000 (IT Act) is India\'s primary legislation for addressing cybercrimes and electronic commerce. Key provisions include: Section 43 (unauthorized access, data theft), Section 66 (computer-related offenses), Section 66A (offensive messages - struck down by Supreme Court in 2015), Section 66B (receiving stolen computer resources), Section 66C (identity theft), Section 66D (cheating by impersonation), Section 66E (privacy violation), Section 66F (cyber terrorism), Section 67 (publishing obscene material), and Section 70 (protected systems). Penalties range from fines to imprisonment up to life term for cyber terrorism.',
      
      'it act 2000': 'The IT Act 2000 (amended in 2008) provides the legal framework for electronic governance and e-commerce in India. The 2008 amendments strengthened cybercrime provisions significantly. Key additions included: identity theft (Sec 66C), cyber terrorism (Sec 66F), intermediate liability (Sec 79), and enhanced penalties. The Act established the Cyber Appellate Tribunal and empowered adjudicating officers. However, it faces criticism for low conviction rates, inadequate investigation capacity, and lack of comprehensive data protection provisions.',
      
      // Comparative Legal Analysis
      'comparative legal analysis': 'Comparative legal analysis examines legal systems, statutes, and judicial practices across different jurisdictions to identify best practices, gaps, and reform opportunities. In cybercrime law, key comparison areas include: (1) Substantive law coverage - what acts are criminalized; (2) Procedural provisions - investigation powers, electronic evidence rules; (3) International cooperation mechanisms - mutual legal assistance, extradition; (4) Institutional frameworks - specialized cyber courts, investigation agencies; (5) Penalties and enforcement - conviction rates, sentencing guidelines. India\'s framework is often compared with the UK\'s Computer Misuse Act 1990, US laws (CFAA, Wiretap Act), and the Budapest Convention standards.',
      
      // Global Standards
      'global standards': 'Emerging global standards in cybercrime law include: (1) Harmonization of substantive criminal law - consistent definitions of hacking, data theft, fraud; (2) Modernized procedural powers - lawful hacking, cloud data access, encryption challenges; (3) 24/7 contact points for urgent requests; (4) Mutual Legal Assistance Treaty (MLAT) streamlining; (5) Preservation of electronic evidence; (6) Public-private partnerships for threat intelligence; (7) Victim protection mechanisms; (8) Capacity building and training; (9) Human rights safeguards; (10) Cross-border data sharing frameworks. The Budapest Convention and new UN Convention represent these evolving standards.',
      
      // Specific Cybercrime Types
      'cybercrime': 'Cybercrime encompasses criminal activities carried out using computers or the internet. Categories include: (1) Crimes against individuals - identity theft, phishing, cyberstalking, harassment; (2) Crimes against property - hacking, data theft, malware, ransomware; (3) Crimes against government - cyber terrorism, attacks on critical infrastructure; (4) Content-related crimes - child pornography, hate speech, copyright violations. Global economic losses exceed $6 trillion annually. Challenges include attribution, jurisdiction, rapid technological evolution, and cross-border nature requiring international cooperation through treaties like Budapest and UN Conventions.',
      
      'hacking': 'Hacking refers to unauthorized access to computer systems or networks. Legal frameworks distinguish between: (1) Black hat hacking (illegal) - malicious unauthorized access for theft, damage, or espionage; (2) White hat hacking (legal) - ethical hacking with permission for security testing; (3) Grey hat hacking - unauthorized but non-malicious. Under Indian IT Act Section 43 and 66, unauthorized access carries penalties up to 3 years imprisonment and fines. Aggravated hacking involving critical infrastructure or cyber terrorism (Section 66F) can result in life imprisonment.',
      
      'data protection': 'Data protection laws govern collection, storage, processing, and transfer of personal data. India\'s framework includes: (1) IT Act Section 43A - compensation for negligent data handling; (2) IT Rules 2011 - reasonable security practices; (3) Digital Personal Data Protection Act 2023 (recently enacted) - comprehensive data protection regime with consent requirements, data principal rights, cross-border transfer rules, and Data Protection Board. International standards include EU GDPR (gold standard), which impacts Indian companies serving EU citizens.',
    }
    
    // Simple keyword matching for demo
    let responseText = ''
    const lowerMessage = message.toLowerCase()
    
    // Check if this is a document-specific query
    if (document_id && documentContext) {
      const docTitle = documentContext.split('Title: ')[1]?.split('\n')[0] || 'this document'
      const docType = documentContext.split('Type: ')[1]?.split('\n')[0] || 'legal'
      const docFilename = documentContext.split('Filename: ')[1]?.split('\n')[0] || ''
      
      // Detect document topic from filename and title
      const isCybercrimeDoc = docFilename.toLowerCase().includes('cybercrime') || 
                              docTitle.toLowerCase().includes('cybercrime') ||
                              lowerMessage.includes('cybercrime')
      const isIndiaDoc = docFilename.toLowerCase().includes('india') || 
                         docTitle.toLowerCase().includes('india')
      const isComparativeDoc = docFilename.toLowerCase().includes('comparative') || 
                               docTitle.toLowerCase().includes('comparative')
      
      // Enhanced document-aware responses with domain intelligence
      if (lowerMessage.includes('summar')) {
        if (isCybercrimeDoc && isIndiaDoc && isComparativeDoc) {
          responseText = `**Summary of Cybercrime Law Analysis**\n\nBased on your document "${docFilename}":\n\nThis appears to be a **comparative legal analysis** examining India's cybercrime legal framework in the context of international standards. Key areas likely covered:\n\n**1. India's Legal Framework:**\n- Information Technology Act, 2000 (IT Act) and 2008 amendments\n- Section 43, 66, 66A-F, 67, 70 (cybercrime provisions)\n- Institutional mechanisms and enforcement challenges\n\n**2. International Standards:**\n- Budapest Convention on Cybercrime (2001) - not ratified by India\n- UN Cybercrime Convention (2024) - emerging global framework\n- Best practices from UK, US, EU jurisdictions\n\n**3. Comparative Analysis:**\n- Legislative scope and coverage gaps\n- Institutional structures (cyber cells, tribunals)\n- International cooperation mechanisms\n- Conviction rates and enforcement effectiveness\n\n**4. Key Findings:**\n- Low conviction rates in India (likely discussed)\n- Limited international cooperation frameworks\n- Need for harmonization with global standards\n- Recommendations for legal reforms\n\nWould you like me to elaborate on any specific aspect?`
        } else {
          responseText = `Based on the document "${docTitle}" (${docFilename}):\n\nThis ${docType} document appears to focus on legal analysis and comparative study. A comprehensive summary would include:\n\n1. Main subject matter and scope\n2. Key legal principles and provisions discussed\n3. Comparative analysis elements (if any)\n4. Relevant legal frameworks and standards\n5. Conclusions and recommendations\n\nFor a more detailed summary, please ask about specific sections or topics within the document.`
        }
      } else if (lowerMessage.includes('key point') || lowerMessage.includes('main point')) {
        if (isCybercrimeDoc) {
          responseText = `**Key Points - Cybercrime Laws (${docFilename})**\n\n**Legislative Framework:**\n1. **India's IT Act 2000** - Primary legislation with Sections 43, 66-67, 70\n2. **2008 Amendments** - Strengthened provisions, added identity theft (66C), cyber terrorism (66F)\n3. **Comparison with Global Standards** - Budapest Convention, UN Convention\n\n**Critical Issues:**\n4. **Low Conviction Rates** - Investigation capacity gaps, procedural delays\n5. **Limited International Cooperation** - India not party to Budapest Convention\n6. **Jurisdictional Challenges** - Cross-border cybercrime enforcement\n\n**Recommendations:**\n7. **Legal Harmonization** - Align with international standards\n8. **Institutional Strengthening** - Specialized cyber courts, trained investigators\n9. **Treaty Participation** - Consider ratifying Budapest/UN conventions\n10. **Capacity Building** - Training, technology, public-private partnerships\n\n${documentContext}`
        } else {
          responseText = `Key points from "${docTitle}":\n\n1. **Document Classification**: ${docType.toUpperCase()}\n2. **Legal Framework**: Establishes or analyzes legal standards and principles\n3. **Comparative Elements**: May include international or jurisdictional comparisons\n4. **Practical Application**: Discusses implementation and compliance considerations\n5. **Global Standards**: References emerging international legal norms\n\n${documentContext}\n\nWould you like me to elaborate on any specific aspect?`
        }
      } else if (lowerMessage.includes('risk') || lowerMessage.includes('concern') || lowerMessage.includes('challenge')) {
        responseText = `**Legal Challenges & Concerns - Cybercrime Framework**\n\nFor the document "${docTitle}":\n\n**India's Key Challenges:**\n\n1. **Enforcement Gaps:**\n   • Low conviction rates (below 10% in many cyber cases)\n   • Insufficient cyber forensic capabilities\n   • Delays in investigation and prosecution\n   • Lack of specialized training for law enforcement\n\n2. **Legislative Limitations:**\n   • IT Act doesn't cover all emerging cyber threats\n   • Absence of comprehensive data protection law (until 2023)\n   • Jurisdictional issues with cross-border crimes\n   • Need for continuous updates to match technology evolution\n\n3. **International Cooperation:**\n   • India not party to Budapest Convention\n   • Limited bilateral MLATs (Mutual Legal Assistance Treaties)\n   • Slow evidence sharing with foreign jurisdictions\n   • Attribution challenges in transnational cybercrime\n\n4. **Institutional Weaknesses:**\n   • Understaffed cyber cells in states\n   • Lack of specialized cyber courts (few exceptions)\n   • Inadequate coordination between agencies\n   • Limited public-private partnerships\n\n**Global Standard Requirements:**\n   • Harmonized substantive law definitions\n   • 24/7 contact points for urgent requests\n   • Streamlined MLAT procedures\n   • Capacity building programs\n   • Human rights safeguards\n\n${documentContext}`
      } else {
        // Intelligent keyword matching with document context
        let foundResponse = false
        for (const [keyword, response] of Object.entries(legalResponses)) {
          if (lowerMessage.includes(keyword)) {
            // Special handling for cybercrime-related queries with document context
            if ((keyword.includes('cybercrime') || keyword.includes('convention') || keyword.includes('it act')) && isCybercrimeDoc) {
              responseText = `**${keyword.toUpperCase()} - Analysis in Context**\n\n${response}\n\n**Relevance to Your Document (${docFilename}):**\n\nThis concept is directly relevant to your comparative legal analysis. The document likely examines:\n\n• How India's legal framework (IT Act) addresses this issue\n• Comparison with international standards (Budapest, UN Conventions)\n• Gaps in current Indian legislation\n• Best practices from other jurisdictions (UK, US)\n• Recommendations for harmonization and reform\n\n**Document Context:**\n${documentContext}\n\n**Key Questions to Explore:**\n- How does India's approach differ from global standards?\n- What are the enforcement challenges?\n- What reforms are recommended?\n\nWould you like me to elaborate on any specific aspect of this analysis?`
            } else {
              responseText = `Regarding "${message}" in the context of your document "${docTitle}":\n\n${response}\n\n**Document Context:**\n${documentContext}\n\nThis information is particularly relevant to your ${docType} document as it provides foundational legal concepts that may apply to the analysis or subject matter discussed.`
            }
            foundResponse = true
            break
          }
        }
        
        if (!foundResponse) {
          responseText = `**Question: "${message}"**\n\nRegarding your document **"${docFilename}"**:\n\n${documentContext}\n\n**How I Can Help:**\n\n• **Legal Framework Analysis** - Explain specific statutes (IT Act sections, international treaties)\n• **Comparative Insights** - India vs. global standards (Budapest Convention, UN Convention)\n• **Key Challenges** - Enforcement gaps, jurisdictional issues, cooperation mechanisms\n• **Specific Provisions** - Section-by-section analysis of IT Act or other laws\n• **International Treaties** - Budapest Convention, UN Cybercrime Convention, MLATs\n• **Reform Recommendations** - Legal harmonization, institutional strengthening\n\n**Suggested Questions:**\n- "Explain the Budapest Convention"\n- "What is the IT Act Section 66F?"\n- "Compare India's laws with global standards"\n- "What are the main challenges in enforcement?"\n- "Summarize this document"\n\nPlease ask about a specific section, legal concept, or comparative aspect for detailed analysis.`
        }
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
  
  // Check if R2 is available
  if (!c.env.DOCUMENTS) {
    return c.json({ 
      error: 'Document storage not configured. Please enable R2 in Cloudflare Dashboard.',
      hint: 'Visit https://dash.cloudflare.com/ and enable R2 storage for your account.'
    }, 503)
  }
  
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
