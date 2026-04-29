import { ApiClient, ApiResponse } from './types';

/**
 * IPC-based API adapter
 * Uses Electron IPC to communicate with backend through main process
 * Primary adapter for production mode
 */
export class IpcAdapter implements ApiClient {
  private electronApi: any;

  constructor() {
    // Access the exposed Electron API from preload script
    this.electronApi = (window as any).electronApi;
    if (!this.electronApi) {
      throw new Error('Electron API not available. Make sure preload script is loaded.');
    }
  }

  async get<T = any>(url: string): Promise<T> {
    const response = await this.request('GET', url);
    if (!response.success) {
      throw new Error(response.error || 'GET request failed');
    }
    return response.data as T;
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.request('POST', url, data);
    if (!response.success) {
      throw new Error(response.error || 'POST request failed');
    }
    return response.data as T;
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.request('PUT', url, data);
    if (!response.success) {
      throw new Error(response.error || 'PUT request failed');
    }
    return response.data as T;
  }

  async delete<T = any>(url: string): Promise<T> {
    const response = await this.request('DELETE', url);
    if (!response.success) {
      throw new Error(response.error || 'DELETE request failed');
    }
    return response.data as T;
  }

  async patch<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.request('PATCH', url, data);
    if (!response.success) {
      throw new Error(response.error || 'PATCH request failed');
    }
    return response.data as T;
  }

  async uploadFile<T = any>(url: string, formData: FormData): Promise<T> {
    try {
      // Convert FormData to object for IPC transmission
      const data: any = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      const response = await this.request('POST', url, data);
      if (!response.success) {
        throw new Error(response.error || 'File upload failed');
      }
      return response.data as T;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  getBaseUrl(): string {
    return 'ipc://backend';
  }

  /**
   * Internal method to make IPC requests
   */
  private async request(method: string, url: string, data?: any): Promise<ApiResponse> {
    try {
      if (!this.electronApi?.apiRequest) {
        throw new Error('electronApi.apiRequest is not available');
      }

      const result = await this.electronApi.apiRequest(method, url, data);

      return {
        success: result.success,
        data: result.data,
        status: result.status,
        error: result.error,
      };
    } catch (error) {
      console.error(`IPC ${method} request error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
      };
    }
  }
}
