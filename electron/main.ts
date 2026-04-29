import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { spawn, ChildProcess, spawnSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { createServer } from 'http';
import { existsSync } from 'fs';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendPort: number = 8000;

const isDev = process.env.NODE_ENV === 'development';

/**
 * Find an available port by attempting to listen on a port
 */
async function findAvailablePort(startPort: number = 8000): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Get Python executable path from venv
 */
function getPythonExe(): string {
  // Try multiple paths to find the venv Python
  const possiblePaths = [
    // From compiled dist folder (dev mode)
    path.join(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe'),
    // From app root (if running as packaged)
    path.join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe'),
    // Fallback to relative path from project root
    path.join(process.cwd(), 'backend', '.venv', 'Scripts', 'python.exe'),
  ];

  console.log(`[getPythonExe] Current working directory: ${process.cwd()}`);
  console.log(`[getPythonExe] __dirname: ${__dirname}`);
  console.log(`[getPythonExe] app.getAppPath(): ${app.getAppPath()}`);

  for (const pythonPath of possiblePaths) {
    console.log(`[getPythonExe] Checking: ${pythonPath}`);
    if (existsSync(pythonPath)) {
      console.log(`[getPythonExe] ✓ Found at: ${pythonPath}`);
      return pythonPath;
    }
  }

  console.log(`[getPythonExe] ⚠ No venv Python found, falling back to system python`);
  return 'python';
}

/**
 * Spawn the Python backend process
 */
async function startBackend(): Promise<number> {
  try {
    const port = await findAvailablePort(8000);
    backendPort = port;

    // Backend directory is at project root, not under electron/
    // __dirname is: C:\...\BewerbungsBot\electron\dist
    // We need: C:\...\BewerbungsBot\backend
    const backendDir = path.join(__dirname, '..', '..', 'backend');
    let backendProcessLocal: ChildProcess;

    if (isDev) {
      // Development: Run uvicorn directly with Python from venv
      const pythonExe = getPythonExe();
      console.log(`Starting backend with Python: ${pythonExe}`);
      console.log(`Backend directory: ${backendDir}`);

      // Use spawn without shell - the path should now be correct
      backendProcessLocal = spawn(pythonExe, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', port.toString(), '--reload'], {
        cwd: backendDir,
        env: {
          ...process.env,
          PYTHONPATH: backendDir,
        },
        stdio: isDev ? 'inherit' : 'ignore',
      });
    } else {
      // Production: Run compiled PyInstaller executable
      const appExe = path.join(process.resourcesPath, 'backend', 'app.exe');
      console.log(`Starting backend from: ${appExe}`);

      if (!existsSync(appExe)) {
        throw new Error(`Backend executable not found at ${appExe}`);
      }

      backendProcessLocal = spawn(appExe, [], {
        cwd: path.join(process.resourcesPath, 'backend'),
        env: {
          ...process.env,
          PORT: port.toString(),
        },
        stdio: 'ignore',
      });
    }

    // Store in module-level variable for cleanup
    backendProcess = backendProcessLocal;

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });

    // Wait for backend to start
    await new Promise((resolve) => setTimeout(resolve, isDev ? 3000 : 2000));

    return port;
  } catch (error) {
    console.error('Failed to start backend:', error);
    throw error;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  console.log('[createWindow] Creating browser window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,  // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000' // Next.js dev server
    : `file://${path.join(process.resourcesPath, 'frontend', 'out', 'index.html')}`; // Static export

  console.log(`[createWindow] Loading app from: ${startUrl}`);
  
  mainWindow.loadURL(startUrl).then(() => {
    console.log('[createWindow] ✓ URL loaded successfully');
    mainWindow?.show();  // Show window after content loads
    console.log('[createWindow] ✓ Window shown');
    
    if (isDev) {
      console.log('[createWindow] Opening DevTools...');
      mainWindow?.webContents.openDevTools();
    }
  }).catch((err) => {
    console.error('[createWindow] ✗ Failed to load URL:', err);
    // Fallback to a simple error page
    mainWindow?.loadURL(`data:text/html,<h1>Failed to load application</h1><p>${err.message}</p>`);
  });

  mainWindow.on('closed', () => {
    console.log('[createWindow] Window closed');
    mainWindow = null;
  });
  
  mainWindow.on('ready-to-show', () => {
    console.log('[createWindow] Window ready-to-show');
  });
}

/**
 * IPC Handlers for API communication
 */
ipcMain.handle('api:get-backend-port', () => {
  return backendPort;
});

ipcMain.handle('api:request', async (event, { method, url, body }) => {
  try {
    const backendUrl = `http://127.0.0.1:${backendPort}${url}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(backendUrl, options);
    const data = await response.json();

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('API request error:', error);
    return { success: false, error: String(error), status: 500 };
  }
});

/**
 * App lifecycle handlers
 */
app.on('ready', async () => {
  try {
    if (!isDev) {
      // Production only: start the bundled PyInstaller backend executable.
      // In development the backend is already running (started separately).
      await startBackend();
    }
    // Create window
    createWindow();
    // Create menu
    createMenu();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Graceful shutdown: kill backend process
 */
app.on('before-quit', () => {
  if (backendProcess) {
    console.log('Killing backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
});

/**
 * Create application menu
 */
function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      ],
    },
  ];

  if (isDev) {
    template.push({
      label: 'Dev',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
