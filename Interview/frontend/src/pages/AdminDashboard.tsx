import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadDocument, listDocuments, deleteDocument, createConfig, listConfigs, startInterview, deleteConfig, updateConfig } from '../services/api';
import type { DocumentInfo, InterviewConfig } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [configs, setConfigs] = useState<InterviewConfig[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(30);
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [interviewMode, setInterviewMode] = useState<'chat' | 'voice'>('chat');

  const loadData = useCallback(async () => {
    try {
      const [docRes, cfgRes] = await Promise.all([listDocuments(), listConfigs()]);
      setDocuments(docRes.documents);
      setConfigs(cfgRes);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const res = await uploadDocument(file);
      setUploadMsg(`${res.message}`);
      loadData();
    } catch (err: any) {
      setUploadMsg(`${err?.response?.data?.detail || 'Upload failed'}`);
      loadData();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await deleteConfig(id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const configData = {
        title, difficulty, duration_minutes: duration, num_questions: numQuestions,
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        document_ids: selectedDocs,
        interview_mode: interviewMode,
      };
      
      if (editingConfigId) {
        await updateConfig(editingConfigId, configData);
        setEditingConfigId(null);
      } else {
        await createConfig(configData);
      }
      
      setTitle(''); setTopics(''); setSelectedDocs([]); setDifficulty('medium'); setDuration(30); setNumQuestions(5); setInterviewMode('chat');
      loadData();
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const handleStartInterview = async (configId: string) => {
    try {
      const res = await startInterview({ config_id: configId, student_id: 'default' });
      navigate(`/interview/${res.session_id}`);
    } catch (e) { console.error(e); }
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Upload documents, configure interviews, and launch sessions</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">Document Upload</h2>
          <label
            className="flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer transition-all duration-300 hover:opacity-90"
            style={{ border: '2px dashed var(--color-border-light)', background: 'var(--color-bg-input)' }}
          >
            <span className="text-4xl mb-2">🗁</span>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {uploading ? 'Processing...' : 'Drop PDF, DOCX, or TXT here'}
            </span>
            <input type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          {uploading && <LoadingSpinner text="Processing document..." />}
          {uploadMsg && <p className="mt-3 text-sm text-center" style={{ color: uploadMsg.startsWith('Processed Successfully') ? 'var(--color-success)' : 'var(--color-danger)' }}>{uploadMsg}</p>}

          {/* Document List */}
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Uploaded Documents ({documents.length})</h3>
            <AnimatePresence>
              {documents.map((doc) => (
                <motion.div key={doc.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)}
                      className="w-4 h-4 rounded accent-[var(--color-primary)]"
                    />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{doc.chunk_count} chunks • {doc.status}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(doc.id)} className="text-xs px-2 py-1 rounded-lg hover:opacity-80" style={{ color: 'var(--color-danger)' }}>Delete</button>
                </motion.div>
              ))}
            </AnimatePresence>
            {documents.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No documents uploaded yet</p>}
          </div>
        </motion.div>

        {/* Configuration Section */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {editingConfigId ? 'Edit Interview' : 'Create Interview'}
            </h2>
            {editingConfigId && (
              <button 
                onClick={() => {
                  setEditingConfigId(null);
                  setTitle(''); setTopics(''); setSelectedDocs([]);
                  setDifficulty('medium'); setDuration(30); setNumQuestions(5); setInterviewMode('chat');
                }}
                className="text-xs px-2 py-1 rounded-lg border hover:bg-[rgba(255,255,255,0.05)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleCreateConfig} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., React Fundamentals Interview"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Topics (comma-separated)</label>
              <input type="text" value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g., React, Hooks, State Management"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Duration (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} min={5} max={180}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Questions</label>
                <input type="number" value={numQuestions} onChange={e => setNumQuestions(+e.target.value)} min={1} max={50}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                />
              </div>
            </div>

            {/* Interview Mode Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Interview Mode</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInterviewMode('chat')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    background: interviewMode === 'chat' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'chat' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'chat' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  💬 Chat
                </button>
                <button type="button" onClick={() => setInterviewMode('voice')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    background: interviewMode === 'voice' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'voice' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'voice' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  🎤 Voice
                </button>
              </div>
            </div>

            {selectedDocs.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
                {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} selected as knowledge base
              </p>
            )}

            <button type="submit" disabled={creating || !title.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 20px rgba(129, 255, 107, 0.41)'}}
            >
              {creating ? (editingConfigId ? 'Updating...' : 'Creating...') : (editingConfigId ? 'Update Configuration' : 'Create')}
            </button>
          </form>
        </motion.div>
      </div>

      {/* Configurations List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">Ready Interviews</h2>
        {configs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No configurations yet. Create one above!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((cfg) => (
              <motion.div key={cfg.id} whileHover={{ scale: 1.02 }} className="p-4 rounded-xl relative" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-semibold break-words flex-1 pr-1">{cfg.title}</h3>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === cfg.id ? null : cfg.id);
                      }}
                      className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.08)] transition-colors flex items-center justify-center"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title="Menu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM12 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM12 17.25a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                      </svg>

                    </button>
                    {activeMenuId === cfg.id && (
                      <div
                        className="absolute right-0 mt-1 w-28 rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-10"
                        style={{ background: 'var(--color-bg-elevated)' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            setEditingConfigId(cfg.id);
                            setTitle(cfg.title);
                            setTopics(cfg.topics?.join(', ') || '');
                            setDifficulty(cfg.difficulty);
                            setDuration(cfg.duration_minutes);
                            setNumQuestions(cfg.num_questions);
                            setSelectedDocs(cfg.document_ids || []);
                            setInterviewMode((cfg.interview_mode || 'chat') as 'chat' | 'voice');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-2"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            if (confirm(`Are you sure you want to delete "${cfg.title}"? This will also delete all associated sessions.`)) {
                              await handleDeleteConfig(cfg.id);
                            }
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-2"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>Topics: {cfg.topics?.join(', ') || 'General'}</p>
                  <p>Difficulty: <span className="capitalize" style={{ color: cfg.difficulty === 'hard' ? 'var(--color-danger)' : cfg.difficulty === 'medium' ? 'var(--color-warning)' : 'var(--color-success)' }}>{cfg.difficulty}</span></p>
                  <p className="flex items-center gap-2">
                    {cfg.num_questions} questions • ⏱️ {cfg.duration_minutes} min
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                      background: cfg.interview_mode === 'voice' ? 'rgba(134, 194, 50, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                      color: cfg.interview_mode === 'voice' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    }}>
                      {cfg.interview_mode === 'voice' ? '🎤 VOICE' : '💬 CHAT'}
                    </span>
                  </p>
                </div>
                <button onClick={() => handleStartInterview(cfg.id)}
                  className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  Start Interview →
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
