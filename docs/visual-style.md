# Workshop visual style

The reference guides the composition, aged timber and metal, gold framing, parchment and acid green lighting. Game text, signed numbers, stock, target ranges, scales and controls remain HTML. Menu selects Easy, Medium or Hard from the assignment table; Medium retains the six-ingredient, four-portion, 150-second, three-life, ±8 rules. Difficulty settings also drive recipe selection, rewards, reaction subsets, save/continue and leaderboard buckets.

## Independent artwork layers

All raster assets are in [`src/assets/layers/`](../src/assets/layers/). The 13 WebP files total approximately 0.78 MB. The background and cabinet are opaque; the cauldron, liquid, book and eight ingredients retain alpha transparency. Objects are independent of the background.

| Asset                                                                                | Use                                                  |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `workshop-background.webp`                                                           | Workshop without controls, labels, book or cauldron  |
| `cauldron-body.webp`                                                                 | Empty iron cauldron on transparent background        |
| `potion-liquid.webp`                                                                 | Independent green liquid and small bubbles           |
| `glow.svg`                                                                           | Separate radial glow                                 |
| `dragon.webp`, `fairy.webp`, `frost.webp`, `mandrake.webp`, `acid.webp`, `void.webp` | Six Medium ingredient illustrations                  |
| `phoenix.webp`, `slime.webp`                                                         | Additional Hard ingredients                          |
| `shelf-frame.webp`                                                                   | Empty wooden shelving cabinet                        |
| `recipe-book.webp`                                                                   | Blank parchment book with leather cover and bookmark |
| `frame.svg`                                                                          | Scalable gold frame                                  |

Parameter, heart, score, clock, help, menu and pause SVG icons are defined in `src/ui/workshop-view.ts`. Palette, frame, glow, spacing and cauldron dimensions use CSS variables. Images were generated with the built-in image_gen tool, not CLI. [Exact final prompts](artwork-prompts.md) and an [asset contact sheet](asset-sheet.png) are included.

## Views and states

`workshop-view.ts` defines small functions for the top panel, shelf, cauldron, recipe, scales and brewing actions. `game.ts` renders their state independently through `updateClock`, `renderShelf`, `renderCauldron`, `renderRecipe` and `renderParameters`. `parameter-status.ts` distinguishes exact range, selected difficulty tolerance, below target and above target. `drag-drop.ts` handles native mouse dragging. Save validation and chemical reaction rules are outside rendering.

Cards show image, name and stock; base parameters appear only in hover/focus details. Depleted slots hide their image and disable click, drag and keyboard focus. Full capacity blocks adding. HTML5 drag-and-drop uses the same guarded add action as clicks. Desktop hover/focus exposes a tooltip. A separate information button opens details without adding an ingredient; a live game pauses and resumes when those details close, restoring focus. Pause hides and disables the entire playfield, including scales and Brew.

The cauldron has empty, filling, ready, success and error states with text feedback. Liquid rises slightly with portion count; the current ingredient images float inside the cauldron. Steam, bubbles and reaction animations respect `prefers-reduced-motion`; ambient animated layers are hidden when reduced motion is requested. All dialogs share the same palette and frame.

## Responsive composition

Wide screens retain three columns. Short laptops reduce decoration and cauldron height and keep the action row outside the scrolling scene, so a long recipe cannot push Brew off screen.

Below 801 px the scene scrolls above a separate action row. Below 551 px the order is statistics → recipe → parameters → two-column ingredient shelf → cauldron. Brew remains below the scene without overlapping it. DOM and keyboard order follow recipe, parameters, ingredients and cauldron.

## Review and verification

Run `npm run dev`, then open [`docs/ui-preview.html`](ui-preview.html). This development-only review harness uses an iframe at the requested viewport size and reports layout metrics. It is separate from the production entry and is not included in the normal build.

Examples:

- `ui-preview.html?width=1440&height=900`
- `ui-preview.html?width=1280&height=720&fixture=long&difficulty=hard`
- `ui-preview.html?width=375&height=667&fixture=full`
- `ui-preview.html?width=375&height=667&fixture=depleted`

Fixtures: `ready`, `empty`, `full`, `depleted`, `long`, `last-life`, `game-over`. Use `difficulty=easy|medium|hard` to inspect other rule sets. Add `scale=native&clean=1` for screenshots at original resolution without the audit footer. Preview actions use real game handlers with autosave disabled: do not save test scores or clear existing leaderboard entries.

See the [requirements audit](requirements-audit.md) for Level 2/3 verification. The [recorded layout audit](layout-audit.json) covers widths 375–1920 px and heights as low as 600 px, including long titles, depleted stock and full capacity. It checks horizontal overflow, Brew visibility, hint overlap, recipe-row overflow, image loading and panel order.

Browser checks covered keyboard addition, blocked fifth portion, depleted stock, separate mobile details without adding, focus restoration, success/error brewing, pause including scales/Brew, help, menu, game over, leaderboard and cancelling the clear confirmation. Existing leaderboard records were not changed. Mobile checks used desktop-browser viewports; physical touchscreen hardware and cross-browser/device testing remain outside this verification.

Screenshots: [desktop](workshop-desktop.png), [laptop](workshop-laptop.png), [wide](workshop-wide.png), [mobile](workshop-mobile.png), [mobile shelf](workshop-mobile-shelf.png), [details](workshop-mobile-details.png), [pause](workshop-pause.png), [game over](workshop-game-over.png).
