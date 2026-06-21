# create-loops

Scaffold a self-hosted [**Loops**](https://github.com/selmansenol/loops) feedback board
in one command — an open-source, AI-native Canny alternative.

```bash
npx create-loops my-board
cd my-board
docker compose up --build
```

Open **http://localhost:3000**. The scaffolder shallow-clones the latest Loops, drops the
git history, and writes a ready-to-run `.env` (fresh `BETTER_AUTH_SECRET`, single-board
mode on). Migrations run on boot and the **first user to sign up becomes the owner**.

## Requirements

- **git** and **Node 18+** (to run the scaffolder)
- **Docker** (easiest), or Node 22+ and Postgres for a manual setup

## Options

| Flag         | Description                                                            |
| ------------ | --------------------------------------------------------------------- |
| `--multi`    | Multi-tenant mode — boards live at `/<slug>` (default is one board at `/`) |
| `-h, --help` | Show help                                                             |

```bash
npx create-loops my-board            # single board (self-host default)
npx create-loops my-saas --multi     # multi-tenant, getloops.co style
```

## What it does

1. `git clone --depth 1` the Loops repository into the target directory.
2. Removes `.git` so you start fresh.
3. Generates `.env` from `.env.example` with a random auth secret (and
   `SINGLE_TENANT_SLUG="main"` unless `--multi`).
4. Prints the next steps.

No tracking, no runtime dependencies — Node built-ins only.

[MIT](https://github.com/selmansenol/loops/blob/main/LICENSE) © Loops contributors.
