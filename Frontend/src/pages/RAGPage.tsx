import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, BookOpen, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RAGMain from '../components/RAGMain';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

interface RAGSession {
  session_id: string;
  name: string;
  description: string;
  updated_at: string;
  documentCount?: number;
}

export default function RAGPage() {
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<RAGSession | null>(null);
  const [showMainView, setShowMainView] = useState(false);
  const [sessions, setSessions] = useState<RAGSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSession, setNewSession] = useState({ name: '', description: '' });
  const [deleteStatus, setDeleteStatus] = useState<string>('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!newSession.name.trim() || !newSession.description.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSession),
      });

      if (response.ok) {
        const createdSession = await response.json();
        setSessions(prev => [createdSession, ...prev]);
        setNewSession({ name: '', description: '' });
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent session selection
    
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions(prev => prev.filter(session => session.session_id !== sessionId));
        setDeleteStatus('Session deleted successfully');
        setTimeout(() => setDeleteStatus(''), 3000);
      } else {
        setDeleteStatus('Failed to delete session');
        setTimeout(() => setDeleteStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      setDeleteStatus('Error deleting session');
      setTimeout(() => setDeleteStatus(''), 3000);
    }
  };

  const handleSessionSelect = (session: RAGSession) => {
    setSelectedSession(session);
    setShowMainView(true);
  };

  const getStatusText = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMinutes = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60));
    
    if (diffMinutes < 2) return 'Active';
    return 'Inactive';
  };

  const getStatusColor = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMinutes = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60));
    
    if (diffMinutes < 2) return 'text-green-400';
    return 'text-gray-400';
  };

  if (showMainView && selectedSession) {
    return (
      <RAGMain 
        selectedSession={selectedSession}
        onBack={() => setShowMainView(false)}
      />
    );
  }

  return (
    <div className="min-h-screen p-4">
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(139, 92, 246, 0.1);
            border-radius: 3px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.3);
            border-radius: 3px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(139, 92, 246, 0.5);
          }
        `}
      </style>
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
              <BookOpen className="text-cyan" size={24} />
              <h1 className="text-xl font-semibold text-white">RAG Assistant</h1>
            </div>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="dark-glass px-4 py-2 rounded-xl text-sm text-white hover:bg-violet-800/30 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Create Session</span>
          </button>
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

        {/* RAG Sessions Grid */}
        <div className="p-6 h-[calc(100%-88px)] overflow-y-auto">
          <h2 className="text-2xl font-bold text-white mb-6">RAG Sessions</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-white">Loading sessions...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => handleSessionSelect(session)}
                  className="code-card group cursor-pointer relative"
                >
                  {/* Delete Button */}
                  <button
                    onClick={(e) => deleteSession(session.session_id, e)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all duration-200 z-10"
                    title="Delete session"
                  >
                    <Trash2 size={16} />
                  </button>

                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3 pr-8">
                    <h3 className="text-white font-semibold text-lg group-hover:text-violet-300 transition-colors">
                      {session.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.updated_at)} bg-current/20`}>
                      {getStatusText(session.updated_at)}
                    </span>
                  </div>

                  {/* Session Preview */}
                  <div className="bg-black/40 rounded-lg p-3 mb-3 border border-violet-400/10">
                    <p className="text-sm text-gray-300">
                      {session.description}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>Session ID: {session.session_id.substring(0, 8)}...</span>
                    <span>{session.updated_at}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="dark-glass rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Session</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={newSession.name}
                  onChange={(e) => setNewSession(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full dark-glass rounded-xl px-4 py-3 text-white placeholder-gray-400 border border-violet-400/30 focus:border-violet-400 focus:shadow-glow outline-none transition-all duration-200"
                  placeholder="Enter session name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full dark-glass rounded-xl px-4 py-3 text-white placeholder-gray-400 border border-violet-400/30 focus:border-violet-400 focus:shadow-glow outline-none transition-all duration-200 min-h-[100px]"
                  placeholder="Describe what this session is for"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSession}
                disabled={!newSession.name.trim() || !newSession.description.trim()}
                className="dark-glass px-4 py-2 rounded-xl text-white hover:bg-violet-800/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}