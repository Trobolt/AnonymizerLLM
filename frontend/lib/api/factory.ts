import { ApiClient } from './types';
import { HttpAdapter } from './httpAdapter';
import { IpcAdapter } from './ipcAdapter';

let apiClientInstance: ApiClient | null = null;

/**
 * Factory function to create and return the appropriate API client adapter
 * Uses environment variables to determine which adapter to use:
 * - NEXT_PUBLIC_API_MODE='http': Use HTTP adapter (development)
 * - NEXT_PUBLIC_API_MODE='ipc': Use IPC adapter (production in Electron)
 * - Default: HTTP adapter for development
 */
export function getApiClient(): ApiClient {
  // Return cached instance if already created
  if (apiClientInstance) {
    return apiClientInstance;
  }

  const apiMode = process.env.NEXT_PUBLIC_API_MODE || 'http';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  try {
    // Only use IPC adapter if we're in a browser environment (not during SSR)
    if (apiMode === 'ipc' && typeof window !== 'undefined') {
      console.log('Using IPC adapter for API communication');
      apiClientInstance = new IpcAdapter();
    } else {
      console.log(`Using HTTP adapter for API communication (${backendUrl})`);
      apiClientInstance = new HttpAdapter(backendUrl);
    }
  } catch (error) {
    console.warn('Failed to create IPC adapter, falling back to HTTP:', error);
    apiClientInstance = new HttpAdapter(backendUrl);
  }

  return apiClientInstance;
}

/**
 * Reset the API client (useful for testing or switching modes)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

/**
 * Get the current API mode (adapter type)
 */
export function getApiMode(): 'http' | 'ipc' {
  // Only use IPC adapter if we're in a browser environment (not during SSR)
  const apiMode = process.env.NEXT_PUBLIC_API_MODE || 'http';
  if (apiMode === 'ipc' && typeof window !== 'undefined') {
    return 'ipc';
  }
  return 'http';
}

/**
 * Export a default instance
 */
export const apiClient = getApiClient();
