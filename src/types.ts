// Cloudflare bindings
export interface Env {
  DB: D1Database
  DOCUMENTS: R2Bucket
  HF_API_KEY: string
  JWT_SECRET: string
}
