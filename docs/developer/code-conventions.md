# Code Conventions — ParaUsted

## TypeScript

- **Strict mode** always. No `any`. No `@ts-ignore` without comment explaining why.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Use `as const` for constant objects and enums.
- Export types from `src/types/` directory.

```typescript
// ✅ GOOD
interface Merchant {
  id: string;
  name: string;
  slug: string;
  amountCents: number;  // Always cents, never float
}

// ❌ BAD
type Merchant = any;
```

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `purchase-flow.tsx`, `create-voucher.ts` |
| Components | PascalCase | `GiftCardPreview`, `MerchantDashboard` |
| Functions | camelCase | `createPurchase`, `redeemVoucher` |
| Constants | UPPER_SNAKE_CASE | `MAX_VOUCHER_CODE_LENGTH`, `DEFAULT_VALID_DAYS` |
| Types/Interfaces | PascalCase | `Purchase`, `VoucherStatus` |
| Database columns | snake_case | `merchant_id`, `amount_cents`, `created_at` |
| API routes | kebab-case | `/api/gift-cards`, `/api/vouchers/[code]/redeem` |
| Environment variables | UPPER_SNAKE_CASE | `STRIPE_SECRET_KEY` |

## Money

```typescript
// ✅ ALWAYS use integer cents
const amountCents = 3500;  // €35.00
const displayAmount = (amountCents / 100).toFixed(2);  // "35.00"

// ❌ NEVER use floating point
const amount = 35.00;  // NO! Floating point errors
```

## Database Queries

```typescript
// ✅ GOOD — merchant_id from auth session
const { data: { user } } = await supabase.auth.getUser();
const merchantId = user?.app_metadata?.merchant_id;

const { data } = await supabase
  .from('vouchers')
  .select('*')
  .eq('merchant_id', merchantId);  // RLS also enforces this

// ❌ BAD — merchant_id from request
const { merchantId } = req.body;  // ATTACKER CONTROLS THIS
```

## Error Handling

```typescript
// ✅ GOOD — generic error to client, detailed log server-side
try {
  const result = await redeemVoucher(code, amountCents);
  return NextResponse.json(result);
} catch (error) {
  console.error('[redeem] Failed:', {
    requestId,
    merchantId,
    error: error instanceof Error ? error.message : 'Unknown',
  });
  return NextResponse.json(
    { error: 'Unable to process redemption' },
    { status: 400 }
  );
}

// ❌ BAD — leaking internal details
return NextResponse.json(
  { error: `Voucher PU-A7F3-K9P2-X8Q1 not found in merchants table` },
  { status: 404 }
);
```

## Component Structure

```typescript
// ✅ Standard component structure
'use client';  // Only if client interactivity needed

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GiftCard } from '@/types';

interface GiftCardPreviewProps {
  card: GiftCard;
  onSelect: (id: string) => void;
}

export function GiftCardPreview({ card, onSelect }: GiftCardPreviewProps) {
  // hooks first
  const [isLoading, setIsLoading] = useState(false);

  // handlers
  const handleSelect = () => {
    setIsLoading(true);
    onSelect(card.id);
  };

  // early returns for edge cases
  if (!card.active) return null;

  // render
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{card.title}</h3>
      <p className="text-sm text-gray-600">{card.description}</p>
      <Button onClick={handleSelect} disabled={isLoading}>
        {isLoading ? 'Selecting...' : 'Select'}
      </Button>
    </div>
  );
}
```

## Import Order

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { NextResponse } from 'next/server';

// 2. External libraries
import { z } from 'zod';
import Stripe from 'stripe';

// 3. Internal libraries
import { createClient } from '@/lib/supabase/server';
import { createAuditEvent } from '@/lib/audit';

// 4. Components
import { Button } from '@/components/ui/button';
import { GiftCardPreview } from '@/components/gift-card/preview';

// 5. Types
import type { Purchase, Voucher } from '@/types';
```
