# 🚀 LeaveNow — Real-Time Commute Orchestrator  
*A polyglot routing system powered by Java Spring Boot, NestJS, Next.js, Redis, PostgreSQL, and OpenAI.*

LeaveNow computes **deterministic, explainable leave-by times** using live Google Maps ETAs, weather conditions, traffic patterns, user buffers (prep → cab wait → parking → walk), and multimodal routing (Drive · Transit · Walk · Cab).  
It merges **deterministic routing**, **AI reasoning**, and **machine-learned preferences** into a single intelligent commute planner.

## ✨ Features

### 🛰 Real-Time Routing & Multimodal Planning
- Live ETAs from Google Maps Directions API  
- Weather-aware slowdowns via OpenWeather (rain, visibility, conditions)  
- Traffic-aware travel time estimation  
- Buffers for prep-time, building exit time, cab wait time, parking/security delays  
- Multi-modal comparison (Drive, Transit, Walk, Cab)

### 🧩 Polyglot Microservices (Java + Node)
#### **Java Spring Boot Routing Engine**
- Computes all ETAs, reliability scores, and buffer adjustments  
- WebClient-based API calls + Resilience4j (retries, circuit breakers)  
- Redis caching for ETAs and weather minute-buckets  

#### **NestJS API Gateway + AI Orchestrator**
- Serves REST API for UI  
- Routes compute requests to Spring Boot  
- Integrates OpenAI for natural-language trip explanations & scenario analysis  
- Handles user preferences, logging, and history

### 💻 Next.js Frontend
- Modern UI with Tailwind CSS  
- Autocomplete using Google Places API  
- Geolocation (“Use my current location”)  
- Interactive trip results: reliability, buffers, alternatives, maps deep-links  
- Weather + traffic indicators for origin & destination  
- AI assistant sidebar (“Ask AI about this trip”)

### 🧠 AI/ML Intelligence
- OpenAI GPT (tool calling) for natural-language trip reasoning  
- LangChain/LangGraph pipeline for AI “what-if” modeling  
- Historical commute analysis (pgvector optional)  
- ML-based preference inference (prep time, walk tolerance)

### 🗄 Persistence & Storage
- PostgreSQL with Prisma ORM  
- JSONB models for alternatives & AI outputs  
- Redis caching layer (Upstash/Redis Cloud)

---

# ✅ **SECTION 4 — Tech Stack**

```markdown
## 🛠 Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Geolocation API

### Backend
- Java 21 + Spring Boot 3 (Routing Engine)
- Node.js + NestJS (Gateway + AI Layer)
- Resilience4j (circuit breakers, retries)
- Redis caching
- Axios / WebClient
- Prisma ORM
- OpenAI GPT integration
- LangChain / LangGraph for tool-calling flows

### Database
- PostgreSQL (Neon / Supabase / RDS)
- Prisma ORM
- JSONB columns
- Optional: pgvector for semantic search

### Cloud / DevOps
- Vercel (frontend)
- Docker containers
- GitHub Actions CI/CD
- Railway / Render / AWS for backend
- Redis Cloud / Upstash

## 🤖 AI Assistant

The integrated AI assistant can:
- Explain routing decisions in natural language  
- Suggest alternatives (“Cab vs Transit vs Walk”)  
- Run what-if simulations:
  - “What if I leave in 20 minutes?”
  - “What if it rains harder?”
  - “What if I drive instead of taking a cab?”

Powered by:
- OpenAI GPT (tool calling)
- LangChain / LangGraph
- Deterministic rule engine synergy