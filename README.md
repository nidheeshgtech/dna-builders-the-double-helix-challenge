# dna-builders-the-double-helix-challenge

A 3D classroom game for Grade 6–8 students. Two players take turns building a DNA ladder by matching base pairs (A–T, G–C), with a teacher who explains the rules and gives hints. When every rung is correct, the ladder twists into a double helix, followed by a short "What we learned" summary about DNA.

## Run it

The game uses ES modules, so it must be served over HTTP (opening `index.html` directly from disk won't work).

- **MAMP:** put the folder in `htdocs` and open `http://localhost:8888/dna-builders-the-double-helix-challenge/`
- **Any static server:** e.g. `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Three.js (r160) is bundled in `vendor/`, so it runs offline. Google Fonts load when online and fall back to system fonts otherwise.

## Controls

- Drag a block from the tray into the glowing space, or click a block to send it there
- **Check answer** to test the pair; **Ask teacher** for a hint
- Keyboard: `A` `T` `G` `C` `U` to place, `Enter` to check

## Files

- `js/main.js` – renderer, camera, game loop, UI wiring
- `js/game.js` – turns, scoring, hints, finale
- `js/dna.js` – blocks, ladder, tray, helix twist, confetti
- `js/classroom.js`, `js/characters.js` – the room and the three characters
- `js/recap.js` – end-of-game DNA summary pages
- `js/audio.js` – synthesised sound effects and teacher voice
- `js/ui.js`, `css/style.css` – HUD, speech bubble, screens
