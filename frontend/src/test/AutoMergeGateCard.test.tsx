import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AutoMergeGateCard } from '../components/AutoMergeGateCard';
import { AutoMergeGateStatus } from '../types';

describe('AutoMergeGateCard component', () => {
  it('renders merged state with 0 Defects Verified badge', () => {
    render(
      <AutoMergeGateCard
        prId={10}
        status="merged"
        mergedAt="2026-10-23T10:00:00Z"
        mergedBy="CodeRefactor AI Bot"
        mergeCommitSha="c8b9d0e1f2"
      />
    );

    expect(screen.getByText('Pull Request Auto-Merged')).toBeInTheDocument();
    expect(screen.getByText('0 Defects Verified')).toBeInTheDocument();
    expect(screen.getByText(/Merged into base branch/i)).toBeInTheDocument();
  });

  it('renders open state with quality gate counts and auto-merge enabled badge', () => {
    const gateStatus: AutoMergeGateStatus = {
      pr_id: 12,
      pr_number: 44,
      title: 'Fix auth security bypass',
      status: 'open',
      auto_merge_enabled: true,
      is_eligible: false,
      is_clean: false,
      severities: {
        critical: 1,
        high: 2,
        medium: 0,
        low: 0,
        total: 3,
      },
      blocking_reasons: ['1 critical finding pending', '2 high findings pending'],
      merged_at: null,
      merged_by: null,
      merge_commit_sha: null,
    };

    render(
      <AutoMergeGateCard
        prId={12}
        status="open"
        initialGateStatus={gateStatus}
      />
    );

    expect(screen.getByText('Auto-Merge Quality Gate')).toBeInTheDocument();
    expect(screen.getByText('Auto-Merge: ON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Force Merge/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
