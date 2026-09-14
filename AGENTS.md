# Repository Guidelines

## Project Structure & Module Organization

OVEC Mapping is a Thai-language certificate-to-course discovery application built with React, TypeScript, and vinext on Cloudflare Workers.

- `app/`: catch-all page/API routes, layout, authentication, and global CSS.
- `components/`: learner portal, mapping views, and staff workflows.
- `lib/`: matching algorithms, policy, source adapters, and artifact registries.
- `db/` and `drizzle/`: D1 schema, database helpers, and SQL migrations; `worker/` contains the Worker entrypoint.
- `tests/`: unit tests and fixtures; `scripts/`: integration checks and data-processing tools.
- `public/`: assets and generated mapping datasets; `docs/`: design, evidence, and workflow specifications.

## Build, Test, and Development Commands

Use Node.js 22.13 or newer.

- `npm ci`: install locked dependencies.
- `cp .env.example .env.local`: initialize local configuration.
- `npm run dev`: start development at `http://localhost:3000`.
- `npm run build` / `npm start`: build and serve production output locally.
- `npm run check`: run TypeScript checks, ESLint, unit tests, and production build.
- `npm run db:generate`: generate migrations after schema changes; inspect SQL before applying.
- `npm run bulk:verify`: validate generated bulk artifacts.

## Coding Style & Naming Conventions

Follow existing two-space indentation, double quotes, semicolons, and trailing commas. Use strict TypeScript, explicit domain types, PascalCase components/types, camelCase functions, and kebab-case module filenames. Use `@/` for root imports where appropriate. ESLint uses Next.js Core Web Vitals and TypeScript rules. Keep learner-facing text clear and in Thai.

## Testing Guidelines

Unit tests use `node:test` and `node:assert/strict`, executed through `tsx`. Name files `tests/*.test.ts`; run `npm test`. No numeric coverage threshold is configured. Cover changed policy, matching, and authorization behavior with meaningful regression cases.

For learner/API changes, run the relevant `scripts/test-*.mjs` against a local server with `LOCAL_TEST_KEY` configured in `.dev.vars`. These scripts create local test records; never target production.

## Commit & Pull Request Guidelines

History uses imperative, descriptive subjects such as “Add learner portal…” and “Remove matching percentages…”. Keep commits focused. PRs should explain the behavior change, validation results, related issues when applicable, and migration or dataset impacts. Include screenshots for visible UI changes.

## Domain & Configuration Rules

Prioritize source-document evidence; automated matches remain proposals requiring expert review. Hide matching percentages in learner screens and printouts. Preserve private-document ownership checks. Keep secrets and local authentication overrides out of hosted configuration and Git. Read the relevant `docs/` specification before changing matching or review behavior.
