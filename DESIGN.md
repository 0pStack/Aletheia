---
name: Aletheia
description: A healthcare journal whose access log nobody can quietly rewrite, told as smoked glass over a desert at last light.
colors:
  desert-night: "oklch(0.14 0.008 30)"
  bone: "oklch(0.994 0.004 150)"
  inkstone: "oklch(0.21 0.006 30)"
  felt-gray: "#6d6d6d"
  pewter: "#808080"
  ash-mist: "#9a9a9a"
  iridescent-sage: "rgb(160 224 171)"
  iridescent-amber: "rgb(255 172 46)"
  iridescent-oxblood: "rgb(165 45 37)"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 14vw, 14rem)"
    fontWeight: 300
    lineHeight: 0.76
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.875rem)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  sharp: "0"
  pill: "75px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "0.6875rem 2.0625rem"
  button-solid:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.desert-night}"
    rounded: "{rounded.pill}"
    padding: "0.6875rem 2.0625rem"
  glass-action:
    textColor: "{colors.bone}"
    rounded: "{rounded.sharp}"
    padding: "1rem 2rem"
  field-underline:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.lead}"
    rounded: "{rounded.sharp}"
    padding: "0.75rem 0"
  close-button:
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
---

# Design System: Aletheia

## 1. Overview

**Creative North Star: "Smoked Glass at Last Light"**

