# 🚀 Orbit Rush

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb.svg)](https://react.dev/)
[![Expo](https://img.shields.io/badge/Expo-57.0-black.svg)](https://expo.dev/)
[![Express](https://img.shields.io/badge/Express-5.0-000000.svg)](https://expressjs.com/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Orbit Rush** is a fast-paced, skill-based arcade dodge-and-collect game featuring responsive physics, dynamic hazard scaling, temporary combo multipliers, tactical dashes, and unlockable visual trails.

Built as a high-performance TypeScript monorepo, Orbit Rush offers both a web browser arcade experience rendered on an HTML5 Canvas and a native mobile application powered by Expo and React Native with haptic feedback.

---

## 🎮 Game Overview & Mechanics

In **Orbit Rush**, players navigate a high-energy arena while dodging incoming orbital hazards and collecting energy sparks to maximize their high score.

### Core Gameplay Mechanics

- **Orbital Steering & Physics**: Smooth player movement with inertia, friction, and directional steering.
- **Hazard Evasion**: Hazards spawn continuously around the perimeter and sweep across the playfield at scaling velocities.
- **Spark Collection & Combos**: Collecting sparks adds bonus points and increments your combo meter. Every 3 sparks upgrades your combo multiplier (up to **5x**). Missing sparks for 3.6 seconds resets your multiplier.
- **Tactical Dash**: Execute a burst-velocity dash that grants brief invulnerability (0.48s) to slip out of tight traps. Recharges every 3 seconds.
- **Cosmetic Trail Unlocks**: Accumulate sparks across all runs to unlock distinct visual particle trails:
  - ⚡ **Ion Trail** (*Default* - Electric Cyan `#6bf1ff`) — Unlocked at 0 sparks
  - ☀️ **Solar Trail** (*Amber Fire* `#ffbd67`) — Unlocked at 10 lifetime sparks
  - 🌌 **Nova Trail** (*Cosmic Purple* `#c69cff`) — Unlocked at 30 lifetime sparks
  - 💎 **Prism Trail** (*Mint Emerald* `#73f4c0`) — Unlocked at 60 lifetime sparks

---

## 🕹️ Controls & Platform Features

| Feature / Action | 🌐 Web Arcade App | 📱 Native Mobile App |
| :--- | :--- | :--- |
| **Steering / Movement** | Mouse cursor tracking or WASD / Arrow keys | One-finger touch drag & steering |
| **Tactical Dash** | Spacebar or Mouse Click | Dedicated Dash Button |
| **Pause / Resume** | On-screen Pause button or ESC key | On-screen Pause overlay |
| **Feedback** | Visual screen shake & particle effects | Native haptic feedback (`expo-haptics`) |
| **Storage & Progress** | Browser `localStorage` | Device `AsyncStorage` |

---

## 🏗️ Monorepo Architecture

Orbit Rush is organized as a clean **pnpm workspace** monorepo designed for reusability, strict type safety, and seamless API integration:

```text
orbit-rush/
├── artifacts/
│   ├── orbit-rush/              # 🌐 Web application (Vite, React 19, HTML5 Canvas, Tailwind)
│   ├── orbit-rush-mobile/       # 📱 Mobile application (Expo SDK 57, React Native, Expo Router)
│   └── api-server/              # ⚡ Express 5 REST API server (Node.js 24, Pino logging)
├── lib/
│   ├── api-spec/                # 📄 OpenAPI 3.0 specification (`openapi.yaml`) & Orval config
│   ├── api-client-react/        # 🎣 Auto-generated React Query hooks
│   ├── api-zod/                 # 🛡️ Auto-generated Zod validation schemas
│   └── db/                      # 🗄️ PostgreSQL schema definitions & Drizzle ORM setup
├── scripts/                     # 🛠️ Workspace utilities & post-merge hooks
├── package.json                 # Monorepo root configuration & workspace scripts
└── pnpm-workspace.yaml          # Workspace packages definition & supply-chain security rules
```

---

## 🛠️ Tech Stack

### Web Frontend (`@workspace/orbit-rush`)
- **Framework**: React 19 + Vite 7
- **Game Engine**: Custom HTML5 Canvas renderer with physics engine (`src/game/engine.ts`)
- **Styling & UI**: Tailwind CSS v4, Radix UI primitives, Lucide icons, Framer Motion
- **State Management**: TanStack React Query v5

### Native Mobile (`@workspace/orbit-rush-mobile`)
- **Framework**: Expo SDK 57 + React Native 0.86
- **Navigation**: Expo Router v5
- **Features**: Expo Haptics, Reanimated, Linear Gradient, Safe Area Context

### Backend & API Server (`@workspace/api-server`)
- **Runtime & Server**: Node.js 24, Express 5
- **Logging**: Pino HTTP logger with `pino-pretty`
- **Build**: Esbuild bundler

### Database & Type Safety (`lib/db`, `lib/api-spec`)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM + Drizzle Zod
- **API Spec & Codegen**: OpenAPI 3.0 YAML with Orval code generation
- **Type Safety**: End-to-end type safety across database, server, client, and mobile packages

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `^24.0.0`
- **pnpm**: `^10.0.0`
- **PostgreSQL**: Required if running the backend API server and database migrations

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/orbit-rush.git
   cd orbit-rush
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables** (Optional, for API & Database):
   Create a `.env` file in root or set the required variables:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/orbit_rush
   PORT=5000
   ```

---

## 💻 Development Commands

| Command | Description |
| :--- | :--- |
| `pnpm --filter @workspace/orbit-rush run dev` | Start the Web Arcade development server (Vite) |
| `pnpm --filter @workspace/orbit-rush-mobile run dev` | Start the Expo Mobile app development server |
| `pnpm --filter @workspace/api-server run dev` | Build & run the Express API server on port `5000` |
| `pnpm run typecheck` | Run TypeScript type checks across all workspace projects |
| `pnpm run build` | Full workspace build (type check + project compilation) |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Push Drizzle ORM database schema changes to Postgres |

---

## 🛡️ Supply-Chain Protection

This repository enforces supply-chain security via `pnpm-workspace.yaml`:
- **Minimum Release Age**: Requires npm package versions to be published for at least 24 hours (`minimumReleaseAge: 1440`) before installation, mitigating zero-day supply-chain attacks.
- Explicit allowlists are maintained for trusted scoped packages (`@replit/*`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
