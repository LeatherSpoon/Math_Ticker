# Frontier Loop Prototype

A browser-based top-down orthographic sci-fi progression game prototype inspired by the provided direction doc.

## Run

Open `index.html` in a browser.

## Asset dependency policy (offline-safe core gameplay)

- Core gameplay should start from **local assets only**.
- Three.js is loaded from `vendor/three.min.js` as the primary dependency path.
- A CDN script is kept as an **optional fallback only** if the local bundle is missing.
- For deterministic deployments, ship a pinned `vendor/three.min.js` artifact with your release so no external network is needed for startup.
- `game.js` has a startup guard: if `window.THREE` is missing, gameplay initialization halts and an explicit boot error panel is shown.

## Offline verification checklist

When testing in browser offline mode (DevTools Network = Offline), verify:

1. Scene renders in the canvas.
2. The player mesh appears at spawn.
3. PP increments over time in the HUD.

## Current systems

- Orthographic 3D overworld with stylized outlined meshes.
- Active movement (WASD/Arrows), resource pickups, step-count progression.
- Idle progression through passive PP gain and assignable drones.
- Stat investment loop consuming Processing Power (PP).
- Environment unlock thresholds and travel (Landing Site, Mine, Verdant Maw, Lagoon Coast).
- Pokemon-style combat cutaway with HP bars and Focus Point ring.
- Actions: Fight, Items, Run, Skills (Jab, Heavy Hit, Kinetic Driver, Ballistic Lunge, Ion Beam, Scan).
- Basic consumable crafting and usage in combat.

## Troubleshooting blank screen

If the game UI appears but the 3D viewport is blank, look for this message:

- `3D engine failed to load.`

This means the Three.js runtime was unavailable or failed during startup. The game now falls back to a degraded HUD-only mode (shown in the Environment label) so progression can continue while you fix rendering.
