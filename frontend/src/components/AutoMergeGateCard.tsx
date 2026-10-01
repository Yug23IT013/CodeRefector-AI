import React, { useState } from 'react';
import {
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Lock,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { AutoMergeGateStatus } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface AutoMergeGateCardProps {
  prId: number;
  initialGateStatus?: AutoMergeGateStatus;
  status: string;
  mergedAt?: string | null;
  mergedBy?: string | null;
  mergeCommitSha?: string | null;
  onMergedSuccess?: () => void;
}

export const AutoMergeGateCard: React.FC<AutoMergeGateCardProps> = ({
  prId,
  initialGateStatus,
  status,
  mergedAt,
  mergedBy,
  mergeCommitSha,
  onMergedSuccess,
}) => {
  const [gate, setGate] = useState<AutoMergeGateStatus | undefined>(initialGateStatus);
  const [toggling, setToggling] = useState(false);
  const [showForceModal, setShowForceModal] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [forceMerging, setForceMerging] = useState(false);
  const [forceError, setForceError] = useState<string | null>(null);

  const isMerged = status === 'merged';
  const autoMergeEnabled = gate ? gate.auto_merge_enabled : true;

  const counts = gate?.severities || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  const isClean =
    counts.critical === 0 &&
    counts.high === 0 &&
    counts.medium === 0 &&
    counts.low === 0;

  const handleToggleAutoMerge = async () => {
    setToggling(true);
    try {
      const res = await api.toggleAutoMerge(prId);
      if (gate) {
        setGate({
          ...gate,
          auto_merge_enabled: res.auto_merge_enabled,
          is_eligible: isClean && status === 'open' && res.auto_merge_enabled,
        });
      }
    } catch (e) {
      console.error('Failed to toggle auto-merge', e);
    } finally {
      setToggling(false);
    }
  };

  const handleForceMerge = async () => {
    setForceMerging(true);
    setForceError(null);
    try {
      const res = await api.forceMergePR(prId, forceReason);
      if (res.success) {
        setShowForceModal(false);
        if (onMergedSuccess) {
          onMergedSuccess();
        }
      }
    } catch (err: any) {
      setForceError(err.message || 'Failed to force merge PR');
    } finally {
      setForceMerging(false);
    }
  };

  // State A: PR is already merged
  if (isMerged) {
    const isForceMerged = mergedBy?.toLowerCase().includes('force');
    return (
      <Card
        elevation="default"
        className={`p-6 border ${
          isForceMerged
            ? 'bg-amber-950/20 border-amber-500/30'
            : 'bg-emerald-950/20 border-emerald-500/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isForceMerged
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isForceMerged ? 'Pull Request Force-Merged' : 'Pull Request Auto-Merged'}
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isForceMerged
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isForceMerged ? 'Manual Override' : '0 Defects Verified'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Merged by <span className="font-semibold text-white">{mergedBy || 'CodeRefactor AI'}</span>
                {mergedAt && ` on ${new Date(mergedAt).toLocaleDateString()}`}
                {mergeCommitSha && (
                  <span className="font-mono text-[11px] text-slate-400 ml-2">
                    ({mergeCommitSha.slice(0, 8)})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-2 text-slate-200 border border-border-subtle flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Merged into base branch
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // State B: PR is open - Show Quality Gate Checklist & Controls
  return (
    <>
      <Card elevation="default" className="p-6 space-y-5 border-border-prominent">
        {/* Header with Title and Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Auto-Merge Quality Gate</h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-2 text-slate-300 border border-border-subtle">
                  Strict Rule: 0 Findings
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically merges when Critical, High, Medium, and Low findings all reach 0.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAutoMerge}
              disabled={toggling}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                autoMergeEnabled
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                  : 'bg-surface-2 text-slate-400 border-border-subtle hover:bg-surface-3'
              }`}
            >
              {autoMergeEnabled ? (
                <ToggleRight className="w-4 h-4 text-purple-400" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-slate-500" />
              )}
              <span>{autoMergeEnabled ? 'Auto-Merge: ON' : 'Auto-Merge: OFF'}</span>
            </button>

            {/* Force Merge Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForceModal(true)}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/60"
              icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
            >
              <span>Force Merge</span>
            </Button>
          </div>
        </div>

        {/* Quality Gate Zero-Tolerance Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Critical */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              counts.critical === 0
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Critical</span>
              {counts.critical === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{counts.critical}</span>
              <span className="text-[11px] text-slate-400">/ 0 required</span>
            </div>
          </div>

          {/* High */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              counts.high === 0
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-amber-950/30 border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">High</span>
              {counts.high === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{counts.high}</span>
              <span className="text-[11px] text-slate-400">/ 0 required</span>
            </div>
          </div>

          {/* Medium */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              counts.medium === 0
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-yellow-950/30 border-yellow-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Medium</span>
              {counts.medium === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-yellow-400" />
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{counts.medium}</span>
              <span className="text-[11px] text-slate-400">/ 0 required</span>
            </div>
          </div>

          {/* Low */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              counts.low === 0
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-sky-950/30 border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Low</span>
              {counts.low === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-sky-400" />
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{counts.low}</span>
              <span className="text-[11px] text-slate-400">/ 0 required</span>
            </div>
          </div>
        </div>

        {/* Gate Status Verdict Bar */}
        {isClean ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Quality Gate Passed:</strong> All findings resolved (0 Critical, 0 High, 0 Medium, 0 Low).
                {autoMergeEnabled
                  ? ' Automated merge will execute on the next sync event.'
                  : ' Auto-merge is currently toggled OFF.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-rose-300">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Auto-Merge Blocked:</strong> {counts.total} unresolved finding(s) remain in this PR. Push fixes to reach 0 findings, or use Force Merge if authorized.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Force Merge Confirmation Modal */}
      {showForceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface-1 border border-border-prominent rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-subtle bg-surface-2/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm Force Merge</h3>
                  <p className="text-xs text-slate-400">Manual quality gate override</p>
                </div>
              </div>
              <button
                onClick={() => setShowForceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-2 text-xs text-amber-200">
                <p className="font-semibold text-amber-300">
                  ⚠️ Warning: Bypassing Automated Quality Gate
                </p>
                <p>
                  This pull request currently has{' '}
                  <strong>{counts.total} unresolved findings</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {counts.critical > 0 && <li>{counts.critical} Critical security / bug risk(s)</li>}
                  {counts.high > 0 && <li>{counts.high} High severity issue(s)</li>}
                  {counts.medium > 0 && <li>{counts.medium} Medium maintainability issue(s)</li>}
                  {counts.low > 0 && <li>{counts.low} Low style / lint issue(s)</li>}
                </ul>
                <p className="pt-1 text-[11px] text-amber-300/80">
                  Force-merging will bypass this gate, merge into the base branch, and record your username in the audit log.
                </p>
              </div>

              {forceError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                  {forceError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Override Reason / Audit Note (Optional):
                </label>
                <input
                  type="text"
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                  placeholder="e.g. Emergency hotfix approved by lead"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-0 border border-border-subtle text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-border-subtle bg-surface-2/40 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForceModal(false)}
                disabled={forceMerging}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleForceMerge}
                disabled={forceMerging}
                className="bg-amber-600 hover:bg-amber-500 text-white border-amber-600"
                icon={<Zap className={`w-3.5 h-3.5 ${forceMerging ? 'animate-spin' : ''}`} />}
              >
                <span>{forceMerging ? 'Merging...' : 'Confirm Force Merge'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
