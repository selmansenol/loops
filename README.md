<p align="center">
  <img src=".github/loops-banner.svg" alt="Loops — open-source, self-hostable feedback board" width="100%" />
</p>

<h1 align="center">Loops</h1>

<p align="center">
  <strong>The open-source, AI-native feedback board — a self-hostable Canny alternative.</strong><br/>
  Collect feature requests, let users vote and discuss, plan a roadmap, ship a public
  changelog, and let AI cluster and prioritize the noise for you.
</p>

<p align="center">
  <a href="https://getloops.co"><img src="https://img.shields.io/badge/Live-getloops.co-7C9CFF?style=flat&logo=vercel&logoColor=white" alt="Live demo"/></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/npx-create--loops-CB3837?logo=npm&logoColor=white" alt="npx create-loops"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/PRs-welcome-7C9CFF.svg" alt="PRs welcome"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/Postgres-16-4169E1?logo=postgresql&logoColor=white" alt="Postgres 16"/>
</p>

<p align="center">
  <a href="#-what-is-this">What is this?</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-ai-native-extras">AI extras</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-self-hosting">Self-hosting</a> ·
  <a href="#-configuration">Config</a> ·
  <a href="#-public-api">API</a> ·
  <a href="#-contributing">Contributing</a> ·
  <a href="#-sponsors">Sponsors</a>
</p>

---

## 🧭 What is this?

Most feedback tools just **collect** requests and leave you to drown in them. Loops is
**AI-native**: as feedback comes in it detects duplicates, can turn a vague chat into a
clean post, and drafts your roadmap for you — all on infrastructure you own (just
**Node + Postgres**, no proprietary backend, no per-seat pricing).

There are two ways to use it:

