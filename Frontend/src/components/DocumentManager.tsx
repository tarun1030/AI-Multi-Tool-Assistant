import React, { useState, useEffect } from 'react';
import { Upload, File, X, FileText, Image, Video, Trash2 } from 'lucide-react';

interface Document {
  document_id: string;
  document_name: string;
  document_size: number;
}

interface DocumentManagerProps {
  sessionId: string;
}

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return <FileText className="text-red-400" size={20} />;
    case 'txt':
    case 'md':
      return <File className="text-gray-400" size={20} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <Image className="text-blue-400" size={20} />;
    case 'mp4':
    case 'avi':
    case 'mov':
      return <Video className="text-purple-400" size={20} />;
    default:
      return <File className="text-gray-400" size={20} />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const decimals = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

export default function DocumentManager({ sessionId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [deleteStatus, setDeleteStatus] = useState<string>('');

  useEffect(() => {
    if (sessionId) {
      fetchDocuments();
    }
  }, [sessionId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${sessionId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_BASE_URL}/rag/sessions/${sessionId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setUploadStatus(`Successfully uploaded ${result.success_count} files with ${result.total_chunks} chunks`);
        
        // Refresh documents list
        await fetchDocuments();
        
        // Clear status after 3 seconds
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('Upload failed');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadStatus('Upload error');
      setTimeout(() => setUploadStatus(''), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers
    
    try {
      const response = await fetch(`${API_BASE_URL}/rag/sessions/${sessionId}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.document_id !== documentId));
        setDeleteStatus('Document deleted successfully');
        setTimeout(() => setDeleteStatus(''), 3000);
      } else {
        setDeleteStatus('Failed to delete document');
        setTimeout(() => setDeleteStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      setDeleteStatus('Error deleting document');
      setTimeout(() => setDeleteStatus(''), 3000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset the input
    e.target.value = '';
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="dark-glass rounded-2xl flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-violet-400/20">
          <h3 className="text-white font-semibold mb-2">Documents</h3>
          <p className="text-gray-400 text-sm">{documents.length} files uploaded</p>
        </div>

        {/* Upload Zone */}
        <div className="p-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 cursor-pointer relative ${
              isDragging 
                ? 'border-violet-400 bg-violet-400/20 shadow-glow-xl' 
                : 'border-violet-400/50 hover:border-violet-400 hover:bg-violet-400/10'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!isUploading) {
                document.getElementById('file-input')?.click();
              }
            }}
          >
            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              accept=".pdf,.txt,.md,.docx"
            />
            
            <Upload className="text-violet-400 mx-auto mb-2" size={24} />
            <p className="text-white text-sm font-medium mb-1">
              {isUploading ? 'Uploading files...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-gray-400 text-xs">
              Support for PDF, TXT, MD, DOCX and more
            </p>
            
            {/* Upload Status */}
            {uploadStatus && (
              <div className="mt-3 text-xs text-green-400 bg-green-400/20 rounded px-3 py-2">
                {uploadStatus}
              </div>
            )}

            {/* Delete Status */}
            {deleteStatus && (
              <div className={`mt-3 text-xs px-3 py-2 rounded ${
                deleteStatus.includes('successfully') ? 'text-green-400 bg-green-400/20' : 'text-red-400 bg-red-400/20'
              }`}>
                {deleteStatus}
              </div>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 p-4 pt-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="dark-glass p-3 rounded-xl flex items-center space-x-3 glass-hover group relative"
              >
                {getFileIcon(doc.document_name)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm truncate pr-6" title={doc.document_name}>
                    {doc.document_name}
                  </h4>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span>{formatFileSize(doc.document_size)}</span>
                    <span>•</span>
                    <span>ID: {doc.document_id.substring(0, 8)}...</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteDocument(doc.document_id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all duration-200 absolute top-3 right-3"
                  title="Remove document"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            
            {documents.length === 0 && !isUploading && (
              <div className="text-center text-gray-400 py-8">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No documents uploaded yet</p>
                <p className="text-sm">Upload files to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}