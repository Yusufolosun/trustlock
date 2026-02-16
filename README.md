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

## Architecture Details

### Trait-Based Design

TrustLock uses Clarity traits for maximum composability:

```clarity
(define-trait escrow-trait
  (
    (deposit (uint) (response bool uint))
    (release () (response bool uint))
    (refund () (response bool uint))
    (get-info () (response {...} uint))
  )
)
```

Any contract implementing this trait can be deployed by the factory and interact with the ecosystem.

### State Machine

Escrows follow a simple, secure state machine:

```
CREATED → FUNDED → RELEASED
            ↓
         REFUNDED
```

See [State Machine Documentation](docs/state-machine.md) for detailed transition rules.

### Error Handling

All functions return typed errors with specific codes for debugging:
- **100-199**: Authorization errors
- **200-299**: State errors
- **300-399**: Validation errors
- **400-499**: Execution errors

Full error reference: [Error Codes Documentation](docs/error-codes.md)

## Testing

Comprehensive test specifications defined for Phase 5 implementation:
- 40+ unit tests across all functions
- Edge case coverage
- Security-focused tests
- Target: 95% code coverage

See [Test Specifications](docs/test-specifications.md) for details.

## License

MIT
