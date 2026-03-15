# Kings Wood Project Rules

## Project Goal

- Build a polished mobile-first web experience for selecting a lot in Kings Wood.
- The core story combines:
  - parents' saju-based interpretation
  - site and lot context from Kings Wood plans
  - a clear recommendation flow for which lot best matches the family
- Primary site context:
  - address: `충청북도 옥천군 군북면 증약리 1483`
  - source images: `Site_Plan.png`, `Phase2_Floor_Plan.png`

## Read First

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. `Site_Plan.png`
5. `Phase2_Floor_Plan.png`

## Product Direction

- The first usable version should be a static-friendly site that can deploy cleanly to GitHub Pages.
- Prefer a front-end-only architecture unless a real backend is clearly necessary.
- Default implementation stack:
  - `Vite`
  - `React`
  - `TypeScript`
  - lightweight CSS strategy suited to mobile storytelling
- Avoid framework features that complicate static deployment.

## UX Rules

- Design for phone width first, especially around `390px`.
- Korean copy is the default.
- The site should feel premium, calm, and land-focused rather than like a generic dashboard.
- Use the site plan images as key visual anchors.
- Keep the main user journey short:
  - understand the site
  - compare candidate lots
  - review saju and land-energy interpretation
  - see a final recommendation
- Every screen should remain legible and tappable on mobile without zooming.

## Content Rules

- Treat saju and land-energy analysis as interpretive guidance, not objective truth.
- Separate hard facts from interpretation.
  - hard facts: lot number, relative position, road access, park adjacency, plan image context
  - interpretation: saju match, energy harmony, narrative recommendation
- If the parents' birth date or birth time is missing, do not invent personalized readings.
- Use placeholder or sample saju data only when clearly labeled.

## Implementation Rules

- Keep data shapes simple and explicit for lots, parents, and recommendation results.
- Prefer local JSON or TypeScript constants for early data modeling.
- Keep plan-image coordinates and highlighted-lot logic easy to edit.
- Build reusable sections for:
  - hero and project intro
  - site overview map
  - lot detail cards
  - saju input or summary
  - recommendation result
- Preserve image fidelity; do not aggressively compress or distort the provided plans.

## Testing And Validation

- Run the app locally and verify in a real browser before calling work complete.
- After meaningful UI changes, run `pnpm review:ui` to generate fresh Playwright review artifacts.
- Use browser-based validation for:
  - mobile viewport layout
  - touch-friendly interactions
  - image zoom or focus states if added
  - recommendation flow and navigation
- Capture screenshots when visual changes matter.
- Before deployment, confirm the static production build works locally.

## Deployment Rules

- Deploy through GitHub, with GitHub Pages as the default target unless the user asks otherwise.
- Keep asset paths and routing compatible with static hosting.
- Do not introduce server-only dependencies that break GitHub Pages without explicit approval.

## Collaboration Notes

- Make progress directly when the next step is clear.
- When a decision changes deployment, data model, or user trust, pause and surface the tradeoff.
- Prefer small, working increments over large speculative rewrites.
- If the installed skill `$playwright-visual-review-loop` is available, use it for an independent browser-first review pass after frontend changes.
