'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, ChevronRight, Clock, MapPin, Plus, Search,
  TrendingUp, CheckCircle2, Circle, Flame, Users, BarChart2,
  Trash2, KanbanSquare, LayoutGrid, ArrowRight, ChevronLeft, X,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { jobApi } from '@/lib/api';

const KANBAN_STAGES = ['Sourcing', 'Screening', 'Interview', 'Offer', 'Hired'] as const;
type KStage = typeof KANBAN_STAGES[number];

const STAGE_COLORS: Record<KStage, { bg: string; text: string; border: string }> = {
  Sourcing:  { bg: 'rgba(245,158,11,0.07)',  text: '#D97706', border: 'rgba(245,158,11,0.2)' },
  Screening: { bg: 'rgba(37,99,235,0.07)',   text: '#2563EB', border: 'rgba(37,99,235,0.2)' },
  Interview: { bg: 'rgba(124,58,237,0.07)',  text: '#7C3AED', border: 'rgba(124,58,237,0.2)' },
  Offer:     { bg: 'rgba(5,150,105,0.07)',   text: '#059669', border: 'rgba(5,150,105,0.2)' },
  Hired:     { bg: 'rgba(16,185,129,0.12)',  text: '#059669', border: 'rgba(16,185,129,0.3)' },
};

const EVAL_STATUS_COLORS: Record<string, string> = {
  Sourcing: '#D97706', Evaluating: '#2563EB', Completed: '#059669', Draft: '#9CA3AF',
};

