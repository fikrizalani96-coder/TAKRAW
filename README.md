# Sepak Takraw Game Challenge

A competitive **sepak takraw (regu) match simulation** for the browser, built with **three.js** — no external
assets, everything (humans, arenas, animation, audio) is generated procedurally. It plays on phones and desktops,
with keyboard, gamepad or a floating touch joystick + four action buttons.

```
npm install
npm run dev        # http://localhost:5173  (also on your LAN: --host)
npm run build      # -> dist/index.html  (one self-contained file, ~0.8 MB, works offline / from any static host)
npm test           # headless unit + soak suites  (npm test -- --browser  adds the real-app checks)
```

## What's in the game

| | |
|---|---|
| **Two venues** | **Official ISTAF arena** — pink synthetic court with regulation markings, LED boards, tiered stands with an animated crowd, video wall, umpire chair, referee + line judges. **Kampung Takraw** — a packed-earth village court at golden hour, bamboo poles and a fishing-net, stilt houses, palms, villagers on benches, chickens, drifting dust. |
| **Real roles** | The **tekong** serves (and defends the back), the **tosser** tosses the ball to the tekong for the serve and lifts/sets, the **killer** spikes (*libas*). The player who owns the next touch performs it — with their own animation. |
| **Physics** | Ball: gravity, quadratic drag, Magnus (spin) force, spin decay, floor bounce with friction/spin coupling, net mesh, top cord, posts, ceiling — sub-stepped at 240 Hz. The AI/assist solvers plan against the *same* integrator the game runs. |
| **ISTAF rules** | 21-point sets (deuce, cap 25), best of 3 (decider to 15, cap 17), change of sides at 8 in the decider, 3-serve rotation (alternating at deuce), max 3 touches, no consecutive touches by one player (blocks excluded), service faults (missed toss/ball, net, out, own side), net-tape/antenna crossing, ball landed / out / under net. Quick (11) and Kampung (15) formats are also included. |
| **Animation** | **1,167 clips** in 15 families (serve 84, receive 219, set 72, spike/libas 228, block 45, movement 182, idle 46, dive/slide 75, toss 24, ball skills 14, celebrate 48, react 26, warm-up 28, officials 40, freestyle 36) on a **109-joint** rig. See the *Animation Lab* on the title screen to browse, search, mirror, slow down and scrub every one. |
| **Humans** | Real proportions (tekong / tosser / killer / official / elder / youth builds), sculpted from signed-distance fields, skinned to the 109-joint rig (spine ×5, neck, jaw, eyes, lids, brows, cheeks, lips, clavicle/scapula, twist bones, 19-bone hands, foot/ball/toes), dressed with per-team kits (sash, stripes, chevron… drawn per-pixel in a shader), numbers and names. |
| **Human control** | You always control the player who must touch the ball next (or press *switch*). Movement has arrival assist so contact windows are forgiving; assist level is selectable (Full / Balanced / Manual). |
| **Camera / HUD / audio** | Broadcast camera that re-fits the whole court to any aspect ratio (portrait phone → ultrawide), scoreboard with flags, ball-touch pips, radar, toasts, synthesised crowd/whistle/ball/net audio. |

### Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move / aim | WASD / arrows | left floating joystick | left stick |
| **A** SEPAK — foot technique / *sila* serve | `J` or `Space` | A | A / ✕ |
| **B** BADAN — chest/body / *kuda* serve | `K` | B | X / □ |
| **C** KEPALA / LIBAS! — head / spike / block / *cara* serve | `L` | C | Y / △ |
| **D** SELAMAT — dive / slide save | `I` | D | B / ○ |
| Switch player | `Q` / `Tab` | ⇄ | LB / RB |
| Camera / pause / aids / mute | `V` / `P` or `Esc` / `H` / `M` | side buttons | Back / Start |

**Serving:** press A / B / C to choose *sila* / *kuda* / *cara*; the tosser tosses; press again as the ball drops into the tekong's
striking zone (auto-kick if you're late, when assist is on). Hold the stick while serving/spiking to aim the reticle.
**Receiving:** the ring on the floor marks where to stand; press the technique button that suits the ball height.
**Spiking:** press C — stick pulled back = *gulung* (roll), sideways = *gunting* (scissor) / *kilas*, forward = *kuda*.
**Blocking:** move the front player to the marker and press C (it arms the perfectly timed block).

### URL parameters (handy for testing)

`?auto=1` starts a match immediately · `&env=official|kampung` · `&a=THA&b=MAS` (12 teams) · `&format=istaf|quick|kampung` ·
`&human=1` (you play; default is AI-vs-AI spectate) · `&quality=low|medium|high` · `&touch=1` · `?lab=1` opens the Animation Lab.

## How it's built

```
src/character   SDF human: skeleton (109 joints), body/head/hands/feet, clothes, kits, face texture, mesher
src/anim        pose vector (66 channels), clips (Hermite), builders/* (the 1,167-clip catalogue), animator (layers, IK, foot pinning)
src/game        config, ball physics, ISTAF rules, skill library, team AI brain, match state machine, human control, view binding
src/world       official arena, Kampung village, court/net, ball mesh, textures
src/engine      camera rig, WebAudio synth, input (keyboard / gamepad / touch)
src/ui          HUD, menus, Animation Lab
tests/          headless suites + Playwright drivers for the real app
```

* **Animation is procedural.** Every clip is a *parametric generator* (leg/arm reach solvers with anatomical clamps, jump arcs,
  contact timing) that produces spline keyframes on demand, so 1,000+ clips cost almost nothing at start-up and the technique
  is authored around the ball-contact point that the game feeds to the IK at runtime. They are not motion-captured.
* **The "metahuman" is our own.** Characters are procedural SDF meshes on a MetaHuman-style joint hierarchy, not Epic MetaHuman
  assets (which can't ship in a self-contained web build). Faces are stylised; a painted face texture provides brows, lips, lid
  creases and stubble.
* **Sponsors are fictional** (Zenith, Nova Bank, Velox…). Team kits are inspired by the national colours, not licensed replicas.

## Testing

`npm test` runs: rig/skeleton checks, the catalogue build (unique IDs, ≥1000 clips, NaN/limit checks), ball-physics behaviours
(net, cord, posts, Magnus, bounce), ISTAF rules (21 checks), AI-vs-AI full-match soaks (ISTAF and Kampung formats), and an
assist-only human-team match. `npm test -- --browser` additionally boots the real app in headless Chromium (SwiftShader), plays
both venues and drives the human-control path with a scripted player (serve presses, movement, technique buttons, blocks).

## Known limitations / ideas

* Faces and hair are stylised, not photoreal; crowd members are simple instanced figures.
* No instant-replay yet; the AI never commits net or four-touch faults.
* Real-device performance depends on GPU: `low` quality (auto on touch devices) reduces mesh density, shadows and crowd size.
