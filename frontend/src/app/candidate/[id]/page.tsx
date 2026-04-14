'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, User, Briefcase, Award, MessageSquare, Zap,
  UserCheck, CheckCircle2, Loader2, Save, Tag, X, ArrowRight,
  FileText, AlertCircle, Clock, Send, HelpCircle,
  Copy, CheckCheck, Brain, XCircle, ChevronDown, ChevronUp, RefreshCw,
  Mail, Phone, MapPin, ExternalLink, ShieldAlert, Share2, Code, Edit2, Check
} from 'lucide-react';
import { jobApi } from '@/lib/api';

const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Applied: { bg: 'rgba(107,114,128,.08)', text: '#6B7280', border: 'rgba(107,114,128,.2)' },
  Screening: { bg: 'rgba(37,99,235,.08)', text: '#2563EB', border: 'rgba(37,99,235,.2)' },
  Interview: { bg: 'rgba(124,58,237,.08)', text: '#7C3AED', border: 'rgba(124,58,237,.2)' },
  Offer: { bg: 'rgba(5,150,105,.08)', text: '#059669', border: 'rgba(5,150,105,.2)' },
  Hired: { bg: 'rgba(16,185,129,.12)', text: '#059669', border: 'rgba(16,185,129,.3)' },
  Rejected: { bg: 'rgba(220,38,38,.08)', text: '#DC2626', border: 'rgba(220,38,38,.2)' },
};

const DECISION_META: Record<string, { label: string; color: string; bg: string }> = {
  STRONG_YES: { label: 'Strong Yes ✦', color: '#059669', bg: 'rgba(5,150,105,.1)' },
  YES: { label: 'Yes', color: '#0D9488', bg: 'rgba(13,148,136,.1)' },
  MAYBE: { label: 'Maybe', color: '#D97706', bg: 'rgba(217,119,6,.1)' },
  NO: { label: 'No', color: '#DC2626', bg: 'rgba(220,38,38,.1)' },
};

const scoreColor = (s: number) => s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#DC2626';

const cleanFileName = (fileName: string) => {
  if (!fileName) return "Unknown Candidate";
  let name = fileName.replace(/\.[^/.]+$/, "");
  name = name.replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, "");
  name = name.replace(/ \(\d+\)/g, "");
  name = name.replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, "");
  name = name.replace(/[_\-]+/g, " ").replace(/\s\s+/g, " ").trim();
  return name || "Candidate";
};

/* ── Score Ring ─────────────────────────────────────────────── */
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: '900', fontSize: size > 80 ? '22px' : '16px', color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '1px' }}>SCORE</span>
      </div>
    </div>
  );
}