type ViewMode = 'grid' | 'kanban';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [view, setView] = useState<ViewMode>('grid');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ id: string; current: string } | null>(null);

  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await jobApi.getAll();
      if (res.data.success) setCampaigns(res.data.campaigns);
    } catch { } finally { setLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this campaign and all its candidates? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await jobApi.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } catch { alert('Failed to delete.'); } finally { setDeleting(null); }
  };

  const moveToStage = async (id: string, stage: string) => {
    setMovingId(id);
    try {
      await jobApi.updateCampaignStage(id, stage);
      setCampaigns(prev => prev.map(c => c._id === id ? { ...c, kanban_stage: stage } : c));
    } catch { alert('Failed to move.'); } finally { setMovingId(null); setMoveModal(null); }
  };

  const allStages = ['All', ...KANBAN_STAGES];
  
  // Separation logic
  const filtered = campaigns.filter(c => {
    const matchQ = c.title?.toLowerCase().includes(query.toLowerCase()) || c.department?.toLowerCase().includes(query.toLowerCase());
    const matchS = filterStage === 'All' || (c.kanban_stage || 'Sourcing') === filterStage;
    return matchQ && matchS;
  });

  const activeJobs = filtered.filter(c => (c.kanban_stage || 'Sourcing') !== 'Hired');
  const closedJobs = filtered.filter(c => (c.kanban_stage || 'Sourcing') === 'Hired');

  const byStage = (stage: KStage) => campaigns.filter(c => (c.kanban_stage || 'Sourcing') === stage);

  const cardVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
  const totalCandidates = campaigns.reduce((s, c) => s + (c.candidateCount || 0), 0);
  const completedCount = campaigns.filter(c => (c.kanban_stage || 'Sourcing') === 'Hired').length;
  const activeCount = campaigns.filter(c => (c.kanban_stage || 'Sourcing') !== 'Hired').length;

  const CampaignCard = ({ campaign, compact = false, isClosed = false }: { campaign: any; compact?: boolean; isClosed?: boolean }) => {
    const stage = (campaign.kanban_stage || 'Sourcing') as KStage;
    const sColors = STAGE_COLORS[stage];
    const evalColor = EVAL_STATUS_COLORS[campaign.status] || '#9CA3AF';
    return (
      <div style={{ position: 'relative', opacity: isClosed ? 0.75 : 1, transition: 'opacity 0.2s' }}>
        <Link href={`/jd/${campaign._id}`} className="job-card" style={{ display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: compact ? '12px' : '18px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isClosed ? 'rgba(0,0,0,0.05)' : 'linear-gradient(135deg,rgba(232,98,42,.12),rgba(245,166,35,.12))', border: isClosed ? '1px solid var(--border-color)' : '1px solid rgba(232,98,42,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={18} color={isClosed ? 'var(--text-muted)' : 'var(--accent-primary)'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: `${evalColor}14`, color: evalColor, border: `1px solid ${evalColor}28`, fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {campaign.status === 'Completed' ? <CheckCircle2 size={9} /> : <Circle size={9} />} {campaign.status}
              </span>
              {!compact && (
                <button onClick={(e) => handleDelete(e, campaign._id)} disabled={deleting === campaign._id}
                  style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid rgba(220,38,38,.15)', background: 'var(--error-bg)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
          <h3 style={{ fontSize: compact ? '13px' : '15px', fontWeight: '700', color: isClosed ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom: '5px', lineHeight: 1.3 }}>{campaign.title}</h3>
          {!compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10} />{campaign.department || 'General'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {campaign.candidateCount > 0 && !compact && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={9} />{campaign.candidateCount} candidates</span>
                {campaign.status === 'Completed' && <span style={{ color: 'var(--success)', fontWeight: '700' }}>{campaign.shortlisted || 0} shortlisted</span>}
              </div>
              {campaign.status === 'Completed' && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(((campaign.shortlisted || 0) / campaign.candidateCount) * 100, 100)}%` }} />
                </div>
              )}
            </div>
          )}
          <div className="divider" style={{ marginBottom: '12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge badge-accent" style={{ fontSize: '9px', fontFamily: 'monospace' }}>#{campaign._id.slice(-6).toUpperCase()}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: isClosed ? 'var(--text-muted)' : 'var(--accent-primary)', fontWeight: '600' }}>{isClosed ? 'View data' : 'Open pipeline'} <ChevronRight size={12} /></div>
          </div>
        </Link>

        {/* Kanban stage badge & move button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: compact ? '8px' : '10px', justifyContent: 'space-between' }}>
          <span style={{ background: sColors.bg, color: sColors.text, border: `1px solid ${sColors.border}`, fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px' }}>{stage}</span>
          <button
            onClick={e => { e.stopPropagation(); setMoveModal({ id: campaign._id, current: stage }); }}
            className="btn-ghost" style={{ fontSize: '10px', padding: '3px 8px', opacity: 0.7 }}>
            {isClosed ? 'Reopen' : 'Move'} →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Executive Hiring Dashboard</h1>
          <p className="page-subtitle">Strategic overview of your active recruitment pipeline.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/analytics" className="btn-secondary" style={{ fontSize: '13px' }}><BarChart2 size={15} /> Analytics</Link>
          <Link href="/create-jd" className="btn-primary"><Plus size={15} /> New Role</Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && campaigns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Total Campaigns', value: campaigns.length, icon: Briefcase, color: 'var(--accent-primary)' },
            { label: 'Active Positions', value: activeCount, icon: Flame, color: '#D97706' },
            { label: 'Positions Filled', value: completedCount, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'Total Candidates', value: totalCandidates, icon: Users, color: 'var(--info)' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="stat-card-label">{s.label}</div>
                    <div className="stat-card-value" style={{ color: s.color, fontSize: '28px' }}>{s.value}</div>
                  </div>
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} color={s.color} />
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search campaigns…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {allStages.map(s => (
            <button key={s} onClick={() => setFilterStage(s)}
              style={{ padding: '0 13px', height: '46px', borderRadius: 'var(--radius)', border: `1.5px solid ${filterStage === s ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: filterStage === s ? 'var(--accent-soft)' : 'var(--bg-card)', color: filterStage === s ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: filterStage === s ? '700' : '500', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--shadow-xs)' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['grid', 'kanban'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ width: '46px', height: '46px', borderRadius: 'var(--radius)', border: `1.5px solid ${view === v ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: view === v ? 'var(--accent-soft)' : 'var(--bg-card)', color: view === v ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {v === 'grid' ? <LayoutGrid size={16} /> : <KanbanSquare size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: '24px' }}>
              <div className="skeleton" style={{ height: '38px', width: '38px', borderRadius: '10px', marginBottom: '18px' }} />
              <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '12px', width: '50%', marginBottom: '20px' }} />
              <div className="skeleton" style={{ height: '1px', width: '100%', marginBottom: '14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ height: '18px', width: '70px', borderRadius: '20px' }} />
                <div className="skeleton" style={{ height: '18px', width: '90px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card empty-state">
          <Briefcase size={40} className="empty-state-icon" />
          <h3 style={{ fontSize: '17px', fontWeight: '700' }}>{campaigns.length === 0 ? 'No roles yet' : 'No results'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '300px' }}>
            {campaigns.length === 0 ? 'Post your first role to start.' : 'Try adjusting filters.'}
          </p>
          {campaigns.length === 0 && <Link href="/create-jd" className="btn-primary" style={{ marginTop: '8px' }}><Plus size={15} /> Post a Role</Link>}
        </motion.div>
      ) : view === 'grid' ? (
        /* ── GRID VIEW ──────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Active Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <TrendingUp size={18} color="var(--accent-primary)" />
              <span style={{ fontWeight: '800', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Positions</span>
              <span className="badge badge-accent">{activeJobs.length}</span>
            </div>
            {activeJobs.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.01)', border: '1px dashed var(--border-color)' }}>
                No active roles. Everything is up to date.
              </div>
            ) : (
              <motion.div className="dashboard-grid" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                {activeJobs.map(c => (
                  <motion.div key={c._id} variants={cardVariants}><CampaignCard campaign={c} /></motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Closed Section */}
          {closedJobs.length > 0 && (
            <div>
              <button 
                onClick={() => setShowClosed(!showClosed)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontWeight: '800', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Closed Roles</span>
                <span className="badge badge-neutral" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', fontSize: '12px' }}>{closedJobs.length}</span>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: showClosed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              
              <AnimatePresence>
                {showClosed && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <motion.div className="dashboard-grid" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                      {closedJobs.map(c => (
                        <motion.div key={c._id} variants={cardVariants}><CampaignCard campaign={c} isClosed /></motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        /* ── KANBAN VIEW ─────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', overflowX: 'auto', minWidth: '900px' }}>
          {KANBAN_STAGES.map(stage => {
            const cols = byStage(stage);
            const sc = STAGE_COLORS[stage];
            const isHiredCol = stage === 'Hired';
            return (
              <div key={stage} style={{ opacity: isHiredCol ? 0.9 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '8px 12px', borderRadius: 'var(--radius)', background: isHiredCol ? 'rgba(16,185,129,0.05)' : sc.bg, border: `1px solid ${isHiredCol ? 'rgba(16,185,129,0.15)' : sc.border}` }}>
                  <span style={{ fontWeight: '800', fontSize: '12px', color: sc.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {isHiredCol ? '✓ ' : ''}{stage}
                  </span>
                  <span style={{ background: sc.border, color: sc.text, borderRadius: '20px', fontSize: '10px', fontWeight: '800', padding: '1px 7px' }}>{cols.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
                  {cols.map(c => (
                    <motion.div key={c._id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="card" style={{ padding: '14px', borderLeft: `3px solid ${sc.text}`, background: isHiredCol ? 'rgba(0,0,0,0.01)' : 'var(--bg-card)' }}>
                        <CampaignCard campaign={c} compact isClosed={isHiredCol} />
                      </div>
                    </motion.div>
                  ))}
                  {cols.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px', border: '1.5px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>No campaigns</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Move Stage Modal */}
      {moveModal && (
        <div className="modal-overlay" onClick={() => setMoveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Move Campaign to Stage</h3>
              <button className="btn-ghost" style={{ padding: '6px' }} onClick={() => setMoveModal(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {KANBAN_STAGES.map(s => {
                const sc = STAGE_COLORS[s];
                const isCurrent = s === moveModal.current;
                return (
                  <button
                    key={s}
                    onClick={() => moveToStage(moveModal.id, s)}
                    disabled={isCurrent || movingId === moveModal.id}
                    style={{
                      padding: '14px 18px', borderRadius: 'var(--radius)', textAlign: 'left',
                      border: `1.5px solid ${isCurrent ? sc.border : 'var(--border-color)'}`,
                      background: isCurrent ? sc.bg : 'var(--bg-card)',
                      color: isCurrent ? sc.text : 'var(--text-primary)',
                      cursor: isCurrent ? 'default' : 'pointer', fontWeight: isCurrent ? '700' : '500',
                      fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span>{s}</span>
                    {isCurrent ? <span style={{ fontSize: '10px' }}>Current</span> : <ArrowRight size={14} color="var(--text-muted)" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
