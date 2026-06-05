# ADR-004: 5-Layer Personalization as Legal Shield

## Status: Accepted

## Context
EU Directive 2011/83 grants buyers a 14-day withdrawal right for online purchases. This could expose ParaUsted to refund obligations.

## Decision
Make personalization MANDATORY on every gift card (5 layers: relationship type, design template, recipient name, sender name, personal message). This qualifies for the EU "personalized goods" exemption from the withdrawal right.

## Consequences
- ✅ Legal protection: two independent exemptions (personalized goods + digital content consent)
- ✅ Better UX: personalization makes the gift feel special, not transactional
- ✅ Higher perceived value → higher conversion rates
- ⚠️ Must ensure all 5 fields are truly REQUIRED, not optional
- ⚠️ Must store personalization data as legal evidence in purchases table
