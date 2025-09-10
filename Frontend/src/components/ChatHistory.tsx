import React from 'react';
import { Clock, Code, Loader2, Trash2 } from 'lucide-react';

interface ChatHistoryProps {
  chats: any[];
  selectedChat: any;
  onSelectChat: (chat: any) => void;
  onDeleteChat: (chatId: string) => void; // New prop for delete action
  codeSnippets?: any[];
  onSelectCode?: (code: any) => void;
  isGeneral?: boolean;
  loading?: boolean;
}

export default function ChatHistory({ 
  chats, 
  selectedChat, 
  onSelectChat, 
  onDeleteChat, // Add to props
  codeSnippets, 
  onSelectCode,
  isGeneral = false,
  loading = false
}: ChatHistoryProps) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="space-y-4">
        {/* Chat History Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4">
            {isGeneral ? 'Recent Conversations' : 'Chat History'}
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2 text-gray-400">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-sm">Loading chats...</span>
              </div>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`dark-glass p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedChat?.id === chat.id 
                      ? 'bg-violet-800/30 shadow-glow border border-violet-400/50' 
                      : 'glass-hover border border-transparent hover:border-violet-400/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium text-sm truncate">
                      {chat.title}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering onSelectChat
                        onDeleteChat(chat.id);
                      }}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs truncate">
                    {chat.lastMessage}
                  </p>
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <Clock size={10} className="mr-1" />
                    {chat.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Snippets Section (only for Code Notes) */}
        {codeSnippets && onSelectCode && (
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-4">Code Snippets</h3>
            <div className="space-y-2">
              {codeSnippets.map((snippet) => (
                <div
                  key={snippet.id}
                  onClick={() => onSelectCode(snippet)}
                  className="dark-glass p-3 rounded-xl cursor-pointer glass-hover group border border-transparent hover:border-violet-400/30 transition-all duration-200"
                >
                  <div className="flex items-center mb-2">
                    <Code className="text-violet-400 mr-2 group-hover:text-cyan transition-colors" size={14} />
                    <h4 className="text-white font-medium text-sm truncate">
                      {snippet.name}
                    </h4>
                  </div>
                  <pre className="text-xs font-mono text-gray-400 overflow-hidden">
                    <code className="line-clamp-3">
                      {snippet.code.split('\n').slice(0, 3).join('\n')}
                    </code>
                  </pre>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>{snippet.chatCount} chats linked</span>
                    <span>updated {snippet.lastUpdated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}