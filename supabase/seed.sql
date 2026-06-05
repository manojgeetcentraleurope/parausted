-- ParaUsted Seed Data — Development Only
-- Run: supabase db reset (this runs after all migrations)

-- Test Merchant 1: Barber Carlos
INSERT INTO merchants (id, auth_user_id, name, slug, category, email, phone, address, city, bizum_phone, bank_iban, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Peluquería Carlos',
    'barbercarlos',
    'barber',
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

-- Gift Cards for Barber Carlos
INSERT INTO gift_cards (id, merchant_id, card_type, title, description, amount_cents, valid_days, active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'service', 'Corte + Peinado', 'Lavado, corte y peinado completo', 2500, 365, true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'service', 'Corte + Barba', 'Corte de pelo y arreglo de barba', 3500, 365, true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'fixed_value', 'Tarjeta Regalo €25', 'Vale por cualquier servicio', 2500, 365, true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'fixed_value', 'Tarjeta Regalo €50', 'Vale por cualquier servicio', 5000, 365, true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'custom_value', 'Elige tu importe', 'Elige el valor que prefieras', NULL, 365, true);

-- Gift Cards for Restaurant María
INSERT INTO gift_cards (id, merchant_id, card_type, title, description, amount_cents, valid_days, active) VALUES
('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'service', 'Cena para 2', 'Menú degustación para dos personas', 6000, 365, true),
('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'fixed_value', 'Tarjeta Regalo €30', 'Vale por consumición en restaurante', 3000, 365, true);

-- Set min/max for custom value card
UPDATE gift_cards SET min_amount_cents = 1000, max_amount_cents = 20000 WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
