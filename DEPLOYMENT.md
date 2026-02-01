# 🚀 Deployment Guide - Legal AI Platform

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Cloudflare Setup](#cloudflare-setup)
4. [Production Deployment](#production-deployment)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- ✅ Cloudflare account (free tier works)
- ✅ Hugging Face account
- ✅ GitHub account (for code hosting)

### Required Tools
- ✅ Node.js 18+ 
- ✅ npm or yarn
- ✅ Git
- ✅ Wrangler CLI (installed via npm)

### API Tokens Needed
- ✅ Hugging Face API token (Read access)
- ✅ Cloudflare API token (for deployment)

---

## Local Development Setup

### Step 1: Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/legal-ai-platform.git
cd legal-ai-platform

# Install dependencies
npm install

# Verify installation
npm list
```

### Step 2: Get Hugging Face API Token

1. Go to https://huggingface.co/settings/tokens
2. Click "New token"
3. Name: `legal-ai-platform`
4. Type: Select "Read"
5. Click "Generate"
6. Copy token (starts with `hf_`)

### Step 3: Configure Environment

Create `.dev.vars` file in project root:

```bash
# Hugging Face Configuration
HF_API_TOKEN=hf_your_token_here

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars

# Application Configuration
APP_NAME=Legal AI Platform
NODE_ENV=development
```

**🔒 Security Note**: Never commit `.dev.vars` to Git!

### Step 4: Create Local D1 Database

```bash
# Create D1 database for production
npx wrangler d1 create legal-ai-production

# Output will show:
# [[d1_databases]]
# binding = "DB"
# database_name = "legal-ai-production"
# database_id = "xxxx-xxxx-xxxx-xxxx"

# Copy the database_id to wrangler.jsonc
```

Update `wrangler.jsonc`:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "legal-ai-production",
      "database_id": "paste-your-database-id-here"
    }
  ]
}
```

### Step 5: Initialize Database

```bash
# Apply migrations locally
npm run db:migrate:local

# Seed with test data
npm run db:seed

# Verify database
npx wrangler d1 execute legal-ai-production --local --command="SELECT * FROM users"
```

### Step 6: Build Application

```bash
# Build for production
npm run build

# Verify dist/ folder is created
ls -la dist/
```

### Step 7: Start Development Server

```bash
# Clean port 3000 (if needed)
fuser -k 3000/tcp 2>/dev/null || true

# Start with PM2 (recommended)
pm2 start ecosystem.config.cjs

# Or start manually
npx wrangler pages dev dist --d1=legal-ai-production --local --ip 0.0.0.0 --port 3000

# Verify server is running
curl http://localhost:3000/api/health
```

### Step 8: Access Application

- **URL**: http://localhost:3000
- **Test Account**: 
  - Email: `admin@legalai.com`
  - Password: `Admin@123`

---

## Cloudflare Setup

### Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Verify email
3. Complete setup

### Step 2: Get Cloudflare API Token

**Option A: Use GenSpark Tool (Recommended)**
```javascript
// In GenSpark environment
setup_cloudflare_api_key()
```

**Option B: Manual Setup**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Permissions:
   - Account - Cloudflare Pages: Edit
   - Account - D1: Edit
   - Account - R2: Edit
5. Click "Continue to summary"
6. Click "Create Token"
7. Copy token (starts with long string)

### Step 3: Configure Wrangler

```bash
# Login to Wrangler (if not using API token)
npx wrangler login

# Or set API token
export CLOUDFLARE_API_TOKEN=your_token_here

# Verify authentication
npx wrangler whoami
```

### Step 4: Create R2 Bucket

```bash
# Create bucket for documents
npx wrangler r2 bucket create legal-ai-documents

# Verify bucket
npx wrangler r2 bucket list
```

---

## Production Deployment

### Step 1: Update Configuration

Ensure `wrangler.jsonc` is correct:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "legal-ai-platform",
  "compatibility_date": "2026-02-01",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "legal-ai-production",
      "database_id": "your-actual-database-id"
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "DOCUMENTS",
      "bucket_name": "legal-ai-documents"
    }
  ]
}
```

### Step 2: Create Cloudflare Pages Project

```bash
# Create project
npx wrangler pages project create legal-ai-platform \
  --production-branch main \
  --compatibility-date 2026-02-01

# Output will show your project URL
```

### Step 3: Apply Database Migrations to Production

```bash
# Apply migrations to production D1
npm run db:migrate:prod

# Verify migrations
npx wrangler d1 execute legal-ai-production \
  --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Step 4: Set Production Secrets

```bash
# Set Hugging Face API token
npx wrangler pages secret put HF_API_TOKEN \
  --project-name legal-ai-platform
# Enter your token when prompted

# Set JWT secret
npx wrangler pages secret put JWT_SECRET \
  --project-name legal-ai-platform
# Enter your secret (minimum 32 characters)

# Verify secrets (shows names only, not values)
npx wrangler pages secret list \
  --project-name legal-ai-platform
```

