# Next.js + Tailwind v4: 300+ Node Processes on `next dev`

## Symptom

After running `scripts/dev-web.bat` (or `.sh`), `Get-Process node` showed
**hundreds of `node.exe` processes** within seconds of launch — even on a
verified clean slate (`taskkill /F /IM node.exe /T`). Looked like a fork bomb.

## What it was NOT

Three plausible-but-wrong theories were tested and falsified by inspecting
the process tree (`Get-CimInstance Win32_Process` with `ParentProcessId`):

1. **npm script name collision / recursion.**
   `npm --prefix frontend run dev` does *not* walk upward. It reads
   `frontend/package.json` and runs *its* `dev` script. Verified: the spawned
   `cmd.exe` ran `/c next dev`, not `/c dev-web.bat`.

2. **Shadowing `npm`/`npx` binary or shell alias loop.**
   No `npm`/`npx` files exist in the repo. Non-interactive `cmd.exe` and
   `bash` don't expand aliases. The `npx` process was the real one from
   `C:\Program Files\nodejs\...\npx-cli.js`.

3. **Zombie/orphan accumulation from previous runs.**
   The clean-slate `taskkill` brought the count to 0 before launch. The
   explosion happened on a single fresh run.

The process tree showed a **wide tree**, not a deep repeating chain — proof
that no script was re-entering itself.

## What it actually was

Out of ~341 node processes, **341 had the same command line**:

```
"node" C:\Users\wwert\Desktop\BewerbungsBot\frontend\.next\dev\build\postcss.js <port>
```

Inspecting `frontend/.next/dev/build/postcss.js` revealed it as a
**Turbopack-generated PostCSS bridge**:

```
[turbopack-node]/child_process/evaluate.ts
  -> [turbopack-node]/transforms/postcss.ts
     -> [project]/frontend/postcss.config.mjs
```

### Root cause

- Next.js 16 uses **Turbopack** (a Rust compiler) by default in `dev`.
- Turbopack handles CSS natively via **Lightning CSS**.
- **BUT** if a `postcss.config.*` file exists, Turbopack *defers* CSS
  processing to PostCSS, which is a JavaScript pipeline.
- PostCSS can't run inside Turbopack's Rust engine, so Turbopack
  **forks a Node child process per CSS evaluation** to run it.
- With Tailwind v4's `@tailwindcss/postcss` plugin + HMR ticking on every
  edit/request, the fork count grows fast — hundreds within seconds.

### Important nuance: config presence is the *enabler*, not the *cause*

Restoring `postcss.config.mjs` did NOT immediately bring the worker count
back. Steady-state right after `next dev` starts is ~4 processes. The
spike to 341 happens only when the dev server is actually doing CSS work:

- A browser is connected and has loaded the page → CSS modules requested.
- HMR / Fast Refresh fires on file saves → CSS re-evaluated.
- Pre-existing workers from previous evaluations don't always exit on
  Windows before new ones spawn → workers accumulate.

So the worker count is roughly `f(active PostCSS evaluations)`, not
`f(postcss.config.mjs exists)`. The original 341-process measurement
likely caught the dev server mid-HMR-storm with a browser hammering it,
not at idle.

## Why we can't simply delete `postcss.config.mjs`

**Initial attempt (wrong fix):** delete `postcss.config.mjs`. Process
count dropped from 341 → 4 immediately. The page also lost all styling.

Tailwind v4 in Next.js **requires** the `@tailwindcss/postcss` plugin.
Without the PostCSS config, `@import "tailwindcss"` in `globals.css` is
treated as a plain CSS import that resolves to nothing — no utility
classes are generated. There is currently no Turbopack-native Tailwind
plugin for Next 16; the PostCSS bridge is the official integration path.

**Decision:** keep `postcss.config.mjs`. The high `node.exe` count during
dev is an accepted cost of the Next 16 + Tailwind v4 combo on Windows,
not a bug in this repo.

## Mitigations (not eliminations)

1. **Measure after warm-up, not during.** Initial compile + HMR bursts
   spike the count; idle steady-state is much lower.
2. **Keep Tailwind directives in one entry CSS file** (`app/globals.css`).
   Each separately-imported CSS module = a separate PostCSS evaluation =
   a separate worker fork.
3. **Use the `Terminate Dev Processes` task** between dev sessions on
   Windows. Ctrl+C does not always reliably propagate to all
   grandchildren, so orphans accumulate across runs.
4. `scripts/dev-web.sh` has `trap 'kill 0' EXIT INT TERM` so on
   bash-based Linux/WSL hosts shutdown is clean.

## Lessons

- **Don't trust process count alone — group by command line.** A `taskkill`
  test plus `Get-CimInstance Win32_Process | Group-Object CommandLine`
  immediately reveals whether you have N copies of one thing (worker pool)
  or N nested copies of your own script (recursion).
- **Wide tree vs. deep chain** is the recursion test. A repeating chain
  `cmd → npm → cmd → npm → …` with the same command line nesting downward
  is a fork bomb. A wide tree with one top-level entry is not.
- **Turbopack + `postcss.config` = JS worker forks.** Any time you adopt a
  Rust-backed bundler (Turbopack, Vite/Rolldown, Bun), check whether your
  CSS plugin chain forces it back into a JS subprocess pipeline. With
  Tailwind v4 + Next 16 today, you can't avoid it without losing styles.
- **Verify the fix preserves correctness, not just metrics.** Removing
  `postcss.config.mjs` reduced the count from 341 → 4 — and silently
  broke all Tailwind styling. A green metric is not a working app.
- **HMR amplifies the cost.** A worker-per-evaluation pattern that's
  acceptable for a one-shot build becomes pathological in long-running
  dev servers because workers aren't always reused/reaped between
  recompiles.
- **Diagnose before "fixing".** Three structurally plausible theories
  (recursion, shadowing, zombies) all turned out to be wrong. Inspecting
  the actual `CommandLine` field on the spawned processes pointed
  straight at the real cause within one query.
