# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit tests. There is no
Vitest config file — tests run against the default Node environment, which is
ideal for the pure TypeScript logic that lives in `src/lib`.

> More contributors will write tests if the process is documented. This guide
> covers how to run tests, where to put them, and how to mock Freighter and the
> API layer.

---

## Running tests

| Command | What it does |
| --- | --- |
| `npm test` | Runs the currently wired-up suite (`src/lib/utils/index.test.ts`) in CI mode (no watch). |
| `npx vitest run` | Runs **every** `*.test.ts` file once. Use this after adding a new test file. |
| `npx vitest` | Watch mode for local development — re-runs the affected tests on save. |
| `npx vitest run src/lib/utils/index.test.ts` | Runs a single test file. |

`npm test` is intentionally scoped to the `src/lib/utils` suite today. When you
add a new test file, run it directly (`npx vitest run <path>`) or run the whole
suite with `npx vitest run`.

There is no coverage tooling or test runner config committed at this time, so
`--coverage` and custom `environment`/`setupFiles` options are not available out
of the box.

---

## Where test files live and how to name them

- **Co-locate tests with the code they cover.** A test for
  `src/lib/utils/index.ts` lives at `src/lib/utils/index.test.ts`; a test for
  `src/lib/stellar/freighter.ts` lives at `src/lib/stellar/freighter.test.ts`.
  This is the existing convention in the repo — follow it.
- **Suffix:** use `*.test.ts`. Vitest also matches `*.spec.ts`, but `*.test.ts`
  is what the repo already uses.
- **Keep them TypeScript.** No `.js`/`.jsx` tests.

Example layout:

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── services.ts
│   │   └── services.test.ts        ← test next to the code
│   ├── stellar/
│   │   ├── freighter.ts
│   │   └── freighter.test.ts
│   └── utils/
│       ├── index.ts
│       └── index.test.ts           ← existing example
```

---

## Example: unit test for a util

A test is just a plain TypeScript file that imports the function under test
using a **relative path** (see the note on path aliases below) and asserts on its
output with `describe` / `it` / `expect`.

Given this function in `src/lib/utils/index.ts`:

```ts
export function formatRetentionCountdown(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Ready to unlock';
  if (daysRemaining === 1) return '1 day remaining';
  if (daysRemaining < 7) return `${daysRemaining} days remaining`;
  const weeks = Math.floor(daysRemaining / 7);
  const days = daysRemaining % 7;
  if (days === 0) return `${weeks}w remaining`;
  return `${weeks}w ${days}d remaining`;
}
```

Place the test beside it at `src/lib/utils/index.test.ts` (or a new
`src/lib/utils/format.test.ts`):

```ts
import { describe, expect, it } from 'vitest';

import { formatRetentionCountdown } from './index';

