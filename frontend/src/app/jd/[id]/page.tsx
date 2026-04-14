'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Loader2, ChevronLeft,
  LayoutGrid, Sparkles, Upload, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, MessageSquare, UserCheck, Zap,
  Award, RefreshCw, Clock, MapPin, ExternalLink, BrainCircuit,
  Share2, Copy, Star, ShieldAlert, ChevronRight, TrendingUp, Trash2,
  ListFilter, BarChart3, PieChart, Target
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { pushNotif } from '@/components/Sidebar';

// ── Pipeline Stepper ───────────────────────────────────────────
const STEPS = [
  { key: 'UPLOADED',      label: 'Received',  short: '1' },
  { key: 'AGENT_3_4_DONE', label: 'Parsed',  short: '2' },
  { key: 'AGENT_5_DONE',   label: 'Scored',  short: '3' },
  { key: 'AGENT_6_7_DONE', label: 'Debated', short: '4' },
  { key: 'COMPLETED',      label: 'Done',    short: '5' },
];

const PipelineStepper = ({ status }: { status: string }) => {
  const cur = STEPS.findIndex(s => s.key === status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {STEPS.map((step, i) => {
        const done = i <= cur;
        const active = i === cur + 1 && status !== 'COMPLETED';
        const isLast = i === STEPS.length - 1;
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div className={`step-dot ${done ? 'done' : active ? 'active' : ''}`}>
                {done && i < cur ? <CheckCircle2 size={12} /> : active ? <Loader2 size={11} className="animate-spin" /> : step.short}
              </div>
              <span style={{ fontSize: '8px', color: done ? 'var(--success)' : active ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: '600', marginTop: '3px', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {!isLast && <div className={`step-line ${done && i < cur ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const cleanFileName = (fileName: string) => {
  if (!fileName) return "Unknown Candidate";
  let name = fileName.replace(/\.[^/.]+$/, "");
  name = name.replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, "");
  name = name.replace(/ \(\d+\)/g, "");
  name = name.replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, "");
  name = name.replace(/[_\-]+/g, " ").replace(/\s\s+/g, " ").trim();
  return name || "Candidate";
};

// ── Candidate Row ──────────────────────────────────────────────
const decisionStyle: Record<string, string> = {
  STRONG_YES: 'decision-STRONG_YES',
  YES: 'decision-YES',
  MAYBE: 'decision-MAYBE',
  NO: 'decision-NO',
};

const scoreColor = (score: number) => {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
};

const CandidateCard = ({ candidate, rank, onDelete }: { candidate: any; rank?: number; onDelete: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const score = candidate.final_score ?? candidate.match_score;
  const decClass = decisionStyle[candidate.final_decision] || '';

  return (
    <div className="card" style={{ 
      overflow: 'hidden', 
      border: open ? '1.5px solid rgba(232,98,42,0.3)' : '1px solid var(--border-color)',
      transition: 'border-color 0.2s',
      marginBottom: '10px',
    }}>
      {/* Summary row */}
      <div 
        onClick={() => setOpen(!open)}
        style={{ 
          padding: '16px 20px', 
          display: 'grid', 
          gridTemplateColumns: '48px 1fr 220px 90px 110px 40px 36px', 
          alignItems: 'center', 
          cursor: 'pointer',
          gap: '12px',
        }}
      >
        {/* Rank */}
        <div style={{ 
          width: '40px', height: '40px', borderRadius: '10px', 
          background: rank && rank <= 3 ? 'var(--accent-gradient)' : 'rgba(0,0,0,0.05)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          fontWeight: '800', fontSize: '15px', 
          color: rank && rank <= 3 ? 'white' : 'var(--text-secondary)',
          fontFamily: 'var(--font-display)',
        }}>
          {rank || '—'}
        </div>

        {/* Name + skills */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '7px' }}>
            {candidate.parsed_data?.full_name || cleanFileName(candidate.fileName)}
            <Link href={`/candidate/${candidate._id}`} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
              <ExternalLink size={12} color="var(--accent-primary)" />
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {(candidate.validated_skills?.top_skills || []).slice(0, 3).map((sk: any, i: number) => (
              <span key={i} className="tag" style={{ fontSize: '10px' }}>
                {typeof sk === 'string' ? sk : sk.name}
              </span>
            ))}
          </div>
        </div>

        {/* Pipeline */}
        <div style={{ padding: '0 8px' }}>
          <PipelineStepper status={candidate.status} />
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.06em', marginBottom: '3px', textTransform: 'uppercase' }}>Score</div>
          {score != null ? (
            <div style={{ fontSize: '22px', fontWeight: '900', color: scoreColor(score), fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {score}
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</div>}
        </div>

        {/* Decision */}
        <div style={{ textAlign: 'center' }}>
          {candidate.final_decision ? (
            <span className={`badge ${decClass}`} style={{ fontSize: '10px' }}>
              {candidate.final_decision.replace('_', ' ')}
            </span>
          ) : (
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>PENDING</span>
          )}
        </div>

        {/* Delete */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(candidate._id);
            }} 
            className="btn-ghost" 
            style={{ padding: '6px', borderRadius: '8px', color: 'var(--error)' }}
            title="Delete Candidate"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {open ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--border-color)' }}
          >
            <div style={{ padding: '24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: 'rgba(0,0,0,0.015)' }}>
              {/* Left */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <MessageSquare size={13} /> Agent 6+7: Debate Reconciliation
                </div>
                <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px' }}>
                    "{candidate.debate_summary || 'Evaluation pending…'}"
                  </p>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent 5 Score</div>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{candidate.match_score ?? '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Corrected Score</div>
                      <div style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{candidate.corrected_score ?? '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Final Score</div>
                      <div style={{ fontWeight: '800', color: score != null ? scoreColor(score) : 'var(--text-primary)' }}>{score ?? '—'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <UserCheck size={13} /> Agent 9: HR Final Review
                </div>
                <div className="card" style={{ padding: '16px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  {candidate.hr_note || 'Awaiting HR synthesis…'}
                </div>
              </div>

              {/* Right */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Award size={13} /> Validated Skills
                </div>
                <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {(candidate.validated_skills?.top_skills || []).map((s: any, i: number) => (
                      <span key={i} className="tag tag-success">{typeof s === 'string' ? s : s.name}</span>
                    ))}
                  </div>
                </div>

                {(candidate.match_results?.strengths?.length > 0) && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <Zap size={13} /> Match Highlights
                    </div>
                    <div className="card" style={{ padding: '16px' }}>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {candidate.match_results.strengths.slice(0, 4).map((s: string, i: number) => (
                          <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Campaign Intelligence Dashboard ──────────────────────────
type RequiredSkill = string | { name: string };
type CandidateSkill = string | { name: string };
type SkillCoverageItem = { name: string; count: number; pct: number };

const CampaignAnalytics = ({ candidates, job }: { candidates: any[]; job: any }) => {
  const funnelStages = ['Sourcing', 'Screening', 'Interview', 'Offer', 'Hired'];
  const funnelData = funnelStages.map(s => ({
    stage: s,
    count: candidates.filter(c => (c.interview_stage || 'Sourcing') === s).length
  }));

  const scoreBuckets = [
    { label: '90-100', min: 90, max: 101, color: '#10B981' },
    { label: '80-89',  min: 80, max: 90,  color: '#059669' },
    { label: '70-79',  min: 70, max: 80,  color: '#D97706' },
    { label: '60-69',  min: 60, max: 70,  color: '#EA580C' },
    { label: '< 60',   min: 0,  max: 60,  color: '#DC2626' },
  ];

  const scoreDist = scoreBuckets.map(b => ({
    ...b,
    count: candidates.filter(c => {
      const s = c.final_score ?? c.match_score;
      return s != null && s >= b.min && s < b.max;
    }).length
  }));

  const rawRequiredSkills = job.jd_analysis?.must_have_skills ?? job.jd_analysis?.required_skills ?? [];
  const requiredSkills: RequiredSkill[] = Array.isArray(rawRequiredSkills) ? rawRequiredSkills : [];

  const skillCoverage: SkillCoverageItem[] = requiredSkills
    .map((skill): SkillCoverageItem | null => {
      const name = (typeof skill === 'string' ? skill : skill?.name)?.trim();
      if (!name) return null;

      const matchCount = candidates.filter(c =>
        (c.validated_skills?.top_skills || []).some((sk: CandidateSkill) =>
          (typeof sk === 'string' ? sk : sk.name).toLowerCase().includes(name.toLowerCase())
        )
      ).length;

      return {
        name,
        count: matchCount,
        pct: candidates.length ? Math.round((matchCount / candidates.length) * 100) : 0,
      };
    })
    .filter((item): item is SkillCoverageItem => item !== null)
    .sort((a, b) => b.pct - a.pct);

  const maxFunnel = Math.max(...funnelData.map(d => d.count), 1);
  const maxScore = Math.max(...scoreDist.map(d => d.count), 1);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Applicants', value: candidates.length, icon: Users, color: 'var(--text-primary)' },
          { label: 'Avg Pool Score', value: `${Math.round(candidates.reduce((a, b) => a + (b.final_score ?? b.match_score ?? 0), 0) / (candidates.length || 1))}%`, icon: Zap, color: 'var(--accent-primary)' },
          { label: 'Shortlist Rate', value: `${Math.round((candidates.filter(c => c.final_decision === 'STRONG_YES' || c.final_decision === 'YES').length / (candidates.length || 1)) * 100)}%`, icon: Target, color: 'var(--success)' },
          { label: 'Active Interviews', value: candidates.filter(c => c.interview_stage === 'Interview').length, icon: MessageSquare, color: 'var(--info)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={20} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Funnel */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            <BarChart3 size={14} color="var(--accent-primary)" /> Hiring Funnel Conversion
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {funnelData.map((d, i) => (
              <div key={d.stage} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ fontWeight: '600' }}>{d.stage}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{d.count} ({Math.round(d.count / maxFunnel * 100)}%)</span>
                </div>
                <div style={{ height: '32px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
                   <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${(d.count / maxFunnel) * 100}%` }}
                    style={{ height: '100%', background: `linear-gradient(90deg, var(--accent-primary) 0%, #F59E0B ${100 - (i * 15)}%)`, opacity: 0.8 }} 
                   />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Spectrum */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            <PieChart size={14} color="var(--success)" /> Talent Quality Distribution
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '220px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            {scoreDist.map(b => (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: b.color }}>{b.count}</div>
                <motion.div 
                  initial={{ height: 0 }} animate={{ height: `${(b.count / maxScore) * 160}px` }}
                  style={{ width: '100%', background: b.color, borderRadius: '4px 4px 0 0', minHeight: b.count > 0 ? '4px' : '0' }}
                 />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
          <Zap size={14} color="#F59E0B" /> Market Skill Coverage Map
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {skillCoverage.length > 0 ? skillCoverage.map(s => (
            <div key={s.name} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: s.pct > 70 ? 'rgba(16,185,129,0.03)' : s.pct < 30 ? 'rgba(220,38,38,0.03)' : 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.count} candidates matched</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '900', color: s.pct > 70 ? 'var(--success)' : s.pct < 30 ? 'var(--error)' : 'var(--warning)' }}>{s.pct}%</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Market Fit</div>
              </div>
            </div>
          )) : (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No required skills defined in JD.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Upload Zone ────────────────────────────────────────────────
const UploadZone = ({ onUpload, isUploading }: { onUpload: (f: File[]) => Promise<void>; isUploading: boolean }) => {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (newFiles: File[]) => setFiles(prev => {
    const existing = new Set(prev.map(f => f.name));
    return [...prev, ...newFiles.filter(f => !existing.has(f.name))];
  });

  return (
    <div className="card" style={{ padding: '24px', marginBottom: '28px' }}>
      <div 
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => !isUploading && document.getElementById('cv-file-input')?.click()}
      >
        <input 
          id="cv-file-input"
          type="file" 
          multiple 
          hidden 
          accept=".pdf,.docx,.doc"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
        />
        <motion.div animate={{ y: dragging ? -6 : 0 }} transition={{ type: 'spring', damping: 15 }}>
          <Upload size={36} color={dragging ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
        </motion.div>
        <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px', color: dragging ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
          Drop CV files here
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>PDF, DOCX or DOC · up to 10 MB each</div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {files.map((f, i) => (
                <div key={i} className="badge badge-accent" style={{ gap: '6px', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                  <FileText size={11} />
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>{f.name}</span>
                  ✕
                </div>
              ))}
            </div>
            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={isUploading}
              onClick={async e => { e.stopPropagation(); await onUpload(files); setFiles([]); }}
            >
              {isUploading 
                ? <><Loader2 className="animate-spin" size={18} /> Uploading & Parsing…</> 
                : <><Upload size={18} /> Upload {files.length} Candidate CV{files.length !== 1 ? 's' : ''}</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main JD Detail Page ────────────────────────────────────────
export default function JDDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'intelligence'>('pipeline');
  const [job, setJob] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyPublicLink = () => {
    const url = `${window.location.origin}/jobs/${id}`;
    navigator.clipboard.writeText(url).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
  };

  const handleGenerateRecommendation = async () => {
    setRecLoading(true);
    try {
      const res = await jobApi.generateRecommendation(id);
      if (res.data.success) {
        setRecommendation(res.data.recommendation);
        pushNotif({ icon: 'complete', title: 'AI Recommendation Ready', body: `Recommendation for "${job?.title}" is ready.` });
      }
    } catch (e: any) {
      pushNotif({ icon: 'alert', title: 'Recommendation Failed', body: e.response?.data?.error || 'Cannot generate recommendation yet. Need 2+ evaluated candidates.' });
    } finally { setRecLoading(false); }
  };

  const fetchResults = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await jobApi.getResults(id);
      if (res.data.success) {
        setJob(res.data.job);
        setCandidates(res.data.candidates);
        setSummary(res.data.summary);
        
        const stillRunning = res.data.candidates.some((c: any) => !['COMPLETED', 'FAILED'].includes(c.status));
        if (!stillRunning && isPolling) {
          setIsPolling(false);
          setProcessing(false);
        }
      }
    } catch { /* silent */ } finally {
      if (!silent) setLoading(false);
    }
  }, [id, isPolling]);

  useEffect(() => { fetchResults(); }, [id, fetchResults]);
  
  useEffect(() => {
    if (!isPolling) return;
    const t = setInterval(() => fetchResults(true), 3000);
    return () => clearInterval(t);
  }, [isPolling, fetchResults]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    setUploadFeedback(null);
    try {
      const res = await jobApi.uploadCandidates(id, files);
      const count = res.data.uploaded?.length || files.length;
      setUploadFeedback(`✓ ${count} CVs uploaded and parsed.`);
      pushNotif({ icon: 'upload', title: 'CVs Uploaded', body: `${count} candidate CV${count !== 1 ? 's' : ''} uploaded to "${job?.title || 'campaign'}" and parsed.` });
      await fetchResults(true);
    } catch {
      setUploadFeedback('✗ Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleEvaluate = async () => {
    setProcessing(true);
    setIsPolling(true);
    setProcessError(null);
    pushNotif({ icon: 'info', title: 'Evaluation Started', body: `AI agents are now evaluating candidates for "${job?.title || 'campaign'}".` });
    try {
      await jobApi.processEvaluation(id);
      pushNotif({ icon: 'complete', title: 'Evaluation Complete', body: `All candidates have been scored and ranked for "${job?.title || 'campaign'}".` });
    } catch (err: any) {
      setProcessError(err.response?.data?.error || 'Pipeline failed. Check server logs.');
      pushNotif({ icon: 'alert', title: 'Evaluation Failed', body: err.response?.data?.error || 'Pipeline error. Check server logs.' });
      setIsPolling(false);
      setProcessing(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" />
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading campaign…</p>
    </div>
  );

  if (!job) return (
    <div className="empty-state">
      <AlertCircle size={44} className="empty-state-icon" />
      <h3>Campaign Not Found</h3>
      <button className="btn-primary" onClick={() => router.push('/')}><ChevronLeft size={16} /> Back to Dashboard</button>
    </div>
  );

  const statusMap: Record<string, { label: string; cls: string }> = {
    Sourcing: { label: 'Sourcing', cls: 'badge-warning' },
    Evaluating: { label: 'Evaluating', cls: 'badge-info' },
    Completed: { label: 'Completed', cls: 'badge-success' },
  };
  const st = statusMap[job.status] || { label: job.status, cls: 'badge-neutral' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => router.push('/')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Dashboard
          <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
          <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{job.title}</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className={`badge ${st.cls}`}>{st.label}</span>
            <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '10px' }}>#{id.slice(-6).toUpperCase()}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} />{new Date(job.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '4px', letterSpacing: '-0.3px' }}>{job.title}</h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={13} />{job.department}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={copyPublicLink} style={{ fontSize: '13px' }}>
            {linkCopied ? <><CheckCircle2 size={14} color="var(--success)" /> Copied!</> : <><Share2 size={14} /> Share Role</>}
          </button>
          <button className="btn-secondary" onClick={() => fetchResults(true)}><RefreshCw size={15} /> Refresh</button>
          <button className="btn-primary" onClick={handleEvaluate} disabled={processing || candidates.length === 0} style={{ padding: '11px 22px' }}>
            {processing ? <><Loader2 className="animate-spin" size={18} /> Running Agents…</> : <><Sparkles size={18} /> Evaluate All Candidates</>}
          </button>
        </div>
      </div>

      {processError && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} />{processError}
        </div>
      )}

      {isPolling && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '10px', 
            padding: '12px 18px', borderRadius: 'var(--radius)', 
            background: 'var(--info-bg)', border: '1px solid rgba(37,99,235,0.2)',
            color: 'var(--info)', fontSize: '13px', marginBottom: '20px',
          }}
        >
          <Loader2 className="animate-spin" size={15} />
          Multi-agent pipeline is running. Results update every 3 seconds…
        </motion.div>
      )}

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '28px' }}>
        
        {/* LEFT: Content based on TABS */}
        <div>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
            {(['pipeline', 'intelligence'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '12px 4px', background: 'none', border: 'none', borderBottom: `2.5px solid ${activeTab === t ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', textTransform: 'capitalize' }}>
                {t === 'pipeline' ? <ListFilter size={15} /> : <BarChart3 size={15} />}
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'pipeline' ? (
              <motion.div key="pipeline" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <UploadZone onUpload={handleUpload} isUploading={uploading} />
                
                {uploadFeedback && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '13px', color: uploadFeedback.startsWith('✓') ? 'var(--success)' : 'var(--error)', marginBottom: '16px', fontWeight: '600' }}>
                    {uploadFeedback}
                  </motion.p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="var(--accent-primary)" />
                    <span style={{ fontWeight: '700', fontSize: '16px' }}>Candidate Pipeline</span>
                    {candidates.length > 0 && <span className="badge badge-accent">{candidates.length}</span>}
                  </div>
                </div>

                {candidates.length === 0 ? (
                  <div className="card empty-state" style={{ padding: '60px 30px' }}>
                    <Users size={40} className="empty-state-icon" />
                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>No candidates yet</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Drop CVs above to begin the AI evaluation.</p>
                  </div>
                ) : (
                  <div>
                    {candidates.map((c, i) => (
                      <motion.div key={c._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <CandidateCard 
                          candidate={c} 
                          rank={c.rank} 
                          onDelete={async (cid) => {
                            if (window.confirm('Are you sure you want to delete this candidate?')) {
                              try {
                                await jobApi.deleteCandidate(cid);
                                pushNotif({ icon: 'complete', title: 'Candidate Deleted', body: 'The candidate and their files have been removed.' });
                                fetchResults(true);
                              } catch { alert('Failed to delete candidate.'); }
                            }
                          }}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <CampaignAnalytics key="intelligence" candidates={candidates} job={job} />
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Intelligence Side Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* AI Recommendation Panel */}
          <div className="card" style={{ padding: '22px', border: recommendation ? '1.5px solid rgba(232,98,42,0.3)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px', fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Star size={13} /> AI Hiring Recommendation
            </div>
            {recommendation ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '800', background: recommendation.confidence === 'HIGH' ? 'rgba(5,150,105,0.1)' : recommendation.confidence === 'MEDIUM' ? 'rgba(217,119,6,0.1)' : 'rgba(156,163,175,0.1)', color: recommendation.confidence === 'HIGH' ? 'var(--success)' : recommendation.confidence === 'MEDIUM' ? '#D97706' : 'var(--text-muted)', border: `1px solid ${recommendation.confidence === 'HIGH' ? 'rgba(5,150,105,0.2)' : 'rgba(0,0,0,0.08)'}` }}>
                    {recommendation.confidence} CONFIDENCE
                  </span>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius)', background: 'rgba(232,98,42,0.04)', border: '1px solid rgba(232,98,42,0.15)', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>RECOMMENDED HIRE</div>
                  <div style={{ fontWeight: '800', fontSize: '16px', fontFamily: 'var(--font-display)', marginBottom: '6px' }}>{recommendation.recommended_candidate}</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{recommendation.headline}</div>
                  {recommendation.recommended_id && (
                    <Link href={`/candidate/${recommendation.recommended_id}`} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'none' }}>
                      View Profile <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
                {recommendation.reasons?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '7px' }}>Why This Candidate</div>
                    <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {recommendation.reasons.map((r: string, i: number) => <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {recommendation.risks?.length > 0 && (
                  <div style={{ marginBottom: '12px', padding: '12px', borderRadius: 'var(--radius)', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#D97706', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldAlert size={11} /> Potential Risks</div>
                    <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {recommendation.risks.map((r: string, i: number) => <li key={i} style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.4 }}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={handleGenerateRecommendation} disabled={recLoading} className="btn-ghost" style={{ marginTop: '12px', fontSize: '11px', width: '100%', justifyContent: 'center' }}>
                  <RefreshCw size={11} /> Regenerate
                </button>
              </motion.div>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0 8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  Let AI analyze your top candidates and recommend the best hire with reasons + risks.
                </div>
                <button 
                  className="btn-primary" 
                  onClick={handleGenerateRecommendation} 
                  disabled={recLoading || candidates.filter(c => c.status === 'COMPLETED').length < 2} 
                  style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
                >
                  {recLoading ? <><Loader2 className="animate-spin" size={15} /> Analyzing candidates…</> : <><BrainCircuit size={15} /> Generate AI Recommendation</>}
                </button>
                {candidates.filter(c => c.status === 'COMPLETED').length < 2 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Needs 2+ evaluated candidates.</p>
                )}
              </div>
            )}
          </div>

          {/* Stats Summary Panel */}
          {summary && (
            <div className="card" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '18px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <LayoutGrid size={13} /> Campaign Overview
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Talent Pool', value: summary.total, color: 'var(--text-primary)' },
                  { label: 'Shortlisted', value: summary.shortlisted, color: 'var(--success)' },
                  { label: 'Borderline', value: summary.maybes, color: 'var(--warning)' },
                  { label: 'Declined', value: summary.rejected, color: 'var(--error)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(0,0,0,0.025)', borderRadius: 'var(--radius)', padding: '12px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>{s.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skill Glimpse */}
          {(job.jd_analysis?.must_have_skills?.length > 0) && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Must-Have Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {job.jd_analysis.must_have_skills.slice(0, 10).map((s: string, i: number) => (
                  <span key={i} className="tag tag-warn" style={{ fontSize: '10px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* JD Mini */}
          <div className="card" style={{ padding: '20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <FileText size={12} /> Job Description
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)', maxHeight: '200px', overflowY: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{job.generated_jd}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
