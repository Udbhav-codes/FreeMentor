# Legal documents — drafts

Four documents Google Play requires before the listing goes live, drafted
against **what the app actually does** rather than from a template. Every
claim here was checked against the code, the database schema and the product
plan; where the app's behaviour changes, these have to change with it.

> **Written to be usable, not as legal advice.** The Terms and Conditions are
> drafted against Indian statute — the IT Act 2000 and the Intermediary
> Guidelines 2021, the Consumer Protection Act 2019 and the E-Commerce Rules
> 2020, the DPDP Act 2023, the Contract Act 1872 for the 16–17 capacity point,
> and the Arbitration and Conciliation Act 1996 — and each clause is written
> to match what the app actually does. I am not a lawyer. If you can have one
> read these before launch, do; if not, they are a far better starting point
> than a template, and the risk sits with the claims in clause 3.4 and the
> pricing in clause 6, which are the ones a complaint would target.
>
> **Originally noted:** I am not one,
> and nothing here is legal advice. They are meant to save your lawyer the
> hours it takes to learn what the product does — not to replace them. The
> DPDP Act's penalties reach ₹250 crore, and a review is cheap against that.

## What you must fill in before publishing

Every placeholder is in `[SQUARE BRACKETS]`:

| Placeholder | What it is |
|---|---|
| `[LEGAL ENTITY NAME]` | the company or sole proprietorship that owns the app |
| `[REGISTERED ADDRESS]` | required on an Indian privacy policy |
| `[GRIEVANCE OFFICER NAME]` | **mandatory in India** — IT Rules 2021 and DPDP |
| `[GRIEVANCE EMAIL]` | must be monitored; 24 h acknowledge, 15 days resolve |
| `[SUPPORT EMAIL]` | general support |
| `[WEBSITE]` | e.g. freementor.app |
| `[EFFECTIVE DATE]` | the date you publish |

The app currently points at `https://freementor.app/privacy` and
`/terms` (see `app/src/app/sign-in.tsx`). Those URLs must serve these
documents before launch, and Play also requires the privacy policy to be
reachable from a public URL **outside** the app.

## The four

| File | Required by |
|---|---|
| `privacy-policy.md` | Google Play, DPDP Act 2023 |
| `terms-of-service.md` | Consumer Protection Act 2019, E-Commerce Rules 2020 |
| `refund-policy.md` | Play billing policy, CP Act |
| `content-policy.md` | YouTube API Services terms, copyright safe harbour |

## Two things your lawyer should look at first

**The price comparison in the welcome copy.** The app tells learners they
would otherwise pay "₹6,000 to ₹40,000+" for a course. Under the CCPA
guidelines on misleading advertisements (2022) a comparative claim needs
substantiation you can produce on demand. Either document the survey of
competitor pricing that supports it, or soften the claim. This is the single
most likely thing to attract a complaint, and it is in
`app/src/marketing/welcome.ts`.

**Account deletion on the web — now built.** Served by the API at
`/delete-account`, so it works without the app installed. The policies are
served too: `/privacy` (the URL the app links to), `/privacy-policy`,
`/terms`, `/refund-policy`, `/content-policy`.

**One thing you must do before it works in production:** add the deployed page
URL to Supabase -> Authentication -> URL Configuration -> Redirect URLs, e.g.
`https://api.freementor.app/delete-account`. Without it the Google sign-in on
that page returns to a blank screen — the same failure as `exp://**` for the
app. It cannot be tested locally against a deployed Supabase project until
that entry exists.

Note also that the policies are read from this `docs/legal/` directory at
runtime. A deployment that ships only `server/` will 404 them; set
`LEGAL_DOCS_DIR` or include this directory in the image.

## A promise the operation does not yet keep

The Content Policy says resources are "checked automatically and re-checked at
least monthly". **That is not currently true.** `tools/check_links.py` exists
and has never been run: all 1,174 videos still carry `duration_seconds: null`,
so every study time the app shows is an estimate rather than the real
duration x 1.15 rule, and no link has ever been verified as live.

Two ways to make the sentence honest, and you have to pick one before the
listing goes live:

1. **Run it and schedule it.** Needs a YouTube Data API key (free), then
   `python tools/check_links.py` monthly as a cron. This is the intended
   operation and the product plan commits to it.
2. **Soften the wording** to what you actually do.

Publishing a policy that describes a process you do not operate is worse than
publishing a weaker policy you keep to.

## Also still outstanding

- No ads are live yet, so the advertising sections describe intended
  behaviour. If you launch before M6, cut those paragraphs rather than
  describe something that is not happening — and note that Basic currently
  opens resources after a confirmation dialog, not an advertisement, so the
  Terms would overstate what happens. **The Plans screen now says the same
  thing** ("Each one opens after a short rewarded ad"), which is a promise
  about a plan nobody can yet buy — the buy button still says payment is not
  connected. Harmless while that holds; wrong the day Billing goes live
  without AdMob.
- **In-app copy was brought into line with the locking model (Oct 2026).**
  Five learner-facing strings still said videos were free to open on every
  plan, or never behind an ad — including the Plans screen's own Basic
  feature list, on the screen that takes the money. All corrected in English,
  Hindi and Hinglish, and `marketing/compliance.ts` now fails the build on an
  unqualified free-access claim.
- The documents now describe the **Oct 2026 locking model**: the trial is
  Basic free for 3 days with no ads, and afterwards everything locks including
  videos. If that changes again, clause 5 and 6.4 of the Terms, the Privacy
  Policy's advertising section and the Content Policy's YouTube section all
  have to change together.
- Firebase Analytics and Crashlytics are named in the privacy policy because
  the product plan commits to them. If they are not in the first build, remove
  them — naming a processor you do not use is its own problem.