describe('formatRetentionCountdown', () => {
  it('reports ready when no days remain', () => {
    expect(formatRetentionCountdown(0)).toBe('Ready to unlock');
    expect(formatRetentionCountdown(-3)).toBe('Ready to unlock');
  });

  it('uses a singular label for one day', () => {
    expect(formatRetentionCountdown(1)).toBe('1 day remaining');
  });

  it('formats under a week in days and a week or more in weeks', () => {
    expect(formatRetentionCountdown(5)).toBe('5 days remaining');
    expect(formatRetentionCountdown(14)).toBe('2w remaining');
    expect(formatRetentionCountdown(16)).toBe('2w 2d remaining');
  });
});
```

Run it with `npx vitest run src/lib/utils/index.test.ts`.

---

## Mocking Freighter

All Freighter access goes through the wrappers in `src/lib/stellar/freighter.ts`,
which in turn call the `@stellar/freighter-api` package. Mock the package with
`vi.mock` so tests never touch a real browser extension or the network. Because
`@stellar/freighter-api` is a bare package name, the mock works without any path
aliasing.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the package BEFORE importing the module under test.
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  requestAccess: vi.fn(),
  // watchWallet() constructs this class and calls watch()/stop() on it.
  WatchWalletChanges: vi.fn(() => ({ watch: vi.fn(), stop: vi.fn() })),
}));

import * as freighterApi from '@stellar/freighter-api';

import { getUserAddress, isFreighterInstalled, signTx } from './freighter';

const freighter = vi.mocked(freighterApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('freighter wrappers', () => {
  it('returns the address when Freighter responds without an error', async () => {
    freighter.getAddress.mockResolvedValue({
      address: 'GABCDEF...',
      error: undefined,
    } as never);

    await expect(getUserAddress()).resolves.toBe('GABCDEF...');
  });

  it('throws when Freighter returns an error', async () => {
    freighter.getAddress.mockResolvedValue({
      address: '',
      error: 'User rejected the request',
    } as never);

    await expect(getUserAddress()).rejects.toThrow('User rejected the request');
  });

  it('reports not-installed when isConnected throws', async () => {
    freighter.isConnected.mockRejectedValue(new Error('no extension'));

    await expect(isFreighterInstalled()).resolves.toBe(false);
  });

  it('returns the signed XDR from signTransaction', async () => {
    freighter.signTransaction.mockResolvedValue({
      signedTxXdr: 'AAAA...',
      error: undefined,
    } as never);

    await expect(signTx('xdr', 'Test SDF Network ; September 2015')).resolves.toBe(
      'AAAA...',
    );
  });
});
```

Tips:

- Mock the package for the **whole file** with a top-level `vi.mock(...)`. Vitest
  hoists it above the imports, so the module under test receives the fake.
- `vi.mocked(module)` gives you typed access to the mock functions for setting
  return values and asserting calls.
- `signNonce()` dynamically imports `@stellar/stellar-sdk`. If you exercise it,
  rely on the real SDK (it needs no browser), or mock that package too.

---

## Mocking the API layer

The typed API functions in `src/lib/api/services.ts` call the shared
`apiClient` (an axios instance) exported from `src/lib/api/client.ts`. The
cleanest way to test a service function is to replace that module with a fake
whose methods return the shapes the service expects (the backend wraps payloads
in `{ data: ... }`).

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Replace the axios instance with simple mocks.
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from './client';

import { authApi } from './services';

const client = vi.mocked(apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authApi.getNonce', () => {
  it('requests the nonce for an address and unwraps the payload', async () => {
    client.get.mockResolvedValue({ data: { data: { nonce: 'nonce-123' } } } as never);

    await expect(authApi.getNonce('GABCDEF...')).resolves.toBe('nonce-123');

    expect(client.get).toHaveBeenCalledWith('/auth/nonce?address=GABCDEF...');
  });
});
```

Notes:

- Mock `./client` (a **relative** path) so the mock resolves to the same module
  that `services.ts` imports. See the alias caveat below.
- Matching the response envelope matters: services read `response.data.data`, so
  return `{ data: { data: <payload> } }`.
- To simulate a failure, make the mock reject:
  `client.get.mockRejectedValue(new Error('500'))`.
- Prefer this module-mock approach over hitting the network. No extra
  dependencies (MSW, etc.) are required.

---

## Caveats worth knowing

- **Path aliases don't resolve in tests.** `tsconfig.json` defines `@/*` →
  `./src/*`, but no Vite/Vitest config registers it and `vite-tsconfig-paths` is
  not installed. Import from tests using **relative paths**
  (`./index`, `./client`, `../stellar/freighter`) — as the existing test does.
  Type-only imports (e.g. `@/types`) are erased at compile time and are fine.
- **No DOM environment.** Vitest runs in the default Node environment and
  `jsdom`/`happy-dom` and Testing Library are not installed, so `document`,
  `window`, and `localStorage` are undefined. The current suites test pure
  logic/adapters and mock any browser APIs. Component/DOM tests would require
  adding a DOM environment and a Vitest config first.
- **Mock, don't call out.** Freighter and the backend must never be reached from
  tests — always mock `@stellar/freighter-api` and the API client.
