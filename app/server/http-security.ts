import { createHash } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";

// Inline scripts that print documents need. The print window is written by the app itself,
// so it inherits the app's Content-Security-Policy; these exact scripts are allowed by hash.
export const AUTO_PRINT_SCRIPT = "window.onload = function() { window.print(); }";
export const CATALOG_PRINT_SCRIPT = 'document.getElementById("print-catalog").addEventListener("click",function(){window.print()});';
const scriptHash = (source: string) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`;

// Satoshi (headings) is still served by Fontshare until a licensed self-hosted copy is added.
const FONTSHARE_CSS = "https://api.fontshare.com", FONTSHARE_FILES = "https://cdn.fontshare.com";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${scriptHash(AUTO_PRINT_SCRIPT)} ${scriptHash(CATALOG_PRINT_SCRIPT)}`,
  `style-src 'self' 'unsafe-inline' ${FONTSHARE_CSS}`,
  `font-src 'self' data: ${FONTSHARE_FILES}`,
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// TRUST_PROXY tells Express how many reverse proxies sit in front of the app so that
// req.ip and req.secure are correct. Unset means no proxy (the previous behaviour).
// Accepts a hop count (e.g. 1), or Express names/addresses such as "loopback" or "10.0.0.1".
export function trustProxySetting(value = process.env.TRUST_PROXY): boolean | number | string {
  const v = (value || "").trim();
  if (!v || v === "false") return false;
  if (v === "true") throw new Error("TRUST_PROXY=true would trust client-supplied addresses. Use a hop count such as 1, or 'loopback'.");
  return /^\d+$/.test(v) ? Number(v) : v;
}

// The app listens on loopback by default; expose it through a TLS reverse proxy.
// Set HOST=0.0.0.0 only on a private network or inside a container behind a proxy.
export const listenHost = (value = process.env.HOST) => (value || "").trim() || "127.0.0.1";

// Origin the server uses to call itself (e.g. rendering an estimate email from its print page).
export function internalOrigin(port: string | number, host = listenHost()) {
  const target = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${target.includes(":") ? `[${target}]` : target}:${port}`;
}

export function applyHttpSecurity(app: Express, production: boolean) {
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxySetting());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    // The development server injects inline module scripts and a websocket; enforce in production.
    if (production) res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    next();
  });
}
