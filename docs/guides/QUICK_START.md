# Electron Development - Quick Start

## Issues Fixed

✅ **Backend path resolution** - Now uses Python from venv directly in development mode (no more missing executable errors)
✅ **Simplified launch configuration** - Single "Electron: Dev" launch config that does everything
✅ **Removed redundant configurations** - Cleaned up to focus on development workflow

## Quick Start (3 Steps)

### 1. Install Dependencies
```bash
npm install
cd backend
.venv\Scripts\pip install -r requirements.txt
cd ../frontend
npm install
cd ..
```

### 2. Start Development
**Option A: Using VS Code Launch Configuration**
- Press `F5`
- Select **"Electron: Dev"** configuration
- Electron window opens automatically with frontend and backend running

**Option B: Using npm command**
```bash
# Terminal 1: Start Frontend + Electron compilation watcher
npm run electron:dev

# This automatically:
# 1. Starts Next.js on http://localhost:3000 with HTTP API mode
# 2. Compiles Electron TypeScript in watch mode
# 3. Launches Electron window when Next.js is ready
# 4. Starts backend on dynamic port (logged to console)
```

### 3. Verify Everything Works
- Electron window opens and displays the Next.js app
- Open DevTools (F12) to see logs
- Check that "chat count" API call succeeds
- Backend logs should show in main terminal

## How It Works

**Development Mode Flow:**
```
1. npm run electron:dev is called
2. Terminal 1: tsc compiles electron/*.ts to electron/dist/
3. Terminal 2: waits for http://localhost:3000 to be ready
4. Once ready: electron . is launched
5. Electron main.ts (from dist/) starts
6. Backend: Python spawned with `python -m uvicorn main:app` from venv
7. Frontend: Connects to backend via HTTP adapter on localhost:8000
8. DevTools open automatically for debugging
```

**Backend Discovery:**
- Dev mode: Uses `.venv/Scripts/python.exe` from your project
- Runs: `python -m uvicorn main:app --host 127.0.0.1 --port [available_port] --reload`
- Shows logs in inherited stdio (visible in terminal)
- Auto-reloads on Python changes

## The Single Launch Configuration

**"Electron: Dev"** does this:
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

This:
1. ✅ Starts frontend task first (Next.js on port 3000 with HTTP API mode)
2. ✅ Runs `npm run electron:dev` which compiles TS and waits for frontend
3. ✅ Launches Electron when frontend is ready
4. ✅ Electron main.ts automatically starts Python backend
5. ✅ Opens DevTools for debugging
6. ✅ On exit, cleans up all processes

## npm Scripts Reference

```bash
# Development
npm run electron:dev              # Start Electron dev environment
npm run electron:compile          # Compile Electron TS in watch mode

# Building
npm run build:backend             # Compile Python with PyInstaller
npm run build:frontend            # Build Next.js for Electron (IPC mode)
npm run build:electron            # Compile Electron TS
npm run electron:build            # Full production build (all 3 above)
npm run electron:package          # Create Windows installer
```

## Debugging

### View Logs
- Electron window: Press F12 to open DevTools
- Backend: Visible in terminal (stdout inherited in dev mode)
- Frontend: DevTools console

### Debug Backend API Calls
In DevTools console:
```javascript
// Check that HTTP adapter is being used
const apiClient = await import('./lib/api/factory.js');
console.log(apiClient.getApiClient().constructor.name); // Should be "HttpAdapter"
```

### Debug Electron Main Process
1. In VS Code, set breakpoints in `electron/main.ts`
2. F5 → Select "Electron: Dev"
3. Debugger will attach to main process

## Common Issues & Solutions

### "Backend process error: ENOENT"
**Problem:** Python not found  
**Solution:** 
1. Verify venv is activated: `cd backend && .venv\Scripts\python.exe --version`
2. Check `.venv` folder exists in backend directory
3. Reinstall: `pip install -r requirements.txt`

### "Cannot find module 'uvicorn'"
**Problem:** Dependencies not installed in venv  
**Solution:** `cd backend && .venv\Scripts\pip install uvicorn`

### "Port 3000 already in use"
**Problem:** Next.js dev server still running  
**Solution:** Run "Terminate Dev Processes" task or `taskkill /F /IM node.exe`

### Electron window won't open
**Problem:** Frontend not ready yet  
**Solution:** 
1. Check terminal for Next.js startup errors
2. Wait for "ready started server on" message
3. Check http://localhost:3000 manually in browser

## Production Build

When ready to build for distribution:

```bash
# Full build (compiles backend with PyInstaller, builds frontend for IPC, creates executable)
npm run electron:build

# Create Windows installer
npm run electron:package

# Output files in dist/ folder:
# - BewerbungsBot-1.0.0-x64.exe (portable)
# - BewerbungsBot-1.0.0-x64.msi (installer)
```

## File Structure After Start

```
BewerbungsBot/
├── electron/
│   ├── main.ts, preload.ts (source)
│   ├── dist/
│   │   ├── main.js (compiled)
│   │   └── preload.js (compiled)
│   └── tsconfig.json
├── frontend/
│   ├── .next/ (Next.js build artifacts)
│   ├── node_modules/
│   └── lib/api/ (adapter pattern)
├── backend/
│   ├── main.py
│   ├── .venv/ (virtual environment)
│   └── requirements.txt
└── node_modules/
```

## Next: Customization

After verifying everything works:

1. **Add more API endpoints** - Expand `backend/main.py` with more routes
2. **Build UI components** - Add to `frontend/components/`
3. **Implement features** - Both frontend and backend can be developed normally
4. **Hot reload** - Changes to Python/frontend auto-reload in dev mode

---

**Status:** ✅ Ready to develop  
**Launch Config:** Single "Electron: Dev" configuration  
**Backend:** Uses venv Python, auto-started, visible logs  
**Ready to ship:** `npm run electron:package`
