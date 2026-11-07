/** First and last name from a full name (honorifics dropped), or null for a single word. Pure, so client code can use it. */
export function splitName(full: string): [string, string] | null {
  const parts = full.replace(/^(dr|mr|mrs|ms|miss|prof|engr|barr)\.?\s+/i, '').trim().split(/\s+/);
  return parts.length < 2 ? null : [parts[0], parts[parts.length - 1]];
}
