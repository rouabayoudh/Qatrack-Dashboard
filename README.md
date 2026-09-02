# QATrack

Enterprise test management platform, built as a Turborepo monorepo.

## What's inside?

### Apps and Packages

- `apps/web` — [Next.js](https://nextjs.org/) app (App Router, Tailwind CSS, TypeScript). The frontend: dashboard, requirements, test cases, execution, reports.
- `apps/api` — [NestJS](https://nestjs.com/) backend (TypeScript). Handles Jira OAuth, auth (`qatrack_token` httpOnly cookie), and Jira sync.
- `packages/shared-types` — shared TypeScript types (e.g. `Requirement`), imported as `@qatrack/shared-types` by both apps.

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

## Prerequisites

- Node.js (see `.nvmrc` / `engines` field if present)
- A package manager (this repo assumes `npm`; swap for `pnpm`/`yarn` if that's what you use)
- `apps/web/.env.local` with at least:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```
- `apps/api/.env` with your Jira OAuth credentials and JWT secret (see `apps/api/.env.example` if present)

## Install

From the repo root:

```sh
npm install
```

## Run everything together

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
turbo dev
```

Without global `turbo`:

```sh
npx turbo dev
```

This starts both `apps/web` (default `http://localhost:3000`) and `apps/api` (default `http://localhost:3001`) in watch mode.

## Run the frontend alone

```sh
turbo dev --filter=web
```

or without global `turbo`:

```sh
npx turbo dev --filter=web
```

or directly, without turbo at all:

```sh
cd apps/web
npm run dev
```

The frontend expects `apps/api` to already be running (or reachable at `NEXT_PUBLIC_API_URL`) for auth and data — pages that call `/auth/me` will redirect to `/login` if the API isn't reachable.

## Run the backend alone

```sh
turbo dev --filter=api
```

or without global `turbo`:

```sh
npx turbo dev --filter=api
```

or directly, without turbo at all:

```sh
cd apps/api
npm run start:dev
```

`start:dev` runs the Nest app in watch mode (auto-restarts on file changes). Other useful Nest scripts, if defined in `apps/api/package.json`:

```sh
npm run start        # run once, no watch
npm run start:debug  # watch mode + inspector on port 9229
npm run build        # compile to dist/
```

## Build

To build all apps and packages:

```sh
turbo build
```

Build a specific package with a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

```sh
turbo build --filter=web
turbo build --filter=api
```

## Lint

```sh
turbo lint
turbo lint --filter=web
turbo lint --filter=api
```

## Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share build/test cache across machines and CI. By default, Turborepo caches locally only.

```sh
turbo login
turbo link
```

## Useful Links

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)