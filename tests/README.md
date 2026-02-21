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

Follow this pattern:

```typescript
Clarinet.test({
    name: "Category: Description",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        // Setup
        const account = accounts.get('wallet_1')!;

        // Execute
        let block = chain.mineBlock([
            Tx.contractCall(...)
        ]);

        // Assert
        block.receipts[0].result.expectOk();

        // Verify state
        let status = chain.callReadOnlyFn(...);
        assertEquals(status.result, expected);
    },
});
```

## Coverage Goals

| Contract          | Functions          | Target Coverage |
| ----------------- | ------------------ | --------------- |
| trustlock-traits  | 0 (constants only) | N/A             |
| trustlock-escrow  | 9                  | 95%+            |
| trustlock-factory | 11                 | 95%+            |

## CI Integration

Tests run automatically on:

- Every commit to feature branches
- Pull requests to main
- Pre-deployment checks

```yaml
# Example GitHub Actions
- name: Run Clarinet tests
  run: clarinet test --coverage
```
