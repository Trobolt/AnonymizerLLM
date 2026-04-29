from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI(title="BewerbungsBot Backend")

# In-memory chat storage (for debugging)
chat_ids = list(range(1, 10, 2))  # [1, 3, 5, 7, 9]
next_chat_id = 10

# Configure CORS to allow requests from React frontend and Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Next.js dev server
        "http://localhost:3001",      # Alternative Next.js port
        "http://127.0.0.1:3000",      # Localhost IPv4
        "http://127.0.0.1:3001",      # Localhost IPv4 alternative
        "http://localhost:8000",      # Allow calls to same backend
        "http://127.0.0.1:8000",      # Localhost IPv4 backend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/chats/list")
async def get_chats_list():
    """
    Returns a list of chat IDs.
    """
    return {"chat_ids": chat_ids}


@app.post("/api/chats/add")
async def add_chat():
    """
    Creates a new chat and returns the new chat ID.
    """
    global next_chat_id
    new_chat_id = next_chat_id
    next_chat_id += 1
    chat_ids.append(new_chat_id)
    return {"chat_id": new_chat_id}


@app.post("/api/chats/{chat_id}/remove")
async def remove_chat(chat_id: int):
    """
    Removes a chat by its ID.
    Prints the chat_id to console for debugging.
    TODO: Later, this should delete the chat from the database.
    """
    print(f"Removing chat with ID: {chat_id}")
    if chat_id in chat_ids:
        chat_ids.remove(chat_id)
    return {"status": "success", "removed_chat_id": chat_id}


@app.get("/api/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int):
    """
    Returns the messages for a specific chat.
    Currently returns a test message: "hello world [chatid]"
    """
    return {
        "chat_id": chat_id,
        "messages": [
            {"role": "model", "content": f"hello world {chat_id}"}
        ]
    }


@app.post("/api/chats/{chat_id}/message")
async def send_message(chat_id: int, request_body: dict):
    """
    Sends a message to a chat and streams the response token by token.
    Request body should contain: {"message": "user message"}
    Streams tokens separated by newlines in JSON format: {"token": "word"}
    """
    user_message = request_body.get("message", "")
    
    async def token_generator():
        # Stream tokens with delay (simulating LLM)
        response_text = f"Response to '{3*user_message}' in chat {chat_id}"
        words = response_text.split()
        
        for i, word in enumerate(words):
            # Add space between words except for the first one
            token = (word + " ") if i < len(words) - 1 else word
            
            # Yield token as JSON
            yield json.dumps({"token": token}) + "\n"
            
            # Simulate token delay (like streaming from LLM)
            await asyncio.sleep(0.05)
    
    return StreamingResponse(
        token_generator(),
        media_type="application/x-ndjson"
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok"}

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
