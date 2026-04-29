"use client";
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import Settings from '../components/Settings';
import { fetchChatList, fetchChatMessages, addChat, removeChat } from '../lib/api';

// Typen definieren
export type Message = { role: 'user' | 'model'; content: string };
export type Chat = { id: number; title: string; messages: Message[] };

export default function Home() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<number>(1);
    const [chatIds, setChatIds] = useState<number[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [loadingChat, setLoadingChat] = useState(false);

    // Fetch chat IDs from backend on component mount
    useEffect(() => {
        const getChatIds = async () => {
            try {
                const result = await fetchChatList();
                setChatIds(result.chat_ids);
                // Set active chat to the first one if available
                if (result.chat_ids.length > 0 && !activeChatId) {
                    setActiveChatId(result.chat_ids[0]);
                }
            } catch (error) {
                console.error("Failed to fetch chat list from backend:", error);
                setChatIds([]);
            }
        };

        getChatIds();
    }, []);

    // Fetch messages when chat is selected
    useEffect(() => {
        const loadChatMessages = async () => {
            setLoadingChat(true);
            try {
                const response = await fetchChatMessages(activeChatId);
                
                // Update or create chat with messages from backend
                setChats(prev => {
                    const existingChat = prev.find(c => c.id === activeChatId);
                    if (existingChat) {
                        return prev.map(c =>
                            c.id === activeChatId
                                ? { ...c, messages: response.messages }
                                : c
                        );
                    } else {
                        return [
                            ...prev,
                            {
                                id: activeChatId,
                                title: `Chat ${activeChatId}`,
                                messages: response.messages
                            }
                        ];
                    }
                });
            } catch (error) {
                console.error(`Failed to fetch messages for chat ${activeChatId}:`, error);
                // Create empty chat if fetch fails
                setChats(prev => {
                    const existingChat = prev.find(c => c.id === activeChatId);
                    if (!existingChat) {
                        return [
                            ...prev,
                            {
                                id: activeChatId,
                                title: `Chat ${activeChatId}`,
                                messages: []
                            }
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
    const activeChat = chats.find(c => c.id === activeChatId) || { id: activeChatId, title: `Chat ${activeChatId}`, messages: [] };

    const updateMessages = (newMessages: Message[]) => {
        setChats(prev => prev.map(c =>
            c.id === activeChatId ? { ...c, messages: newMessages } : c
        ));
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
            const updatedChats = chats.filter(chat => chat.id !== id);
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
                ) : (
                    <ChatInterface
                        key={activeChatId}
                        messages={activeChat.messages}
                        onMessagesUpdate={updateMessages}
                        chatId={activeChatId}
                    />
                )}
            </div>
            {showSettings && <Settings onClose={() => setShowSettings(false)} />}
        </div>
    );
}