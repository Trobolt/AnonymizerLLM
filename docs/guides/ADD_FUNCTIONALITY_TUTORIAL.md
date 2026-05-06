# 🚀 Tutorial: Adding New Backend Functionalities

A step-by-step guide to add new features using the **Adapter Pattern** in BewerbungsBot.

---

## 🎯 Overview: How It Works

The project uses the **Adapter Pattern** to switch between HTTP (development) and IPC (production) communication automatically:

```
Frontend Component
    ↓
getApiClient() [factory.ts]
    ↓
HttpAdapter (dev) OR IpcAdapter (prod)
    ↓
Backend (FastAPI - main.py)
```

Both adapters implement the same `ApiClient` interface, so **you write the same code in the frontend regardless of the mode**.

---

## 📋 Step-by-Step: Adding a New Functionality

Let's say you want to add a feature to **fetch user profile data** from the backend.

### **Step 1: Add the Backend Endpoint** 
**File:** `backend/main.py`

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BewerbungsBot Backend")

# ... existing CORS configuration ...

# ✅ NEW ENDPOINT: Get user profile
@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str):
    """
    Returns user profile data.
    TODO: Query database for actual user data
    """
    # Example response
    return {
        "id": user_id,
        "name": "Max Mustermann",
        "email": "max@example.com",
        "created_at": "2024-01-15"
    }

# ✅ NEW ENDPOINT: Update user profile
@app.put("/api/users/{user_id}")
async def update_user_profile(user_id: str, data: dict):
    """
    Updates user profile with new data.
    """
    return {
        "success": True,
        "message": f"User {user_id} updated successfully",
        "data": data
    }

# Existing endpoints...
```

**Best Practices:**
- Use RESTful routes: `/api/resource/{id}` or `/api/resource/action`
- Follow HTTP methods: GET (read), POST (create), PUT (update), DELETE (delete)
- Return consistent response format: `{success, data, error}`
- Add docstrings explaining the endpoint

---

### **Step 2: Create a Typed Response Interface**
**File:** `frontend/lib/api/types.ts`

```typescript
// ...existing interfaces...

/**
 * User Profile Response from backend
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Generic success response wrapper
 */
export interface SuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}
```

---

### **Step 3: Add High-Level API Function**
**File:** `frontend/lib/api.ts`

```typescript
import { getApiClient } from './api/factory';
import { UserProfile, SuccessResponse } from './api/types';

/**
 * Fetch user profile data from backend
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const client = getApiClient();
  return client.get<UserProfile>(`/api/users/${userId}`);
}

/**
 * Update user profile on backend
 */
export async function updateUserProfile(
  userId: string,
  profileData: Partial<UserProfile>
): Promise<SuccessResponse> {
  const client = getApiClient();
  return client.put<SuccessResponse>(`/api/users/${userId}`, profileData);
}

// Existing functions...
```

**Key Points:**
- Always use `getApiClient()` - it handles adapter selection automatically
- Type your responses with TypeScript interfaces
- Use generic type parameter: `client.get<UserProfile>(...)`
- Keep API functions in `lib/api.ts` - this is your API layer

---

### **Step 4: Use the API in Your Component**
**File:** `frontend/components/UserProfile.tsx` (new component)

```typescript
'use client'; // Next.js client component

import { useState, useEffect } from 'react';
import { fetchUserProfile, updateUserProfile } from '@/lib/api';
import { UserProfile } from '@/lib/api/types';

export function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProfile(userId);
        setProfile(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleUpdateProfile = async () => {
    if (!profile) return;

    try {
      const result = await updateUserProfile(userId, {
        name: 'Updated Name',
        email: 'newemail@example.com'
      });

      if (result.success) {
        alert('Profile updated successfully!');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!profile) return <div>No profile found</div>;

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-bold">{profile.name}</h2>
      <p className="text-gray-600">{profile.email}</p>
      <p className="text-sm text-gray-500">Joined: {profile.created_at}</p>
      <button
        onClick={handleUpdateProfile}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Update Profile
      </button>
    </div>
  );
}
```

**Key Points:**
- Use `'use client'` directive for client-side components
- Handle loading, error, and success states
- Always wrap API calls in try-catch
- Use the functions from `lib/api.ts` - not the client directly

---

## 📚 Complete Example: Adding a "Get All Users" Feature

### Backend (main.py)
```python
@app.get("/api/users")
async def get_all_users():
    """List all users."""
    return {
        "users": [
            {"id": "1", "name": "Alice", "email": "alice@example.com"},
            {"id": "2", "name": "Bob", "email": "bob@example.com"},
        ]
    }
```

### Types (frontend/lib/api/types.ts)
```typescript
export interface UsersListResponse {
  users: UserProfile[];
}
```

### API Layer (frontend/lib/api.ts)
```typescript
export async function fetchAllUsers(): Promise<UsersListResponse> {
  const client = getApiClient();
  return client.get<UsersListResponse>('/api/users');
}
```

### Component (frontend/components/UsersList.tsx)
```typescript
'use client';

import { useState, useEffect } from 'react';
import { fetchAllUsers } from '@/lib/api';
import { UserProfile } from '@/lib/api/types';

export function UsersList() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    fetchAllUsers()
      .then(response => setUsers(response.users))
      .catch(err => console.error('Failed to fetch users:', err));
  }, []);

  return (
    <div>
      {users.map(user => (
        <div key={user.id} className="border-b p-2">
          {user.name} ({user.email})
        </div>
      ))}
    </div>
  );
}
```

---

## ✅ Checklist: Adding a New Functionality

- [ ] **Backend**: Add FastAPI endpoint in `main.py` with proper HTTP method
- [ ] **Types**: Define TypeScript interface in `frontend/lib/api/types.ts`
- [ ] **API Layer**: Create function in `frontend/lib/api.ts` using `getApiClient()`
- [ ] **Component**: Use the API function in your React component with error handling
- [ ] **Test**: Run with both HTTP mode (`npm run dev:web`) and see if it works

---

## 🔄 Why This Pattern Works

### Development Mode (HTTP)
```
Component → fetchUserProfile()
        ↓
        getApiClient() returns HttpAdapter
        ↓
        fetch("http://localhost:8000/api/users/123")
        ↓
        Backend responds with JSON
