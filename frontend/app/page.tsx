"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatInterface from "../components/ChatInterface";
import Settings from "../components/Settings";
import {
  fetchChatList,
  fetchChatMessages,
  addChat,
  removeChat,
} from "../lib/api";

// Typen definieren
export type Message = { role: "user" | "model"; content: string };
export type Chat = { id: number; title: string; messages: Message[] };

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<number[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Fetch chat IDs from backend on mount; auto-create one if none exist so
  // the user always has a chat to talk to the parrot in.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        let ids = (await fetchChatList()).chat_ids;
        if (ids.length === 0) {
          await addChat();
          ids = (await fetchChatList()).chat_ids;
        }
        setChatIds(ids);
        if (ids.length > 0) {
          setActiveChatId((current) => current ?? ids[0]);
        }
      } catch (error) {
        console.error("Failed to bootstrap chat list:", error);
        setChatIds([]);
      }
    };

    bootstrap();
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (activeChatId == null) return;
    const chatId = activeChatId;
    const loadChatMessages = async () => {
      setLoadingChat(true);
      try {
        const response = await fetchChatMessages(chatId);

        // Update or create chat with messages from backend
        setChats((prev) => {
          const existingChat = prev.find((c) => c.id === chatId);
          if (existingChat) {
            return prev.map((c) =>
              c.id === chatId ? { ...c, messages: response.messages } : c
            );
          } else {
            return [
              ...prev,
              {
                id: chatId,
                title: `Chat ${chatId}`,
                messages: response.messages,
              },
            ];
          }
        });
      } catch (error) {
        console.error(`Failed to fetch messages for chat ${chatId}:`, error);
        // Create empty chat if fetch fails
        setChats((prev) => {
          const existingChat = prev.find((c) => c.id === chatId);
          if (!existingChat) {
            return [
              ...prev,
              {
                id: chatId,
                title: `Chat ${chatId}`,
                messages: [],
              },
            ];
          }
          return prev;
        });
      } finally {
        setLoadingChat(false);
      }
    };

    loadChatMessages();
  }, [activeChatId]);

  // Den aktuell ausgewählten Chat finden
  const activeChat =
    activeChatId != null
      ? chats.find((c) => c.id === activeChatId) || {
          id: activeChatId,
          title: `Chat ${activeChatId}`,
          messages: [],
        }
      : null;

  const updateMessages = (newMessages: Message[]) => {
    if (activeChatId == null) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId ? { ...c, messages: newMessages } : c
      )
    );
  };

  const handleAddChat = async () => {
    try {
      await addChat();
      // Refresh chat list after adding
      const listResult = await fetchChatList();
      setChatIds(listResult.chat_ids);
    } catch (error) {
      console.error("Failed to add new chat:", error);
    }
  };

  const handleDeleteChat = async (id: number) => {
    try {
      await removeChat(id);
      // Refresh chat list after removing
      const listResult = await fetchChatList();
      setChatIds(listResult.chat_ids);

      // Also update local chats state
      const updatedChats = chats.filter((chat) => chat.id !== id);
      setChats(updatedChats);

      // Switch to another chat if the deleted one was active
      if (activeChatId === id && listResult.chat_ids.length > 0) {
        setActiveChatId(listResult.chat_ids[0]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-white overflow-hidden">
      <Sidebar
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onAddChat={handleAddChat}
        onDeleteChat={handleDeleteChat}
        onSettingsClick={() => setShowSettings(true)}
        chatIds={chatIds}
      />
      <div className="flex-1 flex flex-col relative">
        {loadingChat ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading chat...
          </div>
        ) : activeChat && activeChatId != null ? (
          <ChatInterface
            key={activeChatId}
            messages={activeChat.messages}
            onMessagesUpdate={updateMessages}
            chatId={activeChatId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            No chat selected. Create a new chat to get started.
          </div>
        )}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
