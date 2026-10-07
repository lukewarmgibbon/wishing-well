import { describe, it, expect } from "vitest";
import { isPrivateAddress, assertPublicHttpUrl } from "@/lib/public-fetch";

/**
 * The guard that stops this endpoint being used to reach our own database, the
 * loopback interface, or a cloud metadata service. These are the exact cases
 * that turn a "paste a link" feature into an SSRF hole, so each one is pinned.
 */
describe("isPrivateAddress", () => {
  it("blocks loopback on both stacks", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.1.2.3")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  it("blocks the cloud metadata endpoint", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  it("blocks RFC1918 ranges", () => {
    expect(isPrivateAddress("10.0.0.5")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
  });

  it("blocks carrier NAT and link-local", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("169.254.1.1")).toBe(true);
  });

  it("blocks IPv6 unique-local and link-local", () => {
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12:3456::1")).toBe(true);
  });

  it("sees through IPv4-mapped IPv6, the common bypass", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
  });

  it("blocks the unspecified and multicast ranges", () => {
    expect(isPrivateAddress("0.0.0.0")).toBe(true);
    expect(isPrivateAddress("224.0.0.1")).toBe(true);
    expect(isPrivateAddress("255.255.255.255")).toBe(true);
  });

  it("allows genuine public addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });

  it("does not block addresses that merely look close to private ones", () => {
    // 172.32 is outside 172.16/12; 192.169 is outside 192.168/16.
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("192.169.0.1")).toBe(false);
    expect(isPrivateAddress("11.0.0.1")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("accepts an ordinary https link", () => {
    expect(assertPublicHttpUrl("https://example.com/thing").hostname).toBe("example.com");
  });

  it("trims surrounding whitespace from a pasted link", () => {
    expect(assertPublicHttpUrl("  https://example.com/x  ").hostname).toBe("example.com");
  });

  it("rejects non-web schemes", () => {
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublicHttpUrl("gopher://example.com")).toThrow();
    expect(() => assertPublicHttpUrl("javascript:alert(1)")).toThrow();
    expect(() => assertPublicHttpUrl("data:text/html,<script>")).toThrow();
  });

  it("rejects direct attempts to reach internal services", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1:5432")).toThrow();
    expect(() => assertPublicHttpUrl("http://localhost")).toThrow();
    expect(() => assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/")).toThrow();
    expect(() => assertPublicHttpUrl("http://[::1]:8080")).toThrow();
  });

  it("rejects things that are not URLs at all", () => {
    expect(() => assertPublicHttpUrl("not a url")).toThrow();
    expect(() => assertPublicHttpUrl("")).toThrow();
  });
});