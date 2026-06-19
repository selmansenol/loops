# Security Policy

## Supported Versions

Loop is under active development. Security fixes are applied to the `main` branch and the
latest release.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use GitHub's private
[**"Report a vulnerability"**](../../security/advisories/new) feature, or email the
maintainer privately. Include:

- A description of the issue and its impact
- Steps to reproduce (proof of concept if possible)
- Affected version / commit

We'll acknowledge your report as soon as possible and keep you updated on the fix. Please
give us a reasonable window to address the issue before any public disclosure.

## Hardening notes for self-hosters

- Always set a strong, unique `BETTER_AUTH_SECRET`.
- Serve the app over HTTPS in production and set `BETTER_AUTH_URL` to the public URL.
- Keep your AI provider and API keys out of version control (use `.env`).
- Restrict database network access to the app only.

Thank you for helping keep Loop and its users safe. 🙏
