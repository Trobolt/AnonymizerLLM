"use client";
import { useState } from 'react';

interface SidebarProps {
    activeChatId: number;
    onSelectChat: (id: number) => void;
    onAddChat: () => void;
    onDeleteChat: (id: number) => void;
    onSettingsClick: () => void;
    chatIds?: number[];
}

export default function Sidebar({ activeChatId, onSelectChat, onAddChat, onDeleteChat, onSettingsClick, chatIds }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-72'} bg-[#1e1f20] h-screen flex flex-col transition-all duration-300`}>
            <div className="p-4 flex flex-col gap-4">
                <button onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 hover:bg-[#2e2f30] rounded-full w-fit">
                    ☰
                </button>
                <button onClick={onAddChat}
                        className="flex items-center gap-3 bg-[#2e2f30] hover:bg-[#37393b] p-3 rounded-full text-sm font-medium transition-colors">
                    <span>+</span>
                    {!isCollapsed && <span>Neuer Chat</span>}
                </button>
            </div>

            {/* MITTE: Liste nur anzeigen wenn NICHT eingeklappt */}
            <div className="flex-1 flex flex-col min-h-0"> {/* min-h-0 ist wichtig für Flex-Scrolling */}

                {/* Scrollbare Liste */}
                <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                    {!isCollapsed && (
                        <div className="space-y-1">
                            {(chatIds || []).map(chatId => (
                                <div
                                    key={chatId}
                                    onClick={() => onSelectChat(chatId)}
                                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${activeChatId === chatId ? 'bg-[#2e2f30]' : 'hover:bg-[#2e2f30]'}`}
                                >
                        <span className="truncate text-sm pr-2">
                            Chat {chatId}
                        </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteChat(chatId);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-[#2e2f30]">
                <button
                    onClick={onSettingsClick}
                    className="flex items-center gap-3 w-full p-3 hover:bg-[#2e2f30] rounded-xl text-sm transition-colors">
                    <span>⚙️</span>
                    {!isCollapsed && <span>Einstellungen</span>}
                </button>
            </div>
        </aside>
    );
}