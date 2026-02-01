# 🏗️ Legal AI Platform - System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Security Architecture](#security-architecture)
5. [Deployment Architecture](#deployment-architecture)
6. [Scalability Strategy](#scalability-strategy)

---

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         User Browser                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │  Landing Page  │  │   Dashboard    │  │   Chat UI      │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
└────────────────┬─────────────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│              Cloudflare Global Edge Network                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Cloudflare Pages                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Static  │  │   Hono   │  │ Workers  │              │  │
│  │  │  Assets  │  │   API    │  │ Runtime  │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────┬──────────────────┬──────────────────┬──────────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌──────────┐   ┌──────────────┐   ┌──────────────┐
│ Cloudflare│   │ Cloudflare   │   │ Cloudflare   │
│    D1     │   │      R2      │   │      KV      │
│(Database) │   │  (Storage)   │   │  (Optional)  │
└──────────┘   └──────────────┘   └──────────────┘
     │
     │ Data Flow
     ▼
┌──────────────────────────────────────────────┐
│         External Services                    │
│  ┌─────────────────┐  ┌───────────────────┐│
│  │  Hugging Face   │  │  Third-party APIs ││
│  │ Inference API   │  │   (OCR, Vector)   ││
│  └─────────────────┘  └───────────────────┘│
└──────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Layer

**Technology**: Vanilla JavaScript + Tailwind CSS

**Components**:
- `Landing Page` - Marketing and auth entry
- `Dashboard` - User overview and statistics
- `Document Library` - File management interface
- `Chat Interface` - AI conversation UI
- `Admin Panel` - System management (admin only)

**State Management**:
```javascript
const state = {
    token: localStorage,
    user: Current user object,
    currentPage: Active dashboard page,
    documents: Document list,
    sessions: Chat sessions
}
```

**Communication**: Axios HTTP client with JWT bearer tokens

---

### Backend Layer (Hono + Workers)

**Framework**: Hono (Lightweight, Fast, Edge-optimized)

**Route Structure**:
```
/api/auth/*        → Authentication (register, login, verify)
/api/documents/*   → Document management (upload, list, download)
/api/chat/*        → Chat sessions and messaging
/api/users/*       → User profile and statistics
/api/admin/*       → Admin operations (protected)
```

**Middleware**:
- `CORS` - Cross-origin request handling
- `authMiddleware` - JWT verification
- `adminOnly` - Role-based access control

**Edge Runtime Benefits**:
- Global distribution (200+ cities)
- < 50ms cold start
- Automatic scaling
- Zero configuration

---

### Data Layer

#### Cloudflare D1 (SQLite)

**Tables**:
1. **users** - Authentication and user data
2. **documents** - File metadata and categorization
3. **chat_sessions** - Conversation containers
4. **chat_messages** - Individual messages
5. **audit_logs** - Security and compliance logging
6. **usage_analytics** - API usage tracking

**Indexes**:
- Primary keys on all id columns
- Foreign keys with cascading deletes
- Composite indexes for common queries
- Text search indexes for document titles

**Replication**:
- Automatic global replication
- Read replicas in edge locations
- Eventual consistency model

#### Cloudflare R2 (Object Storage)

**Structure**:
```
legal-ai-documents/
├── documents/
│   ├── {user_id}/
│   │   ├── {timestamp}-{filename}.pdf
│   │   ├── {timestamp}-{filename}.txt
│   │   └── ...
```

**Benefits**:
- S3-compatible API
- No egress fees
- 10 million operations/month (free tier)
- Automatic durability (11 9's)

---

### AI Integration Layer

#### Hugging Face Inference API

**Models**:
1. **Legal-BERT** (`nlpaueb/legal-bert-base-uncased`)
   - Specialized for legal text
   - Best for: Classification, NER
   - Context window: 512 tokens

2. **FLAN-T5 Legal** (`google/flan-t5-base`)
   - Text-to-text generation
   - Best for: Q&A, summarization
   - Context window: 512 tokens

**Request Flow**:
```
User Message → Backend API → HF API Call → Response Processing → Database Save
```

**Error Handling**:
- Automatic retry with exponential backoff
- Fallback to cached responses
- User-friendly error messages

---

## Data Flow

### Document Upload Flow

```
1. User selects file in browser
2. FormData created with file + metadata
3. POST /api/documents/upload (with JWT)
4. Backend validates file type and size
5. Generate unique R2 key
6. Upload to R2 bucket
7. Save metadata to D1
8. Return document ID to user
9. Log analytics event
```

### Chat Message Flow

```
1. User types message in chat UI
2. POST /api/chat/sessions/{id}/messages
3. Save user message to D1
4. Retrieve document context (if linked)
5. Build AI prompt with context
6. Call Hugging Face API
7. Process AI response
8. Save assistant message to D1
9. Update session statistics
10. Return response to user
11. Log usage analytics
```

### Authentication Flow

```
1. User submits login credentials
2. POST /api/auth/login
3. Validate email and password hash
4. Generate JWT with user payload
5. Return token to client
6. Client stores in localStorage
7. All API requests include Bearer token
8. Backend verifies JWT on each request
9. Log audit event
```

---

## Security Architecture

### Authentication & Authorization

**JWT Structure**:
```json
{
  "id": 123,
  "email": "user@example.com",
  "role": "user",
  "iat": 1234567890,
  "exp": 1234999999
}
```

**Token Lifecycle**:
- Expiration: 7 days
- Storage: localStorage (client-side)
- Transmission: Authorization header
- Verification: On every protected route

**Password Security**:
- SHA-256 hashing
- No plaintext storage
- Minimum 8 characters
- Rate limiting (via quota)

### API Security

**Protection Layers**:
1. CORS - Restrict origins
2. JWT verification - Authenticate requests
3. Role-based access - Authorize actions
4. Input validation - Prevent injection
5. Rate limiting - Prevent abuse

**Audit Logging**:
- Every action logged
- User ID, action type, timestamp
- IP address and user agent
- Success/failure status

---

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────┐
│         Cloudflare Global Network                │
│                                                  │
│  Edge Location 1    Edge Location 2   ...       │
│  ┌──────────────┐  ┌──────────────┐           │
│  │   Worker     │  │   Worker     │           │
│  │  Instance    │  │  Instance    │           │
│  └──────────────┘  └──────────────┘           │
│         │                  │                    │
│         └──────────┬───────┘                   │
│                    │                            │
│              ┌──────────┐                       │
│              │ D1 Primary│                       │
│              └──────────┘                       │
│                    │                            │
│         ┌──────────┴──────────┐               │
│    ┌─────┴──────┐      ┌──────┴────┐         │
│    │ D1 Replica │      │ D1 Replica│         │
│    │ (Region 1) │      │ (Region 2)│         │
│    └────────────┘      └───────────┘         │
└─────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
Developer Push
     │
     ▼
Git Repository (GitHub)
     │
     ▼
Build Process (Vite)
     │
     ▼
Wrangler Deploy
     │
     ▼
Cloudflare Pages
     │
     ├─► Run Migrations
     ├─► Set Secrets
     └─► Deploy Worker
```

---

## Scalability Strategy

### Horizontal Scaling

**Workers**: Automatically scaled by Cloudflare
- No configuration needed
- Unlimited concurrent requests
- Pay per request model

**Database (D1)**:
- Automatic read replicas
- Edge caching
- Query optimization

**Storage (R2)**:
- Unlimited capacity
- Automatic sharding
- CDN integration

### Performance Optimization

**Caching Strategy**:
1. Static assets - CDN cached
2. API responses - Edge cached (selective)
3. Database queries - Connection pooling
4. AI responses - Optional caching

**Database Optimization**:
- Indexes on foreign keys
- Pagination for large results
- Batch operations
- Prepared statements

**Frontend Optimization**:
- Lazy loading
- Code splitting
- Asset compression
- CDN delivery

### Monitoring & Observability

**Metrics**:
- Request count
- Error rate
- Response time
- Database latency
- AI inference time

**Logging**:
- Application logs
- Audit logs
- Error logs
- Performance logs

**Alerting**:
- Error thresholds
- Performance degradation
- Quota limits
- Security events

---

## Cost Optimization

### Cloudflare Free Tier
- 100,000 requests/day
- D1: 5 GB storage + 5 million reads
- R2: 10 GB storage + 1 million operations

### Estimated Costs (Per Month)

**Small Organization (< 50 users)**:
- Workers: $5
- D1: $0 (within free tier)
- R2: $0 (within free tier)
- Hugging Face: $0-9 (free or PRO)
- **Total: $5-14/month**

**Medium Organization (< 500 users)**:
- Workers: $25
- D1: $5
- R2: $10
- Hugging Face: $9-50
- **Total: $49-90/month**

**Enterprise (1000+ users)**:
- Workers: Custom pricing
- D1: $25+
- R2: $50+
- Hugging Face: Enterprise
- **Total: $100-500+/month**

---

## Disaster Recovery

### Backup Strategy
- D1: Automatic backups (7 days retention)
- R2: Versioning enabled
- Code: Git repository
- Configurations: Version controlled

### Recovery Procedures
1. Database corruption → Restore from D1 backup
2. Code issues → Git rollback + redeploy
3. Data loss → R2 version recovery
4. Service outage → Cloudflare automatic failover

---

## Future Enhancements

1. **Vector Search** - Semantic document search
2. **WebSockets** - Real-time chat
3. **Queues** - Background job processing
4. **Durable Objects** - Stateful components
5. **Workers AI** - On-edge model inference
6. **Analytics Engine** - Real-time analytics

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-02-01  
**Maintained by**: Legal AI Platform Team
