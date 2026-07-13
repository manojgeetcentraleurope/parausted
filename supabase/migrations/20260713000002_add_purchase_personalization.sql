ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS occasion TEXT NOT NULL DEFAULT 'just_because',
  ADD COLUMN IF NOT EXISTS font_style TEXT NOT NULL DEFAULT 'elegant';

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_occasion_check,
  ADD CONSTRAINT purchases_occasion_check CHECK (
    occasion IN (
      'birthday',
      'anniversary',
      'wedding',
      'thank_you',
      'congratulations',
      'christmas',
      'just_because'
    )
  ),
  DROP CONSTRAINT IF EXISTS purchases_font_style_check,
  ADD CONSTRAINT purchases_font_style_check CHECK (
    font_style IN ('elegant', 'modern', 'handwritten')
  );