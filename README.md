# HireSettle — Frontend Repo

> **Next.js 14 frontend for milestone-based recruiter fee escrow on Stellar**

This is **Repo 3 of 3** in the HireSettle project:

| Repo | Description |
|------|-------------|
| `hiresettle-contract` | Soroban smart contract (Rust) |
| `hiresettle-backend` | NestJS REST API + retention scheduler |
| `hiresettle-frontend` ← you are here | Next.js 14 + Freighter wallet UI |

---

## What This Frontend Does

- **Sign-In With Stellar** — connect Freighter wallet, sign a nonce, receive JWT
- **Create engagements** — define job details, fee structure, parties; lock USDC in escrow via Freighter
- **Milestone timeline** — view all milestones with role-specific actions
- **Retention timers** — live countdown showing days/ledgers until each retention milestone unlocks
- **Unlock milestones** — button appears when the retention window has elapsed, triggers on-chain unlock
- **Submit proof** — recruiters submit IPFS hash or URL as evidence
- **Confirm / dispute** — companies approve or challenge submitted proof
- **Resolve disputes** — arbiters approve or reject disputed milestones
- **Request replacement** — companies trigger the replacement clause when a candidate leaves early
- **Notifications** — colour-coded feed with retention-window-approaching alerts

---

## What's Different From ChainSettle Frontend

### Retention timer UI

Every Locked retention milestone shows a live countdown fetched from `GET /milestones/:index/timer`. The UI renders:
- Days remaining until unlock (e.g. "27 days remaining")
- A colour-coded pill — amber when approaching, green when ready to unlock
- The estimated unlock date from the backend

Once `unlockable = true`, an "Unlock milestone" button appears. Clicking it calls `unlock_milestone()` on-chain via Freighter, which changes the milestone from Locked → Pending so the recruiter can submit proof.

### `MilestoneKind` badges

Each milestone shows a "Retention" badge so both parties understand its time-locked nature at a glance.

### Role toggle on engagements list

The list page has a "As company / As recruiter" toggle so users who participate in both roles can switch views without needing separate accounts.

### `ReplacementBanner`

When an engagement's status is `ReplacementRequested`, a prominent amber banner appears explaining the situation and showing the recruiter what to do next (submit proof for the replacement candidate).

### New contract calls

`unlockMilestone()` and `requestReplacement()` in `lib/stellar/contract.ts` — not present in ChainSettle frontend.

---

## Project Structure

```
hiresettle-frontend/
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── README.md
│
└── src/
    ├── middleware.ts               ← JWT cookie check → redirect to login
    │
    ├── app/
    │   ├── layout.tsx              ← Root layout + Providers
    │   ├── page.tsx                ← Redirect to /dashboard/engagements
    │   ├── providers.tsx           ← Zustand rehydration
    │   ├── auth/login/page.tsx     ← Freighter + Sign-In With Stellar
    │   ├── dashboard/
    │   │   ├── layout.tsx          ← Sidebar + TopBar
    │   │   └── engagements/
    │   │       ├── page.tsx        ← List + role toggle + filters
    │   │       ├── create/page.tsx ← Create form with milestone builder
    │   │       └── [id]/page.tsx   ← Detail + timeline + actions
    │   └── notifications/page.tsx  ← Colour-coded notification feed
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx         ← Nav + role display
    │   │   └── TopBar.tsx          ← Network badge + notifications bell
    │   ├── engagements/
    │   │   ├── EngagementCard.tsx   ← List item card
    │   │   ├── EngagementProgress.tsx ← USDC stats + progress bar
    │   │   ├── EngagementMeta.tsx   ← Addresses + off-chain metadata
    │   │   └── ReplacementBanner.tsx ← Replacement clause banner
    │   └── milestones/
    │       └── MilestoneTimeline.tsx ← Full interactive timeline with retention timers
    │
    ├── lib/
    │   ├── stellar/
    │   │   ├── freighter.ts        ← Freighter API wrappers
    │   │   └── contract.ts         ← All Soroban contract calls
    │   ├── api/
    │   │   ├── client.ts           ← Axios + JWT interceptor
    │   │   └── services.ts         ← Typed API functions + timer endpoint
    │   ├── hooks/
    │   │   └── use-auth-store.ts   ← Zustand auth store
    │   └── utils/
    │       └── index.ts            ← Formatting + retention timer helpers
    │
    ├── types/index.ts              ← All TypeScript types
    └── styles/globals.css          ← Tailwind + HireSettle design tokens
```

---

## Role-Based UI

| Role | Detected | Actions available |
|---|---|---|
| **Company** | `address === engagement.companyAddress` | Confirm milestones, raise disputes, cancel engagement, request replacement |
| **Recruiter** | `address === engagement.recruiterAddress` | Unlock retention milestones, submit proof documents |
| **Arbiter** | `address === engagement.arbiterAddress` | Approve or reject disputed milestones |
| **Observer** | Any other address | Read-only view |

---

## Retention Timer Flow

```
Engagement created
  → Milestone 2 (30-day) = Locked, timer starts
  → Timer shows "30 days remaining" in the UI

  ← 27 days pass (backend notifies "approaching" at day 27)
  → Timer shows "3 days remaining"

  ← Day 30 passes
  → Backend sets milestone to PENDING, notifies recruiter
  → Timer shows "Ready to unlock" (green pill)
  → "Unlock milestone" button appears

  Recruiter clicks "Unlock milestone"
    → unlockMilestone() called on-chain via Freighter
    → Milestone status → Pending on-chain
    → "Submit proof" button appears

  Recruiter clicks "Submit proof"
    → Enters IPFS hash
    → submitProof() called on-chain via Freighter
    → Company sees "Confirm & release" button

  Company clicks "Confirm & release"
    → confirmMilestone() called on-chain
    → 40% of fee released to recruiter
```

---

## Setup

```bash
cp .env.example .env.local   # fill in contract ID + backend URL
npm install
npm run dev                   # → http://localhost:3001
```

Install [Freighter](https://freighter.app), switch to Testnet, fund a test account at [friendbot.stellar.org](https://friendbot.stellar.org).

---

## Production Checklist

- [ ] `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- [ ] Update `NEXT_PUBLIC_USDC_ADDRESS` to mainnet SAC
- [ ] Update `NEXT_PUBLIC_CONTRACT_ID` to mainnet contract
- [ ] Use HTTPS backend URL
- [ ] Deploy to Vercel / Docker

---

## License

MIT
