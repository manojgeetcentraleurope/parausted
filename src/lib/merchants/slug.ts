const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;
const UNSUPPORTED_SLUG_CHARACTERS_REGEX = /[^a-z0-9-]/g;
const MULTIPLE_HYPHENS_REGEX = /-+/g;
const EDGE_HYPHENS_REGEX = /^-+|-+$/g;

function normalizeSlugCandidate(value: string): string {
  return value
    .normalize('NFKD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .trim()
    .replace(WHITESPACE_REGEX, '-')
    .replace(UNSUPPORTED_SLUG_CHARACTERS_REGEX, '')
    .replace(MULTIPLE_HYPHENS_REGEX, '-')
    .replace(EDGE_HYPHENS_REGEX, '');
}

export function slugifyMerchantName(name: string): string {
  return normalizeSlugCandidate(name);
}

export function sanitizeMerchantSlug(slug: string): string {
  return normalizeSlugCandidate(slug);
}