# Decorative pages prototype (Phase 0B, Version 2)

A visual-quality experiment for the **dedication page** and the **back page** of a
Nest & Quill storybook. It is isolated: nothing in `app/`, `lib/` or the Edge
Function imports it, and the customer PDF export (`lib/services/pdf.ts`) is
unchanged. It uses the same renderer (pdf-lib), the same 8 × 8 in page, the same
WinAnsi standard fonts and the same text guard (`toWinAnsiSafe`) as production, so
a design that works here can be ported without new dependencies.

## View it

```bash
node --experimental-strip-types scripts/prototypes/decorative-pages/render.ts /tmp/decorative-pages
open /tmp/decorative-pages/proof.pdf            # all 11 sample pages
pdftoppm -r 100 -png /tmp/decorative-pages/proof.pdf /tmp/decorative-pages/page   # optional PNGs
```

Every sample uses synthetic text and fictional names (Theo, Marisol, Pip, Nia,
Imani). No story, image, database row or API call is involved.

## Compare with Version 1

Version 1 (commit 6b2ddb3) is frozen in `v1/decorativePages.ts`. Render it with the
same fixtures for a before/after check:

```bash
node --experimental-strip-types scripts/prototypes/decorative-pages/render.ts /tmp/decorative-pages-v1 --v1
```

V2 changes: larger, keepsake-style dedication with the feather ornament and author
line following the text; smaller back-page wordmark (publisher signature) and a
heavier closing message; one thin rule plus a soft rounded inner line with leaf
sprigs in the corners, sparkles and a vector feather instead of the certificate
double frame. `ORNAMENT_SLOTS` names where illustration-style variants could plug
in later without changing the page architecture.

## Test

```bash
node --experimental-strip-types --test scripts/prototypes/decorative-pages/decorativePages.test.ts
```

## Files

- `decorativePages.ts` — V2 layout module: frame, divider, flourishes, letter-spaced
  labels, adaptive text fitting (`fitTextBlock`), `drawDedicationPage`, `drawBackPage`.
- `v1/decorativePages.ts` — frozen Version 1 for comparison.
- `render.ts` — fixtures and the proof renderer (`--v1` switches layouts).
- `assets/logo.png`, `assets/mark.png` — PNG derivations of the approved brand logo
  (`public/brand/logo.webp`); pdf-lib cannot embed WebP. The mark is the nest-and-quill
  device cropped from the same logo. No customer illustration is used.
