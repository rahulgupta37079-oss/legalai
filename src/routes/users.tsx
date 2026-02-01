import { Hono } from 'hono'
import type { Bindings } from '../index'
import { authMiddleware } from './auth'

export const userRoutes = new Hono<{ Bindings: Bindings }>()
userRoutes.use('/*', authMiddleware)

userRoutes.get('/profile', async (c) => {
  const user = c.get('user')
  const profile = await c.env.DB.prepare('SELECT id, email, full_name, role, organization, api_quota, api_used, created_at FROM users WHERE id = ?').bind(user.id).first()
  if (!profile) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true, profile })
})

userRoutes.get('/stats', async (c) => {
  const user = c.get('user')
  const docStats = await c.env.DB.prepare('SELECT COUNT(*) as total, SUM(file_size) as total_size FROM documents WHERE user_id = ?').bind(user.id).first()
  const chatStats = await c.env.DB.prepare('SELECT COUNT(*) as total_sessions, SUM(message_count) as total_messages FROM chat_sessions WHERE user_id = ?').bind(user.id).first()
  const { results: recentActivity } = await c.env.DB.prepare('SELECT action, resource_type, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(user.id).all()

  return c.json({ success: true, stats: { documents: docStats, chats: chatStats, recent_activity: recentActivity } })
})
