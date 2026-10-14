/**
 * A sentence containing "FreeMentor", with "Mentor" in amber.
 *
 * The naive version — render the sentence minus the brand, then append a
 * separate amber "Mentor" — works only while the brand sits at the end.
 * Hindi is subject-object-verb, so "FreeMentor में आपका स्वागत है" puts it
 * first and the appended half lands at the end of the sentence:
 *
 *     Free में आपका स्वागत हैMentor
 *
 * So the split happens wherever the brand actually appears, which holds for
 * any word order and any language.
 *
 * Amber is a FILL and never text (§11.2, 1.78:1 on our background), so the
 * "Mentor" half uses `accentInk` — the 5.9:1 token — not the fill colour.
 */
import { Fragment } from 'react';
import { Txt } from './ui.tsx';

const BRAND = 'FreeMentor';

export function BrandText({
  children,
  variant = 'display',
}: {
  children: string;
  variant?: 'display' | 'title' | 'heading' | 'body';
}) {
  const parts = children.split(BRAND);

  // No brand in the string: nothing to colour, and splitting would be wrong.
  if (parts.length === 1) return <Txt variant={variant}>{children}</Txt>;

  return (
    <Txt variant={variant}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              Free
              <Txt variant={variant} color="accent">
                Mentor
              </Txt>
            </>
          ) : null}
        </Fragment>
      ))}
    </Txt>
  );
}
