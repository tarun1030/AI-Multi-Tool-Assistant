import React, { useState } from 'react';
import { Copy, Edit, Play } from 'lucide-react';

interface CodeViewerProps {
  code: any;
}

export default function CodeViewer({ code }: CodeViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [codeContent, setCodeContent] = useState(code?.code || '');

  if (!code) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <p className="text-gray-400 text-center">
          Select a code snippet to view and edit
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="dark-glass rounded-2xl flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-violet-400/20">
          <div>
            <h3 className="text-white font-semibold">{code.name}</h3>
            <p className="text-gray-400 text-sm">{code.language}</p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="dark-glass p-2 rounded-lg hover:bg-violet-800/30 transition-all duration-200 text-violet-400 hover:text-white"
            >
              <Edit size={16} />
            </button>
            <button className="dark-glass p-2 rounded-lg hover:bg-violet-800/30 transition-all duration-200 text-cyan hover:text-white">
              <Play size={16} />
            </button>
            <button className="dark-glass p-2 rounded-lg hover:bg-violet-800/30 transition-all duration-200 text-gray-400 hover:text-white">
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {isEditing ? (
            <textarea
              value={codeContent}
              onChange={(e) => setCodeContent(e.target.value)}
              className="w-full h-full bg-transparent text-white font-mono text-sm resize-none outline-none border border-violet-400/30 rounded-xl p-4 focus:border-violet-400 focus:shadow-glow transition-all duration-200"
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                <code className="block">
                  {codeContent.split('\n').map((line, index) => (
                    <div key={index} className="flex">
                      <span className="text-gray-500 select-none w-8 text-right mr-4 shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1">{line}</span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-violet-400/20 text-xs text-gray-400 flex justify-between items-center">
          <span>{code.chatCount} chats linked</span>
          <span>last updated {code.lastUpdated}</span>
        </div>
      </div>
    </div>
  );
}