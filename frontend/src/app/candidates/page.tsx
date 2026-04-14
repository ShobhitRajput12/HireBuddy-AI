'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Trophy, Meh, ThumbsDown, ChevronRight, Loader2,
  BarChart2, Filter, SlidersHorizontal, X, Download, UserCheck,
  ChevronDown, CheckSquare2, Square
} from 'lucide-react';
import { jobApi } from '@/lib/api';

const DECISION_COLORS: Record<string, string> = {
  STRONG_YES: '#059669', YES: '#0D9488', MAYBE: '#D97706', NO: '#DC2626',
};
const DECISIONS = ['All', 'STRONG_YES', 'YES', 'MAYBE', 'NO', 'PENDING'];
const STAGES = ['All', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

export default function CandidatesPage() {
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [decFilter, setDecFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'rank'>('score');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const campRes = await jobApi.getAll();
      const campMap: Record<string, string> = {};
      const candidateList: any[] = [];
      if (campRes.data.success) {
        for (const c of campRes.data.campaigns) {
          campMap[c._id] = c.title;
          try {
            const res = await jobApi.getResults(c._id);
            if (res.data.success) {
              candidateList.push(...res.data.candidates.map((cand: any) => ({
                ...cand, campaignTitle: c.title, campaignId: c._id,
              })));
            }
          } catch { }
        }
      }
      setCampaigns(campMap);
      setAllCandidates(candidateList);
    } catch { } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let list = allCandidates.filter(c => {
      const name = c.parsed_data?.full_name || c.fileName || '';
      const skills = (c.validated_skills?.top_skills || []).map((s: any) => typeof s === 'string' ? s : s.name).join(' ');
      const matchQ = name.toLowerCase().includes(query.toLowerCase()) || c.campaignTitle?.toLowerCase().includes(query.toLowerCase()) || skills.toLowerCase().includes(query.toLowerCase());
      const matchD = decFilter === 'All' || (decFilter === 'PENDING' ? !c.final_decision : c.final_decision === decFilter);
      const matchS = stageFilter === 'All' || (c.interview_stage || 'Applied') === stageFilter;
      const matchC = campaignFilter === 'All' || c.campaignId === campaignFilter;
      const score = c.final_score ?? c.match_score;
      const matchScore = score == null || (score >= scoreMin && score <= scoreMax);
      return matchQ && matchD && matchS && matchC && matchScore;
    });

    if (sortBy === 'score') list = list.sort((a, b) => (b.final_score ?? b.match_score ?? -1) - (a.final_score ?? a.match_score ?? -1));
    if (sortBy === 'rank')  list = list.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    if (sortBy === 'date')  list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [allCandidates, query, decFilter, stageFilter, campaignFilter, scoreMin, scoreMax, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map(c => c._id)));
  const clearSelect = () => setSelectedIds(new Set());
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c._id));

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      if (bulkAction === 'reject') {
        await jobApi.bulkAction(ids, 'reject');
        setAllCandidates(prev => prev.map(c => ids.includes(c._id) ? { ...c, final_decision: 'NO', interview_stage: 'Rejected' } : c));
      } else {
        await jobApi.bulkAction(ids, 'stage', bulkAction);
        setAllCandidates(prev => prev.map(c => ids.includes(c._id) ? { ...c, interview_stage: bulkAction } : c));
      }
      clearSelect();
    } catch { alert('Bulk action failed.'); } finally { setBulkLoading(false); setBulkAction(''); }
  };

  const exportCSV = () => {
    const rows = filtered.filter(c => selectedIds.size === 0 || selectedIds.has(c._id));
    const headers = ['Name', 'Campaign', 'Score', 'Decision', 'Stage', 'Skills', 'Rank'];
    const csvContent = [
      headers.join(','),
      ...rows.map(c => [
        `"${c.parsed_data?.full_name || c.fileName}"`,
        `"${c.campaignTitle}"`,
        c.final_score ?? c.match_score ?? '',
        c.final_decision || '',
        c.interview_stage || 'Applied',
        `"${(c.validated_skills?.top_skills || []).slice(0, 5).map((s: any) => typeof s === 'string' ? s : s.name).join('; ')}"`,
        c.rank || '',
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'candidates.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const evalCount = allCandidates.filter(c => c.status === 'COMPLETED').length;
  const strongYes = allCandidates.filter(c => c.final_decision === 'STRONG_YES').length;
  const maybes = allCandidates.filter(c => c.final_decision === 'MAYBE').length;
  const noCount = allCandidates.filter(c => c.final_decision === 'NO').length;
  const scoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 60 ? '#D97706' : 'var(--error)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">All Candidates</h1>
          <p className="page-subtitle">Browse, filter and act on candidates across every campaign.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={exportCSV} style={{ fontSize: '13px' }}>
            <Download size={14} /> Export CSV
          </button>
          <div className="badge badge-accent" style={{ fontSize: '14px', padding: '6px 14px', alignSelf: 'center' }}>
            <Users size={14} />{allCandidates.length} total
          </div>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total', value: allCandidates.length, icon: Users, color: 'var(--text-primary)' },
            { label: 'Evaluated', value: evalCount, icon: BarChart2, color: 'var(--info)' },
            { label: 'Strong Yes', value: strongYes, icon: Trophy, color: 'var(--success)' },
            { label: 'Borderline', value: maybes, icon: Meh, color: '#D97706' },
            { label: 'Declined', value: noCount, icon: ThumbsDown, color: 'var(--error)' },
          ].map(s => { const Icon = s.icon; return (
            <div key={s.label} className="stat-card" style={{ padding: '16px 18px' }}>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value" style={{ color: s.color, fontSize: '22px' }}>{s.value}</div>
            </div>
          ); })}
        </motion.div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search name, skill, campaign…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {DECISIONS.map(d => (
            <button key={d} onClick={() => setDecFilter(d)}
              style={{ padding: '0 11px', height: '46px', borderRadius: 'var(--radius)', border: `1.5px solid ${decFilter === d ? (DECISION_COLORS[d] || 'var(--accent-primary)') : 'var(--border-color)'}`, background: decFilter === d ? `${DECISION_COLORS[d] || 'var(--accent-primary)'}12` : 'var(--bg-card)', color: decFilter === d ? (DECISION_COLORS[d] || 'var(--accent-primary)') : 'var(--text-secondary)', fontWeight: decFilter === d ? '700' : '500', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s' }}>
              {d === 'All' ? d : d.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => setShowFilters(f => !f)} style={{ fontSize: '13px' }}>
          <SlidersHorizontal size={14} /> Filters {showFilters ? <X size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div className="card" style={{ padding: '20px', marginBottom: '16px' }}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div>
                <label className="input-label">Interview Stage</label>
                <select className="input" value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ cursor: 'pointer' }}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Campaign</label>
                <select className="input" value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="All">All Campaigns</option>
                  {Object.entries(campaigns).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Sort By</label>
                <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ cursor: 'pointer' }}>
                  <option value="score">AI Score (High → Low)</option>
                  <option value="rank">Rank (1 → N)</option>
                  <option value="date">Date (Newest)</option>
                </select>
              </div>
              <div>
                <label className="input-label">Min Score: {scoreMin}</label>
                <input type="range" min={0} max={100} value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
              </div>
              <div>
                <label className="input-label">Max Score: {scoreMax}</label>
                <input type="range" min={0} max={100} value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => { setDecFilter('All'); setStageFilter('All'); setCampaignFilter('All'); setScoreMin(0); setScoreMax(100); setSortBy('score'); }}>
                  <X size={13} /> Reset Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--accent-gradient)', color: 'white', marginBottom: '14px', boxShadow: 'var(--shadow-accent)', flexWrap: 'wrap' }}>
            <UserCheck size={16} />
            <span style={{ fontWeight: '700', fontSize: '14px' }}>{selectedIds.size} selected</span>
            <div style={{ flex: 1 }} />
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: 'rgba(255,255,255,.25)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">Select action…</option>
              <option value="Screening">→ Move to Screening</option>
              <option value="Interview">→ Move to Interview</option>
              <option value="Offer">→ Move to Offer</option>
              <option value="Hired">→ Mark as Hired</option>
              <option value="reject">✗ Bulk Reject</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction || bulkLoading}
              style={{ padding: '7px 18px', borderRadius: '8px', background: 'rgba(255,255,255,.2)', border: '1.5px solid rgba(255,255,255,.35)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              {bulkLoading ? 'Applying…' : 'Apply'}
            </button>
            <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.25)', color: 'white', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={13} /> Export Selected
            </button>
            <button onClick={clearSelect} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '6px', padding: '6px' }}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" style={{ marginBottom: '12px' }} />
          <p>Aggregating candidates across all campaigns…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Users size={40} className="empty-state-icon" />
          <h3 style={{ fontWeight: '700', fontSize: '16px' }}>No candidates found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Upload CVs to a campaign or adjust your filters.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <button onClick={allSelected ? clearSelect : selectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    {allSelected ? <CheckSquare2 size={15} color="var(--accent-primary)" /> : <Square size={15} />}
                  </button>
                </th>
                <th style={{ width: '48px' }}>Rank</th>
                <th>Candidate</th>
                <th>Campaign</th>
                <th>Stage</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Decision</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const name = c.parsed_data?.full_name || c.fileName;
                const score = c.final_score ?? c.match_score;
                const decColor = DECISION_COLORS[c.final_decision] || 'var(--text-muted)';
                const isSel = selectedIds.has(c._id);
                const stageStr = c.interview_stage || 'Applied';
                return (
                  <motion.tr
                    key={c._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    style={{ background: isSel ? 'rgba(232,98,42,.04)' : undefined }}
                  >
                    <td>
                      <button onClick={() => toggleSelect(c._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {isSel ? <CheckSquare2 size={15} color="var(--accent-primary)" /> : <Square size={15} color="var(--text-muted)" />}
                      </button>
                    </td>
                    <td>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: c.rank && c.rank <= 3 ? 'var(--accent-gradient)' : 'rgba(0,0,0,0.05)', color: c.rank && c.rank <= 3 ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px' }}>
                        {c.rank || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '3px' }}>{name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {(c.validated_skills?.top_skills || []).slice(0, 2).map((s: any) => typeof s === 'string' ? s : s.name).join(' · ')}
                      </div>
                    </td>
                    <td>
                      <Link href={`/jd/${c.campaignId}`} style={{ textDecoration: 'none' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '11px', cursor: 'pointer' }}>{c.campaignTitle}</span>
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: stageStr === 'Hired' ? 'rgba(5,150,105,.1)' : stageStr === 'Rejected' ? 'var(--error-bg)' : 'rgba(37,99,235,.08)', color: stageStr === 'Hired' ? 'var(--success)' : stageStr === 'Rejected' ? 'var(--error)' : '#2563EB', border: `1px solid ${stageStr === 'Hired' ? 'rgba(5,150,105,.2)' : stageStr === 'Rejected' ? 'rgba(220,38,38,.2)' : 'rgba(37,99,235,.2)'}` }}>
                        {stageStr}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {score != null ? (
                        <span style={{ fontWeight: '800', fontSize: '17px', color: scoreColor(score), fontFamily: 'var(--font-display)' }}>{score}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.final_decision ? (
                        <span style={{ background: `${decColor}12`, color: decColor, border: `1px solid ${decColor}28`, fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>
                          {c.final_decision.replace('_', ' ')}
                        </span>
                      ) : <span className="badge badge-neutral" style={{ fontSize: '10px' }}>PENDING</span>}
                    </td>
                    <td>
                      <Link href={`/candidate/${c._id}`} className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px' }}>
                        Profile <ChevronRight size={12} />
                      </Link>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
