/**
 * Masks an email address for PII minimisation (GDPR Art. 5).
 * "manoj.singh@example.com" → "ma*********@ex*********.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return '***@***.***';

  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);
  const dotIndex = domain.lastIndexOf('.');

  const maskedLocal =
    local.length <= 2
      ? local[0] + '*'.repeat(5)
      : local.substring(0, 2) + '*'.repeat(Math.min(local.length - 2, 9));

  let maskedDomain: string;
  if (dotIndex < 1) {
    maskedDomain = domain[0] + '*'.repeat(5);
  } else {
    const domainName = domain.substring(0, dotIndex);
    const tld = domain.substring(dotIndex); // includes the dot
    maskedDomain =
      domainName.length <= 2
        ? domainName[0] + '*'.repeat(5) + tld
        : domainName.substring(0, 2) + '*'.repeat(Math.min(domainName.length - 2, 9)) + tld;
  }

  return maskedLocal + '@' + maskedDomain;
}
