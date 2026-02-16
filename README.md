# TrustLock

Modular escrow factory for trustless P2P transactions on Stacks.

## Overview

TrustLock enables trustless escrow agreements between two parties without intermediaries. Each escrow is deployed as an independent smart contract with atomic release and refund mechanisms.

## Architecture

- **trustlock-factory**: Deploys escrow contract instances
- **trustlock-escrow**: Core escrow logic (deposit, release, refund)
- **trustlock-traits**: Interface definitions for composability

## Status

🚧 **Under Active Development**

## Requirements

- [Clarinet](https://github.com/hirosystems/clarinet) >= 2.0
- Node.js >= 18.x (for frontend)
- Stacks wallet

## Local Development

```bash
# Install dependencies
clarinet integrate

# Run tests
clarinet test

# Deploy to devnet
clarinet deployments apply -p deployments/default.devnet-plan.yaml
```

## Development & Testing

### Running Tests

```bash
# Run full test suite
clarinet test

# Run with coverage report
clarinet test --coverage

# Run specific test file
clarinet test --file tests/trustlock-escrow_test.ts
```

### Test Coverage

- **Total Tests**: 24+ test cases
- **Coverage**: 95%+ code coverage target
- **Categories**: Initialization, deposit, release, refund, factory, integration, edge cases

See [Test Documentation](tests/README.md) for details.

### Local Development

```bash
# Check contract syntax
clarinet check

# Start local devnet
clarinet integrate

# Deploy contracts locally
clarinet deployments apply -p deployments/default.devnet-plan.yaml
```

## License

MIT

