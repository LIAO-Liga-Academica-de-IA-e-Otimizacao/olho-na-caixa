# Agent notes

This repository implements a method for the Olho na Caixa challenge: checking produce when it arrives at a school kitchen.

The problem statement is not stored here. Before you interpret the challenge, its items, constraints, scoring, or required deliverables, read the upstream repository:

https://github.com/marx-correia/desafio-olho-na-caixa/tree/main

Use that repository as the source of the problem this project is trying to solve. The local book under `docs/` records the decisions and the method this team chose. When the two disagree about the challenge itself, follow the upstream statement. When they disagree about the method, follow the local book.

Do not copy the statement back into this repository.

## Test scaffolding that stays for now

The Marcas page, the test clip, and the simulator stills served into `app/public/stills/` are already gone: the Conferir result screen draws the YOLO boxes. What remains below is still needed and goes away later. When every item on this list is removed, delete this section too.

- `markTopLayer` in `app/lib/top-layer.ts` and its cases in `app/lib/top-layer.test.ts`: the provisional peel-color detector. The screens only use the YOLO boxes (`detectTopLayer` plus the shared `Mark`/`TopLayer` types, which stay). Remove the function and its tests once the color-vs-model comparison is done or dropped.
- `testStillSet` in `app/lib/test-stills.ts` (plus `test-stills.test.ts`), `loadTestStills`/`autoStills`/`cornerSource` in `app/components/Conference.tsx`, and the `placeTree` test-stills links in `app/scripts/link-public.mjs` (served at `app/public/test-stills/`): the temporary shortcut that fills the frames with the book scenes while they open empty during testing. The top stills arrive with their true rim corners, projected from each seed's render camera. Remove once empty frames stop being the daily test path. `probeStillSet` and `loadProbe` in the same files (plus the git-ignored `gate-*.png` probes): the solid dark/blown/ok frames that trip the light gate during testing. They go away with the shortcut.
