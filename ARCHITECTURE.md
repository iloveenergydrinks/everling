# Architecture Documentation

## System Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Email     │────▶│  Cloudflare  │────▶│  Postmark   │
│   Client    │     │   Routing    │     │   Inbound   │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
                                    ┌───────────────────┐
                                    │   Webhook API     │
                                    │   /api/webhooks   │
                                    └───────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────┐
                                    │   Claude AI       │
                                    │   Task Extractor  │
                                    └───────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────┐
                                    │   PostgreSQL      │
                                    │   Database        │
                                    └───────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────┐
                                    │   Next.js App     │
                                    │   Dashboard       │
                                    └───────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context + hooks
- **Authentication**: NextAuth.js

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **ORM**: Prisma
- **Database**: PostgreSQL
- **AI**: Anthropic Claude 3.5 Haiku

### Infrastructure
- **Hosting**: Railway
- **Email Routing**: Cloudflare
- **Email Processing**: Postmark
- **Environment**: Production/Development

## Database Schema

### Core Tables

```sql
Organizations (Multi-tenancy)
├── id (UUID, PK)
├── name
├── slug (unique)
├── emailPrefix (unique)
├── plan
├── taskLimit
└── timestamps

Users (Authentication)
├── id (UUID, PK)
├── email (unique)
├── password (hashed)
├── name
└── timestamps

OrganizationMembers (M2M)
├── organizationId (FK)
├── userId (FK)
├── role (admin|member|viewer)
└── joinedAt

Tasks (Core Entity)
├── id (UUID, PK)
├── organizationId (FK)
├── title
├── description
├── status (todo|in_progress|done)
├── priority (low|medium|high)
├── dueDate
├── assignedToId (FK)
├── createdById (FK)
├── createdVia (email|web|api)
├── emailMetadata (JSON)
└── timestamps

EmailLogs (Audit Trail)
├── id (UUID, PK)
├── organizationId (FK)
├── fromEmail
├── toEmail
├── subject
├── processed
├── taskId (FK, nullable)
├── rawData (JSON)
├── error
└── createdAt
```

## API Design

### RESTful Endpoints

```
Authentication
POST   /api/auth/register      - Create account
POST   /api/auth/[...nextauth] - NextAuth handler

Organizations
GET    /api/organizations      - List user's orgs
POST   /api/organizations      - Create org
PUT    /api/organizations/:id  - Update org

Tasks
GET    /api/tasks              - List tasks
POST   /api/tasks              - Create task
GET    /api/tasks/:id          - Get task
PATCH  /api/tasks/:id          - Update task
DELETE /api/tasks/:id          - Delete task

Webhooks
POST   /api/webhooks/email     - Postmark inbound
```

### Authentication Flow

1. **Registration**
   - User provides email, password, org name
   - System creates User + Organization + Member relation
   - Generates unique email prefix

2. **Login**
   - Credentials validated via NextAuth
   - JWT token includes organizationId
   - Session persisted client-side

3. **Authorization**
   - All API routes check session.organizationId
   - Row-level security via Prisma where clauses
   - Role-based access for future features

## Email Processing Pipeline

### 1. Email Reception
```typescript
// Postmark webhook payload
{
  From: "sender@example.com",
  To: "acme@yourdomain.com",
  Subject: "Task subject",
  TextBody: "Email content...",
  Date: "2024-01-01T12:00:00Z"
}
```

### 2. Organization Resolution
```typescript
const emailPrefix = extractPrefix(email.To) // "acme"
const org = await findOrgByPrefix(emailPrefix)
```

### 3. AI Task Extraction
```typescript
const prompt = buildPrompt(email)
const response = await claude.extract(prompt)
const task = parseResponse(response)
```

### 4. Task Creation
```typescript
await prisma.task.create({
  organizationId: org.id,
  ...taskData,
  createdVia: 'email'
})
```

## Security Architecture

### Authentication
- Passwords hashed with bcrypt (12 rounds)
- Sessions managed by NextAuth
- JWT tokens for API access

### Authorization
- Organization-scoped queries
- Role-based permissions (future)
- API key authentication (future)

### Data Protection
- HTTPS only in production
- Environment variables for secrets
- Prepared statements via Prisma
- Input validation with Zod

## Performance Considerations

### Database
- Indexed foreign keys
- Composite indexes for common queries
- Connection pooling via Prisma

### Caching Strategy
- Static assets: CDN (Vercel/Railway)
- Session data: In-memory
- Task lists: Client-side SWR (future)

### Scalability
- Horizontal scaling via Railway
- Database read replicas (future)
- Queue for email processing (future)
- Rate limiting per organization

## Deployment Architecture

### Development
```bash
Local PostgreSQL → localhost:3000 → Hot reload
```

### Production (Railway)
```bash
Railway PostgreSQL → Railway App → Custom domain
```

### CI/CD Pipeline
1. Push to GitHub
2. Railway auto-deploys
3. Run migrations
4. Health checks
5. Live

## Monitoring & Observability

### Current
- Railway logs
- Prisma query logs
- Console error tracking

### Planned
- Sentry for error tracking
- PostHog for analytics
- Custom metrics dashboard
- Uptime monitoring

## Disaster Recovery

### Backup Strategy
- Daily database backups
- Point-in-time recovery
- Email log retention (30 days)

### Failure Scenarios
1. **Database failure**: Restore from backup
2. **Email webhook failure**: Postmark retries
3. **AI API failure**: Fallback to basic parsing
4. **Application crash**: Railway auto-restart

---

*Last updated: September 2025*
