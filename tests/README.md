# TrustLock Test Suite

## Overview

Comprehensive test suite with 24+ test cases covering all contract functionality.

## Running Tests

```bash
# Run all tests
clarinet test

# Run specific test file
clarinet test --file tests/trustlock-escrow_test.ts

# Run with coverage
clarinet test --coverage
```

## Test Categories

### Traits Tests (`trustlock-traits_test.ts`)
- Error code definitions
- Constant uniqueness

### Escrow Tests (`trustlock-escrow_test.ts`)
- Initialization (3 tests)
- Deposit (3 tests)
- Release (3 tests)
- Refund (3 tests)

### Factory Tests (`trustlock-factory_test.ts`)
- Escrow creation (1 test)
- Creator tracking (1 test)
- Counter functionality (1 test)
- Full details query (1 test)

### Integration Tests (`trustlock-integration_test.ts`)
- Full successful flow (1 test)
- Full refund flow (1 test)
- Multiple concurrent escrows (1 test)

### Edge Cases (`trustlock-edge-cases_test.ts`)
- Non-existent escrow queries (1 test)
- Large amounts (1 test)
- Minimum deadlines (1 test)
- Refundable checks (1 test)
- Empty lists (1 test)

## Test Statistics

- **Total Test Cases**: 24+
- **Target Coverage**: 95%+
- **Test Files**: 5
- **Categories**: 8

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

| Contract | Functions | Target Coverage |
|----------|-----------|----------------|
| trustlock-traits | 0 (constants only) | N/A |
| trustlock-escrow | 9 | 95%+ |
| trustlock-factory | 11 | 95%+ |

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
