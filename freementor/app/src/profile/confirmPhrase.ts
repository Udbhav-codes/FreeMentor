/**
 * The typed confirmation for deleting an account (components/ConfirmCard.tsx).
 * Case and extra spaces are forgiven; the words are not.
 */
export function matchesPhrase(typed: string, phrase: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(typed) === norm(phrase);
}
