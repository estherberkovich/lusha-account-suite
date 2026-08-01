# Account Intelligence Suite

A unified, AI-powered account management toolkit for a B2B sales intelligence platform (in the spirit of Lusha), covering the full customer lifecycle in one place: health scoring, expansion strategy, call intelligence, QBR generation, and manager reporting — all reading the same shared account data.

## Tabs

- **Health Dashboard** — sector-adaptive, weighted risk scoring with AI-generated insights
- **Expansion Copilot** — signal-driven stakeholder mapping and expansion briefs, calibrated by account health
- **Call Intelligence** — live call recording, real speaker diarization, and AI sentiment/risk analysis, with persistent call history
- **QBR Assistant** — turns raw meeting notes into a client-ready quarterly business review
- **Manager Report** — internal, manager-facing account and portfolio recaps with report history and an account-wide Action Log

## Required setup: two API keys

This app calls two APIs through secure Vercel serverless functions, so keys are never exposed in the browser.

**1. Anthropic (for all AI generation across every tab)**
1. Get a key from [console.anthropic.com](https://console.anthropic.com) → API Keys.
2. In Vercel: **Settings → Environment Variables** → add `ANTHROPIC_API_KEY`.

**2. AssemblyAI (for Call Intelligence transcription + speaker diarization)**
1. Get a key from [assemblyai.com](https://www.assemblyai.com) → Dashboard → API Keys.
2. In Vercel: **Settings → Environment Variables** → add `ASSEMBLYAI_API_KEY`.

After adding both, redeploy (Deployments → ⋯ → Redeploy) so the functions pick them up.

Without these set, AI features fall back to a pre-written example output for the built-in demo accounts, clearly labeled as such.

## Tech

- React + Vite
- Vercel Serverless Functions: `/api/analyze.js` (Anthropic Claude) and `/api/transcribe.js` (AssemblyAI)
- `window.storage` for client-side persistence (custom accounts, signals, stakeholders, action log, call/QBR/report history)

## Run locally

```bash
npm install
npm run dev
```

Note: the `/api` functions only run when deployed on Vercel (or via `vercel dev`).

---

*All account names, companies, and figures in this project are fictional, created for portfolio demonstration purposes.*
