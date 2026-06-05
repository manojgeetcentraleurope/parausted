# ADR-005: Next.js (App Router) Over React + Vite SPA

## Status: Accepted

## Context
The public gift card page needs to render properly when shared on WhatsApp and Instagram (OG meta tags). SEO matters for city discovery pages.

## Decision
Next.js with App Router on Vercel. Server-side rendering for public pages. Client components only where interactivity is needed.

## Consequences
- ✅ SSR: WhatsApp shows beautiful preview when gift card link is shared
- ✅ SEO: Google indexes merchant pages instantly
- ✅ API routes in same codebase (no separate backend)
- ✅ Vercel: best-in-class DX, preview deployments per PR
- ⚠️ Slightly more complex than a pure SPA
- ⚠️ Vercel can get expensive at high bandwidth (mitigate with Cloudflare CDN)
