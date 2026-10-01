import React, { useState } from 'react';
import { Finding } from '../types';
import { SeverityBadge } from './SeverityBadge';
import { ChevronDown, ChevronUp, Sparkles, FileCode, Check, Copy } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { RAGInsightBadge } from './RAGInsightBadge';

export interface FindingCardProps {
  finding: Finding;
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const copySuggestion = () => {
    if (finding.ai_suggestion) {
      navigator.clipboard.writeText(finding.ai_suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card elevation="default" className="border-border-subtle transition-all duration-200">
      {/* Finding Header */}
      <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle bg-surface-0/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          <SeverityBadge severity={finding.severity} size="sm" />

          <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-2 text-slate-200 font-semibold border border-border-subtle">
            {finding.rule_id}
          </span>

          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 bg-surface-2/60 px-2 py-0.5 rounded-md">
            {finding.category}
          </span>

          <div className="flex items-center gap-1.5 text-xs font-mono text-brand-300">
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-medium">{finding.file_path}</span>
            <span className="text-brand-400 font-bold">:L{finding.line_number}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RAGInsightBadge ruleId={finding.rule_id} filePath={finding.file_path} />

          {finding.ai_suggestion && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded(!expanded)}
              icon={<Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            >
              <span>{expanded ? 'Hide Fix' : 'Show AI Fix'}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Finding Description */}
      <div className="p-4 sm:px-6 text-sm text-slate-200 leading-relaxed font-sans">
        {finding.message}
      </div>

      {/* AI Suggested Fix Box */}
      {finding.ai_suggestion && expanded && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="rounded-xl bg-surface-0 border border-indigo-500/25 p-4 shadow-sm relative">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border-subtle">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Recommended Patch</span>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={copySuggestion}
                icon={copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <div className="text-xs text-emerald-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed bg-surface-2/40 p-3 rounded-lg border border-border-subtle">
              {finding.ai_suggestion}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
