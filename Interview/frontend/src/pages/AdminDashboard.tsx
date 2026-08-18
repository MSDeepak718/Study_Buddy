import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  uploadDocument, listDocuments, deleteDocument, createConfig, listConfigs,
  startInterview, deleteConfig, updateConfig, generateDSAProblem
} from '../services/api';
import type { DocumentInfo, InterviewConfig, DSAProblem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import {
  FolderSimple, ChatCircleText, Microphone, Clock, PencilSimple, Trash,
  ArrowRight, DotsThreeVertical, FileText, Code, Check, Copy, Sparkle, Stack
} from '@phosphor-icons/react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [configs, setConfigs] = useState<InterviewConfig[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatingProblem, setGeneratingProblem] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(45);
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [interviewMode, setInterviewMode] = useState<'chat' | 'voice' | 'dsa' | 'system_design' | 'full_flow'>('dsa');
  const [dsaProblems, setDsaProblems] = useState<DSAProblem[]>([]);

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

  const handleGenerateProblem = async () => {
    setGeneratingProblem(true);
    try {
      const topicArr = topics.split(',').map(t => t.trim()).filter(Boolean);
      const mainTopic = topicArr[0] || 'Arrays & Algorithms';
      const prob = await generateDSAProblem(mainTopic, difficulty);
      setDsaProblems(prev => [...prev, prob]);
      if (!title.trim() && prob.title) {
        setTitle(`DSA Assessment: ${prob.title}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingProblem(false);
    }
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
        dsa_problems: dsaProblems,
      };
      
      if (editingConfigId) {
        await updateConfig(editingConfigId, configData);
        setEditingConfigId(null);
      } else {
        await createConfig(configData);
      }
      
      setTitle(''); setTopics(''); setSelectedDocs([]); setDifficulty('medium'); setDuration(45); setNumQuestions(5); setInterviewMode('dsa'); setDsaProblems([]);
      loadData();
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const handleStartInterview = async (configId: string) => {
    try {
      const cfg = configs.find(c => c.id === configId);
      const res = await startInterview({ config_id: configId, student_id: 'default' });
      if (cfg?.interview_mode === 'dsa') {
        navigate(`/dsa/workspace/${res.session_id}`);
      } else {
        navigate(`/interview/${res.session_id}`);
      }
    } catch (e) { console.error(e); }
  };

  const copyShareLink = (inviteCode: string) => {
    const link = `${window.location.origin}/test/invite/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteCode);
    setTimeout(() => setCopiedInviteId(null), 2500);
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Admin Control Center
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Configure Standalone (DSA, System Design, 1-on-1) or Full-Flow multi-stage tests and share candidate invite links</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText size={22} color="var(--color-primary)" weight="bold" />
            Knowledge Base Upload
          </h2>
          <label
            className="flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer transition-all duration-300 hover:opacity-90"
            style={{ border: '2px dashed var(--color-border-light)', background: 'var(--color-bg-input)' }}
          >
            <FolderSimple size={40} color="var(--color-accent)" weight="bold" className="mb-2" />
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
                      className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{doc.chunk_count} chunks • {doc.status}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(doc.id)} className="text-xs px-2 py-1 rounded-lg hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ color: 'var(--color-danger)' }}>
                    <Trash size={14} weight="bold" /> Delete
                  </button>
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
              {editingConfigId ? 'Edit Assessment' : 'Create Assessment Link'}
            </h2>
            {editingConfigId && (
              <button 
                onClick={() => {
                  setEditingConfigId(null);
                  setTitle(''); setTopics(''); setSelectedDocs([]);
                  setDifficulty('medium'); setDuration(45); setNumQuestions(5); setInterviewMode('dsa'); setDsaProblems([]);
                }}
                className="text-xs px-2.5 py-1 rounded-lg border hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleCreateConfig} className="space-y-4">
            {/* Mode Picker */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Assessment Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <button type="button" onClick={() => setInterviewMode('dsa')}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: interviewMode === 'dsa' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'dsa' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'dsa' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  <Code size={16} weight="bold" />
                  DSA Coding
                </button>

                <button type="button" onClick={() => setInterviewMode('full_flow')}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: interviewMode === 'full_flow' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'full_flow' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'full_flow' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  <Stack size={16} weight="bold" />
                  Full Flow
                </button>

                <button type="button" onClick={() => setInterviewMode('system_design')}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: interviewMode === 'system_design' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'system_design' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'system_design' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  <FileText size={16} weight="bold" />
                  Sys Design
                </button>

                <button type="button" onClick={() => setInterviewMode('chat')}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: interviewMode === 'chat' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'chat' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'chat' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  <ChatCircleText size={16} weight="bold" />
                  1-on-1 Chat
                </button>

                <button type="button" onClick={() => setInterviewMode('voice')}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: interviewMode === 'voice' ? 'var(--color-primary)' : 'var(--color-bg-input)',
                    color: interviewMode === 'voice' ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${interviewMode === 'voice' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  <Microphone size={16} weight="bold" />
                  1-on-1 Voice
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Assessment Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Senior Software Engineer DSA & System Design"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Topics (comma-separated)</label>
              <input type="text" value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g., Arrays, Dynamic Programming, System Architecture"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
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

            {/* AI LeetCode Problem Generator Button */}
            {(interviewMode === 'dsa' || interviewMode === 'full_flow') && (
              <div className="p-3 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--color-bg-elevated)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold flex items-center gap-1.5 text-[var(--color-accent)]">
                      <Sparkle size={14} weight="fill" /> LeetCode AI Problem Generator
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">Pull & format authentic LeetCode problems with testcases</p>
                  </div>
                  <button type="button" onClick={handleGenerateProblem} disabled={generatingProblem}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all hover:opacity-90"
                    style={{ background: 'var(--gradient-primary)', color: '#fff' }}
                  >
                    {generatingProblem ? 'Pulling...' : '+ Add LeetCode Problem'}
                  </button>
                </div>

                {dsaProblems.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    {dsaProblems.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-[var(--color-bg-input)]">
                        <span className="font-semibold text-emerald-400">LeetCode: {p.title} ({p.difficulty})</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{p.sample_test_cases?.length || 0} sample tests</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDocs.length > 0 && (
              <p className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} selected as knowledge base
              </p>
            )}

            <button type="submit" disabled={creating || !title.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 20px rgba(129, 255, 107, 0.41)'}}
            >
              {creating ? (editingConfigId ? 'Updating...' : 'Creating...') : (editingConfigId ? 'Update Configuration' : 'Create Assessment & Generate Share Link')}
            </button>
          </form>
        </motion.div>
      </div>

      {/* Configurations List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">Created Assessment Templates & Share Links</h2>
        {configs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No configurations yet. Create one above!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((cfg) => (
              <motion.div key={cfg.id} whileHover={{ scale: 1.02 }} className="p-4 rounded-xl relative flex flex-col justify-between" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold break-words flex-1 pr-1">{cfg.title}</h3>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === cfg.id ? null : cfg.id);
                        }}
                        className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.08)] transition-colors flex items-center justify-center cursor-pointer"
                        style={{ color: 'var(--color-text-secondary)' }}
                        title="Menu"
                      >
                        <DotsThreeVertical size={20} weight="bold" />
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
                              setInterviewMode(cfg.interview_mode || 'dsa');
                              setDsaProblems(cfg.dsa_problems || []);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-2 cursor-pointer"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            <PencilSimple size={14} weight="bold" />
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
                            className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-2 cursor-pointer"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash size={14} weight="bold" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Topics: {cfg.topics?.join(', ') || 'General'}</p>
                    <p>Difficulty: <span className="capitalize font-semibold" style={{ color: cfg.difficulty === 'hard' ? 'var(--color-danger)' : cfg.difficulty === 'medium' ? 'var(--color-warning)' : 'var(--color-success)' }}>{cfg.difficulty}</span></p>
                    <p className="flex items-center gap-2">
                      <Clock size={12} weight="bold" /> {cfg.duration_minutes} min • {cfg.num_questions} questions
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase" style={{
                        background: 'rgba(129, 255, 107, 0.15)',
                        color: 'var(--color-primary)',
                      }}>
                        {cfg.interview_mode}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                  {/* Share Link Button */}
                  {cfg.invite_code && (
                    <button onClick={() => copyShareLink(cfg.invite_code!)}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
                      style={{ borderColor: 'var(--color-border)', color: copiedInviteId === cfg.invite_code ? 'var(--color-success)' : 'var(--color-text-primary)' }}
                    >
                      {copiedInviteId === cfg.invite_code ? (
                        <>
                          <Check size={14} weight="bold" /> Link Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy size={14} weight="bold" /> Copy Shareable Student Link
                        </>
                      )}
                    </button>
                  )}

                  <button onClick={() => handleStartInterview(cfg.id)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90 cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                  >
                    Launch Preview
                    <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