Aletheia is a desert at dusk seen through dark glass. The scene (Wadi Rum massifs, rubble, red crystal, a fallen ice block holding the login's lens) carries all of the colour and all of the awe. Everything a person reads or touches floats above it on one material: smoked glass, tinted with the night that is falling over the scene. The interface itself is monochrome on purpose. Light, blur and space do the work that colour does elsewhere.

The system is settled. Its job now is uniformity and finish: every screen on the same glass, the same type scale and the same spacing, raised to the level of the landing. New work extends these rules; it does not invent new surfaces. What it rejects, in PRODUCT.md's words: hospital software (grey forms, blue-and-white, dense tables), SaaS templates (hero-metric dashboards, identical card grids, gradient buttons), and health-app cuteness (pastels, mascots, wellness softness).

Density is low and deliberate. One hero per view, generous vertical rhythm on the 4px scale, content set in a single left-aligned column inside the glass. Motion is slow to settle and quick to respond, always on one curve.

**Key Characteristics:**

- One material: smoked glass (Desert Night at 86%, blur 32px, saturate 1.2) over a live WebGL scene.
- Strictly monochrome interface; colour belongs to the scene and the login media only.
- Inter throughout, light weight for anything large, tight negative tracking on headlines.
- Sharp or pill, nothing in between. Hairlines instead of boxes.
- A single easing curve (`cubic-bezier(0.19, 1, 0.22, 1)`), and every motion has a reduced-motion answer.

## 2. Colors: The Last Light Palette

Two tinted neutrals and their mixes carry the entire interface; the scene supplies every other colour.

### Primary

- **Desert Night** (oklch(0.14 0.008 30)): the glass tint and the only "dark". A near-black with a trace of warm oxblood from the dusk behind it. Mixed with transparency it becomes every surface: glass panel 86%, button-size glass 64%, fallback glass 90–94% where `backdrop-filter` is unsupported. In code: `--color-obsidian`.
- **Bone** (oklch(0.994 0.004 150)): the only "light". A near-white with a trace of sage. All text, hairlines, focus rings and solid buttons on the glass are Bone at a set opacity. In code: `--color-paper`.

### Neutral

- **Inkstone** (oklch(0.21 0.006 30)): body text on the legacy light "paper" pages. Those pages are moving onto the glass; do not use Inkstone on new surfaces.
- **Felt Gray** (#6d6d6d), **Pewter** (#808080): muted text and input borders on the legacy light pages only.
- **Ash Mist** (#9a9a9a): decorative dividers on light pages. 2.8:1 on white, so never text and never an input border.

### Tertiary (media only)

- **Iridescent Sage** (rgb(160 224 171)), **Iridescent Amber** (rgb(255 172 46)), **Iridescent Oxblood** (rgb(165 45 37)): the login hero's iridescence and nothing else. They read as green/amber/red status, so they never appear near data.

### Named Rules

**The Bone Opacity Ladder Rule.** On glass, Bone is used at exactly these strengths: text 100%, muted text 78%, placeholder 45%, field line 32%, subtle border 14%, divider 20%. No other opacities. A new shade of grey on the glass is a bug.

**The Scene Owns Colour Rule.** The interface never introduces a hue. If a status needs meaning (Verified, Pending, Failed), it is carried by the word first and by Bone's weight and opacity second, never by green, amber or red.

**The One Glass Rule.** Glass is Desert Night at 86% with `blur(32px) saturate(1.2)`. Defining it again with different numbers in a component is prohibited; every surface that floats over the scene uses the same recipe.

## 3. Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Label/Mono Font:** ui-monospace, Cascadia Code, Consolas (code and hashes only)

**Character:** One humanist sans, used with conviction: very light and tightly tracked when large, so headlines feel carved from the glass; regular and generous when small, so clinical text reads fast.

### Hierarchy

- **Display** (300, clamp(3.5rem, 14vw, 14rem), 0.76): the login wordmark. Once per product.
- **Headline** (300, clamp(2.5rem, 6vw, 4.875rem), 1.02, -0.03em): the landing greeting. Max 14ch.
- **Title** (300, 2rem, 1.1, -0.02em): section and page headings ("Patients", the patient's name in the journal).
- **Lead** (400, 1.25rem, 1.5): the landing lead line and the search field. Max 38ch.
- **Body** (400, 1rem, 1.5): notes, descriptions, everything read. Cap at 65–75ch.
- **Label** (400, 0.75rem, 0.1em, uppercase): field labels, table headers, section kickers, footer facts.

### Named Rules

**The Light-When-Large Rule.** Anything 2rem or above is weight 300 with negative tracking. Bold headlines are prohibited; hierarchy comes from size and light.

**The One Tracking Rule.** Uppercase labels are tracked at 0.1em. The current 0.08em and 0.12em variants are drift to be removed.

**The Loaded Face Rule.** Inter must be shipped with the app, not assumed. A machine without Inter installed currently falls back to its system font, so the demo can render in a different typeface than development.

## 4. Elevation

Aletheia has no shadows. Depth is three flat layers: the WebGL scene at the back, the smoked glass in the middle, content on the glass at the front. Separation between glass and scene comes from the blur and a soft vertical fade (`--glass-fade`, 7rem) where the glass begins, never from a drop shadow. Inside the glass, grouping is done with hairlines and space.

### Named Rules

**The No-Shadow Rule.** `box-shadow` is prohibited on interface surfaces. If something needs to feel lifted, it gets glass, not a shadow.

**The Frosted Inset Rule.** One step of extra depth is allowed inside the glass: a frosted inset (Bone at 4–6% over the glass, sharp corners, no border) for a single grouped item such as a note or a log entry. Never nest an inset in an inset, and never use insets as a grid of cards.

## 5. Components

### Buttons

Hairline pills that fill from below, slow and confident.

- **Shape:** full pill (75px).
- **Outline (default):** transparent, 1px Bone border, Bone text, padding 0.6875rem 2.0625rem.
- **Solid (primary on glass):** Bone fill, Desert Night text. Hover deepens the fill from the bottom edge (oklch(0.88 0.006 80)).
- **Hover / Focus:** a fill rises from below over 450ms on the glide curve; press scales to 0.97. Focus is a 2px Bone outline, offset 2px.
- **Disabled:** Pewter border, muted text, `not-allowed` cursor.

### Glass Action (signature)

The landing's "Search patients" call to action: button-size smoked glass (Desert Night 64%, blur 32px) with a 14% Bone hairline, **sharp** corners, padding 1rem 2rem, and an arrow that slides on hover. Hover thins the glass to 56% and brightens the hairline to 32%. The label must hold 4.5:1 on the glass alone, because the scene can be at its brightest behind it.

### Inputs / Fields

- **Style:** no box. A single 1px underline at Bone 32%, transparent background, sharp, Lead size (1.25rem), placeholder at Bone 45%.
- **Label:** Label style above the field.
- **Hover / Focus:** the underline goes to full Bone; focus adds the 2px Bone outline.
- **Error:** the message is set in Body below the field; the underline does not turn red.

### Lists and Tables

- **Hairline list (notes):** items separated by 1px Bone 20% rules with 1.5rem vertical padding; the list closes with a rule under the last item. Meta (author, time, visibility) in Label style above the text.
- **Table (access log):** Label-style headers with a 20% hairline beneath, Body-small cells (0.875rem) with 0.75rem vertical padding and a hairline per row. Refused attempts are marked in words, not colour.

### Glass Panel (journal)

The journal opens as a full-height sheet of the same glass over the landing, which stays mounted behind it. It slides up on the glide curve and closes with the pill close button (top right) or Esc. Its glass must match the landing's exactly (see The One Glass Rule).

### Navigation

The header sits over the scene with a Desert Night 55% gradient and a 14% hairline under it. The wordmark in Body size; nav links in Label style (0.1em, uppercase), muted at rest and full Bone when hovered or current.

### Footer

A hairline (Bone 20%) above a single row: the lockup (mark at 1.5rem beside "Aletheia" in 0.875rem) on the left, the three log facts in Label style on the right, all centred on one line.

## 6. Do's and Don'ts

### Do:

- **Do** put every surface that floats over the scene on the one glass: Desert Night 86%, `blur(32px) saturate(1.2)`, fallback 90% without `backdrop-filter`.
- **Do** use only the Bone Opacity Ladder on glass: 100 / 78 / 45 / 32 / 20 / 14%.
- **Do** set anything 2rem or larger in Inter 300 with negative tracking.
- **Do** track every uppercase label at 0.1em.
- **Do** choose sharp (0) or pill (75px) for every corner.
- **Do** separate content with 1px hairlines and space from the 4px scale.
- **Do** give every motion the glide curve and a reduced-motion fallback (crossfade or none).
- **Do** carry status in words ("Verified", "Pending", "Failed", "Refused").

### Don't:

- **Don't** look like hospital software: grey forms, blue-and-white, dense tables (Cosmic, TakeCare, Epic).
- **Don't** use SaaS template patterns: hero-metric dashboards, identical card grids, gradient buttons.
- **Don't** go health-app cute: pastels, illustrated mascots, wellness softness.
- **Don't** show blockchain imagery (chains, blocks, glowing hashes). Show what the chain guarantees.
- **Don't** use `box-shadow` on interface surfaces, or a border radius between 0 and a full pill.
- **Don't** introduce a hue in the interface. The iridescent colours are for the login media only, and never near data.
- **Don't** redefine the glass or the text opacities locally with new numbers. If the journal panel's glass differs from the landing's, the panel is wrong.
- **Don't** nest a frosted inset inside another, or lay insets out as a card grid.
- **Don't** set bold headlines, or all-caps body copy.
