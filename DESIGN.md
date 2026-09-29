---
name: LeafAI
description: A calm, practical plant health screening interface.
colors:
  canvas: "#f6f5ef"
  surface: "#fffefa"
  muted: "#eeeee7"
  ink: "#17211b"
  ink-muted: "#667168"
  line: "#d9ddd5"
  forest: "#143d2b"
  deep-forest: "#0b281b"
  sage: "#6e9872"
  sage-soft: "#e4ece1"
  amber: "#b98448"
  amber-soft: "#f6ead9"
  danger: "#b8514a"
  danger-soft: "#f8e4e1"
typography:
  display:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(3.2rem, 6.5vw, 6.7rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.085em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.65
    letterSpacing: "normal"
  technical:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "0.68rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
spacing:
  page: "clamp(24px, 5vw, 68px)"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#ffffff"
    rounded: "9px"
---

## Overview

LeafAI should feel calm, practical, and botanical. Use the existing forest
green, sage, and warm neutral palette to make plant health information feel
approachable. The light application canvas and deep forest navigation are the
current visual direction; `frontend/src/styles/redesign.css` is the styling
source of truth.

## Colors

- Use `forest` for primary actions and high-priority emphasis; use `deep-forest`
  for the application sidebar.
- Use `sage` and `sage-soft` for supporting emphasis, progress, and selected
  states.
- Use `amber` for caution and `danger` for errors. Pair status colors with
  labels or icons so color is never the only signal.
- Keep the warm canvas, white surface, dark ink, muted ink, and subtle line
  colors distinct and legible.

## Typography

- Use Manrope for interface and body text. Keep page headings strong and
  compact, and supporting text readable with comfortable line height.
- Use DM Mono sparingly for technical labels, eyebrows, and numeric details.
- Keep scan instructions concise and avoid long text blocks in task flows.

## Layout

- Keep a persistent deep-forest sidebar for app navigation and a warm canvas
  for page content.
- Align headings and explanatory copy to the left. Make the next scan action
  and the prediction result easy to find.
- At mobile widths, preserve the same hierarchy while allowing navigation,
  controls, and result content to fit without horizontal scrolling.
- Keep controls keyboard accessible, visibly focused, and comfortable to tap.

## Elevation & Depth

- Use subtle borders and restrained shadows to separate surfaces from the
  canvas. Avoid adding elevation to every component.
- Keep scan results and analysis content visually clear without layering
  several surfaces around the same information.

## Shapes

- Use modest rounding: compact controls are around 8–9px, inputs and secondary
  surfaces around 12px, and larger shared panels around 18px.
- Keep corners consistent within a component group; reserve distinctive
  shapes for intentional botanical moments, such as the home scan preview.

## Components

- Primary buttons use forest green, white text, and a compact rounded shape.
- Content panels use light surfaces, subtle borders, and dark ink.
- Prediction results prioritize the likely condition, confidence, severity,
  and practical advice. Keep uncertainty and educational-use limits clear.
- Upload, camera, reports, and dashboard views need understandable empty,
  loading, success, warning, and error states.
- Use botanical imagery as supporting context; it must not compete with the
  user's leaf image or result.

## Do's and Don'ts

- Do keep LeafAI's forest and warm neutral identity consistent across routes.
- Do use calm language and explain predictions without implying certainty.
- Do keep focus indicators, contrast, and non-color status cues visible.
- Don't replace the palette with a borrowed brand's colors.
- Don't overuse gradients, glass effects, nested cards, or motion that slows a
  scan.
- Don't present a prediction or suggested next step as a confirmed diagnosis
  or guaranteed treatment.
