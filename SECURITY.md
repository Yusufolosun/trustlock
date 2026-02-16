# Security Policy

## Supported Versions

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 0.1.x   | :white_check_mark: | Alpha  |
| < 0.1   | :x:                | Development |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

### Private Disclosure

Please report security vulnerabilities privately:

1. **Email**: Create a private disclosure via GitHub Security Advisories
2. **Details to include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix timeline**: Depends on severity
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium: 30-60 days
  - Low: 60-90 days

## Security Considerations

### Smart Contract Security

TrustLock implements multiple security patterns:

1. **Checks-Effects-Interactions (CEI)**
   - All state changes before external calls
   - Prevents reentrancy attacks

2. **Authorization Checks**
   - Buyer/seller role verification
   - Function-level access control

3. **State Machine Enforcement**
   - Strict state transition rules
   - Prevents invalid state changes

4. **Deadline Enforcement**
   - Block-height based deadlines
   - Deterministic refund conditions

### Known Limitations

**Alpha Release Limitations**:
- No formal security audit completed
- Not recommended for large value transactions
- Use on testnet only until audit

**By Design**:
- Refunds are permissionless after deadline
- No dispute resolution mechanism
- No cancellation before funding
- Fixed deadline (cannot be extended)

### Audit Status

| Area | Status | Notes |
|------|--------|-------|
| Smart Contracts | ⏳ Pending | Awaiting professional audit |
| Test Coverage | ✅ Complete | 26 tests, 100% pass rate |
| Documentation | ✅ Complete | Architecture and security docs |
| Deployment | ⏳ Pending | Testnet deployment planned |

## Best Practices for Users

### Using TrustLock Securely

1. **Start Small**: Test with minimal amounts first
2. **Verify Addresses**: Double-check buyer/seller addresses
3. **Understand Deadlines**: Know when refunds become available
4. **Use Testnet**: Practice on testnet before mainnet
5. **Monitor Transactions**: Track your escrows actively

### What to Avoid

- ❌ Using for high-value transactions (until audit)
- ❌ Trusting unverified contract deployments
- ❌ Sending funds to wrong addresses
- ❌ Ignoring deadline windows

## Disclosure Policy

Once a vulnerability is fixed:

1. Credit will be given to reporter (if desired)
2. Details published in CHANGELOG
3. CVE requested for critical issues
4. Users notified via GitHub releases

## Security Updates

Subscribe to:
- GitHub Security Advisories
- Release notifications
- Project announcements

## Contact

Security-related questions: Use GitHub Security Advisories

General questions: Open a public issue
