import { Hono } from 'hono'
import type { Bindings } from '../index'
import { authMiddleware } from './auth'

export const documentRoutes = new Hono<{ Bindings: Bindings }>()
documentRoutes.use('/*', authMiddleware)

documentRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all()
  return c.json({ success: true, documents: results })
})

documentRoutes.post('/upload', async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const title = formData.get('title') as string
  const category = formData.get('category') as string || 'general'

  if (!file) return c.json({ error: 'No file provided' }, 400)

  const r2Key = `documents/${user.id}/${Date.now()}-${file.name}`
  await c.env.DOCUMENTS.put(r2Key, await file.arrayBuffer())

  const result = await c.env.DB.prepare(`
    INSERT INTO documents (user_id, title, filename, file_size, file_type, r2_key, category, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')
  `).bind(user.id, title || file.name, file.name, file.size, file.type, r2Key, category).run()

  return c.json({ success: true, document: { id: result.meta.last_row_id, title } }, 201)
})

documentRoutes.get('/:id/download', async (c) => {
  const user = c.get('user')
  const doc = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first()
  if (!doc) return c.json({ error: 'Not found' }, 404)
  const object = await c.env.DOCUMENTS.get(doc.r2_key as string)
  if (!object) return c.json({ error: 'File not found' }, 404)
  return new Response(object.body, { headers: { 'Content-Type': doc.file_type as string } })
})

documentRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const doc = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first()
  if (!doc) return c.json({ error: 'Not found' }, 404)
  await c.env.DOCUMENTS.delete(doc.r2_key as string)
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})