- **Hosted** — sign up at **[getloops.co](https://getloops.co)** and manage your board at
  `getloops.co/<your-slug>`. Free tier, bring your own AI key, nothing to install.
- **Self-hosted** — run your own single board anywhere with one command (see below). Same
  codebase, zero vendor lock-in.

> [!NOTE]
> One codebase serves both. Setting `SINGLE_TENANT_SLUG` turns Loops into a single-board
> self-host install; leaving it unset runs the multi-tenant hosted experience.

## ✨ Features

- 📋 **Feedback board** — post requests, upvote, filter, search and sort
- 🗺️ **Roadmap** — planned / in progress / shipped columns
- 📰 **Changelog** — shipped items grouped by month, shareable
- 💬 **Comments** — discuss posts; admins can mark official responses
- 🏢 **Multi-board / workspaces** — host many boards at `/<slug>`, each with its own
  members, roles (owner / admin / member) and settings
- 🔐 **Auth** — email/password (with verification + reset via Resend) + optional Google & GitHub OAuth
- 🗳️ **Guest voting** — visitors vote without an account (IP-deduplicated); owners can require sign-in
- 🔑 **Public REST API** with scoped, per-workspace API keys (`/api/v1/*`)
- 🪝 **Webhooks** — HMAC-signed delivery; native Discord & Slack formatting
- 🧩 **Embeddable widget** — one script tag, with `data-user-id` to identify your logged-in users
- 📣 **Share & Embed panel** — public link + QR + one-click embed key per board
- 📊 **Admin & Analytics** — per-board dashboard (visitors, engagement, funnel), team
  management and moderation tools (see below)
- 🌍 **i18n** — 17 languages out of the box, with RTL support

## 🤖 AI-native extras

These are what set Loops apart from a classic Canny clone — and they work with **any**
provider (OpenAI, Anthropic or Google), using **your own API key** per workspace:

- 🪄 **AI duplicate detection** — the composer surfaces similar existing posts as you
  type, so users upvote instead of opening duplicates.
- 💬 **Conversational capture** — an AI assistant asks clarifying questions and turns a
  vague problem into a clean, de-duplicated post.
- 🧭 **AI roadmap generator** — admins auto-sort the top requests into **Now / Next /
  Later** with one click.
- 🧠 **AI Insights** — cluster, summarize and prioritize all feedback into themes.

## 📊 Admin & Analytics

Every board has an owner/admin dashboard at **`/<slug>/admin`** with four tabs:

- **Overview** — visitors & pageviews, an engagement trend (posts + votes), a
  conversion funnel (visitor → voter → member), top posts and top referrers, over a
  7 / 30 / 90-day range, plus CSV export.
- **Members** — list members, invite teammates by email, change roles (owner / admin /
  member) and remove access.
- **Moderation** — bulk-update status, hide or delete posts.
- **Settings** — drop in an external analytics snippet (e.g. Plausible / Umami) and
  read the data-retention note.

Visitor tracking is **first-party and privacy-friendly**: no cookies, no third party,
and a visitor is identified only by a one-way hash of (secret + day + IP) — it can't be
reversed or linked across days. **Do-Not-Track** / Global Privacy Control is honored, and
events are pruned on a retention schedule, so it's GDPR-friendly out of the box.

## 🚀 Quick start

Scaffold a ready-to-run board with one command (requires **git** + **Docker**):

```bash
npx create-loops my-board
cd my-board
docker compose up --build
```

That's it — open **http://localhost:3000**. The scaffolder generates a `.env` with a
fresh auth secret and single-board mode enabled; migrations run automatically on boot,
and the **first user to sign up becomes the owner**.

> Prefer to clone yourself, or want multi-tenant mode? See **[Self-hosting](#-self-hosting)**.

## 🏗️ Self-hosting

### Option A — clone with Docker Compose (app + Postgres)

```bash
git clone https://github.com/selmansenol/loops.git
cd loops
cp .env.example .env
# Set a real secret:  openssl rand -base64 32  → BETTER_AUTH_SECRET
# Single board? Uncomment SINGLE_TENANT_SLUG="main" in .env
docker compose up --build
```

### Option B — multi-tenant (the getloops.co experience)

Leave `SINGLE_TENANT_SLUG` **unset**. `/` becomes the marketing landing, users sign up at
`/auth`, create boards from `/dashboard` → `/new`, and each board lives at `/<slug>`.
Put a reverse proxy (Caddy/Nginx) in front for HTTPS — see
[**Deploy to production**](#-deploy-to-production).

## 💻 Local development

Requires **Node 22+** and a running Postgres.

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres

npm run db:migrate            # create tables + functions/triggers
npm run dev                   # http://localhost:3000
```

No local Postgres? Spin one up with Docker:

```bash
docker run -d --name loop-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=loop postgres:16-alpine
```

### Scripts

| Script                            | What it does                                           |
| --------------------------------- | ------------------------------------------------------ |
| `npm run dev`                     | Start the dev server                                   |
| `npm run build`                   | Production build (`.output/`, node-server preset)      |
| `npm start`                       | Run the built server (`node .output/server/index.mjs`) |
| `npm run db:generate`             | Generate a migration from `src/db/schema.ts`           |
| `npm run db:migrate`              | Apply migrations + `src/db/triggers.sql`               |
| `npm run db:studio`               | Open Drizzle Studio                                    |
| `npm run lint` / `npm run format` | Lint / format                                          |

## 🛠️ Tech stack

| Concern          | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Framework        | [TanStack Start](https://tanstack.com/start) (React 19) + Vite + nitro |
| Database         | PostgreSQL                                                             |
| ORM / migrations | [Drizzle](https://orm.drizzle.team)                                    |
| Auth             | [better-auth](https://better-auth.com) (cookie sessions)               |
| Styling          | Tailwind CSS v4 + Radix UI                                             |
| AI               | [Vercel AI SDK](https://sdk.vercel.ai) (provider-agnostic)             |

> **Architecture note:** the browser never talks to the database directly. All data
> access goes through TanStack **server functions** and the REST API. There is no
> row-level security — every query is scoped to a workspace in the application layer
> (`src/lib/workspace.server.ts`), so workspace isolation is enforced in code. See
> [AGENTS.md](AGENTS.md) for the conventions contributors should follow.

## 📸 Screenshots

|                                                       |                                                       |
| ----------------------------------------------------- | ----------------------------------------------------- |
| ![Loops landing page](.github/screenshot-landing.png) | ![Loops feedback board](.github/screenshot-board.png) |
| _Landing_                                             | _Feedback board_                                      |

## ⚙️ Configuration

All configuration is via environment variables — see [`.env.example`](.env.example).

| Variable                                                                | Required | Description                                        |
| ----------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`                                                          | ✅       | Postgres connection string                         |
| `BETTER_AUTH_SECRET`                                                    | ✅       | Random 32+ byte secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`                                                       | ✅       | Public base URL (OAuth callbacks, cookies)         |
| `SINGLE_TENANT_SLUG`                                                    | –        | Run as one board at `/` (self-host). Unset = multi-tenant |
| `DEMO_WORKSPACE_SLUG`                                                   | –        | Multi-tenant: slug the "Try the demo" button opens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                             | –        | Enable Google login                                |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                             | –        | Enable GitHub login                                |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | –        | AI features (env keys apply in single-tenant mode) |
| `LOOP_AI_PROVIDER` / `LOOP_AI_MODEL`                                    | –        | Force a specific AI provider/model                 |

OAuth callback URLs to register with each provider:

```
<BETTER_AUTH_URL>/api/auth/callback/google
<BETTER_AUTH_URL>/api/auth/callback/github
```

### Roles & admin

Roles are **per workspace** (`owner` / `admin` / `member`) — there is no global admin.

- **Single-tenant** (`SINGLE_TENANT_SLUG` set): the **first user to sign in becomes the
  owner**; everyone after them joins as a member. No SQL needed.
- **Multi-tenant**: whoever creates a board is its owner and can promote others.

Owners and admins get the moderation tools (status changes, AI Insights, API keys,
webhooks); members can post, vote and comment.

## 🔌 Public API

Authenticate with a per-workspace API key (created in **Settings → API Keys**) via
`Authorization: Bearer <key>`.

```bash
# List posts
curl -H "Authorization: Bearer loop_sk_..." http://localhost:3000/api/v1/posts

# Create a post (requires the `write` scope)
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer loop_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Dark mode please","description":"It would be great"}'

# Vote on behalf of an external user
curl -X POST http://localhost:3000/api/v1/posts/<id>/vote \
  -H "Authorization: Bearer loop_sk_..." \
  -H "X-Loop-External-User: user-123"
```

Each key is bound to one workspace, so the API is automatically scoped to that board.

## 🌐 Deploy to production

Loops is a standard Node server (`node .output/server/index.mjs`) + a Postgres
database — host it anywhere (a VPS, Fly.io, Railway, Render, your own box…).

1. Point your domain at the server and terminate TLS (HTTPS) with a reverse proxy
   (Caddy, Nginx, Traefik) or your host's built-in TLS.
2. Set the production environment:
   ```bash
   DATABASE_URL="postgres://…/loops"
   BETTER_AUTH_SECRET="…"                          # openssl rand -base64 32
   BETTER_AUTH_URL="https://feedback.yourdomain.com"   # your public URL
   # SINGLE_TENANT_SLUG="main"                      # set for a single self-host board
   ```
3. If you use OAuth, register the callback URLs above with each provider.
4. Run it — easiest is Docker Compose (app + Postgres):
   ```bash
   docker compose up -d --build
   ```
   Or on a Node host directly: `npm ci && npm run build && npm run db:migrate && npm start`.

### One-command HTTPS (Caddy)

For a single server with your own domain, [`docker-compose.prod.yml`](docker-compose.prod.yml)
runs **app + Postgres + Caddy** with **automatic Let's Encrypt HTTPS**:

```bash
# On the server, after pointing your domain's A record at it:
cp .env.example .env            # set BETTER_AUTH_URL, BETTER_AUTH_SECRET, POSTGRES_PASSWORD
# edit the domain in ./Caddyfile
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy obtains and renews TLS certificates automatically (ports 80/443 must be open).

> [!IMPORTANT]
> `BETTER_AUTH_URL` **must** match the public HTTPS URL, or sign-in cookies and
> OAuth redirects will fail. Always serve production over HTTPS.

## 🗺️ Roadmap

- [x] Multi-board / workspace support
- [x] Guest voting (no account, IP-deduplicated) + owner toggle
- [x] Per-board AI provider + model selection (bring your own key)
- [x] Embed widget with user identification (`data-user-id`)
- [x] Native Discord / Slack webhook formatting
- [x] Transactional email (verification + password reset, Resend)
- [x] Share & Embed panel (public link, QR, one-click embed key)
- [x] Email digests & notifications (status changes, new comments, weekly digest)
- [x] Team invites by email + role management
- [x] Privacy-first analytics & per-board admin dashboard
- [ ] Inbound capture from Telegram / WhatsApp
- [ ] Two-way GitHub / Linear / Jira sync
- [ ] Billing & plans for the hosted edition

Have an idea? Tell us on our own board → **[getloops.co/feedback](https://getloops.co/feedback)** (yes, Loops runs on Loops), or [open an issue](../../issues/new/choose). 🙂

## 🤝 Contributing

Contributions are very welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md). Good first steps:

1. Fork & clone, then follow [Local development](#-local-development).
2. Run `npm run lint` and `npm run build` before opening a PR.
3. Keep new user-facing strings in `src/lib/i18n.ts` (English + Turkish; other locales
   fall back to English).
4. Every DB query must be scoped to a workspace — never read or write across tenants.

## 💛 Sponsors

Loops is free and open-source (MIT). If it saves you time or money, please consider
sponsoring — it directly funds bug fixes and new features, and keeps the project
independent.

<p>
  <a href="https://github.com/sponsors/selmansenol">
    <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-%E2%9D%A4-EA4AAA?logo=githubsponsors&logoColor=white&style=for-the-badge" alt="Sponsor on GitHub"/>
  </a>
</p>

> _Loops ücretsiz ve açık kaynak. İşine yaradıysa [GitHub Sponsors](https://github.com/sponsors/selmansenol) ile destek olabilirsin._ 🙏

**Be the first sponsor** and your name/logo can appear here. 💖

## 🔒 Security

Found a vulnerability? Please **don't** open a public issue — see
[SECURITY.md](SECURITY.md) for private disclosure.

## 📄 License

[MIT](LICENSE) © Loops contributors.
