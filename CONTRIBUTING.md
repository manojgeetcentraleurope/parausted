# Contributing to ParaUsted

## Branch Naming

```
feat/short-description     → New feature
fix/short-description      → Bug fix
chore/short-description    → Maintenance, deps, config
docs/short-description     → Documentation only
test/short-description     → Test additions/fixes
refactor/short-description → Code restructuring
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add purchase flow for offline Bizum payments
fix: prevent double redemption via row locking
chore: update Stripe SDK to v15
docs: add API contract for voucher endpoints
test: add E2E test for merchant onboarding
refactor: extract ledger entry creation into shared function
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with clear, atomic commits
3. Ensure all checks pass: `npm run lint && npm run typecheck && npm run test`
4. Create PR with descriptive title (same format as commit message)
5. PR description should include: What changed, Why, How to test
6. Squash merge to `main`

## Code Review Checklist

Before approving any PR, verify:

- [ ] `merchant_id` comes from JWT/auth session, never from request body
- [ ] All monetary amounts are in integer cents
- [ ] New tables have RLS policies
- [ ] State changes create `audit_event` records
- [ ] No PII in log statements (emails/phones masked)
- [ ] No `service_role` key in client-side code
- [ ] Zod validation on all API inputs
- [ ] Error messages are generic to client
- [ ] Tests cover happy path + failure cases

## Definition of Done

A task is "done" when:

- [ ] Code compiles with zero TypeScript errors
- [ ] ESLint passes with zero warnings
- [ ] Unit tests pass
- [ ] Manual testing confirms feature works
- [ ] Audit events are created for state changes
- [ ] No security rules violated (see copilot-instructions.md)
- [ ] Merged to `main` and deployed via Vercel
