# Contributing to TrustLock

Thank you for considering contributing to TrustLock! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, professional, and constructive in all interactions.

## Getting Started

### Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) v2.0+
- Node.js v18+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/Yusufolosun/trustlock.git
cd trustlock

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your network and deployer address

# Install pre-commit hooks
pip install pre-commit
pre-commit install
pre-commit install --hook-type pre-push   # enables test runner on push

# Verify setup
clarinet check
npm test
pre-commit run --all-files               # dry-run all hooks
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements
- `chore/` - Build/tooling changes

### 2. Make Changes

- Write clear, commented code
- Follow existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Test Locally

```bash
# Check contract syntax
clarinet check

# Run full test suite
npm test

# Run pre-commit hooks
pre-commit run --all-files
```

### 4. Commit Changes

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `test` - Test changes
- `refactor` - Code refactoring
- `chore` - Build/tooling
- `ci` - CI/CD changes

Examples:
```bash
git commit -m "feat(escrow): add cancellation function"
git commit -m "fix(factory): correct escrow counting logic"
git commit -m "docs: update deployment guide"
```

### 5. Push and Create PR

```bash
git push -u origin feature/your-feature-name
```

Open Pull Request on GitHub with:
- Clear title and description
- Link to related issues
- Test results
- Breaking changes (if any)

## Coding Standards

### Clarity Contracts

- **Line length**: Max 100 characters
- **Indentation**: 2 spaces
- **Line endings**: LF only (Unix style)
- **Comments**: Explain complex logic
- **Error codes**: Use defined constants from traits
- **New error codes**: Always define new error codes in `trustlock-traits.clar` first, then mirror them locally in the contract that needs them. Never use raw `(err uXXX)` — always reference named constants like `ERR-NOT-BUYER`.
- **Security**: Follow CEI pattern (Checks-Effects-Interactions)- **Trait compliance**: Any new escrow contract must declare `(impl-trait .trustlock-traits.escrow-trait)` and implement all functions defined in the trait (`deposit`, `release`, `refund`). Read-only functions cannot be part of the trait.- **Deployment order**: Contracts must be deployed in dependency order — traits first, then escrow, then factory. The simnet plan in `deployments/default.simnet-plan.yaml` reflects this. Never reorder it without understanding the dependency chain.

### TypeScript Tests

- **Style**: Follow existing test patterns
- **Coverage**: Aim for 95%+ coverage
- **Naming**: Descriptive test names
- **Structure**: Arrange-Act-Assert pattern

## Testing Requirements

All PRs must include:
- [ ] Unit tests for new functions
- [ ] Integration tests for workflows
- [ ] Edge case tests where applicable
- [ ] All existing tests passing

## Documentation Requirements

Update documentation for:
- New contract functions (inline comments)
- API changes (README)
- Configuration changes (deployment guide)
- Breaking changes (CHANGELOG)

## Review Process

1. Automated CI checks must pass
2. At least one maintainer approval required
3. No unresolved review comments
4. Branch up-to-date with main

## Security

- Never commit private keys, seeds, or secrets
- Report security issues privately (see SECURITY.md)
- Follow secure coding practices
- Validate all inputs

## Questions?

Open an issue for:
- Feature discussions
- Bug reports
- Documentation clarifications
- General questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
