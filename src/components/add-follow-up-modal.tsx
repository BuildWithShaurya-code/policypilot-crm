'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { FollowUpService } from '@/lib/services/follow-up-service';
import { getCustomers, type CustomerWithMetrics } from '@/lib/services/customer-service';
import { getPoliciesByCustomerId } from '@/lib/services/policy-service';
import type { FollowUpReason, Policy } from '@/types/database.types';

interface AddFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: string;
  preselectedPolicyId?: string;
}

const REASONS: { value: FollowUpReason; label: string }[] = [
  { value: 'renewal', label: 'Renewal' },
  { value: 'quote', label: 'Quote' },
  { value: 'payment', label: 'Payment' },
  { value: 'document', label: 'Document' },
  { value: 'callback', label: 'Callback' },
  { value: 'other', label: 'Other' },
];

export function AddFollowUpModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
  preselectedPolicyId,
}: AddFollowUpModalProps) {
  const [customers, setCustomers] = useState<CustomerWithMetrics[]>([]);
  const [customerPolicies, setCustomerPolicies] = useState<Policy[]>([]);

  // Form states
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [policyId, setPolicyId] = useState(preselectedPolicyId || '');
  const [reason, setReason] = useState<FollowUpReason>('renewal');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const da = String(today.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  });
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');
      const da = String(today.getDate()).padStart(2, '0');
      setScheduledDate(`${yr}-${mo}-${da}`);
      setScheduledTime('11:00');
      setCustomerId(preselectedCustomerId || '');
      setPolicyId(preselectedPolicyId || '');
      setError(null);
    }
  }

  // Load customers when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getCustomers().then((res) => {
      if (active) {
        setCustomers(res.data || []);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Load policies when customer changes
  useEffect(() => {
    if (!customerId) return;
    let active = true;
    getPoliciesByCustomerId(customerId).then((res) => {
      if (active) {
        setCustomerPolicies(res.data || []);
      }
    });
    return () => {
      active = false;
    };
  }, [customerId]);

  const visiblePolicies = customerId ? customerPolicies : [];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer.');
      return;
    }

    if (!scheduledDate) {
      setError('Please select a scheduled date.');
      return;
    }

    setSubmitting(true);
    const res = await FollowUpService.createFollowUp({
      customer_id: customerId,
      policy_id: policyId || null,
      reason,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Schedule Follow-up</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Set a reminder task for client renewal, quote, or callback
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Customer Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setPolicyId('');
              }}
              disabled={!!preselectedCustomerId}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            >
              <option value="" style={{ background: '#0a0f1d' }}>
                -- Select Customer --
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} style={{ background: '#0a0f1d' }}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Policy Selection (Optional) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Associated Policy (Optional)
            </label>
            <select
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              disabled={!!preselectedPolicyId || !customerId}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            >
              <option value="" style={{ background: '#0a0f1d' }}>
                -- None / General Follow-up --
              </option>
              {visiblePolicies.map((p) => (
                <option key={p.id} value={p.id} style={{ background: '#0a0f1d' }}>
                  {p.policy_number} - {p.insurer} ({p.policy_type})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Reason *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {REASONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    background: reason === r.value ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    color: reason === r.value ? '#60a5fa' : 'var(--text-secondary)',
                    border: reason === r.value ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Date *
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Notes / Context
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client requested renewal quotation with NCB certificate..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" /> Scheduling...
                </>
              ) : (
                'Schedule Follow-up'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
