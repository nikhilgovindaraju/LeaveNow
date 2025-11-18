# LeaveNow - Real-Time Commute Orchestrator

A production-minded backend that computes deterministic leave-by times by fusing live ETAs (drive/transit/walk) with user buffers (prep/parking/security) and weather, returning an explainable plan + reliability score.

## Features

- 🚗 **Multi-Modal ETA Calculation**: Drive, Transit, and Walk modes via Google Maps
- 🌦️ **Weather Integration**: Precipitation data from OpenWeather API
- 🎯 **Smart Mode Selection**: Chooses optimal transport based on reliability and ETA
- 💾 **PostgreSQL Persistence**: User preferences, venues, plans, and routines
- ⚡ **Redis Caching**: 60s TTL for ETAs, 300s for weather data
- 📊 **Swagger Documentation**: Interactive API docs at `/docs`
- 🔄 **Background Jobs**: BullMQ for routine planning and re-planning
- 🧪 **Stub Mode**: Works without API keys for testing

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS
- **Database**: PostgreSQL (Prisma ORM)
- **Cache/Queue**: Redis (ioredis + BullMQ)
- **HTTP Client**: Axios
- **Docs**: Swagger/OpenAPI

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database
npm run prisma:seed
```

### Environment Variables

Create a `.env` file:

```env
PORT=8080
NODE_ENV=development

DATABASE_URL=postgresql://user:password@localhost:5432/leavenow
REDIS_URL=redis://localhost:6379

GOOGLE_MAPS_API_KEY=your_key_here
OPENWEATHER_API_KEY=your_key_here

USE_STUBS=auto          # auto|true|false
ENABLE_JOBS=true        # enables cron + background jobs
```

### Running

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Docker Compose (all services)
docker compose up --build
```

## API Endpoints

### POST /api/plan

Compute optimal leave-by time.

**Request:**
```json
{
  "origin": {"lat": 47.61, "lng": -122.33},
  "destination": {"lat": 47.62, "lng": -122.35},
  "arriveBy": "2025-11-12T18:30:00Z",
  "prefsId": "optional-string"
}
```

**Response:**
```json
{
  "leaveBy": "2025-11-12T18:02:15Z",
  "chosenMode": "TRANSIT",
  "etaSeconds": 1675,
  "reliability": 0.91,
  "explain": "Light rain (+6%). Includes prep (10m).",
  "alternatives": [
    {"mode": "DRIVE", "etaSeconds": 1800, "reliability": 0.84},
    {"mode": "WALK", "etaSeconds": 4200, "reliability": 0.99}
  ]
}
```

### GET /api/places

Search for places using Google Places API.

**Query Parameters:**
- `q` (required): Search query
- `near` (optional): `lat,lng` for nearby search

**Response:**
```json
[
  {
    "id": "ChIJ...",
    "text": "Trader Joe's - Queen Anne",
    "lat": 47.63,
    "lng": -122.36
  }
]
```

### GET /api/routines

Get all routines.

### POST /api/routines

Create a new routine.

### GET /api/healthz

Health check endpoint.

## Run Modes

### STUB Mode

When API keys are missing, the system automatically switches to deterministic stubs:

- **Google Maps ETAs**: `{DRIVE: 1500, TRANSIT: 1675, WALK: 4200}`
- **Weather**: Random precipitation with 30% probability
- **Places**: Static list of 5 common locations

Set `USE_STUBS=true` to force stub mode, or `USE_STUBS=auto` (default) to auto-detect.

### LIVE Mode

With valid API keys, the system uses:
- Google Maps Directions API for real-time ETAs
- OpenWeather One Call API for precipitation forecasts
- Google Places API for location search

## Core Algorithm

```
weatherPenalty = precip ? 0.06 : 0.0
parkingPenalty = venue.parkingBufferMin * 60
securityPenalty = venue.securityBufferMin * 60
prep = prefs.prepMinutes * 60

adjustedETA = baseETA * (1 + weatherPenalty) + parkingPenalty + securityPenalty + prep
leaveBy = arriveBy - adjustedETA

reliability = 0.95 - (precip ? 0.03 : 0.0)
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## Architecture

```
src/
├── app.module.ts           # Root module
├── main.ts                 # Entry point
├── common/                 # Shared utilities
│   ├── dto/                # Data transfer objects
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Logging interceptor
│   └── utils/              # Time utilities
├── prisma/                 # Prisma module
├── integrations/           # External APIs
│   ├── google.service.ts   # Google Maps + Places
│   ├── weather.service.ts  # OpenWeather
│   └── cache.service.ts    # Redis cache
├── plan/                   # Core planning logic
├── places/                 # Places search
├── preferences/            # User preferences
└── routines/               # Scheduled routines
    └── jobs/               # Background jobs
```


