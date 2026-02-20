# Changelog

All notable changes to TrustLock will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Corrected deployment order in simnet plan — traits now deploys before escrow and factory (#2)
- Unignored `deployments/default.simnet-plan.yaml` so the canonical deployment plan is tracked in git

### Changed
- Enabled strict analysis checker in Clarinet config
- Added deployment order validation step to CI pipeline

### Documentation
- Expanded deployment guide with dependency chain explanation
- Noted deployment order in README, quickstart, and contributing docs

## [0.1.0-alpha] - 2026-02-16

### Added
- Initial alpha release of TrustLock escrow system
- `trustlock-traits.clar`: Trait interface with 15 error codes
- `trustlock-escrow.clar`: Core escrow contract (224 lines)
  - Initialize escrow with buyer, seller, amount, deadline
  - Deposit function with CEI security pattern
  - Release function (seller authorization)
  - Permissionless refund after deadline
  - Read-only query functions
- `trustlock-factory.clar`: Factory contract for deployment
  - Create escrow instances
  - Registry tracking
  - Query functions for discovery
  - Batch queries for pagination
- Comprehensive test suite
  - 26 tests across 5 test files
  - 100% test pass rate
  - Clarinet v3 + Vitest framework
- Documentation
  - State machine specification
  - Error code reference
  - Test specifications (40+ planned cases)
  - Deployment guide
  - Contributing guidelines
  - Security policy
- CI/CD infrastructure
  - GitHub Actions workflow
  - Pre-commit hooks
  - Issue and PR templates

### Security
- CEI pattern implementation (reentrancy protection)
- Role-based authorization checks
- Block-height deadline enforcement
- State machine transition validation

### Known Limitations
- No formal security audit completed
- Not recommended for production use
- Testnet deployment only
- No dispute resolution mechanism
- No cancellation before funding

## [0.0.0] - 2026-02-16

### Added
- Initial repository setup
- Project structure
- Clarinet configuration

[Unreleased]: https://github.com/Yusufolosun/trustlock/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/Yusufolosun/trustlock/releases/tag/v0.1.0-alpha
[0.0.0]: https://github.com/Yusufolosun/trustlock/releases/tag/v0.0.0
