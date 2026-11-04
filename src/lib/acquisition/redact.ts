// Strips credentials from anything the acquisition engine persists or logs
// (task errors, agent-run errors). Errors from SMTP, HTTP clients and model
// SDKs can echo back headers, URLs or config — none of that may be stored.

const PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]'],                    // OpenAI-style keys
  [/\bre_[A-Za-z0-9_]{12,}/g, 're_[redacted]'],                      // Resend keys
  [/\bEAA[A-Za-z0-9]{20,}/g, 'EAA[redacted]'],                       // Meta access tokens
  [/\bAIza[0-9A-Za-z_-]{20,}/g, 'AIza[redacted]'],                   // Google API keys
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]'],
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, '$1[redacted]@'], // user:pass@ in URLs
  [/\b(pass(?:word)?|secret|token|api[_-]?key)(["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, '$1$2[redacted]'],
  [/([?&](?:key|token|access_token|api_key)=)[^&\s]+/gi, '$1[redacted]'],
];

export function redactSecrets(input: string, maxLength = 1000): string {
  let out = input;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out.length > maxLength ? `${out.slice(0, maxLength)}…` : out;
}

export function errorMessage(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}
