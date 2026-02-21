# TrustLock

[![CI Status](https://github.com/Yusufolosun/trustlock/workflows/TrustLock%20CI/badge.svg)](https://github.com/Yusufolosun/trustlock/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/release/Yusufolosun/trustlock?include_prereleases)](https://github.com/Yusufolosun/trustlock/releases)

Modular escrow factory for trustless P2P transactions on Stacks.

## ⚠️ Alpha Release Notice

**Current Version**: v0.1.0-alpha

This is an **alpha release** for testing and feedback. **NOT recommended for production use** until security audit is complete.

- ✅ Use on testnet
- ❌ Do not use for high-value transactions
- ⏳ Security audit pending

## Overview

TrustLock enables trustless escrow agreements between two parties without intermediaries. Each escrow is deployed as an independent smart contract with atomic release and refund mechanisms.

### Key Features

- 🔒 **Trustless**: No intermediary needed
- 🏭 **Factory Pattern**: Deploy unlimited escrow instances
- 🔐 **Secure**: CEI pattern, authorization checks, state machine
- ⛽ **Gas Efficient**: Optimized for low transaction costs
- 🧪 **Well Tested**: 121 tests, 100% pass rate
- 📚 **Documented**: Comprehensive docs and guides

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Yusufolosun/trustlock.git
cd trustlock
npm install

# Run tests
npm test

# Deploy locally
clarinet integrate
```

👉 **Full tutorial**: [Quick Start Guide](docs/quickstart.md)

## Architecture

### Contracts

> **Deployment order matters**: traits → escrow → factory. The trait definition must exist on-chain before any contract that implements it.

**trustlock-traits.clar**
- Escrow trait interface
- 15 error codes across 4 categories

**trustlock-escrow.clar** (224 lines)
- Core escrow logic
- Deposit, release, refund functions
- Read-only queries

**trustlock-factory.clar** (~250 lines)
- Deploy escrow instances
- Registry and tracking
- Paginated per-creator escrow storage (50 IDs per page, unlimited pages)
- Batch queries for pagination

### State Machine

```
CREATED → FUNDED → RELEASED
            ↓
         REFUNDED
```

- **CREATED**: Awaiting buyer deposit
- **FUNDED**: Funds locked, awaiting seller release or deadline
- **RELEASED**: Funds transferred to seller (terminal)
- **REFUNDED**: Funds returned to buyer (terminal)

See [State Machine Documentation](docs/state-machine.md) for details.

### Security Patterns

- **CEI Pattern**: Checks-Effects-Interactions (reentrancy protection)
- **Authorization**: Role-based function access
- **Deadline Enforcement**: Block-height based (deterministic)
- **State Validation**: Strict transition rules

See [Security Policy](SECURITY.md) for details.

## Usage Example

```clarity
;; 1. Create escrow (via factory)
(contract-call? .trustlock-factory create-escrow
  'ST1... ;; buyer
  'ST2... ;; seller
  u1000000 ;; 1 STX
  u100) ;; 100 blocks deadline
;; Returns: (ok u0)  <- escrow-id

;; 2. Buyer deposits
(contract-call? .trustlock-escrow deposit u0)
;; Returns: (ok true)

;; 3. Seller releases funds
(contract-call? .trustlock-escrow release u0)
;; Returns: (ok true)
```

## Gas Costs (Estimated)

| Operation | Cost | Notes |
|-----------|------|-------|
| Create escrow | ~0.01 STX | Via factory |
| Deposit | ~0.01-0.015 STX | Buyer deposits funds |
| Release | ~0.008-0.012 STX | Seller receives funds |
| Refund | ~0.008-0.012 STX | After deadline |
| Queries | ~0.001 STX | Read-only functions |

## Development

### Requirements

- [Clarinet](https://github.com/hirosystems/clarinet) >= 2.0
- Node.js >= 18
- npm >= 9

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Check contracts
clarinet check

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Testing

**Test Suite**: 121 tests across 6 files

- ✅ Trait compliance and error codes (30)
- ✅ Core escrow functions and events (51)
- ✅ Factory creation, lookups, pagination (11)
- ✅ End-to-end integration flows (3)
- ✅ Boundary values and edge cases (9)
- ✅ Stress and concurrency (17)

See [Test Documentation](tests/README.md) for details.

### Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Code standards
- Testing requirements
- Commit conventions
- PR process

## Documentation

- [Quick Start Guide](docs/quickstart.md) - Get started in 10 minutes
- [State Machine](docs/state-machine.md) - State transitions and rules
- [Error Codes](docs/error-codes.md) - Complete error reference
- [Test Specifications](docs/test-specifications.md) - Test case definitions
- [Deployment Guide](docs/deployment-guide.md) - Devnet/testnet/mainnet deployment
- [Security Policy](SECURITY.md) - Security considerations and disclosure

## Roadmap

### Phase 1: Foundation ✅ (v0.1.0-alpha)
- [x] Core escrow contract
- [x] Factory contract
- [x] Test suite (121 tests)
- [x] Documentation
- [x] CI/CD infrastructure

### Phase 2: Security 🔄 (v0.2.0-beta)
- [ ] Professional security audit
- [ ] Testnet deployment
- [ ] Bug bounty program
- [ ] Gas optimization review

### Phase 3: Production 📅 (v1.0.0)
- [ ] Mainnet deployment
- [ ] Frontend interface
- [ ] User documentation
- [ ] Support infrastructure

### Future Enhancements
- [ ] Multi-party escrows
- [ ] Milestone-based payments
- [ ] Dispute resolution mechanism
- [ ] Escrow templates

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Yusufolosun/trustlock/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Yusufolosun/trustlock/discussions)
- **Security**: See [SECURITY.md](SECURITY.md)

## Acknowledgments

Built with:
- [Clarinet](https://github.com/hirosystems/clarinet) - Stacks development environment
- [Stacks](https://www.stacks.co/) - Bitcoin L2 blockchain
- [Clarity](https://clarity-lang.org/) - Smart contract language

---

**Status**: Alpha Release (v0.1.0-alpha)
**Network**: Testnet Only
**Security Audit**: Pending
**Production Ready**: No
