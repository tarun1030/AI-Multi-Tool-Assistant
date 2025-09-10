// Mock data for demonstrations
export const mockCodeSnippets = [
  {
    id: 1,
    name: 'React Component',
    language: 'typescript',
    code: `import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={() => setCount(count - 1)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        -
      </button>
      <span className="text-lg font-semibold">{count}</span>
      <button
        onClick={() => setCount(count + 1)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        +
      </button>
    </div>
  );
}`,
    chatCount: 3,
    lastUpdated: '2 hours ago'
  },
  {
    id: 2,
    name: 'API Utility',
    language: 'javascript',
    code: `const apiClient = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  
  async get(endpoint) {
    const response = await fetch(\`\${this.baseURL}\${endpoint}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },
  
  async post(endpoint, data) {
    const response = await fetch(\`\${this.baseURL}\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

export default apiClient;`,
    chatCount: 1,
    lastUpdated: '1 day ago'
  },
  {
    id: 3,
    name: 'CSS Animation',
    language: 'css',
    code: `@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

.glass-morphism {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}`,
    chatCount: 2,
    lastUpdated: '3 days ago'
  }
];

export const mockChats = [
  {
    id: 1,
    title: 'React Best Practices',
    lastMessage: 'How can I optimize this component?',
    timestamp: '5 min ago',
    messages: [
      {
        sender: 'user',
        content: 'Can you help me create a reusable React component for a counter?'
      },
      {
        sender: 'assistant',
        content: 'I\'ll create a flexible Counter component for you. This component accepts an initial count prop and manages its own state. It uses TypeScript for type safety and includes proper styling.'
      },
      {
        sender: 'user',
        content: 'How can I optimize this component for better performance?'
      },
      {
        sender: 'assistant',
        content: 'Here are several optimization techniques you can apply: Use React.memo for pure components, implement useCallback for event handlers if they\'re passed as props, and consider using useReducer for complex state logic.'
      }
    ]
  },
  {
    id: 2,
    title: 'API Integration',
    lastMessage: 'Perfect! That error handling looks solid.',
    timestamp: '1 hour ago',
    messages: [
      {
        sender: 'user',
        content: 'I need help setting up an API client utility for my React app.'
      },
      {
        sender: 'assistant',
        content: 'I\'ll create a comprehensive API client utility that handles common HTTP operations with proper error handling and TypeScript support.'
      }
    ]
  },
  {
    id: 3,
    title: 'CSS Animations',
    lastMessage: 'These animations look great!',
    timestamp: '2 days ago',
    messages: [
      {
        sender: 'user',
        content: 'Can you show me how to create smooth CSS animations for my components?'
      },
      {
        sender: 'assistant',
        content: 'I\'ll demonstrate several CSS animation techniques including keyframes, transitions, and the glassmorphism effect that\'s popular in modern UI design.'
      }
    ]
  }
];

