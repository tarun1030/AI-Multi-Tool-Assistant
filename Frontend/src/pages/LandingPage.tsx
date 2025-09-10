import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, BookOpen, MessageCircle } from 'lucide-react';

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  path: string;
  onClick: () => void;
}

function ToolCard({ icon, title, subtitle, onClick }: ToolCardProps) {
  return (
    <div
      onClick={onClick}
      className="dark-glass glass-hover p-8 rounded-2xl cursor-pointer group transform transition-all duration-300 hover:scale-105"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="text-violet-400 group-hover:text-cyan transition-colors duration-300 filter drop-shadow-[0_0_10px_rgba(167,139,250,0.8)]">
          {icon}
        </div>
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        <p className="text-gray-300 text-sm leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const tools = [
    {
      icon: <Code size={48} />,
      title: 'Code Notes',
      subtitle: 'Save, view, and chat with your code snippets.',
      path: '/code-notes'
    },
    {
      icon: <BookOpen size={48} />,
      title: 'RAG',
      subtitle: 'Upload docs and ask intelligent questions.',
      path: '/rag'
    },
    {
      icon: <MessageCircle size={48} />,
      title: 'General Chat',
      subtitle: 'Quick conversations, no extra context.',
      path: '/general-chat'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gradient mb-4">
            AI Multi Tool Assistant
          </h1>
          <p className="text-gray-300 text-xl">
            Choose your tool to get started with intelligent assistance
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {tools.map((tool) => (
            <ToolCard
              key={tool.path}
              icon={tool.icon}
              title={tool.title}
              subtitle={tool.subtitle}
              path={tool.path}
              onClick={() => navigate(tool.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}