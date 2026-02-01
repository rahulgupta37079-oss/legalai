import { Hono } from 'hono'
import type { Bindings } from '../index'
import { authMiddleware } from './auth'

export const chatRoutes = new Hono<{ Bindings: Bindings }>()
chatRoutes.use('/*', authMiddleware)

const AI_MODELS = {
  'legal-bert': { name: 'Legal-BERT', model_id: 'nlpaueb/legal-bert-base-uncased', description: 'Specialized BERT for legal text' },
  'flan-t5-legal': { name: 'FLAN-T5 Legal', model_id: 'google/flan-t5-base', description: 'T5 model for legal QA' },
}

async function callHuggingFace(modelId: string, inputs: string, apiToken: string) {
  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs })
  })
  if (!response.ok) throw new Error(`HF API error: ${await response.text()}`)
  return await response.json()
}

chatRoutes.get('/sessions', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND status = "active" ORDER BY updated_at DESC'
  ).bind(user.id).all()
  return c.json({ success: true, sessions: results })
})

chatRoutes.post('/sessions', async (c) => {
  const user = c.get('user')
  const { title, document_id, model_name = 'flan-t5-legal' } = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO chat_sessions (user_id, document_id, title, model_name)
    VALUES (?, ?, ?, ?)
  `).bind(user.id, document_id || null, title || 'New Chat', model_name).run()
  return c.json({ success: true, session: { id: result.meta.last_row_id, title, model_name } }, 201)
})

chatRoutes.get('/sessions/:id/messages', async (c) => {
  const user = c.get('user')
  const session = await c.env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first()
  if (!session) return c.json({ error: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC').bind(c.req.param('id')).all()
  return c.json({ success: true, messages: results })
})

chatRoutes.post('/sessions/:id/messages', async (c) => {
  const user = c.get('user')
  const { message, model_name } = await c.req.json()
  if (!message) return c.json({ error: 'Message required' }, 400)

  const session = await c.env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first()
  if (!session) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, "user", ?)').bind(c.req.param('id'), message).run()

  const modelConfig = AI_MODELS[model_name as keyof typeof AI_MODELS] || AI_MODELS['flan-t5-legal']
  const prompt = `You are a legal AI assistant. Answer this question:\n\nQuestion: ${message}\n\nAnswer:`

  let aiResponse = ''
  let tokensUsed = 0

  try {
    const hfResponse = await callHuggingFace(modelConfig.model_id, prompt, c.env.HF_API_TOKEN)
    aiResponse = (Array.isArray(hfResponse) ? hfResponse[0]?.generated_text : hfResponse.generated_text) || 'No response'
    if (aiResponse.includes(prompt)) aiResponse = aiResponse.replace(prompt, '').trim()
    tokensUsed = Math.ceil((prompt.length + aiResponse.length) / 4)
  } catch (error: any) {
    aiResponse = `I apologize, but I'm having trouble processing your request: ${error.message}`
  }

  const assistantMsg = await c.env.DB.prepare(`
    INSERT INTO chat_messages (session_id, role, content, model_name, tokens_used)
    VALUES (?, 'assistant', ?, ?, ?)
  `).bind(c.req.param('id'), aiResponse, modelConfig.name, tokensUsed).run()

  await c.env.DB.prepare('UPDATE chat_sessions SET message_count = message_count + 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(c.req.param('id')).run()
  await c.env.DB.prepare('UPDATE users SET api_used = api_used + 1 WHERE id = ?').bind(user.id).run()

  return c.json({ success: true, message: { id: assistantMsg.meta.last_row_id, role: 'assistant', content: aiResponse, tokens_used: tokensUsed } })
})

chatRoutes.get('/models', (c) => {
  return c.json({ success: true, models: Object.entries(AI_MODELS).map(([key, value]) => ({ id: key, ...value })) })
})
