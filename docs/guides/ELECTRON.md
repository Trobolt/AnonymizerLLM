# Electron Desktop App Setup Guide

This document explains how to build and run BewerbungsBot as an Electron desktop application that bundles the Next.js frontend and Python FastAPI backend into a single executable.

## Overview

The Electron setup consists of:

- **Electron Main Process** (`electron/main.ts`): Manages the app lifecycle, spawns the Python backend process, and handles IPC communication
- **Frontend** (Next.js): Runs as a dev server during development or as a standalone build in production
- **Backend** (Python FastAPI): Compiled to a `.exe` using PyInstaller and spawned as a subprocess by Electron
- **API Adapter Pattern**: Seamlessly switches between HTTP (development) and IPC (production) communication

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Virtual environment activated in the backend folder

## Quick Start

### Development Mode

Start the full Electron development stack:

```bash
npm run electron:dev
```

This command:
1. Compiles TypeScript in the electron folder to JavaScript
2. Starts the Next.js dev server with HTTP API mode
3. Launches Electron with the frontend and backend

Alternatively, use the VS Code task **"Electron: Dev"** from the Tasks menu.

### Building for Production

Build the complete app package:

```bash
npm run electron:build
```

This command:
1. Builds the backend using PyInstaller (`backend/build.ps1`)
2. Builds the frontend with IPC API mode enabled
3. Compiles the Electron main/preload TypeScript files

### Creating an Installer

Generate the Windows installer:

```bash
npm run electron:package
```

This creates an installer in the `dist/` folder.

## Project Structure

```
BewerbungsBot/
├── electron/
│   ├── main.ts           # Electron main process entry point
│   ├── preload.ts        # IPC bridge for secure communication
│   ├── dist/             # Compiled JavaScript (created during build)
│   └── tsconfig.json     # TypeScript configuration
├── frontend/
│   ├── lib/api/
│   │   ├── types.ts      # ApiClient interface
│   │   ├── httpAdapter.ts # HTTP adapter (dev mode)
│   │   ├── ipcAdapter.ts # IPC adapter (production mode)
│   │   └── factory.ts    # Adapter factory and getApiClient()
│   ├── lib/api.ts        # Refactored to use adapter pattern
│   └── next.config.ts    # Configured for standalone output
├── backend/
│   ├── main.py           # FastAPI app
│   ├── requirements.txt   # Python dependencies
│   ├── pyinstaller.spec  # PyInstaller configuration
│   ├── build.ps1         # PowerShell build script
│   ├── dist/backend/     # Compiled executable (created during build)
│   └── .venv/            # Virtual environment
├── electron-builder.yml  # Electron build configuration
├── package.json          # Root npm dependencies and scripts
├── .vscode/
│   ├── tasks.json        # VS Code tasks for Electron dev/build
│   └── launch.json       # VS Code debug configurations
└── .gitignore            # Git ignore rules for builds and dependencies
```

## API Communication

### Development Mode (HTTP)

In development, the frontend communicates with the backend via HTTP on localhost:

```typescript
const apiClient = getApiClient();
const chatCount = await apiClient.get('/api/chats/count');
```

This uses the `HttpAdapter` which makes fetch requests to `http://localhost:8000`.

### Production Mode (IPC)

In the packaged Electron app, the frontend communicates via Electron IPC:

```typescript
const apiClient = getApiClient();
const chatCount = await apiClient.get('/api/chats/count');
```

This uses the `IpcAdapter` which sends messages through Electron's IPC channel to the main process, which then forwards to the backend.

The API layer automatically detects the environment and uses the appropriate adapter.

## VS Code Integration

### Tasks

Available tasks in VS Code:

- **Electron: Dev** (Ctrl+Shift+B) - Start development environment
- **Electron: Compile TypeScript** - Compile electron TypeScript files
- **Build Backend (PyInstaller)** - Build Python executable
- **Build Frontend (Electron)** - Build Next.js for Electron
- **Electron: Full Build** - Complete production build
- **Electron: Package App** - Create installer
- **Terminate Dev Processes** - Stop running processes

