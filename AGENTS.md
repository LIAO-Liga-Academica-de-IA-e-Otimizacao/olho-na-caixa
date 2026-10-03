# Agent notes

This repository implements a method for the Olho na Caixa challenge: checking produce when it arrives at a school kitchen.

The problem statement is not stored here. Before you interpret the challenge, its items, constraints, scoring, or required deliverables, read the upstream repository:

https://github.com/marx-correia/desafio-olho-na-caixa/tree/main

Use that repository as the source of the problem this project is trying to solve. The local book under `docs/` records the decisions and the method this team chose. When the two disagree about the challenge itself, follow the upstream statement. When they disagree about the method, follow the local book.

Do not copy the statement back into this repository.

## Git commits

Only create commits when the user asks. If unclear, ask first.

### Safety

- Never update the git config.
- Never run destructive or irreversible git commands (`push --force`, hard reset, and similar) unless the user explicitly requests them.
- Never skip hooks (`--no-verify`, `--no-gpg-sign`, and similar) unless the user explicitly requests them.
- Never force-push to `main` or `master`. Warn the user if they ask.
- Avoid `git commit --amend`. Use `--amend` only when all of these hold:
  1. The user explicitly requested amend, or the commit succeeded but a pre-commit hook auto-modified files that need including.
  2. HEAD was created by you in this conversation (verify with `git log -1 --format='%an %ae'`).
  3. The commit has not been pushed (verify with `git status`: branch is ahead of remote).
- If a commit failed or was rejected by a hook, never amend. Fix the issue and create a new commit.
- If you already pushed to remote, never amend unless the user explicitly asks (that requires a force push).
- Never use interactive git flags (`-i`, such as `git rebase -i` or `git add -i`).
- Do not push to the remote unless the user explicitly asks.
- Do not commit secrets (`.env`, `credentials.json`, and similar). Warn if the user asks to commit them.
- Do not create an empty commit when there is nothing to commit.

### When the user asks for a commit

1. In parallel, run:
   - `git status` (staged, unstaged, and untracked)
   - `git diff` (staged and unstaged)
   - `git log` (recent messages, to match this repo's style)
2. Draft a Conventional Commits message (see below). Stage only the relevant files.
3. Commit with a HEREDOC for the message:

```bash
git commit -m "$(cat <<'EOF'
type: short summary.

Optional body.

EOF
)"
```

4. Run `git status` after the commit to verify success.
5. If a pre-commit hook fails, fix the issue and create a **new** commit (do not amend).

Do not run extra non-git exploration commands just to write the commit message. Base the message on the staged diff and recent log style.

### Commit message format (Conventional Commits)

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- Prefix with a type (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `style`, `perf`, and similar), optional scope in parentheses, then `: ` and a short summary.
- `feat` adds a feature. `fix` patches a bug.
- The description is a short summary of why/what changed (for example, `fix: array parsing issue when multiple spaces were contained in string`).
- An optional body may follow one blank line after the description.
- Footers may follow one blank line after the body (`Token: value` or `Token #value`). Use `-` instead of spaces in footer tokens (except `BREAKING CHANGE`).
- Breaking changes: append `!` after the type/scope, and/or add a `BREAKING CHANGE: <description>` footer.
- Focus the message on **why**, not a file list. Keep the subject to about 1–2 sentences of intent.

## Test scaffolding that stays for now

The Marcas page, the test clip, and the simulator stills served into `app/public/stills/` are already gone: the Conferir result screen draws the YOLO boxes. What remains below is still needed and goes away later. When every item on this list is removed, delete this section too.

- `markTopLayer` in `app/lib/top-layer.ts` and its cases in `app/lib/top-layer.test.ts`: the provisional peel-color detector. The screens only use the YOLO boxes (`detectTopLayer` plus the shared `Mark`/`TopLayer` types, which stay). Remove the function and its tests once the color-vs-model comparison is done or dropped.
- `testStillSet` in `app/lib/test-stills.ts` (plus `test-stills.test.ts`), `loadTestStills`/`autoStills`/`cornerSource` in `app/components/Conference.tsx`, and the `placeTree` test-stills links in `app/scripts/link-public.mjs` (served at `app/public/test-stills/`): the temporary shortcut that fills the frames with the book scenes while they open empty during testing. Since the site cleanup it only fills when the URL carries `?test=1`, and the gate probes hide behind the same flag. The top stills arrive with their true rim corners, projected from each seed's render camera. Remove once empty frames stop being the daily test path. `probeStillSet` and `loadProbe` in the same files (plus the git-ignored `gate-*.png` probes): the solid dark/blown/ok frames that trip the light gate during testing. They go away with the shortcut.
