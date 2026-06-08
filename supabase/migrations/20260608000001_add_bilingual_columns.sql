-- Add optional English content columns to merchants and gift_cards.
-- Spanish/default columns remain unchanged and required where they were.

alter table merchants
  add column if not exists description_en text;

alter table gift_cards
  add column if not exists title_en text,
  add column if not exists description_en text;
