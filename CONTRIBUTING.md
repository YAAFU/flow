# Contributing to Flow

Thanks for taking the time to contribute! 🙌 This guide explains how to set up, the standards we follow, and how to get your change merged smoothly. Beginners are welcome — open a draft PR early and ask questions.

## Table of contents
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Branch & commit conventions](#branch--commit-conventions)
- [Before you open a PR](#before-you-open-a-pr)
- [Pull request checklist](#pull-request-checklist)
- [Code style](#code-style)
- [Design system rules](#design-system-rules)
- [Working with the AI endpoints](#working-with-the-ai-endpoints)
- [Reporting bugs & security](#reporting-bugs--security)

## Ways to contribute
- **Bugs** — fix something broken, or file a clear Issue.
- **Features** — implement a roadmap item, or propose one (describe the *problem* first).
- **Docs** — clarify setup, add examples, fix typos.
- **Design / UX** — improve a screen while respecting the design system.
- **Tests** — add Vitest coverage for `lib/` logic (scoring, schedule, types).
- **Translations** — the UI is Thai-first; tidy English copy is welcome.

No contribution is too small. A typo fix is a valid PR.

## Development setup

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<you>/flow.git
cd flow

# 2. Install (pnpm)
pnpm install

# 3. Env
cp .env.example .env.local        # add ANTHROPIC_API_KEY (optional for non-AI work)

# 4. Run
pnpm dev                          # http://localhost:3000
```

> The app is **mobile-first** and centered at `max-width: 420px`. Test in a narrow viewport (DevTools device toolbar) — most UI bugs only show there.

Without an `ANTHROPIC_API_KEY`, AI routes fall back to demo/fixture data, so you can still work on most of the UI.

## Branch & commit conventions
- Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `chore/...`.
- One concern per branch/PR. Smaller PRs are reviewed faster.
- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)**:
  - `feat: add per-day auto-check override`
  - `fix: prevent title overflow on long task names`
  - `refactor: extract schedule helpers`
  - `docs: clarify env setup`

## Before you open a PR
Run all four and make sure they pass:

```bash
pnpm lint
npx tsc --noEmit
pnpm build
pnpm test
```

If you changed UI, include **before / after screenshots** at 420px width.

## Pull request checklist
- [ ] Targets `main`, branch named by type (`feat/…`, `fix/…`).
- [ ] One focused change; description explains *what* and *why*.
- [ ] `lint`, `tsc --noEmit`, `build`, `test` all pass locally.
- [ ] No secrets, keys, or `.env*` files committed.
- [ ] UI change → screenshots + still matches the design system.
- [ ] New logic in `lib/` → a Vitest test where practical.

## Code style
- **TypeScript strict.** Avoid `any`. The Zod schemas in `lib/types.ts` are the source of truth — derive types from them (`z.infer`) instead of redeclaring.
- **Match the file you're editing** — naming, indentation, comment density, and idioms.
- Prefer the existing helpers in `lib/` (`score`, `places`, `osrm`) over re-implementing.
- **Punctuation:** hyphen `-`, never an em dash. Keep copy human and concise — not AI-sounding.
- Keep components small; the main screen lives in `app/page.tsx` and shared pieces in `components/`.

## Design system rules
Flow uses a **Mono Editorial** identity. Please keep contributions on-brand:

- **Colors:** white paper `#FFFFFF`, ink `#111111`, one accent — lime `#D6FF3F` (use the darker `#9CC400` on white backgrounds). Amber `#F59E0B` is for warnings/review only. Neutrals for secondary text/lines.
- **Borders:** 1.5px ink. **Radius:** 12px (small), 16px (large/buttons), pill for tags.
- **Layout:** big, bold, left-aligned headings; lots of whitespace; mobile-first.
- **Fonts (hard rule):**
  - Thai → **MiSans Thai** (the body default). Never style Thai with Space Grotesk.
  - Latin letters, numbers, time, `%`, arrows → **Space Grotesk** via the `.font-grotesk` class.
- The `flow_` wordmark is always lowercase with a lime underscore.

## Working with the AI endpoints
- All AI calls go through the official **Anthropic SDK** in `app/api/*/route.ts` (`lib/claude.ts` holds the client + model ids).
- Keep prompts in the route file; keep keys in env vars (`process.env.ANTHROPIC_API_KEY`).
- Structured responses use `output_config.format` with a JSON schema, validated by Zod after — keep both in sync when you change a shape.
- Every route degrades gracefully (fallback/fixture) so the demo never hard-fails.

## Reporting bugs & security
- **Bugs:** open an Issue with reproduction steps, expected vs actual, environment, and a screenshot/recording.
- **Security:** do **not** open a public Issue. Contact the maintainer privately so it can be fixed before disclosure.

Happy hacking — and thanks for helping people own their day. 💛
