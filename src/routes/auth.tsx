import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import type { Bindings } from '../index'

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Register
authRoutes.post('/register', async (c) => {
  try {
    const { email, password, full_name, organization } = await c.req.json()

    if (!email || !password || !full_name) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    const password_hash = await hashPassword(password)

    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, full_name, organization, role)
      VALUES (?, ?, ?, ?, 'user')
    `).bind(email, password_hash, full_name, organization || null).run()

    const token = await sign({
      id: result.meta.last_row_id,
      email,
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }, c.env.JWT_SECRET)

    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, status)
      VALUES (?, 'register', 'user', 'success')
    `).bind(result.meta.last_row_id).run()

    return c.json({
      success: true,
      token,
      user: {
        id: result.meta.last_row_id,
        email,
        full_name,
        role: 'user',
        api_quota: 100,
        api_used: 0
      }
    }, 201)
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// Login
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: 'Missing email or password' }, 400)
    }

    const user = await c.env.DB.prepare(`
      SELECT id, email, password_hash, full_name, role, is_active, api_quota, api_used
      FROM users WHERE email = ?
    `).bind(email).first()

    if (!user || !user.is_active) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const password_hash = await hashPassword(password)
    if (password_hash !== user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    await c.env.DB.prepare(`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(user.id).run()

    const token = await sign({
      id: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }, c.env.JWT_SECRET)

    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, status)
      VALUES (?, 'login', 'user', 'success')
    `).bind(user.id).run()

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        api_quota: user.api_quota,
        api_used: user.api_used
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Verify
authRoutes.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await verify(token, c.env.JWT_SECRET)

    const user = await c.env.DB.prepare(`
      SELECT id, email, full_name, role, api_quota, api_used
      FROM users WHERE id = ?
    `).bind(payload.id).first()

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        api_quota: user.api_quota,
        api_used: user.api_used
      }
    })
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
})

// Auth middleware
export async function authMiddleware(c: any, next: any) {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch (error) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
