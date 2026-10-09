/**
 * Initials for the fallback avatar — pure, so it can be tested without a
 * device. Kept out of photo.ts because that imports expo-file-system and
 * expo-image-picker, neither of which loads outside a React Native runtime.
 */
export function initialsFrom(name?: string | null): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part));
  if (parts.length === 0) return '';
  const first = [...parts[0]!][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]!][0] ?? '') : '';
  return (first + last).toUpperCase();
}
