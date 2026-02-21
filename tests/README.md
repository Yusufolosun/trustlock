# TrustLock Test Suite

## Overview

Comprehensive test suite with **121 tests** across 6 files covering all contract functionality,
error codes, stress scenarios, and edge cases.

## Framework

- **Test Runner**: [Vitest](https://vitest.dev/) v4
- **Blockchain Simulator**: [@hirosystems/clarinet-sdk](https://github.com/hirosystems/clarinet) v3
- **Clarity Helpers**: `@stacks/transactions` (Cl, ClarityType)

> Tests run against a fresh simnet instance per test — state does not carry over between `it()` blocks.

## Running Tests

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- tests/trustlock-escrow.test.ts

# Run with verbose output
npx vitest run --reporter=verbose

# Run with coverage
npm test -- --coverage
```

## Test Categories

### Traits Tests (`trustlock-traits.test.ts`) — 30 tests

- Deployment verification (2 tests)
- Authorization error codes: u100–u105 (5 tests)
- State error codes: u200–u206 (5 tests)
- Validation error codes: u300–u305 (4 tests)
- Execution error codes: u400 (1 test)
- Error range integrity and uniqueness (6 tests)
- Escrow trait interface and compliance (6 tests)
- End-to-end trait method verification (1 test)

### Escrow Tests (`trustlock-escrow.test.ts`) — 51 tests

- Initialization (5 tests)
- Deposit (4 tests)
- Release (3 tests)
- Refund (3 tests)
- Cancellation (6 tests)
- Event emissions (5 tests)
- Emergency pause (8 tests)
- Deposit advanced (2 tests)
- Release advanced (1 test)
- Refund advanced (2 tests)
- State transitions (5 tests)
- Get-info state reads (4 tests)
- Security: CEI and atomicity (2 tests)
- Factory-escrow ID sync (1 test)

### Factory Tests (`trustlock-factory.test.ts`) — 11 tests

- Escrow creation (1 test)
- Creator tracking (1 test)
- Counter functionality (1 test)
- Full details query (1 test)
- Pagination (1 test)
- Buyer/seller lookups (6 tests)

### Integration Tests (`trustlock-integration.test.ts`) — 3 tests

- Full successful flow via factory (1 test)
- Full refund flow via factory (1 test)
- Multiple concurrent escrows with state isolation (1 test)

### Edge Case Tests (`trustlock-edge-cases.test.ts`) — 9 tests

- Non-existent escrow queries (1 test)
- Large amounts (1 test)
- Minimum deadlines (1 test)
- Refundable status checks (1 test)
- Empty lists (1 test)
- Amount and deadline boundary validation (4 tests)

### Stress Tests (`trustlock-stress.test.ts`) — 17 tests

- Bulk creation: 30 sequential escrows (2 tests)
- Independent state verification (2 tests)
- Interleaved operations (4 tests)
- Concurrent lifecycle: release and refund cycles (3 tests)
- Creator list scaling (2 tests)
- Multi-creator stress and isolation (2 tests)
- Rapid state transitions (2 tests)

## Test Statistics

| File | Tests | Focus |
|------|------:|-------|
| `trustlock-traits.test.ts` | 30 | Error codes, trait interface |
| `trustlock-escrow.test.ts` | 51 | Core escrow functions, events, pause, security |
| `trustlock-factory.test.ts` | 11 | Factory creation, lookups, pagination |
| `trustlock-integration.test.ts` | 3 | End-to-end flows |
| `trustlock-edge-cases.test.ts` | 9 | Boundary values, empty states |
| `trustlock-stress.test.ts` | 17 | Bulk creation, concurrent ops, scaling |
| **Total** | **121** | |

- **Pass Rate**: 100%
- **Test Files**: 6
- **Categories**: 12+

## Writing New Tests

Tests use **Vitest** with **@hirosystems/clarinet-sdk v3**. The `simnet` global
is injected automatically — no manual chain setup needed.

```typescript
import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

describe("My Feature", () => {
    it("creates an escrow and verifies its status", () => {
        // Call a public function
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeOk(expect.anything());

        // Call a read-only function
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("CREATED"));
    });
});
```

Key patterns:
- `simnet.callPublicFn(contract, function, args, sender)` — mutating calls
- `simnet.callReadOnlyFn(contract, function, args, caller)` — read-only queries
- `simnet.mineEmptyBlocks(n)` — advance block height for deadline testing
- `Cl.uint()`, `Cl.principal()`, `Cl.stringAscii()` — Clarity value constructors
- `expect(result).toBeOk(...)` / `expect(result).toBeErr(...)` — Clarity response matchers

## Coverage Goals

| Contract | Functions | Tests | Target Coverage |
|-----------|-----------|-------|-----------------|
| trustlock-traits | 0 (constants + trait) | 30 | N/A |
| trustlock-escrow | 9 | 51 | 95%+ |
| trustlock-factory | 11 | 11 | 95%+ |

## CI Integration

Tests run automatically on every push and PR via GitHub Actions:

```yaml
- name: Run tests
  run: npm test
```
