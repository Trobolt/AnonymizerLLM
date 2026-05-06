# Start Here: Complete Guide to Fixed Electron Setup

## ✅ All Issues Fixed

The implementation is now complete and all errors have been resolved.

## What Was Wrong

1. **Backend executable not found** - Looking in wrong path
2. **Multiple confusing launch configs** - Hard to know which to use
3. **Missing uvicorn.exe** - Tried to find non-existent executable

## What's Fixed

✅ **Single launch configuration** - Just one "Electron: Dev" to rule them all  
✅ **Proper backend detection** - Uses Python from `.venv` automatically  
✅ **Error handling** - Checks files exist before spawning  
✅ **Clear startup flow** - Frontend → Electron → Backend (all automatic)

## Getting Started (Quick Version)

### 1️⃣ Install (one time)
```bash
# Install Node packages
npm install

# Install Python backend
cd backend
.venv\Scripts\pip install -r requirements.txt
cd ../frontend

# Install frontend
npm install
cd ..
```

### 2️⃣ Launch (press F5)
- Open VS Code
- Press `F5`
- Select **"Electron: Dev"**
- Wait for "ready started server" message
- Electron window opens automatically

### 3️⃣ Develop
- Edit files normally
- Backend auto-reloads on Python changes
- Frontend hot-reloads
- Press F12 in Electron window to debug

## The Launch Configuration

**One configuration that does everything:**
```json
{
  "name": "Electron: Dev",
  "type": "node",
  "request": "launch",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "electron:dev"],
  "preLaunchTask": "Frontend: Next.js Dev (Electron)",
  "postDebugTask": "Terminate Dev Processes"
}
```

**What it does:**
1. Starts Next.js on port 3000 (HTTP API mode)
2. Compiles Electron TypeScript files
3. Waits for frontend to be ready
4. Launches Electron with `electron .`
5. Electron's main.ts starts Python backend automatically
6. Opens DevTools for debugging
7. On exit: cleans up all processes

## What Actually Happens

```
You press F5
    ↓
Electron: Dev configuration launches
    ↓
Pre-task: Frontend: Next.js Dev starts
    ↓
npm run electron:dev executes:
    - tsc compiles electron/main.ts → electron/dist/main.js
    - concurrently runs tsc --watch and waits for :3000
    - electron . launches when frontend ready
    ↓
Electron starts (electron/dist/main.js)
    ↓
main.ts runs in Electron process:
    - Finds Python: backend/.venv/Scripts/python.exe
    - Spawns: python -m uvicorn main:app --port [dynamic]
    - Creates window
    - Loads http://localhost:3000
    ↓
Next.js frontend uses HttpAdapter
    ↓
Frontend calls backend API → HttpAdapter → localhost:8000
    ↓
Everything working, DevTools open for debugging
```

## Key Paths (For Reference)

```
Backend Python:       backend/.venv/Scripts/python.exe
Electron TypeScript:  electron/main.ts, electron/preload.ts
Electron compiled:    electron/dist/main.js
Frontend Next.js:     frontend/app/page.tsx
API adapters:         frontend/lib/api/
Configuration files:  .vscode/tasks.json, .vscode/launch.json
```

## Common Commands

```bash
# Development
npm run electron:dev              # Start everything (same as F5)
npm run electron:compile          # Just compile TS (watch mode)

# Building for production
npm run electron:build            # Full build with PyInstaller
npm run electron:package          # Create Windows installer

# Debugging
# In Electron DevTools (F12):
# - Check console for API responses
# - Check Network tab for HTTP calls
# - Set breakpoints in Sources

# Stopping
# Press Ctrl+C in terminal or click stop in VS Code
# Or run task "Terminate Dev Processes"
```

## Troubleshooting

### "Backend process error: ENOENT"
- ✅ Fixed - Now uses proper path to Python
- Backend should start automatically when Electron opens

### "Cannot connect to backend"
- Check terminal output for "Uvicorn running on" message
- Port shown should match logs
- Verify Next.js frontend is on :3000

### "Electron window won't open"
- Wait for "ready started server on" message
- Check terminal for any Next.js errors
- May be compiling TypeScript (first time takes longer)

### "Port already in use"
- Run task: "Terminate Dev Processes"
- Or: `taskkill /F /IM node.exe /T`

## Files You'll Edit

**Most commonly:**
- `backend/main.py` - Add API endpoints
- `frontend/app/page.tsx` - Add UI components
- `frontend/components/` - New components

**On setup:**
- `.env` - If you add environment variables
- `backend/requirements.txt` - If you add Python packages
- `frontend/package.json` - If you add npm packages

**Rarely:**
- `electron/main.ts` - App lifecycle
- `.vscode/launch.json` - Debug configs
- `electron-builder.yml` - Packaging config

## Next Steps

After everything works (F5 → Electron window opens):

1. **Add API endpoints** - Edit `backend/main.py`
2. **Build UI** - Add components to `frontend/`
3. **Test** - Use DevTools (F12) to debug
4. **Build for production** - Run `npm run electron:package`

## Production Build

When ready to ship:

```bash
# Full build with PyInstaller
npm run electron:build

# Create Windows installers
npm run electron:package

# Output in dist/ folder:
# - BewerbungsBot-1.0.0-x64.exe (portable)
# - BewerbungsBot-1.0.0-x64.msi (installer)
```

## Key Features of This Setup

✅ **One launch configuration** - No more multiple confusing options  
✅ **Automatic backend spawning** - Python process starts automatically  
✅ **Hot reload** - Changes to code auto-reload  
✅ **Proper venv detection** - Uses Python from project venv  
✅ **Error handling** - Files checked before execution  
✅ **DevTools debugging** - Full browser DevTools in Electron  
✅ **Separate dev/prod** - HTTP in dev, IPC in production  
✅ **Complete workflow** - Dev to packaged .exe

## Reference Documents

- **QUICK_START.md** - How to get started
- **FIXES_APPLIED.md** - What was fixed and why
- **ELECTRON.md** - Complete architecture guide
- **VERIFICATION_REPORT.md** - Technical details
- **SETUP_CHECKLIST.md** - Implementation phases

---

## Summary

✅ **Status:** Ready  
✅ **Launch:** F5 → "Electron: Dev"  
✅ **Execution:** One-click development  
✅ **Backend:** Auto-started from venv  
✅ **Frontend:** Auto-compiled and reloaded  
✅ **Ship:** `npm run electron:package`

**You're all set. Press F5 and start developing!** 🚀