/* ── Stage Tracker ──────────────────────────────────────────── */
function StagePipeline({ current, candidateId, onUpdate }: { current: string; candidateId: string; onUpdate: (s: string) => void }) {
  const [updating, setUpdating] = useState<string | null>(null);
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  const curIdx = stages.indexOf(current);

  const moveStage = async (stage: string) => {
    if (stage === current) return;
    setUpdating(stage);
    try { await jobApi.updateCandidateStage(candidateId, stage); onUpdate(stage); }
    catch { alert('Failed to update stage.'); }
    finally { setUpdating(null); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
      {stages.map((stage, i) => {
        const done = i <= curIdx;
        const isActive = stage === current;
        const ss = STAGE_STYLES[stage];
        return (
          <React.Fragment key={stage}>
            <button onClick={() => moveStage(stage)} disabled={updating !== null}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isActive ? ss.bg : done ? 'rgba(5,150,105,.08)' : 'rgba(0,0,0,.04)', border: `2px solid ${isActive ? ss.border : done ? 'rgba(5,150,105,.3)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {updating === stage
                  ? <Loader2 size={12} className="animate-spin" color="var(--accent-primary)" />
                  : done && !isActive
                    ? <CheckCircle2 size={14} color="var(--success)" />
                    : <span style={{ fontSize: '10px', fontWeight: '700', color: isActive ? ss.text : 'var(--text-muted)' }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: '9px', fontWeight: isActive ? '700' : '500', color: isActive ? ss.text : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{stage}</span>
            </button>
            {i < stages.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done && i < curIdx ? 'var(--success)' : 'var(--border-color)', transition: 'background 0.4s', marginBottom: '18px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Comment Feed ───────────────────────────────────────────── */
function CommentFeed({ candidateId }: { candidateId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('Recruiter');
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    jobApi.getComments(candidateId)
      .then(r => { setComments(r.data.comments || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [candidateId]);

  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const r = await jobApi.postComment(candidateId, body, author);
      setComments(prev => [...prev, r.data.comment]);
      setBody('');
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { alert('Failed to post comment.'); }
    finally { setPosting(false); }
  };

  const fmt = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        <MessageSquare size={12} /> Team Comments
        {comments.length > 0 && <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 7px' }}>{comments.length}</span>}
      </div>
      {!loaded
        ? <div style={{ textAlign: 'center', padding: '16px' }}><Loader2 className="animate-spin" size={18} color="var(--accent-primary)" /></div>
        : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>No comments yet.</div>
              ) : comments.map((c, i) => (
                <div key={c._id || i} style={{ padding: '10px 12px', borderRadius: 'var(--radius)', background: 'rgba(0,0,0,.02)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{c.author}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmt(c.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)', margin: 0 }}>{c.body}</p>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea className="input" rows={2} value={body} onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
                placeholder="Add a comment…"
                style={{ fontSize: '12px', resize: 'none', lineHeight: 1.4 }} />
              <button className="btn-primary" onClick={post} disabled={posting || !body.trim()}
                style={{ padding: '6px 12px', fontSize: '12px', justifyContent: 'center' }}>
                {posting ? <Loader2 size={12} className="animate-spin" /> : 'Post Comment'}
              </button>
            </div>
          </>
        )}
    </div>
  );
}

/* ── Interview Questions ──────────────────────────────────── */
function InterviewQuestionsPanel({ candidateId, cached }: { candidateId: string; cached: any }) {
  const [questions, setQuestions] = useState<any>(cached || null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!!cached);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await jobApi.generateInterviewQuestions(candidateId);
      setQuestions(r.data.questions);
      setOpen(true);
    } catch { alert('Evaluation required first.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div onClick={() => questions && setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: questions ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Interview Kits</span>
        </div>
        {questions ? (open ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
      </div>

      {!questions ? (
        <button onClick={generate} disabled={loading} className="btn-secondary" style={{ width: '100%', marginTop: '12px', justifyContent: 'center', fontSize: '12px' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Generate Question Set'}
        </button>
      ) : (
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {questions.categories?.map((cat: any, i: number) => (
                  <div key={i}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>{cat.name}</div>
                    <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {cat.questions.map((q: string, j: number) => <li key={j} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{q}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ── Resume Viewer ──────────────────────────────────────────── */
function ResumeViewer({ url, name }: { url: string; name: string }) {
  const [error, setError] = useState(false);
  const fullUrl = url ? (url.startsWith('http') ? url : `http://localhost:5001${url}`) : '';

  if (!url) {
    return (
      <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', gap: '16px', border: '2px dashed var(--border-color)' }}>
        <FileText size={48} color="var(--text-muted)" strokeWidth={1} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Scan unavailable</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: 'calc(100vh - 200px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', background: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '4px 8px', fontSize: '10px' }}>
          Open Full <ExternalLink size={10} />
        </a>
      </div>
      <div style={{ flex: 1, background: '#F3F4F6' }}>
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Resume Preview"
        />
      </div>
    </div>
  );
}

/* ── Main Profile Page ──────────────────────────────────────── */
export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Rename states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => { loadProfile(); }, [id]);

  const loadProfile = async () => {
    try {
      const res = await jobApi.getCandidate(id);
      if (res.data.success) {
        setCandidate(res.data.candidate);
        setCampaign(res.data.campaign);
        setNotes(res.data.candidate.notes || '');
        setTags(res.data.candidate.tags || []);
        
        const pd = res.data.candidate.parsed_data || {};
        setEditableName(pd.full_name || cleanFileName(res.data.candidate.fileName));
      }
    } catch { } finally { setLoading(false); }
  };

  const saveNotes = async () => {
    setSaving(true);
    try { await jobApi.updateCandidateNotes(id, notes, tags); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch { alert('Failed to save.'); } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editableName.trim()) return;
    setRenaming(true);
    try {
      await jobApi.renameCandidate(id, editableName.trim());
      setCandidate((prev: any) => ({
        ...prev,
        parsed_data: { ...(prev.parsed_data || {}), full_name: editableName.trim() }
      }));
      setIsEditingName(false);
    } catch {
      alert('Failed to rename candidate.');
    } finally {
      setRenaming(false);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const t = tagInput.trim();
      if (!tags.includes(t)) setTags(prev => [...prev, t]);
      setTagInput('');
    }
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      <p style={{ color: 'var(--text-secondary)' }}>Syncing candidate data…</p>
    </div>
  );

  if (!candidate) return (
    <div className="empty-state">
      <AlertCircle size={40} className="empty-state-icon" />
      <h3>Candidate not found</h3>
      <button className="btn-primary" onClick={() => router.back()}><ChevronLeft size={16} /> Go back</button>
    </div>
  );

  const pd = candidate.parsed_data || {};
  const name = pd.full_name || cleanFileName(candidate.fileName);
  const score = candidate.final_score ?? candidate.match_score;
  const dec = DECISION_META[candidate.final_decision];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px 40px' }}>
      
      {/* ── PREMIUM IDENTITY HERO ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border-color)', margin: '0 -24px 28px', padding: '20px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)', boxShadow: '0 8px 16px -4px rgba(232,98,42,0.3)' }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                {isEditingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      autoFocus
                      className="input" 
                      style={{ fontSize: '20px', fontWeight: '800', padding: '4px 10px', width: '280px' }} 
                      value={editableName} 
                      onChange={e => setEditableName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleRename()}
                    />
                    <button onClick={handleRename} disabled={renaming} className="btn-primary" style={{ padding: '6px' }}>
                      {renaming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button onClick={() => { setIsEditingName(false); setEditableName(name); }} className="btn-ghost" style={{ padding: '6px' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {name}
                      <button onClick={() => setIsEditingName(true)} className="btn-ghost" style={{ padding: '4px', opacity: 0.4 }} title="Edit Name">
                        <Edit2 size={14} />
                      </button>
                    </h1>
                    <span className="badge badge-accent" style={{ fontSize: '10px', padding: '2px 8px' }}>ID: #{id.slice(-6).toUpperCase()}</span>
                    {pd.is_fresher && <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>ENTRY LEVEL</span>}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Briefcase size={14} color="var(--accent-primary)" />
                   <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{pd.current_title || 'Applicant'}</span>
                </div>
                {campaign && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span>Applied for: </span>
                    <Link href={`/jd/${campaign._id}`} style={{ color: 'var(--accent-primary)', fontWeight: '700', textDecoration: 'none' }}>{campaign.title}</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {score != null && <ScoreRing score={score} size={64} />}
            <div className="divider-v" style={{ height: '40px', margin: '0 8px' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Current Status</div>
              <span style={{ background: STAGE_STYLES[candidate.interview_stage || 'Applied'].bg, color: STAGE_STYLES[candidate.interview_stage || 'Applied'].text, fontSize: '12px', fontWeight: '800', padding: '4px 12px', borderRadius: '30px', border: `1px solid ${STAGE_STYLES[candidate.interview_stage || 'Applied'].border}` }}>
                {candidate.interview_stage || 'Applied'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr 340px', gap: '32px', alignItems: 'start' }}>
        
        {/* LEFTSIDE: DOCUMENT & CONTACT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ResumeViewer url={candidate.resume_url} name={candidate.fileName} />
          
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.08em' }}>Quick Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={14} color="var(--accent-primary)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>EMAIL</div>
                  <a href={`mailto:${pd.email}`} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pd.email || 'not provided'}</a>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={14} color="#0D9488" />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>PHONE</div>
                  <a href={`tel:${pd.phone}`} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none' }}>{pd.phone || 'not provided'}</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={14} color="#D97706" />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>LOCATION</div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{pd.location || 'Remote Opt-in'}</div>
                </div>
              </div>

              {(pd.social_links?.linkedin || pd.social_links?.github) && (
                <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
                  {pd.social_links.linkedin && (
                    <a href={pd.social_links.linkedin} target="_blank" rel="noreferrer" className="btn-secondary" style={{ flex: 1, padding: '8px', justifyContent: 'center' }}>
                      <Share2 size={14} /> LinkedIn
                    </a>
                  )}
                  {pd.social_links.github && (
                    <a href={pd.social_links.github} target="_blank" rel="noreferrer" className="btn-secondary" style={{ flex: 1, padding: '8px', justifyContent: 'center' }}>
                      <Code size={14} /> GitHub
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: AI INTELLIGENCE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Card */}
          <div className="card" style={{ padding: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
               <Zap size={14} /> High-Speed Fit Assessment
             </div>
             <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '20px', fontWeight: '500' }}>
               {pd.work_summary || 'No summary generated yet.'}
             </p>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                   <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>PROFESSIONAL EXP</div>
                   <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>
                     {pd.experience_years < 1 && pd.experience_years > 0 
                       ? `${Math.round(pd.experience_years * 12)}m` 
                       : pd.experience_years === 0 || pd.is_fresher
                         ? 'Entry Level'
                         : `${pd.experience_years}y`}
                   </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>CONFIDENCE</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--success)' }}>{pd.confidence_score || 0}%</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>RANK</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent-primary)' }}>#{candidate.rank || '—'}</div>
                </div>
             </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', fontSize: '11px', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>
              <Award size={14} /> Core Capabilities & Verified Skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {candidate.validated_skills?.top_skills?.map((sk: any, i: number) => {
                const sn = typeof sk === 'string' ? sk : sk.name;
                const required = campaign?.jd_analysis?.must_have_skills || campaign?.jd_analysis?.required_skills || [];
                const isMatch = required.some((r: any) => (typeof r === 'string' ? r : r.name || '').toLowerCase().includes(sn.toLowerCase()));
                return (
                  <span key={i} style={{ padding: '6px 14px', borderRadius: '30px', fontSize: '13px', fontWeight: '700', background: isMatch ? 'rgba(5,150,105,.1)' : 'rgba(0,0,0,.04)', color: isMatch ? 'var(--success)' : 'var(--text-secondary)', border: `1.5px solid ${isMatch ? 'rgba(5,150,105,.3)' : 'var(--border-color)'}` }}>
                    {isMatch && '✓ '}{sn}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              <UserCheck size={14} /> Agents Debate & HR synthesis
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', padding: '16px', borderRadius: '12px', background: 'rgba(0,0,0,0.015)', border: '1px solid var(--border-color)', fontStyle: 'italic', marginBottom: '16px' }}>
              &ldquo;{candidate.debate_summary || 'Evaluating technical trade-offs…'}&rdquo;
            </div>
            {candidate.hr_note && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(5,150,105,0.04)', border: '1px solid rgba(5,150,105,0.2)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--success)', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>
                   <ShieldAlert size={12} /> HR Final Synthesis
                 </div>
                 <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>{candidate.hr_note}</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHTSIDE: ACTIONS & PIPELINE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px' }}>Pipeline Management</div>
            <StagePipeline
              current={candidate.interview_stage || 'Applied'}
              candidateId={id}
              onUpdate={s => setCandidate((prev: any) => ({ ...prev, interview_stage: s }))}
            />
            <div className="divider" style={{ margin: '16px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['Interview', 'Offer', 'Hired', 'Rejected'] as const).map(s => {
                const isActive = candidate.interview_stage === s;
                return (
                  <button key={s} onClick={() => jobApi.updateCandidateStage(id, s).then(() => setCandidate((p:any)=>({...p, interview_stage: s})))}
                    style={{ padding: '10px 14px', borderRadius: '10px', textAlign: 'left', border: '1px solid var(--border-color)', background: isActive ? 'var(--accent-gradient)' : 'white', color: isActive ? 'white' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '700', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {s} {isActive && <CheckCircle2 size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          <InterviewQuestionsPanel candidateId={id} cached={candidate.interview_questions} />

          <div className="card" style={{ padding: '20px' }}>
             <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Internal Notes</div>
             <textarea className="input" rows={6} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Type notes here…" style={{ fontSize: '13px', lineHeight: 1.5, background: 'rgba(232,98,42,0.02)' }} />
             <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {tags.map(t => <span key={t} className="badge badge-accent" style={{ fontSize: '10px', cursor: 'pointer', padding: '3px 8px' }} onClick={() => removeTag(t)}>{t} ✕</span>)}
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" style={{ fontSize: '13px', flex: 1 }} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Add tag..." />
                <button className="btn-primary" onClick={saveNotes} disabled={saving} style={{ padding: '8px 16px' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
             </div>
             {saved && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '11px', color: 'var(--success)', marginTop: '8px', fontWeight: '700' }}>Changes auto-saved to cloud.</motion.div>}
          </div>

          <CommentFeed candidateId={id} />
          
          <div style={{ padding: '0 10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Reference: {String(id).toUpperCase()} <br/>
            Last Sync: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
