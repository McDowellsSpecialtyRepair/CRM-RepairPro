// Phone and email checks used by every customer form and by the server. They catch typing mistakes
// (too many digits, spaces in an email, "gmmail.con"); they cannot tell whether a number is in service or
// a mailbox exists. That needs an outside lookup or a confirmation email, which is not connected.

export type CheckResult = { ok: boolean; value: string; message?: string; suggestion?: string };

// US/Canada numbers: 10 digits (a leading 1 is allowed and dropped), shown as 208-555-1212, with an optional
// extension ("x12"). Other countries: start with + and 8 to 15 digits.
export function checkPhone(raw: unknown): CheckResult {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: "" };
  const ext = text.match(/\s*(?:x|ext\.?|extension)\s*(\d{1,6})\s*$/i);
  const main = ext ? text.slice(0, ext.index) : text;
  if (/[a-wyz]/i.test(main.replace(/ext/i, ""))) return { ok: false, value: text, message: "A phone number can only contain numbers (and an extension like x12)." };
  const digits = main.replace(/\D/g, "");
  const extText = ext ? ` x${ext[1]}` : "";
  if (main.trim().startsWith("+") && !main.trim().startsWith("+1")) {
    if (digits.length < 8 || digits.length > 15) return { ok: false, value: text, message: `This international number has ${digits.length} digits. International numbers have 8 to 15 digits after the +.` };
    return { ok: true, value: `+${digits}${extText}` };
  }
  const us = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (us.length !== 10) {
    return { ok: false, value: text, message: `This phone number has ${digits.length} digit${digits.length === 1 ? "" : "s"}. A US phone number has 10 digits, for example 208-555-1212.` };
  }
  if (/^[01]/.test(us)) return { ok: false, value: text, message: "US area codes don't start with 0 or 1. Check the first three digits." };
  return { ok: true, value: `${us.slice(0, 3)}-${us.slice(3, 6)}-${us.slice(6)}${extText}` };
}

const DOMAIN_FIXES: Record<string, string> = {
  "gmmail.com": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmail.co": "gmail.com", "gmaill.com": "gmail.com", "gmal.com": "gmail.com", "gmail.cm": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com", "iclod.com": "icloud.com", "icloud.co": "icloud.com",
  "aol.co": "aol.com", "comcast.com": "comcast.net", "msn.co": "msn.com",
};
const TLD_FIXES: Record<string, string> = { con: "com", cmo: "com", ocm: "com", comm: "com", vom: "com", xom: "com", cpm: "com", nett: "net", ner: "net", ogr: "org" };

// Returns ok:false for an address that can't work (spaces, no @, no domain). A probable typo in the domain
// ("gmmail.con") comes back ok:false with a suggestion, so the person either takes the fix or confirms.
export function checkEmail(raw: unknown): CheckResult {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: "" };
  const squeezed = text.replace(/\s+/g, "").toLowerCase();
  const suggest = (addr: string) => {
    const at = addr.lastIndexOf("@");
    if (at < 1) return undefined;
    let domain = addr.slice(at + 1);
    const parts = domain.split(".");
    if (parts.length > 1 && TLD_FIXES[parts[parts.length - 1]]) parts[parts.length - 1] = TLD_FIXES[parts[parts.length - 1]];
    domain = parts.join(".");
    domain = DOMAIN_FIXES[domain] || domain;
    const fixed = `${addr.slice(0, at)}@${domain}`;
    return fixed !== text ? fixed : undefined;
  };
  if (/\s/.test(text)) {
    const s = suggest(squeezed);
    return { ok: false, value: text, message: "Email addresses can't contain spaces.", suggestion: s ?? squeezed };
  }
  const m = text.match(/^([^@]+)@([^@]+)$/);
  if (!m) return { ok: false, value: text, message: text.includes("@") ? "An email address has exactly one @." : "An email address needs an @, for example name@gmail.com." };
  const [, local, domain] = m;
  if (local.length > 64 || /^\.|\.$|\.\./.test(local) || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local))
    return { ok: false, value: text, message: "The part before the @ has a character an email address can't use." };
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(domain) || /(^|\.)-|-(\.|$)/.test(domain))
    return { ok: false, value: text, message: "The part after the @ should look like gmail.com or mcdowellsrepair.com." };
  const tld = domain.split(".").pop()!.toLowerCase();
  if (!/^[a-z]{2,}$/.test(tld)) return { ok: false, value: text, message: `".${tld}" isn't a real ending for an email address. Check the part after the last dot.` };
  const s = suggest(text.toLowerCase());
  if (s && s !== text.toLowerCase()) return { ok: false, value: text, message: "This looks like a typing mistake.", suggestion: s };
  return { ok: true, value: text.toLowerCase() };
}
