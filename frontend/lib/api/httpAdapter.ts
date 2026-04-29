import { ApiClient, ApiResponse } from './types';

/**
 * HTTP-based API adapter
 * Uses fetch to communicate with backend on localhost
 * Primary adapter for development mode
 */
export class HttpAdapter implements ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
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
      const fullUrl = `${this.baseUrl}${url}`;
      const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, browser will set it with boundary
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'File upload failed');
      }
      return data as T;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Internal method to make HTTP requests
   */
  private async request(method: string, url: string, data?: any): Promise<ApiResponse> {
    try {
      const fullUrl = `${this.baseUrl}${url}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(fullUrl, options);
      const responseData = await response.json().catch(() => ({}));

      return {
        success: response.ok,
        data: responseData,
        status: response.status,
        error: !response.ok ? responseData.error || `HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      console.error(`HTTP ${method} request error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
      };
    }
  }
}
