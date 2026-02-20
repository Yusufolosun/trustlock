# Changelog

All notable changes to TrustLock will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Corrected deployment order in simnet plan — traits now deploys before escrow and factory (#2)
- Unignored `deployments/default.simnet-plan.yaml` so the canonical deployment plan is tracked in git
- Restricted `initialize-escrow` to factory-only calls — direct calls now return `ERR-NOT-FACTORY (u104)` (#1)
- Replaced `unwrap-panic` in `add-to-creator-list` with paginated storage — creators can now have unlimited escrows (#6)

### Added- Buyer and seller lookup maps to factory contract with paginated storage (#9)
- `get-buyer-escrows`, `get-seller-escrows`, `get-buyer-escrows-page`, `get-seller-escrows-page` read-only functions (#9)
- `get-buyer-info`, `get-seller-info` metadata functions for pagination (#9)
- 6 buyer/seller lookup tests (#9)\n- Escrow contract now declares `(impl-trait .trustlock-traits.escrow-trait)` for compiler-enforced trait compliance (#10)\n- `cancel-escrow` function in the escrow contract — buyer can cancel before funding (#4)
- Factory-level `cancel-escrow` — allows the original creator to cancel through the factory (#4)
- `STATUS-CANCELLED` terminal state
- Print events for all state transitions: `escrow-created`, `escrow-funded`, `escrow-released`, `escrow-refunded`, `escrow-cancelled` (#5)
- Event emissions documentation (`docs/events.md`) with field schemas and consumption examples (#5)
- 5 event verification tests validating print event payloads (#5)
- Paginated creator-escrow storage with `get-creator-escrows-page` and `get-creator-info` read-only functions (#6)
- Pagination overflow test (52 escrows across 2 pages) (#6)
- `MIN-ESCROW-AMOUNT` (u1000 / 0.001 STX) and `MAX-DEADLINE-BLOCKS` (u52560 / ~1 year) bounds (#7)
- `ERR-AMOUNT-TOO-LOW` (u304) and `ERR-DEADLINE-TOO-LONG` (u305) error codes (#7)
- 4 boundary tests: below min, at min, above max, at max (#7)
- Emergency pause mechanism: `pause()`, `unpause()`, `get-paused()` on both escrow and factory contracts (#8)
- `CONTRACT-OWNER` constant and `is-paused` data var for owner-gated circuit breaker (#8)
- `ERR-NOT-OWNER` (u105) and `ERR-CONTRACT-PAUSED` (u206) error codes (#8)
- 8 pause lifecycle tests: pause/unpause by owner, rejection by non-owner, blocks on all 4 operations, resume after unpause, read-only access during pause (#8)
- Emergency pause procedure documented in SECURITY.md (#8)

### Changed
- Updated `escrow-trait` to match multi-escrow implementation: `release(uint)`, `refund(uint)` now take escrow-id; removed `get-info` (read-only functions cannot be in traits) (#10)
- Hardened CI security scan: removed `|| true` from npm audit, added blocking `--audit-level=high` check, advisory-only moderate step, gitleaks secret scanning, and Clarinet static analysis (#11)
- Cached Clarinet binary in CI for faster runs (#11)
- Updated `.pre-commit-config.yaml` with detect-private-key, check-toml, gitleaks scanning, and pre-push test runner hook (#12)
- Updated CONTRIBUTING.md with accurate pre-commit setup instructions (#12)
- Replaced all raw `(err uXXX)` with named error constants in escrow and factory contracts (#3)
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