### Step 5: Build and Deploy

```bash
# Clean build
rm -rf dist/
npm run build

# Deploy to production
npx wrangler pages deploy dist \
  --project-name legal-ai-platform \
  --branch main

# You'll see output like:
# ✨ Successfully created deployment!
# ✨ Deployment complete!
# URL: https://legal-ai-platform.pages.dev
```

### Step 6: Verify Deployment

```bash
# Test health endpoint
curl https://legal-ai-platform.pages.dev/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-01T...","version":"1.0.0"}
```

---

## Post-Deployment

### Step 1: Create Admin Account

1. Visit https://legal-ai-platform.pages.dev
2. Click "Sign Up"
3. Register with admin email
4. Or use seed data account

### Step 2: Test Core Features

**Upload Document**:
1. Login to dashboard
2. Go to "Documents"
3. Click "Upload Document"
4. Select a PDF file
5. Verify upload succeeds

**Test AI Chat**:
1. Go to "AI Chat"
2. Select model (flan-t5-legal)
3. Click "New Chat Session"
4. Send test message
5. Verify AI response

**Test Admin Panel** (if admin):
1. Go to "Admin"
2. Verify statistics display
3. Check user list
4. View audit logs

### Step 3: Configure Custom Domain (Optional)

```bash
# Add custom domain
npx wrangler pages domain add legal.yourdomain.com \
  --project-name legal-ai-platform

# Follow DNS instructions
```

### Step 4: Set Up Monitoring

1. Go to Cloudflare Dashboard
2. Navigate to your Pages project
3. Enable:
   - Web Analytics
   - Error tracking
   - Performance monitoring

---

## Troubleshooting

### Issue: Build Fails

**Symptoms**: `npm run build` errors

**Solutions**:
```bash
# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Try again
npm run build
```

### Issue: Database Not Found

**Symptoms**: `D1_ERROR: no such table: users`

**Solutions**:
```bash
# Verify database ID in wrangler.jsonc
npx wrangler d1 list

# Re-apply migrations
npm run db:migrate:local  # for local
npm run db:migrate:prod   # for production

# Verify tables
npx wrangler d1 execute legal-ai-production \
  --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Issue: Secrets Not Working

**Symptoms**: `HF_API_TOKEN is undefined`

**Solutions**:
```bash
# List secrets
npx wrangler pages secret list --project-name legal-ai-platform

# Delete and recreate
npx wrangler pages secret delete HF_API_TOKEN --project-name legal-ai-platform
npx wrangler pages secret put HF_API_TOKEN --project-name legal-ai-platform

# Redeploy
npm run deploy
```

### Issue: R2 Upload Fails

**Symptoms**: `R2 bucket not found`

**Solutions**:
```bash
# List buckets
npx wrangler r2 bucket list

# Create if missing
npx wrangler r2 bucket create legal-ai-documents

# Verify wrangler.jsonc has correct binding
```

### Issue: AI Chat Not Responding

**Symptoms**: Error messages in chat

**Solutions**:
1. Verify Hugging Face token:
   ```bash
   curl https://api-inference.huggingface.co/models/bert-base-uncased \
     -H "Authorization: Bearer YOUR_HF_TOKEN"
   ```

2. Check model availability on Hugging Face

3. Review browser console for errors

4. Check API usage quota on Hugging Face dashboard

### Issue: Authentication Fails

**Symptoms**: "Invalid token" errors

**Solutions**:
1. Clear browser localStorage
2. Verify JWT_SECRET is set correctly
3. Check token expiration (7 days)
4. Try logging in again

---

## Updating Application

### Deploy New Version

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Deploy
npm run deploy
```

### Update Database Schema

```bash
# Create new migration file
echo "-- Add new column\nALTER TABLE users ADD COLUMN phone TEXT;" > migrations/0002_add_phone.sql

# Apply locally
npm run db:migrate:local

# Test changes
# ... verify everything works ...

# Apply to production
npm run db:migrate:prod
```

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `HF_API_TOKEN` | Yes | Hugging Face API token | `hf_xxxxx` |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) | `your-secret-key` |
| `APP_NAME` | No | Application name | `Legal AI Platform` |
| `NODE_ENV` | No | Environment | `development` / `production` |

---

## Deployment Checklist

- [ ] Hugging Face token obtained
- [ ] Cloudflare account created
- [ ] D1 database created
- [ ] R2 bucket created
- [ ] Migrations applied
- [ ] Secrets configured
- [ ] Application built
- [ ] Deployment successful
- [ ] Health check passes
- [ ] Admin account created
- [ ] Core features tested
- [ ] Monitoring enabled

---

## Support

**Issues**: https://github.com/yourusername/legal-ai-platform/issues  
**Docs**: https://github.com/yourusername/legal-ai-platform/wiki  
**Email**: support@legalai.com

---

**Last Updated**: 2026-02-01  
**Guide Version**: 1.0.0
