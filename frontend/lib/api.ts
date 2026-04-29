import { getApiClient } from './api/factory';

export interface ChatIdsResponse {
  chat_ids: number[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatMessagesResponse {
  chat_id: number;
  messages: ChatMessage[];
}

/**
 * Fetches the list of chat IDs from the backend.
 * Uses the API adapter pattern to work with both HTTP and IPC backends.
 * @returns Promise with the list of chat IDs from the server
 * @throws Error if the request fails
 */
export async function fetchChatList(): Promise<ChatIdsResponse> {
  try {
    const apiClient = getApiClient();
    const data = await apiClient.get<ChatIdsResponse>('/api/chats/list');
    return data;
  } catch (error) {
    console.error("Error fetching chat list from backend:", error);
    throw error;
  }
}

/**
 * Fetches messages for a specific chat.
 * @param chatId The ID of the chat
 * @returns Promise with the chat messages
 * @throws Error if the request fails
 */
export async function fetchChatMessages(chatId: number): Promise<ChatMessagesResponse> {
  try {
    const apiClient = getApiClient();
    const data = await apiClient.get<ChatMessagesResponse>(`/api/chats/${chatId}/messages`);
    return data;
  } catch (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Sends a message to a chat and streams the response.
 * Returns a reader that streams tokens as newline-delimited JSON.
 * @param chatId The ID of the chat
 * @param message The user message
 * @returns A ReadableStreamDefaultReader for reading tokens
 * @throws Error if the request fails
 */
export async function streamChatMessage(chatId: number, message: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  try {
    const apiClient = getApiClient();
    // Use fetch directly for streaming support
    const response = await fetch(`http://localhost:8000/api/chats/${chatId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return response.body.getReader();
  } catch (error) {
    console.error(`Error streaming message to chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Creates a new chat on the backend.
 * @returns Promise with the new chat ID
 * @throws Error if the request fails
 */
export async function addChat(): Promise<{ chat_id: number }> {
  try {
    const apiClient = getApiClient();
    const data = await apiClient.post<{ chat_id: number }>('/api/chats/add');
    return data;
  } catch (error) {
    console.error("Error creating new chat:", error);
    throw error;
  }
}

/**
 * Removes a chat from the backend.
 * @param chatId The ID of the chat to remove
 * @returns Promise with the removal status
 * @throws Error if the request fails
 */
export async function removeChat(chatId: number): Promise<{ status: string; removed_chat_id: number }> {
  try {
    const apiClient = getApiClient();
    const data = await apiClient.post<{ status: string; removed_chat_id: number }>(`/api/chats/${chatId}/remove`);
    return data;
  } catch (error) {
    console.error(`Error removing chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Generic API request handler for other endpoints
 * @param method HTTP method
 * @param url API endpoint
 * @param data Request body (optional)
 */
export async function apiRequest<T = any>(method: string, url: string, data?: any): Promise<T> {
  try {
    const apiClient = getApiClient();

    switch (method.toUpperCase()) {
      case 'GET':
        return await apiClient.get<T>(url);
      case 'POST':
        return await apiClient.post<T>(url, data);
      case 'PUT':
        return await apiClient.put<T>(url, data);
      case 'DELETE':
        return await apiClient.delete<T>(url);
      case 'PATCH':
        return await apiClient.patch<T>(url, data);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  } catch (error) {
    console.error(`API ${method} request failed:`, error);
    throw error;
  }
}
