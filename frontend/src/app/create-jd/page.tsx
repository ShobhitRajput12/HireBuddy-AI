'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle,
  Briefcase, Cpu, BarChart2, Users,
} from 'lucide-react';
import { jobApi } from '@/lib/api';

const steps = [
  { icon: Briefcase, label: 'JD Created',      desc: 'Write a role description in plain English.' },
  { icon: Cpu,       label: 'AI Drafts JD',    desc: 'Agent 1 generates a professional job description.' },
  { icon: BarChart2, label: 'Skills Extracted', desc: 'Agent 2 weights your requirements for scoring.' },
  { icon: Users,     label: 'Ready to Source', desc: 'Upload CVs and run the full evaluation pipeline.' },
];

const CreateJD = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', department: '', prompt: '' });
  const [charCount, setCharCount] = useState(0);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'prompt') setCharCount(value.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await jobApi.create(formData);
      if (res.data.success) {
        router.push('/');
      } else {
        setError(res.data.error || 'Failed to create Job Description');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="white" />
          </div>
          <div className="badge badge-accent">AI-Powered</div>
        </div>
        <h1 className="page-title">Post a New Role</h1>
        <p className="page-subtitle">Describe the position in your own words. Hirebuddy AI will generate a complete, structured job description ready for publishing.</p>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '36px' }}
      >
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="card" style={{ padding: '18px', position: 'relative' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '9px',
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '12px',
              }}>
                <Icon size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>{step.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{step.desc}</div>
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', right: '-7px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
                  <ArrowRight size={13} color="var(--text-muted)" />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="card"
        style={{ padding: '40px' }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div>
              <label className="input-label">Campaign Title *</label>
              <input
                className="input"
                type="text"
                required
                placeholder="e.g. Senior Frontend Engineer – Q3"
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Department</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Engineering, Sales, Design"
                value={formData.department}
                onChange={e => handleChange('department', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <label className="input-label" style={{ marginBottom: 0 }}>What are you looking for? *</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{charCount} chars</span>
            </div>
            <textarea
              className="input"
              required
              rows={6}
              placeholder="Describe the role, key responsibilities, must-have skills, and any company context. Be as brief or detailed as you like — the AI will do the heavy lifting."
              value={formData.prompt}
              onChange={e => handleChange('prompt', e.target.value)}
              style={{ resize: 'vertical', lineHeight: '1.6' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              💡 Tip: Mention years of experience, tech stack, team size, or leadership expectations for best results.
            </p>
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '24px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: '16px' }}
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={20} /><span>Generating job description with AI…</span></>
            ) : (
              <><Sparkles size={20} /><span>Generate Job Description</span><ArrowRight size={18} /></>
            )}
          </button>

          {loading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px' }}
            >
              This usually takes 10–20 seconds. Agents 1 & 2 are working…
            </motion.p>
          )}
        </form>
      </motion.div>

      {/* Badges */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '28px', flexWrap: 'wrap' }}>
        {['Agent 1: JD Writer', 'Agent 2: Requirements Analyzer', 'Auto-saved to Dashboard'].map(t => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <CheckCircle2 size={13} color="var(--success)" /> {t}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreateJD;
