import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CodeNotesPage from './pages/CodeNotesPage';
import RAGPage from './pages/RAGPage';
import GeneralChatPage from './pages/GeneralChatPage';

function App() {
  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="fixed inset-0 bg-gradient-to-br from-black via-violet-900/50 to-violet-800/30"></div>
      <div className="relative z-10">
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/code-notes" element={<CodeNotesPage />} />
            <Route path="/rag" element={<RAGPage />} />
            <Route path="/general-chat" element={<GeneralChatPage />} />
          </Routes>
        </Router>
      </div>
    </div>
  );
}

export default App;