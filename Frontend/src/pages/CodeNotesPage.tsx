import React, { useState } from 'react';
import { ArrowLeft, Plus, Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CodeNotesMain from '../components/CodeNotesMain';
import { mockCodeSnippets, mockChats } from '../data/mockData';

export default function CodeNotesPage() {
  const navigate = useNavigate();
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [showMainView, setShowMainView] = useState(false);

  const handleCodeSelect = (code: any) => {
    setSelectedCode(code);
    setShowMainView(true);
  };

  if (showMainView && selectedCode) {
    return (
      <CodeNotesMain 
        selectedCode={selectedCode}
        onBack={() => setShowMainView(false)}
      />
    );
  }

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
              <Code2 className="text-violet-400" size={24} />
              <h1 className="text-xl font-semibold text-white">Code Notes</h1>
            </div>
          </div>
          <button className="dark-glass px-4 py-2 rounded-xl text-sm text-white hover:bg-violet-800/30 transition-all duration-200 flex items-center space-x-2">
            <Plus size={16} />
            <span>New Code</span>
          </button>
        </div>

        {/* Code Cards Grid */}
        <div className="p-6 h-[calc(100%-88px)] overflow-y-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Your Code Snippets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockCodeSnippets.map((snippet) => (
              <div
                key={snippet.id}
                onClick={() => handleCodeSelect(snippet)}
                className="code-card group"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-lg group-hover:text-violet-300 transition-colors">
                    {snippet.name}
                  </h3>
                  <span className="text-xs text-violet-400 bg-violet-400/20 px-2 py-1 rounded-full">
                    {snippet.language}
                  </span>
                </div>

                {/* Code Preview */}
                <div className="bg-black/40 rounded-lg p-3 mb-3 border border-violet-400/10">
                  <pre className="text-xs font-mono text-gray-300 overflow-hidden">
                    <code>
                      {snippet.code.split('\n').slice(0, 4).map((line, index) => (
                        <div key={index} className="truncate">
                          {line || ' '}
                        </div>
                      ))}
                      {snippet.code.split('\n').length > 4 && (
                        <div className="text-violet-400">...</div>
                      )}
                    </code>
                  </pre>
                </div>

                {/* Card Footer */}
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>{snippet.chatCount} chats linked</span>
                  <span>updated {snippet.lastUpdated}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}