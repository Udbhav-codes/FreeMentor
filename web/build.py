"""Builds the public static site from docs/legal.

    python web/build.py

The markdown in `docs/legal/` stays the single source of truth; this renders
it to HTML so the policies are readable without JavaScript. That matters: a
Play reviewer, a crawler or somebody with JS disabled has to be able to read a
privacy policy, and a page that fetches markdown client-side shows them
nothing.

Only the markdown these documents actually use is supported — headings, bold,
italic, inline code, links, lists, tables, blockquotes, rules. A general
markdown library would be more code and another dependency for no gain.

Output goes to `web/dist/`, which is what you point Cloudflare Pages, Netlify
or GitHub Pages at. No build step is needed on the host; commit dist/ or run
this before deploying.
"""

from __future__ import annotations

import html
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
LEGAL = REPO / "docs" / "legal"
DIST = ROOT / "dist"

PAGES = [
    ("privacy-policy.md", "privacy-policy.html", "Privacy Policy"),
    ("terms-of-service.md", "terms.html", "Terms and Conditions"),
    ("refund-policy.md", "refund-policy.html", "Refund Policy"),
    ("content-policy.md", "content-policy.html", "Content & Copyright Policy"),
]


def inline(text: str) -> str:
    """Escapes, then applies the inline marks. Order matters: code first, so
    a backtick span containing an asterisk is not mangled by the bold rule.

    `quote=True` is load-bearing, not tidiness. With `quote=False` a double
    quote survived escaping and the link rule below dropped it straight into
    an href attribute, so this markdown:

        [click](https://a" onmouseover="alert(1))

    produced `<a href="https://a" onmouseover="alert(1">click</a>` — a live
    event handler on a page that carries a Supabase sign-in. The only input
    today is `docs/legal/*.md`, which we write ourselves, so nothing was
    exploitable; it would have become exploitable the moment any text we did
    not author passed through here, which is a bad thing to rely on noticing.

    The URL pattern already requires `https?://`, so `javascript:` was never
    reachable. Raw HTML was already escaped. This was the one hole.
    """
    out = html.escape(text, quote=True)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    # The URL cannot contain a quote: &quot; by now, and " is excluded anyway
    # so a malformed link fails to match rather than half-matching.
    out = re.sub(r"\[([^\]]+)\]\((https?://[^)\s\"']+)\)", r'<a href="\2">\1</a>', out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![\w*])\*([^*]+)\*(?![\w*])", r"<em>\1</em>", out)
    return out


def render(md: str) -> str:
    """Markdown to HTML, for the subset these documents use."""
    lines = md.split("\n")
    out: list[str] = []
    i = 0
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            close_list()
            i += 1
            continue

        # A table: a header row, a separator of dashes, then body rows.
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(
            r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]
        ):
            close_list()
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            out.append("<table><thead><tr>")
            out.extend(f"<th>{inline(c)}</th>" for c in cells)
            out.append("</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>")
                i += 1
            out.append("</tbody></table>")
            continue

        if stripped.startswith("---") and set(stripped) <= {"-"}:
            close_list()
            out.append("<hr />")
            i += 1
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            close_list()
            level = len(heading.group(1))
            out.append(f"<h{level}>{inline(heading.group(2))}</h{level}>")
            i += 1
            continue

        if stripped.startswith("> "):
            close_list()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(f"<blockquote><p>{inline(' '.join(quote))}</p></blockquote>")
            continue

        bullet = re.match(r"^[-*]\s+(.*)$", stripped)
        if bullet:
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(bullet.group(1))}</li>")
            i += 1
            continue

        # A paragraph runs until a blank line or the start of another block.
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(
            r"^\s*(#{1,4}\s|[-*]\s|\||>|---)", lines[i].strip()
        ):
            para.append(lines[i].strip())
            i += 1
        if para:
            close_list()
            out.append(f"<p>{inline(' '.join(para))}</p>")
            continue
        i += 1

    close_list()
    return "\n".join(out)


TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — FreeMentor</title>
    <meta name="description" content="FreeMentor {title}" />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main>
      <nav class="crumbs"><a href="/">FreeMentor</a> · {title}</nav>
      {body}
      <footer>
        <a href="/privacy-policy.html">Privacy</a> ·
        <a href="/terms.html">Terms</a> ·
        <a href="/refund-policy.html">Refunds</a> ·
        <a href="/content-policy.html">Content</a> ·
        <a href="/delete-account.html">Delete my account</a>
      </footer>
    </main>
  </body>
</html>
"""


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    for source, target, title in PAGES:
        path = LEGAL / source
        if not path.is_file():
            raise SystemExit(f"missing: {path}")
        body = render(path.read_text(encoding="utf-8"))
        (DIST / target).write_text(
            TEMPLATE.format(title=html.escape(title), body=body), encoding="utf-8"
        )
        print(f"  {source:<24} -> dist/{target}")

    # The app links to /privacy, from an installed build we cannot change.
    shutil.copy(DIST / "privacy-policy.html", DIST / "privacy.html")
    print("  privacy.html             -> alias for the app's link")

    for name in ("delete-account.html", "index.html", "style.css", "_headers"):
        source = ROOT / "src" / name
        if source.is_file():
            shutil.copy(source, DIST / name)
            print(f"  {name:<24} -> dist/{name}")

    placeholders = sum(
        page.read_text(encoding="utf-8").count("[LEGAL ENTITY NAME]")
        for page in DIST.glob("*.html")
    )
    if placeholders:
        print(
            f"\n  NOTE: {placeholders} unfilled [PLACEHOLDER] occurrence(s). "
            "These are drafts — fill them in and have a lawyer review before publishing."
        )
    print(f"\nBuilt {len(list(DIST.glob('*')))} files into web/dist/")


if __name__ == "__main__":
    main()
