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

## License

MIT
