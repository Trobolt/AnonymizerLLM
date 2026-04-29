"use client";
import { useState } from 'react';
import { Message } from '../app/page';
import { streamChatMessage } from '../lib/api';

interface ChatInterfaceProps {
    messages: Message[];
    onMessagesUpdate: (msgs: Message[]) => void;
    chatId: number;
}

export default function ChatInterface({ messages, onMessagesUpdate, chatId }: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const streamResponse = async (userText: string, currentMessages: Message[]) => {
        setIsTyping(true);
        let currentText = "";

        // Add model message placeholder
        const messagesWithPending = [...currentMessages, { role: 'model' as const, content: "" }];
        onMessagesUpdate(messagesWithPending);

        try {
            const reader = await streamChatMessage(chatId, userText);
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Process all complete lines
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        try {
                            const parsed = JSON.parse(line);
                            currentText += parsed.token || "";
                            
                            // Update message with new token
                            const updated = [...messagesWithPending];
                            updated[updated.length - 1].content = currentText;
                            onMessagesUpdate(updated);
                        } catch (e) {
                            console.error("Failed to parse token:", e);
                        }
                    }
                }
                
                // Keep incomplete line in buffer
                buffer = lines[lines.length - 1];
            }

            // Process any remaining content in buffer
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    currentText += parsed.token || "";
                    const updated = [...messagesWithPending];
                    updated[updated.length - 1].content = currentText;
                    onMessagesUpdate(updated);
                } catch (e) {
                    console.error("Failed to parse final token:", e);
                }
            }
        } catch (error) {
            console.error("Error streaming response:", error);
            // Add error message to chat
            const errorMsg = [...messagesWithPending];
            errorMsg[errorMsg.length - 1].content = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            onMessagesUpdate(errorMsg);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newMessages: Message[] = [...messages, { role: 'user', content: input }];
        onMessagesUpdate(newMessages);
        setInput('');
        streamResponse(input, newMessages);
    };

    return (
        <main className="flex h-screen bg-[#131314] text-white flex-col p-4">
            <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full space-y-6 pt-10">
                {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Frag Gemini etwas...
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-[#2e2f30]' : 'bg-transparent border border-[#2e2f30]'}`}>
                            <p className="leading-relaxed">{m.content}</p>
                        </div>
                    </div>
                ))}
                {isTyping && <div className="text-gray-400 animate-pulse text-sm">Schreibt...</div>}
            </div>

            <div className="max-w-3xl mx-auto w-full pb-8">
                <form onSubmit={handleSubmit} className="relative bg-[#1e1f20] rounded-3xl px-6 py-4 flex items-center border border-[#333] focus-within:border-[#4285f4] transition-all">
                    <input
                        className="bg-transparent flex-1 outline-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hier tippen..."
                        disabled={isTyping}
                    />
                    <button type="submit" className="text-xl" disabled={isTyping}>🚀</button>
                </form>
            </div>
        </main>
    );
}