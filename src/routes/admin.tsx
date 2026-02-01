import { Hono } from 'hono'
import type { Bindings } from '../index'
import { authMiddleware } from './auth'

export const adminRoutes = new Hono<{ Bindings: Bindings }>()
adminRoutes.use('/*', authMiddleware)

async function adminOnly(c: any, next: any) {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)
  await next()
}

adminRoutes.use('/*', adminOnly)

adminRoutes.get('/stats', async (c) => {
  const userStats = await c.env.DB.prepare('SELECT COUNT(*) as total_users, COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users FROM users').first()
  const docStats = await c.env.DB.prepare('SELECT COUNT(*) as total_documents, SUM(file_size) as total_storage FROM documents').first()
  const chatStats = await c.env.DB.prepare('SELECT COUNT(*) as total_sessions, SUM(message_count) as total_messages FROM chat_sessions').first()
  const apiStats = await c.env.DB.prepare('SELECT COUNT(*) as total_api_calls, SUM(tokens_used) as total_tokens FROM usage_analytics WHERE action_type = "chat"').first()

  return c.json({ success: true, stats: { users: userStats, documents: docStats, chats: chatStats, api: apiStats } })
})

adminRoutes.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, email, full_name, role, organization, is_active, api_quota, api_used, created_at FROM users ORDER BY created_at DESC LIMIT 100').all()
  return c.json({ success: true, users: results })
})
