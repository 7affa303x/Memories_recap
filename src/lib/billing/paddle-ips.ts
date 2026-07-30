/**
 * Live Paddle notification source IPs.
 * Source of truth: GET https://api.paddle.com/ips (data.ipv4_cidrs).
 * Do not hard-code — list can change.
 */

type IpCache = {
  cidrs: string[];
  fetchedAt: number;
};

let cache: IpCache | null = null;
const TTL_MS = 60 * 60 * 1000;

function parseIpv4(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw ?? "32");
  const ipNum = parseIpv4(ip);
  const baseNum = parseIpv4(base || "");
  if (ipNum == null || baseNum == null || !Number.isFinite(bits)) return false;
  if (bits <= 0) return true;
  if (bits >= 32) return ipNum === baseNum;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

export async function getPaddleLiveIpv4Cidrs(): Promise<string[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.cidrs;
  }
  const res = await fetch("https://api.paddle.com/ips", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Paddle IPs: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { ipv4_cidrs?: string[] };
  };
  const cidrs = json.data?.ipv4_cidrs || [];
  if (!cidrs.length) {
    throw new Error("Paddle IP list empty");
  }
  cache = { cidrs, fetchedAt: Date.now() };
  return cidrs;
}

/** Extract the first public client IP from proxy headers. */
export function requestClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export async function isPaddleWebhookIpAllowed(
  request: Request
): Promise<{ ok: boolean; ip: string | null; reason?: string }> {
  // Local / preview without proxy headers — allow only in non-production.
  const ip = requestClientIp(request);
  if (!ip) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, ip: null, reason: "no_ip_non_production" };
    }
    return { ok: false, ip: null, reason: "missing_client_ip" };
  }
  try {
    const cidrs = await getPaddleLiveIpv4Cidrs();
    const ok = cidrs.some((cidr) => ipInCidr(ip, cidr));
    return ok
      ? { ok: true, ip }
      : { ok: false, ip, reason: "ip_not_in_paddle_allowlist" };
  } catch (error) {
    // Fail closed in production if the IP list cannot be loaded.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, ip, reason: "ip_fetch_failed_non_production" };
    }
    return {
      ok: false,
      ip,
      reason:
        error instanceof Error ? error.message : "ip_fetch_failed",
    };
  }
}
