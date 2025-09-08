import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ChatHistory from './ChatHistory';
import ChatWindow from './ChatWindow';
import CodeViewer from './CodeViewer';
import { mockChats } from '../data/mockData';

interface CodeNotesMainProps {
  selectedCode: any;
  onBack: () => void;
}

export default function CodeNotesMain({ selectedCode, onBack }: CodeNotesMainProps) {
  const [selectedChat, setSelectedChat] = useState(mockChats[0]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(25);
  const [rightPanelWidth, setRightPanelWidth] = useState(35);

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
              <h1 className="text-xl font-semibold text-white">{selectedCode.name}</h1>
              <span className="text-xs text-violet-400 bg-violet-400/20 px-2 py-1 rounded-full">
                {selectedCode.language}
              </span>
            </div>
          </div>
        </div>

        {/* Three Panel Layout */}
        <div className="flex h-[calc(100%-88px)]">
          {/* Left Panel - Chat History */}
          <div 
            className="border-r border-violet-400/20 overflow-hidden"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <ChatHistory
              chats={mockChats}
              selectedChat={selectedChat}
              onSelectChat={setSelectedChat}
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

          {/* Middle Panel - Chat Window */}
          <div 
            className="border-r border-violet-400/20 flex flex-col"
            style={{ width: `${100 - leftPanelWidth - rightPanelWidth}%` }}
          >
            <ChatWindow chat={selectedChat} />
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

          {/* Right Panel - Code Viewer */}
          <div 
            className="overflow-hidden"
            style={{ width: `${rightPanelWidth}%` }}
          >
            <CodeViewer code={selectedCode} />
          </div>
        </div>
      </div>
    </div>
  );
}