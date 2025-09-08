import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronRight, Image, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface ChatWindowProps {
  chat: any;
  isRAG?: boolean;
  onSendMessage?: (query: string, image?: File, sessionId?: string) => Promise<any>;
  currentSessionId?: string;
  isNewChat?: boolean;
  onChatUpdate?: (updatedChat: any, sessionMetadata?: any) => void;
}

interface SourceBlock {
  document: string;
  snippet: string;
}

export default function ChatWindow({ 
  chat, 
  isRAG = false, 
  onSendMessage,
  currentSessionId,
  isNewChat = false,
  onChatUpdate
}: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [expandedSources, setExpandedSources] = useState<{ [key: number]: boolean }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages, streamingMessage]);

  const toggleSource = (index: number) => {
    setExpandedSources(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const currentMessage = message;
    const newUserMessage = {
      sender: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString(),
      hasImage: selectedImage !== null
    };

    // Create updated chat with new user message
    const updatedChatWithUserMessage = {
      ...chat,
      messages: [...(chat.messages || []), newUserMessage]
    };

    // Update chat immediately with user message
    if (onChatUpdate) {
      onChatUpdate(updatedChatWithUserMessage);
    }

    setIsLoading(true);
    setMessage('');
    removeImage();

    try {
      if (isRAG && onSendMessage) {
        // Use RAG-specific message handling
        const result = await onSendMessage(currentMessage, selectedImage, currentSessionId);
        
        if (result) {
          // Create assistant message with sources
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

          // Create final updated chat
          const finalUpdatedChat = {
            ...updatedChatWithUserMessage,
            messages: [...updatedChatWithUserMessage.messages, assistantMessage]
          };

          // Update the chat with both messages
          if (onChatUpdate) {
            onChatUpdate(finalUpdatedChat, {
              history_id: result.history_id,
              caption: result.caption
            });
          }
        }
      } else {
        // Original streaming chat logic for non-RAG
        const formData = new FormData();
        formData.append('query', currentMessage);
        if (!isNewChat && currentSessionId) {
          formData.append('session_id', currentSessionId);
        }
        if (selectedImage) {
          formData.append('image', selectedImage);
        }

        const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to send message');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let sessionMetadata: any = null;
          let completeStreamedMessage = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'metadata') {
                    sessionMetadata = data;
                  } else if (data.type === 'content') {
                    completeStreamedMessage += data.chunk;
                    setStreamingMessage(completeStreamedMessage);
                  } else if (data.type === 'done') {
                    // Stream is complete - create final assistant message
                    const assistantMessage = {
                      sender: 'assistant',
                      content: completeStreamedMessage,
                      timestamp: new Date().toISOString()
                    };

                    // Create final updated chat with both user and assistant messages
                    const finalUpdatedChat = {
                      ...updatedChatWithUserMessage,
                      messages: [...updatedChatWithUserMessage.messages, assistantMessage]
                    };

                    // Update the chat smoothly instead of reloading
                    if (onChatUpdate) {
                      onChatUpdate(finalUpdatedChat, sessionMetadata);
                    }

                    // Clear streaming message
                    setStreamingMessage('');
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessage(currentMessage);
      
      // Revert the chat state if there was an error
      if (onChatUpdate) {
        onChatUpdate(chat);
      }
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Custom markdown components for better styling
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={atomDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.875rem'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code 
          className="bg-black/50 text-cyan px-1 py-0.5 rounded text-sm border border-violet-400/30" 
          {...props}
        >
          {children}
        </code>
      );
    },
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-violet-400 pl-4 italic text-gray-300 my-2">
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-white mb-2 mt-4">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-semibold text-white mb-2 mt-3">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-md font-medium text-white mb-1 mt-2">{children}</h3>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside text-gray-200 ml-4 my-2">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside text-gray-200 ml-4 my-2">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="mb-1">{children}</li>
    ),
    p: ({ children }: any) => (
      <p className="leading-relaxed mb-2 text-gray-100">{children}</p>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-200">{children}</em>
    ),
    a: ({ href, children }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-cyan hover:text-violet-400 underline transition-colors"
      >
        {children}
      </a>
    ),
  };

  // Welcome message for new chats
  const welcomeMessage = {
    sender: 'assistant',
    content: isRAG 
      ? "Hello! I'm your RAG assistant. I can help you analyze and ask questions about your uploaded documents. Upload some documents and start asking questions!"
      : "Hello! I'm an AI assistant. I'm here to help with a wide variety of tasks including answering questions, helping with analysis, writing, math and much more. How can I assist you today?",
    timestamp: new Date().toISOString()
  };

  // Show welcome message for new chats with no messages
  const displayMessages = (isNewChat && chat?.messages?.length === 0) 
    ? [welcomeMessage] 
    : chat?.messages || [];

  const scrollbarStyles = `
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
  `;

  return (
    <div className="flex flex-col h-full">
      <style>{scrollbarStyles}</style>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {displayMessages.map((msg: any, index: number) => (
          <div key={index} className="space-y-3">
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] p-4 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-violet-600/30 text-white border border-violet-400/50 shadow-glow'
                    : 'dark-glass text-white shadow-cyan-glow border-cyan/30'
                }`}
              >
                {msg.sender === 'user' ? (
                  <div className="space-y-2">
                    {/* Show image preview if attached */}
                    {msg.hasImage && (
                      <div className="mb-2">
                        <div className="flex items-center text-sm text-gray-300 bg-black/20 rounded p-2">
                          <Image size={16} className="mr-2" />
                          <span>Image attached</span>
                        </div>
                      </div>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown components={MarkdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>

            {/* Source snippets for RAG responses */}
            {isRAG && msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div className="ml-4 space-y-2">
                <div className="text-xs text-gray-400 font-medium mb-2">Related Sources:</div>
                {msg.sources.map((source: SourceBlock, sourceIndex: number) => (
                  <div key={sourceIndex} className="dark-glass rounded-xl border border-cyan/20">
                    <button
                      onClick={() => toggleSource(index * 100 + sourceIndex)}
                      className="w-full p-3 text-left flex items-center justify-between hover:bg-violet-800/20 transition-colors rounded-xl"
                    >
                      <span className="text-sm text-cyan font-medium">
                        📄 {source.document}
                      </span>
                      {expandedSources[index * 100 + sourceIndex] ? (
                        <ChevronDown className="text-gray-400" size={16} />
                      ) : (
                        <ChevronRight className="text-gray-400" size={16} />
                      )}
                    </button>
                    {expandedSources[index * 100 + sourceIndex] && (
                      <div className="p-3 pt-0 text-sm text-gray-300 border-t border-violet-400/20">
                        <p className="italic leading-relaxed">"{source.snippet}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Streaming message display */}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="dark-glass text-white shadow-cyan-glow border-cyan/30 max-w-[85%] p-4 rounded-2xl">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown components={MarkdownComponents}>
                  {streamingMessage}
                </ReactMarkdown>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs text-gray-400">Streaming...</span>
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="dark-glass text-white shadow-cyan-glow border-cyan/30 max-w-[70%] p-4 rounded-2xl">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-sm text-gray-300">
                  {isRAG ? 'Analyzing documents...' : 'AI is thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-violet-400/20">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-4 relative inline-block">
            <img 
              src={imagePreview} 
              alt="Selected" 
              className="max-w-32 max-h-32 rounded-lg border border-violet-400/30"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder={isRAG ? "Ask a question about your documents..." : "Type your message..."}
            className="w-full dark-glass rounded-2xl px-6 py-4 pr-24 text-white placeholder-gray-400 border border-violet-400/30 focus:border-violet-400 focus:shadow-glow outline-none transition-all duration-200"
            disabled={isLoading}
          />
          
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            {!isRAG && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-violet-400 transition-colors"
                  title="Add image"
                >
                  <Image size={18} />
                </button>
              </>
            )}
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !message.trim()}
              className="text-violet-400 hover:text-white transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}