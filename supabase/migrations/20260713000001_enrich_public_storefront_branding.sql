-- Add visual storefront data for the existing demo tenants.
-- These updates are intentionally idempotent and safely no-op when a tenant
-- is not present in a given environment.

UPDATE public.merchants
SET
    description = COALESCE(
        description,
        'Experiencias privadas en Sevilla, creadas por guías locales y adaptadas a cada viajero.'
    ),
    description_en = COALESCE(
        description_en,
        'Private Seville experiences created by local guides and tailored to every traveller.'
    ),
    cover_image_url = 'https://images.unsplash.com/photo-1559564477-6e8582270002?auto=format&fit=crop&w=1800&q=85',
    brand_color = '#b85c2e'
WHERE id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
  AND slug = 'seville-tours-co';

UPDATE public.merchants
SET
    description = 'Barbería contemporánea en el centro de Sevilla. Corte, navaja y ritual sin prisas.',
    description_en = 'A contemporary barbershop in central Seville. Cut, razor and unhurried ritual.',
    cover_image_url = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1800&q=85',
    brand_color = '#b78a3d'
WHERE slug = 'barbercarlos';