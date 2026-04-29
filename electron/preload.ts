import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose safe APIs to the renderer process
 * This provides a bridge between the frontend and Electron main process
 */
contextBridge.exposeInMainWorld('electronApi', {
  /**
   * Get the backend port for HTTP requests (mainly for dev mode)
   */
  getBackendPort: async (): Promise<number> => {
    return await ipcRenderer.invoke('api:get-backend-port');
  },

  /**
   * Make API request through IPC
   * @param method HTTP method (GET, POST, etc.)
   * @param url API endpoint path (e.g., '/api/chats/count')
   * @param body Request body (optional)
   * @returns Response with success status, data, and HTTP status code
   */
  apiRequest: async (method: string, url: string, body?: any) => {
    return await ipcRenderer.invoke('api:request', { method, url, body });
  },
});

/**
 * Type definitions for TypeScript support
 */
declare global {
  interface Window {
    electronApi: {
      getBackendPort: () => Promise<number>;
      apiRequest: (method: string, url: string, body?: any) => Promise<any>;
    };
  }
}