### Debug Configurations

Available debug configurations in VS Code:

- **Electron: Main Process** - Debug the Electron main process
- **Electron: Full Stack Dev** - Debug the complete stack
- **Backend: Python FastAPI** - Debug the Python backend
- **Frontend: Next.js Dev (Electron)** - Debug the Next.js app
- **Electron: Dev (Full Stack)** - Compound debug configuration for all three

To debug, select a configuration from the Debug menu and press F5.

## Building the Backend

### Initial Setup

Install PyInstaller in the backend virtual environment:

```bash
cd backend
.venv\Scripts\pip install pyinstaller
```

Or reinstall dependencies:

```bash
.venv\Scripts\pip install -r requirements.txt
```

### Building

Build the backend executable:

```bash
cd backend
powershell -ExecutionPolicy RemoteSigned -File build.ps1
```

Or use the VS Code task **"Build Backend (PyInstaller)"**.

This creates:
- `backend/dist/backend/app.exe` - Main executable
- `backend/dist/backend/` - All dependencies bundled

### Custom PyInstaller Options

Edit `backend/pyinstaller.spec` to customize:
- Hidden imports
- Icon files
- Console window behavior
- Single-file vs one-folder mode

## Environment Variables

### Frontend

- `NEXT_PUBLIC_API_MODE` - Set to `http` (dev) or `ipc` (production)
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL for HTTP mode (default: `http://localhost:8000`)

### Backend

- `PORT` - Port to listen on (set by Electron automatically)
- `PYTHONPATH` - Python path (set by Electron and build scripts)

### Electron

- `NODE_ENV` - Set to `development` or `production`

## Architecture Decisions

### API Adapter Pattern

The API adapter pattern provides:

- **Flexibility**: Switch between HTTP and IPC without changing UI code
- **Testing**: Easy to mock API calls with different adapters
- **Type Safety**: Full TypeScript support with the `ApiClient` interface

### PyInstaller vs Conda

PyInstaller is chosen over Conda/Anaconda because it:

- Creates smaller standalone executables
- Requires no runtime distribution
- Easier to bundle with Electron

### Standalone Next.js Build

The Next.js standalone output is used for production because it:

- Reduces dependencies (no Node.js required at runtime)
- Optimizes for the bundled Electron context
- Improves startup performance

### IPC in Production, HTTP in Development

This approach:

- Makes debugging easier during development (direct HTTP inspection)
- Provides more secure communication in production (IPC)
- Eliminates port conflicts in development

## Troubleshooting

### Backend Not Starting

1. Check that Python is in PATH: `python --version`
2. Verify backend virtual environment is activated
3. Check that port 8000 is not already in use
4. Look for errors in the Electron console (F12)

### Frontend Not Loading

1. Verify Next.js dev server is running: `npm run dev:electron` in frontend folder
2. Check that environment variables are set correctly
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### IPC Adapter Not Working

1. Ensure preload.ts script is loaded: Check browser DevTools console for `window.electronApi`
2. Verify IPC handlers in main.ts are registered
3. Check that API requests include the correct URL path (must start with `/`)

### PyInstaller Build Failures

1. Update PyInstaller: `pip install --upgrade pyinstaller`
2. Check for hidden imports needed by your dependencies
3. Try one-file vs one-folder mode in pyinstaller.spec
4. Look at build logs in `backend/build/`

## Next Steps

### Auto-Updater

Add electron-updater for automatic app updates:

```bash
npm install electron-updater
```

### Code Signing

Configure code signing in `electron-builder.yml` for production:

- Windows: Code signing certificate required
- macOS: Apple Developer certificate required

### Crash Reporting

Integrate crash reporting with services like Sentry or Electron's built-in features.

### macOS/Linux Support

Extend builds to additional platforms by adding targets in `electron-builder.yml`.

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [PyInstaller Documentation](https://pyinstaller.readthedocs.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## Support

For issues or questions, refer to the GitHub issues or consult the documentation links above.
