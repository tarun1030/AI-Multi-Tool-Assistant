import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MessageSquare, Trash2 } from 'lucide-react';
import ChatWindow from './ChatWindow';
import DocumentManager from './DocumentManager';

interface RAGMainProps {
  selectedSession: any;
  onBack: () => void;
}

interface ChatHistory {
  history_id: string;
  caption: string;
  message_count: number;
  updated_at: string;
}

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export default function RAGMain({ selectedSession, onBack }: RAGMainProps) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(30);
  const [rightPanelWidth, setRightPanelWidth] = useState(30);
  const [histories, setHistories] = useState<ChatHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ChatHistory | null>(null);
  const [currentChat, setCurrentChat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<string>('');

  useEffect(() => {
    if (selectedSession?.session_id) {
      fetchHistories();
    }
  }, [selectedSession]);

  const fetchHistories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${selectedSession.session_id}/histories`);
      if (response.ok) {
        const data = await response.json();
        setHistories(data);
      }
    } catch (error) {
      console.error('Error fetching histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (historyId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${selectedSession.session_id}/histories/${historyId}/messages`);
      if (response.ok) {
        const messages = await response.json();
        
        // Transform API messages to match UI format
        const transformedMessages = messages.map((msg: any) => ({
          sender: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          sources: msg.role === 'assistant' && msg.related_chunks ? 
            msg.related_chunks.map((chunk: string, index: number) => ({
              document: `Source ${index + 1}`,
              snippet: chunk
            })) : undefined
        }));

        setCurrentChat({
          ...selectedSession,
          messages: transformedMessages
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const deleteHistory = async (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent history selection
    
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${selectedSession.session_id}/histories/${historyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHistories(prev => prev.filter(history => history.history_id !== historyId));
        
        // If the deleted history was selected, clear current chat
        if (selectedHistory?.history_id === historyId) {
          setSelectedHistory(null);
          setCurrentChat({
            ...selectedSession,
            messages: []
          });
        }
        
        setDeleteStatus('History deleted successfully');
        setTimeout(() => setDeleteStatus(''), 3000);
      } else {
        setDeleteStatus('Failed to delete history');
        setTimeout(() => setDeleteStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting history:', error);
      setDeleteStatus('Error deleting history');
      setTimeout(() => setDeleteStatus(''), 3000);
    }
  };

  const handleHistorySelect = (history: ChatHistory) => {
    setSelectedHistory(history);
    fetchMessages(history.history_id);
  };

  const handleNewChat = () => {
    setSelectedHistory(null);
    setCurrentChat({
      ...selectedSession,
      messages: []
    });
  };

  const handleSendMessage = async (query: string, image?: File, sessionId?: string) => {
    try {
      const requestBody: any = {
        session_id: selectedSession.session_id,
        query: query
      };

      // Add history info if continuing an existing conversation
      if (selectedHistory) {
        requestBody.history_id = selectedHistory.history_id;
        requestBody.caption = selectedHistory.caption;
      } else {
        requestBody.history_id = null;
        requestBody.caption = null;
      }

      const response = await fetch(`${API_BASE_URL}/rag/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Create the assistant message with sources
        const assistantMessage = {
          sender: 'assistant',
          content: result.answer,
          timestamp: new Date().toISOString(),
          sources: result.related_chunks ? 
            result.related_chunks.map((chunk: string, index: number) => ({
              document: `Source ${index + 1}`,
              snippet: chunk
            })) : undefined
        };

        // If this was a new chat, update the history list
        if (!selectedHistory && result.history_id) {
          const newHistory: ChatHistory = {
            history_id: result.history_id,
            caption: result.caption,
            message_count: 2, // user + assistant message
            updated_at: new Date().toISOString()
          };
          
          setHistories(prev => [newHistory, ...prev]);
          setSelectedHistory(newHistory);
        }

        return result;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const handleChatUpdate = async (updatedChat: any, sessionMetadata?: any) => {
    setCurrentChat(updatedChat);
    
    // If we have session metadata for a new chat, refresh the history list from API
    if (sessionMetadata && !selectedHistory && sessionMetadata.history_id) {
      try {
        // Refresh histories from API to get the most up-to-date list
        const response = await fetch(`${API_BASE_URL}/rag/sessions/${selectedSession.session_id}/histories`);
        if (response.ok) {
          const updatedHistories = await response.json();
          setHistories(updatedHistories);
          
          // Find and select the current history
          const currentHistory = updatedHistories.find((h: ChatHistory) => h.history_id === sessionMetadata.history_id);
          if (currentHistory) {
            setSelectedHistory(currentHistory);
          }
        }
      } catch (error) {
        console.error('Error refreshing histories:', error);
        
        // Fallback: only add if it doesn't exist
        const existingHistory = histories.find(h => h.history_id === sessionMetadata.history_id);
        if (!existingHistory) {
          const newHistory: ChatHistory = {
            history_id: sessionMetadata.history_id,
            caption: sessionMetadata.caption || 'New Chat',
            message_count: updatedChat.messages?.length || 0,
            updated_at: new Date().toISOString()
          };
          
          setHistories(prev => [newHistory, ...prev]);
          setSelectedHistory(newHistory);
        } else {
          setSelectedHistory(existingHistory);
        }
      }
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="dark-glass rounded-2xl overflow-hidden h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-violet-400/20">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-white">{selectedSession.name}</h1>
              <span className="text-xs text-cyan bg-cyan/20 px-2 py-1 rounded-full">
                {histories.length} histories
              </span>
            </div>
          </div>
        </div>

        {/* Delete Status */}
        {deleteStatus && (
          <div className="px-6 pt-2">
            <div className={`text-xs px-3 py-2 rounded ${
              deleteStatus.includes('successfully') ? 'text-green-400 bg-green-400/20' : 'text-red-400 bg-red-400/20'
            }`}>
              {deleteStatus}
            </div>
          </div>
        )}

        {/* Three Panel Layout */}
        <div className="flex h-[calc(100%-88px)]">
          {/* Left Panel - Session History */}
          <div 
            className="border-r border-violet-400/20 overflow-hidden"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <div className="p-4 h-full overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Chat History</h3>
                <button
                  onClick={handleNewChat}
                  className="dark-glass p-2 rounded-lg text-violet-400 hover:text-white hover:bg-violet-800/30 transition-all duration-200"
                  title="New Chat"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              {loading ? (
                <div className="text-gray-400 text-sm">Loading histories...</div>
              ) : (
                <div className="space-y-2">
                  {/* New Chat Option */}
                  <div 
                    onClick={handleNewChat}
                    className={`dark-glass p-3 rounded-xl cursor-pointer glass-hover transition-all duration-200 ${
                      !selectedHistory ? 'bg-violet-800/30 shadow-glow border-violet-400/50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <MessageSquare size={16} className="text-violet-400" />
                      <h4 className="text-white font-medium text-sm">
                        New Chat
                      </h4>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Start a new conversation
                    </p>
                  </div>

                  {/* Existing Histories */}
                  {histories.map((history) => (
                    <div
                      key={history.history_id}
                      onClick={() => handleHistorySelect(history)}
                      className={`dark-glass p-3 rounded-xl cursor-pointer glass-hover transition-all duration-200 relative group ${
                        selectedHistory?.history_id === history.history_id ? 'bg-violet-800/30 shadow-glow border-violet-400/50' : ''
                      }`}
                    >
                      {/* Delete Button */}
                      <button
                        onClick={(e) => deleteHistory(history.history_id, e)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all duration-200 z-10"
                        title="Delete history"
                      >
                        <Trash2 size={14} />
                      </button>

                      <h4 className="text-white font-medium text-sm mb-1 pr-6">
                        {history.caption}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{history.message_count} messages</span>
                        <span>{history.updated_at}</span>
                      </div>
                    </div>
                  ))}

                  {histories.length === 0 && !loading && (
                    <div className="text-center text-gray-400 py-8">
                      <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No conversations yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resizer */}
          <div 
            className="w-1 bg-violet-400/20 hover:bg-violet-400/40 cursor-col-resize transition-colors"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = leftPanelWidth;
              
              const handleMouseMove = (e: MouseEvent) => {
                const diff = ((e.clientX - startX) / window.innerWidth) * 100;
                const newWidth = Math.max(15, Math.min(40, startWidth + diff));
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

          {/* Middle Panel - Q&A Chat */}
          <div 
            className="border-r border-violet-400/20 flex flex-col"
            style={{ width: `${100 - leftPanelWidth - rightPanelWidth}%` }}
          >
            <ChatWindow 
              chat={currentChat || { ...selectedSession, messages: [] }}
              isRAG={true}
              onSendMessage={handleSendMessage}
              currentSessionId={selectedSession.session_id}
              isNewChat={!selectedHistory}
              onChatUpdate={handleChatUpdate}
            />
          </div>

          {/* Resizer */}
          <div 
            className="w-1 bg-violet-400/20 hover:bg-violet-400/40 cursor-col-resize transition-colors"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = rightPanelWidth;
              
              const handleMouseMove = (e: MouseEvent) => {
                const diff = ((startX - e.clientX) / window.innerWidth) * 100;
                const newWidth = Math.max(20, Math.min(50, startWidth + diff));
                setRightPanelWidth(newWidth);
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

          {/* Right Panel - Document Manager */}
          <div 
            className="overflow-hidden"
            style={{ width: `${rightPanelWidth}%` }}
          >
            <DocumentManager sessionId={selectedSession.session_id} />
          </div>
        </div>
      </div>
    </div>
  );
}