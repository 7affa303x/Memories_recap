import { describe, expect, it } from "vitest";

// Inline the CIDR matcher logic used by paddle-ips (pure functions)
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

describe("paddle live IP allowlist matching", () => {
  it("matches /32 Paddle notification IPs exactly", () => {
    expect(ipInCidr("34.237.3.244", "34.237.3.244/32")).toBe(true);
    expect(ipInCidr("34.237.3.245", "34.237.3.244/32")).toBe(false);
  });

  it("rejects non-Paddle addresses", () => {
    expect(ipInCidr("1.2.3.4", "34.237.3.244/32")).toBe(false);
  });
});