export const mockRAGSessions = [
  {
    id: 1,
    name: 'React Documentation',
    documentCount: 4,
    lastQuery: 'How do hooks work?',
    messages: [
      {
        sender: 'user',
        content: 'How do React hooks work internally?'
      },
      {
        sender: 'assistant',
        content: 'React hooks are functions that let you "hook into" React features from function components. They work by maintaining state and effects through React\'s internal fiber architecture.',
        sources: [
          {
            document: 'react-hooks-guide.pdf',
            snippet: 'Hooks are a new addition in React 16.8. They let you use state and other React features without writing a class.'
          },
          {
            document: 'advanced-react-patterns.md',
            snippet: 'The useState hook returns a pair: the current state value and a function that lets you update it.'
          }
        ]
      },
      {
        sender: 'user',
        content: 'What are the rules of hooks?'
      },
      {
        sender: 'assistant',
        content: 'There are two main rules for hooks: 1) Only call hooks at the top level of your React functions, never inside loops, conditions, or nested functions. 2) Only call hooks from React function components or custom hooks.',
        sources: [
          {
            document: 'react-hooks-guide.pdf',
            snippet: 'By following these rules, you ensure that hooks are called in the same order every time the component renders.'
          }
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'TypeScript Basics',
    documentCount: 2,
    lastQuery: 'Type annotations',
    messages: [
      {
        sender: 'user',
        content: 'What are TypeScript type annotations and how do I use them?'
      },
      {
        sender: 'assistant',
        content: 'Type annotations in TypeScript are a way to explicitly specify the types of variables, function parameters, and return values. They help catch errors at compile time and improve code documentation.',
        sources: [
          {
            document: 'typescript-handbook.pdf',
            snippet: 'Type annotations are written using a colon after the variable name, followed by the type.'
          }
        ]
      }
    ]
  },
  {
    id: 3,
    name: 'Web Performance',
    documentCount: 6,
    lastQuery: 'Bundle optimization',
    messages: [
      {
        sender: 'user',
        content: 'How can I optimize my web app bundle size?'
      },
      {
        sender: 'assistant',
        content: 'There are several strategies for bundle optimization: code splitting, tree shaking, dynamic imports, and using a bundler analyzer to identify large dependencies.',
        sources: [
          {
            document: 'web-performance-guide.pdf',
            snippet: 'Code splitting allows you to split your code into smaller chunks which can be loaded on demand.'
          },
          {
            document: 'webpack-optimization.md',
            snippet: 'Tree shaking eliminates dead code from your bundle by analyzing which exports are actually used.'
          }
        ]
      }
    ]
  }
];

export const mockGeneralChats = [
  {
    id: 1,
    title: 'Programming Advice',
    lastMessage: 'Focus on solving problems, not just learning syntax.',
    timestamp: '10 min ago',
    messages: [
      {
        sender: 'user',
        content: 'What\'s the best way to learn programming effectively?'
      },
      {
        sender: 'assistant',
        content: 'The most effective way to learn programming is through a combination of structured learning and hands-on practice. Start with fundamentals, build projects regularly, read other people\'s code, and don\'t be afraid to make mistakes - they\'re part of the learning process.'
      },
      {
        sender: 'user',
        content: 'Should I focus on one language or learn multiple languages?'
      },
      {
        sender: 'assistant',
        content: 'I recommend getting proficient in one language first, then expanding. Focus on solving problems, not just learning syntax. Once you understand programming concepts deeply in one language, picking up others becomes much easier.'
      }
    ]
  },
  {
    id: 2,
    title: 'Career Questions',
    lastMessage: 'Building a portfolio is crucial for developers.',
    timestamp: '3 hours ago',
    messages: [
      {
        sender: 'user',
        content: 'How important is it to have a portfolio as a developer?'
      },
      {
        sender: 'assistant',
        content: 'A portfolio is extremely important for developers. It showcases your skills, demonstrates your coding style, and provides tangible proof of your abilities to potential employers or clients. Include 3-5 quality projects that show different skills and technologies.'
      }
    ]
  },
  {
    id: 3,
    title: 'Tech Trends',
    lastMessage: 'AI is transforming how we write and debug code.',
    timestamp: '1 day ago',
    messages: [
      {
        sender: 'user',
        content: 'What are the biggest trends in web development right now?'
      },
      {
        sender: 'assistant',
        content: 'Some major trends include: AI-assisted development tools, serverless architectures, micro-frontends, WebAssembly for performance-critical applications, and the continued rise of TypeScript. AI is particularly transformative, changing how we write, debug, and optimize code.'
      }
    ]
  }
];

export const mockDocuments = [
  {
    id: 1,
    name: 'react-hooks-guide.pdf',
    type: 'pdf',
    size: '2.4 MB',
    uploadedAt: '2 hours ago'
  },
  {
    id: 2,
    name: 'advanced-react-patterns.md',
    type: 'md',
    size: '156 KB',
    uploadedAt: '1 day ago'
  },
  {
    id: 3,
    name: 'typescript-handbook.pdf',
    type: 'pdf',
    size: '5.2 MB',
    uploadedAt: '3 days ago'
  },
  {
    id: 4,
    name: 'web-performance-guide.pdf',
    type: 'pdf',
    size: '3.1 MB',
    uploadedAt: '1 week ago'
  },
  {
    id: 5,
    name: 'webpack-optimization.md',
    type: 'md',
    size: '89 KB',
    uploadedAt: '1 week ago'
  },
  {
    id: 6,
    name: 'api-design-principles.txt',
    type: 'txt',
    size: '45 KB',
    uploadedAt: '2 weeks ago'
  }
];