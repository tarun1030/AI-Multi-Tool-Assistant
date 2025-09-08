import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatHistory from '../components/ChatHistory';
import ChatWindow from '../components/ChatWindow';

interface Session {
  session_id: string;
  caption: string;
  created_at: string;
  last_accessed: string;
  message_count: number;
  last_message_time: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  has_image?: boolean;
}

interface ChatSession {
  session_id: string;
  caption: string;
  created_at: string;
  last_accessed: string;
  messages: ChatMessage[];
}

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1/chat';

export default function GeneralChatPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} sec${diffInSeconds !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error('Failed to fetch chat history');
      
      const data = await response.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat history');
      console.error('Error fetching chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch individual chat session
  const fetchChatSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch chat session');
      
      const data = await response.json();
      setSelectedChat(data);
      setIsNewChat(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat session');
      console.error('Error fetching chat session:', err);
    }
  };

  // Delete chat session
  const deleteChat = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete chat session');

      // Refresh chat history
      await fetchChatHistory();

      // Clear selected chat if it was the one deleted
      if (selectedChat?.session_id === sessionId) {
        setSelectedChat(null);
        setIsNewChat(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat session');
      console.error('Error deleting chat session:', err);
    }
  };

  // Create new chat
  const createNewChat = () => {
    const newChat: ChatSession = {
      session_id: 'new_chat_temp',
      caption: 'New Chat',
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      messages: []
    };
    setSelectedChat(newChat);
    setIsNewChat(true);
  };

  // Handle chat updates from ChatWindow (smooth updates)
  const handleChatUpdate = async (updatedChat: any, sessionMetadata?: any) => {
    // Update the current selected chat immediately
    const transformedChat: ChatSession = {
      session_id: updatedChat.id,
      caption: updatedChat.title || 'New Chat',
      created_at: selectedChat?.created_at || new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      messages: updatedChat.messages.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp,
        has_image: msg.hasImage
      }))
    };

    setSelectedChat(transformedChat);

    // If this was a new chat and we have session metadata, update the session ID
    if (sessionMetadata && sessionMetadata.session_id && isNewChat) {
      transformedChat.session_id = sessionMetadata.session_id;
      transformedChat.caption = sessionMetadata.caption || 'New Chat';
      setSelectedChat(transformedChat);
      setIsNewChat(false);

      // Add the new session to the sessions list
      const newSession: Session = {
        session_id: sessionMetadata.session_id,
        caption: sessionMetadata.caption || 'New Chat',
        created_at: transformedChat.created_at,
        last_accessed: transformedChat.last_accessed,
        message_count: transformedChat.messages.length,
        last_message_time: transformedChat.messages[transformedChat.messages.length - 1]?.timestamp || transformedChat.last_accessed
      };

      // Add to the top of sessions list
      setSessions(prev => [newSession, ...prev]);
    } else if (!isNewChat && selectedChat) {
      // Update existing session in the sessions list
      setSessions(prev => prev.map(session => 
        session.session_id === selectedChat.session_id 
          ? {
              ...session,
              last_accessed: new Date().toISOString(),
              message_count: transformedChat.messages.length,
              last_message_time: transformedChat.messages[transformedChat.messages.length - 1]?.timestamp || session.last_message_time
            }
          : session
      ));

      // Move the updated session to the top of the list
      setSessions(prev => {
        const updatedSession = prev.find(s => s.session_id === selectedChat.session_id);
        const otherSessions = prev.filter(s => s.session_id !== selectedChat.session_id);
        return updatedSession ? [updatedSession, ...otherSessions] : prev;
      });
    }
  };

  // Handle chat selection
  const handleSelectChat = async (session: Session) => {
    await fetchChatSession(session.session_id);
  };

  // Transform sessions for ChatHistory component
  const transformedChats = sessions.map(session => ({
    id: session.session_id,
    title: session.caption,
    lastMessage: `${session.message_count} messages`,
    timestamp: formatRelativeTime(session.last_accessed)
  }));

  // Transform selected chat for ChatWindow component
  const transformedSelectedChat = selectedChat ? {
    id: selectedChat.session_id,
    title: selectedChat.caption,
    messages: selectedChat.messages.map(msg => ({
      sender: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp,
      hasImage: msg.has_image
    }))
  } : null;

  useEffect(() => {
    fetchChatHistory();
  }, []);

  // Auto-select first chat when sessions are loaded (only if no chat is selected)
  useEffect(() => {
    if (sessions.length > 0 && !selectedChat && !isNewChat) {
      handleSelectChat(sessions[0]);
    }
  }, [sessions, selectedChat, isNewChat]);

  return (
    <div className="min-h-screen p-4">
      <div className="dark-glass rounded-2xl overflow-hidden h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-violet-400/20">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center space-x-2">
              <MessageCircle className="text-neon-pink" size={24} />
              <h1 className="text-xl font-semibold text-white">General Chat</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* New Chat Button */}
            <button
              onClick={createNewChat}
              className="flex items-center space-x-2 px-4 py-2 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/50 rounded-xl text-white transition-colors"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>
            {error && (
              <div className="text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Two Panel Layout */}
        <div className="flex h-[calc(100%-88px)]">
          {/* Left Panel - Chat History */}
          <div 
            className="border-r border-violet-400/20 overflow-hidden"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <ChatHistory
              chats={transformedChats}
              selectedChat={transformedSelectedChat || { id: '', title: '', lastMessage: '', timestamp: '' }}
              onSelectChat={(chat) => {
                const session = sessions.find(s => s.session_id === chat.id);
                if (session) handleSelectChat(session);
              }}
              onDeleteChat={deleteChat}
              isGeneral={true}
              loading={loading}
            />
          </div>

          {/* Resizer */}
          <div 
            className="w-1 bg-violet-400/20 hover:bg-violet-400/40 cursor-col-resize transition-colors"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = leftPanelWidth;
              
              const handleMouseMove = (e: MouseEvent) => {
                const diff = ((e.clientX - startX) / window.innerWidth) * 100;
                const newWidth = Math.max(20, Math.min(50, startWidth + diff));
                setLeftPanelWidth(newWidth);
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

          {/* Right Panel - Main Chat */}
          <div 
            className="flex flex-col"
            style={{ width: `${100 - leftPanelWidth}%` }}
          >
            {transformedSelectedChat ? (
              <ChatWindow 
                chat={transformedSelectedChat} 
                onSendMessage={() => Promise.resolve({})} // Placeholder since we handle in ChatWindow
                currentSessionId={selectedChat?.session_id}
                isNewChat={isNewChat}
                onChatUpdate={handleChatUpdate} // Pass the smooth update handler
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {loading ? 'Loading chats...' : 'Click "New Chat" to start a conversation'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}