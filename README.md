# 🧠 AI Multi-Tool Assistant

An AI-powered multi-tool assistant built with **Ollama Gemma3:4B** that provides code-focused assistance, document-based retrieval, and general conversation in one platform — all with **dedicated histories and a clean interface**.  

## 📂 Project Structure
- **frontend/** → React + TypeScript frontend  
- **backend/project_root/** → FastAPI backend  
- **Model** → [Ollama Gemma3:4B](https://ollama.ai)  
- **Embeddings** → `sentence-transformers/all-MiniLM-L6-v2`  
- **Vector DB** → FAISS  

## 🔧 Features
The assistant comes with **three main tools**, each with its **own history tracking** and user-friendly interface:

### 1. 💻 Code Notes
- Define **purpose** and **language** for each code session  
- Maintain **code-specific history**  
- Update, refine, and **track different versions of code**  

### 2. 📚 RAG (Retrieval-Augmented Generation)
- Open a **session** with a name and short description  
- Upload or connect documents  
- Chat with **context-aware answers** retrieved from documents  
- Keep **session history** for easy reference  

### 3. 💬 General Chat
- Ask **general questions**  
- Perform **image analysis**  
- Engage in casual conversation  
- Access **chat history** anytime  

## 🚀 Tech Stack
- **Frontend:** React + TypeScript  
- **Backend:** FastAPI  
- **Model:** Ollama Gemma3:4B  
- **Embeddings:** Sentence-Transformers (MiniLM)  
- **Vector Store:** FAISS  

---

✨ With **history for every tool** and a **streamlined interface**, this project unifies code assistance, document-based reasoning, and general AI chat into one seamless assistant.
