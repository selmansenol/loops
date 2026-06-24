# Changelog

All notable changes to Loops are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Admin & Analytics** — per-board dashboard at `/<slug>/admin` (privacy-first
  visitor analytics, engagement trend, conversion funnel, top posts/referrers,
  CSV export) plus team management (invite by email + roles) and moderation
  (bulk status, hide, delete).
- **Platform operator dashboard** at `/admin` — deployment-wide stats across all
  boards, gated by `PLATFORM_ADMIN_EMAILS`.
- **Ollama / OpenAI-compatible provider** — bring your own local model (Ollama,
  LM Studio, vLLM) via a base URL; the API key is optional.
- **Email notifications** — status-change and new-comment emails, subscriptions,
  one-click unsubscribe, and a weekly digest.
- **Prebuilt Docker image** published to `ghcr.io/selmansenol/loops` for
  build-free self-hosting.

### Changed

- Self-hosted fonts (no render-blocking Google Fonts) and a real favicon set.
- Privacy-first, cookieless visitor tracking that honors Do-Not-Track / GPC.

### Security

- Rate limiting on public write endpoints (`/api/v1` posts & votes), the
  analytics beacon, and the AI chat.
- Integration tests for multi-tenant isolation, vote de-duplication and API-key
  scope; CI now runs them against a real Postgres.
