/**
 * Abstract interface for API client implementations
 * Allows switching between HTTP and IPC adapters without changing business logic
 */
export interface ApiClient {
  /**
   * Make a GET request
   */
  get<T = any>(url: string): Promise<T>;

  /**
   * Make a POST request
   */
  post<T = any>(url: string, data?: any): Promise<T>;

  /**
   * Make a PUT request
   */
  put<T = any>(url: string, data?: any): Promise<T>;

  /**
   * Make a DELETE request
   */
  delete<T = any>(url: string): Promise<T>;

  /**
   * Make a PATCH request
   */
  patch<T = any>(url: string, data?: any): Promise<T>;

  /**
   * Upload a file
   */
  uploadFile<T = any>(url: string, formData: FormData): Promise<T>;

  /**
   * Get the current API base URL (for debugging/logging)
   */
  getBaseUrl(): string;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}
