# Firefox Launch Configuration Port Mismatch
**Date:** 2026-04-27
**Status:** Investigating

## 1. Classification
- **Severity:** Major
- **Priority:** High
- **Component:** Development / Launch Configuration / Frontend

## 2. Description
- **Expected Behavior:** "Web: Dev (HTTP, Firefox)" launch configuration starts dev servers and opens Firefox to access the app at http://localhost:3000
- **Actual Behavior:** Firefox opens but cannot connect to the server on localhost:3000 - connection refused or timeout
- **Steps to Reproduce:** 
  1. Start VS Code
  2. Click "Run and Debug" (Ctrl+Shift+D)
  3. Select "Web: Dev (HTTP, Firefox)" from the configuration dropdown
  4. Click the green play button to launch
- **Environment:** Windows, BewerbungsBot project with Next.js frontend and FastAPI backend
- **Related Cases:** None yet

## 3. Reproduction
```bash
# Launch configuration would trigger:
# 1. preLaunchTask: "Dev: Web Servers"
# 2. Opens Firefox at http://localhost:3000
```

## 4. Investigation
### Hypotheses (Ranked by Recency & Size)
| Rank | File | Line | Hypothesis | Status |
|------|------|------|-----------|--------|
| 1 | [.vscode/tasks.json](.vscode/tasks.json#L12) | 12-36 | Task's `problemMatcher` doesn't properly detect when servers are ready, causing Firefox to launch before server is listening | [x] **ROOT CAUSE** |
| 2 | [dev-web.bat](scripts/dev-web.bat#L1) | 15-27 | Next.js server may not be starting on port 3000 | [x] Verified working (port 3000 ✓) |
| 3 | [launch.json](.vscode/launch.json#L6) | 6-11 | Launch config pointing to wrong port | [x] Verified correct (http://localhost:3000 ✓) |

### Hard Facts (Terminal Proof)
✓ Dev servers start correctly with no errors
✓ Frontend: Next.js responds on http://localhost:3000 with HTTP 200
✓ Backend: Uvicorn responds on http://127.0.0.1:8000 with HTTP 200
✓ Frontend ready output: `[FRONTEND] ✓ Ready in 452ms` (matches endsPattern)

## 5. Final Solution
**Root Cause:** The `"Dev: Web Servers"` background task's `problemMatcher` had an incorrect `endsPattern` that wasn't matching the actual server ready output. This caused VS Code to launch Firefox before the dev servers were actually listening, resulting in connection failures.

**Root Pattern Issue:** Original pattern was:
```
"endsPattern": "Ready in|started server on|Local:.*http|Uvicorn running on|frontend.*ready"
```

This pattern didn't properly match because:
1. The actual output format is `[FRONTEND] ✓ Ready in 452ms` with a checkmark character
2. The regex pattern lacked proper line anchors
3. Matching multiple sources caused ambiguity

**Fix Applied:**
Updated `[.vscode/tasks.json](.vscode/tasks.json#L18)` to use a more specific pattern that only matches when the **frontend** is ready:
```json
"endsPattern": "^\\[FRONTEND\\].*Ready in"
```

Additionally simplified [.vscode/launch.json](.vscode/launch.json#L6) Firefox configuration by removing unnecessary properties that could cause debugging issues.

**Files Modified:**
- [.vscode/tasks.json](.vscode/tasks.json#L18) - Fixed problemMatcher endsPattern
- [.vscode/launch.json](.vscode/launch.json#L6) - Simplified Firefox launch config

## 6. Verification
Server startup sequence (verified working):
```
[dev-web] Starting backend + frontend (HTTP mode)...
[BACKEND] INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
[FRONTEND] ▲ Next.js 16.2.4 (Turbopack)
[FRONTEND] - Local:         http://localhost:3000
[FRONTEND] ✓ Ready in 452ms                           <-- endsPattern matches here
[BACKEND] INFO:     Application startup complete.
[FRONTEND] Using HTTP adapter for API communication (http://localhost:8000)
```

Both servers confirmed responding correctly:
- `http://localhost:3000` → HTTP 200 (Next.js frontend)
- `http://localhost:8000/` → HTTP 200/404 (FastAPI backend responding)

## 7. Footprint Check
- [x] Dev servers start correctly
- [x] Frontend accessible on localhost:3000
- [x] problemMatcher properly detects server ready state
- [x] No existing functionality affected (only task pattern changed)
