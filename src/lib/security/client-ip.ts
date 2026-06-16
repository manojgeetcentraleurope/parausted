import 'server-only';

/**
 * Fallback IP used when no trusted client address can be derived. The
 * `security_events.ip_address` column is `INET NOT NULL`, so logging must
 * always have a syntactically valid value. `0.0.0.0` is an explicit
 * "unknown" sentinel that never collides with a real client.
 */
export const UNKNOWN_CLIENT_IP = '0.0.0.0';

function isPlausibleIp(value: string): boolean {
  // Lightweight syntactic check only — enough to keep the value valid for an
  // INET column and to avoid header-injected junk. Not a full RFC validator.
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (ipv4.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  return value.includes(':') && ipv6.test(value);
}

/**
 * Derives a best-effort client IP from proxy headers.
 *
 * On Vercel the left-most entry of `x-forwarded-for` is the originating
 * client; `x-real-ip` is used as a fallback. Returns {@link UNKNOWN_CLIENT_IP}
 * when no plausible address is present so callers never fail on a missing IP.
 *
 * Note: `x-forwarded-for` is client-spoofable when not behind a trusted
 * proxy. For MVP rate limiting this is acceptable; it is a throttling signal,
 * not an authorization decision.
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first && isPlausibleIp(first)) {
      return first;
    }
  }

  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp && isPlausibleIp(realIp)) {
    return realIp;
  }

  return UNKNOWN_CLIENT_IP;
}