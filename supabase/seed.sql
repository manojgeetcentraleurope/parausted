-- ParaUsted Seed Data — Development Only
-- Run: supabase db reset (this runs after all migrations)

-- Test Merchant 1: Barber Carlos
INSERT INTO merchants (id, auth_user_id, name, slug, category, description, description_en, cover_image_url, brand_color, email, phone, address, city, bizum_phone, bank_iban, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Glamour Barbería',
    'barbercarlos',
    'barber',
    'Barbería contemporánea en el centro de Sevilla. Corte, navaja y ritual sin prisas.',
    'A contemporary barbershop in central Seville. Cut, razor and unhurried ritual.',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1800&q=85',
    '#b78a3d',
    'carlos@test.parausted.es',
    '+34612345678',
    'Calle Sierpes 42, Sevilla',
    'Sevilla',
    '+34612345678',
    'ES1234567890123456789012',
    'active'
);

-- Test Merchant 2: Restaurant María
INSERT INTO merchants (id, auth_user_id, name, slug, category, email, phone, address, city, bizum_phone, status)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000002',
    'Restaurante María',
    'restaurantemaria',
    'restaurant',
    'maria@test.parausted.es',
    '+34698765432',
    'Avenida de la Constitución 15, Sevilla',
    'Sevilla',
    '+34698765432',
    'active'
);

INSERT INTO gift_cards (id, merchant_id, card_type, title, title_en, description, description_en, amount_cents, min_amount_cents, max_amount_cents, valid_days, voucher_code_prefix, sort_order, active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'service', 'Corte de autor', 'Signature Cut', 'Diagnóstico, lavado, corte a medida y acabado.', 'Consultation, wash, tailored cut and finish.', 2800, NULL, NULL, 365, 'GL-CUT', 10, true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'service', 'Ritual corte y barba', 'Cut & Beard Ritual', 'Corte de precisión, arreglo de barba, toalla caliente y acabado premium.', 'Precision cut, beard shaping, hot towel and premium finish.', 4500, NULL, NULL, 365, 'GL-RIT', 20, true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'service', 'Afeitado real', 'Royal Shave', 'Afeitado clásico a navaja, preparación de la piel y toalla caliente.', 'Classic straight-razor shave, skin preparation and hot towel.', 3200, NULL, NULL, 365, 'GL-SHV', 30, true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'fixed_value', 'Experiencia Glamour €50', 'Glamour Experience €50', 'Crédito para elegir cualquier servicio o producto de la barbería.', 'Credit toward any barbershop service or product.', 5000, NULL, NULL, 365, 'GL-GFT', 40, true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'custom_value', 'Regalo a tu medida', 'A Gift Your Way', 'Elige el valor y deja que esa persona diseñe su propio ritual.', 'Choose the value and let them design their own ritual.', NULL, 2000, 20000, 365, 'GL-FLX', 50, true);

-- Gift Cards for Restaurant María
INSERT INTO gift_cards (id, merchant_id, card_type, title, description, amount_cents, min_amount_cents, max_amount_cents, valid_days, active) VALUES
('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'service', 'Cena para 2', 'Menú degustación para dos personas', 6000, NULL, NULL, 365, true),
('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'fixed_value', 'Tarjeta Regalo €30', 'Vale por consumición en restaurante', 3000, NULL, NULL, 365, true);

-- min/max already set in INSERT for custom value card above