```

### Production Mode (IPC - Electron)
```
Component → fetchUserProfile()
        ↓
        getApiClient() returns IpcAdapter
        ↓
        window.electronApi.apiRequest('GET', '/api/users/123')
        ↓
        Electron Main Process (IPC)
        ↓
        Backend responds via IPC
```

**Same code in your component - different transport automatically!** 🎉

---

## 🎨 Common API Patterns

### GET Request (Fetch Data)
```typescript
// Backend
@app.get("/api/data/{id}")
async def get_data(id: str):
    return {"id": id, "data": "..."}

// Frontend
export async function fetchData(id: string): Promise<Data> {
  return getApiClient().get<Data>(`/api/data/${id}`);
}
```

### POST Request (Create)
```typescript
// Backend
@app.post("/api/items")
async def create_item(item: dict):
    return {"success": True, "item": item}

// Frontend
export async function createItem(name: string): Promise<SuccessResponse> {
  return getApiClient().post<SuccessResponse>('/api/items', { name });
}
```

### PUT Request (Update)
```typescript
// Backend
@app.put("/api/items/{id}")
async def update_item(id: str, data: dict):
    return {"success": True, "data": data}

// Frontend
export async function updateItem(id: string, data: any): Promise<SuccessResponse> {
  return getApiClient().put<SuccessResponse>(`/api/items/${id}`, data);
}
```

### DELETE Request (Remove)
```typescript
// Backend
@app.delete("/api/items/{id}")
async def delete_item(id: str):
    return {"success": True, "message": f"Deleted {id}"}

// Frontend
export async function deleteItem(id: string): Promise<SuccessResponse> {
  return getApiClient().delete<SuccessResponse>(`/api/items/${id}`);
}
```

---

## 🐛 Debugging Tips

### Check which adapter is being used:
```typescript
import { getApiMode } from '@/lib/api/factory';

console.log('Current API mode:', getApiMode()); // 'http' or 'ipc'
```

### Network requests (HTTP mode):
- Open browser DevTools → Network tab
- Make a request and see the full HTTP request/response

### IPC requests (Production):
- Open DevTools → Console
- Check Electron logs in the main process console

### Test endpoint quickly:
```bash
# While backend is running
curl http://localhost:8000/api/users/123
```

---

## 📖 Reference Files

- **API Adapter Pattern**: [frontend/lib/api/factory.ts](../frontend/lib/api/factory.ts)
- **API Types**: [frontend/lib/api/types.ts](../frontend/lib/api/types.ts)
- **HTTP Adapter**: [frontend/lib/api/httpAdapter.ts](../frontend/lib/api/httpAdapter.ts)
- **IPC Adapter**: [frontend/lib/api/ipcAdapter.ts](../frontend/lib/api/ipcAdapter.ts)
- **API Layer**: [frontend/lib/api.ts](../frontend/lib/api.ts)
- **Backend**: [backend/main.py](../backend/main.py)

---

## ⚡ Quick Start: Add "Get Stats" Feature

**1. Backend** (`backend/main.py`):
```python
@app.get("/api/stats")
async def get_stats():
    return {"chats": 5, "messages": 42, "users": 10}
```

**2. Types** (`frontend/lib/api/types.ts`):
```typescript
export interface Stats {
  chats: number;
  messages: number;
  users: number;
}
```

**3. API** (`frontend/lib/api.ts`):
```typescript
export async function fetchStats(): Promise<Stats> {
  return getApiClient().get<Stats>('/api/stats');
}
```

**4. Component** (in any `.tsx` file):
```typescript
const stats = await fetchStats();
console.log(`You have ${stats.chats} chats`);
```

**Done!** Works in both HTTP and IPC mode automatically! ✨
