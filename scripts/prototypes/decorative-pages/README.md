# Decorative pages prototype (Phase 0B)

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

## Test

```bash
node --experimental-strip-types --test scripts/prototypes/decorative-pages/decorativePages.test.ts
```

## Files

- `decorativePages.ts` — layout module: frame, divider, flourishes, letter-spaced
  labels, adaptive text fitting (`fitTextBlock`), `drawDedicationPage`, `drawBackPage`.
- `render.ts` — fixtures and the proof renderer.
- `assets/logo.png`, `assets/mark.png` — PNG derivations of the approved brand logo
  (`public/brand/logo.webp`); pdf-lib cannot embed WebP. The mark is the nest-and-quill
  device cropped from the same logo. No customer illustration is used.
