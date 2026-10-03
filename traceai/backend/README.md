# TraceAI — Backend API

> **Understand the Impact Before You Change the Code.**

Node.js + Express + MongoDB backend for the TraceAI requirement traceability platform.

---

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Runtime      | Node.js                           |
| Framework    | Express.js 4                      |
| Database     | MongoDB + Mongoose 8              |
| Auth         | JWT + bcryptjs                    |
| Validation   | express-validator                 |
| Dev server   | nodemon                           |
| AI (future)  | Gemini / LLM                      |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Start development server

```bash
npm run dev
```

The API will be available at **http://localhost:5000**

---

## Health Check

```
GET http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "TraceAI backend is running",
  "timestamp": "...",
  "environment": "development"
}
```

---

## Development Phases

| Phase | Feature                        | Status        |
|-------|-------------------------------|---------------|
| 1     | Express server + health check  | ✅ Complete   |
| 2     | MongoDB connection              | ⏳ Pending    |
| 3     | User authentication (JWT)      | ⏳ Pending    |
| 4     | Project APIs                   | ⏳ Pending    |
| 5     | Requirements + versions        | ⏳ Pending    |
| 6     | Components                     | ⏳ Pending    |
| 7     | Traceability matrix            | ⏳ Pending    |
| 8     | AI impact analysis             | ⏳ Pending    |
| 9     | History + verification         | ⏳ Pending    |
| 10    | Notifications                  | ⏳ Pending    |
| 11    | Seed data                      | ⏳ Pending    |
| 12    | API testing                    | ⏳ Pending    |
| 13    | Connect frontend               | ⏳ Pending    |

---

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Auth, error, validation middleware
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # Business logic
│   ├── utils/           # Shared utilities
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── .env                 # Local environment (git-ignored)
├── .env.example         # Template for environment variables
└── package.json
```

---

## API Response Format

**Success**
```json
{ "success": true, "data": {} }
```

**Error**
```json
{ "success": false, "message": "Descriptive error message" }
```

---

## Security Notes

- Passwords are hashed with bcryptjs (salt rounds: 12)
- JWTs expire in 7 days by default
- CORS restricted to `localhost:5173` in development
- Never commit `.env` or real API keys
