import React, { useState } from 'react';
import { Copy, Check, Sparkles, Terminal } from 'lucide-react';
import { Button } from './Button';

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  highlightRuleId?: string;
  highlightSeverity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface CodeDiffViewProps {
  filename: string;
  lines: DiffLine[];
  aiSuggestion?: string;
  aiExplanation?: string;
  ruleId?: string;
}

export const CodeDiffView: React.FC<CodeDiffViewProps> = ({
  filename,
  lines,
  aiSuggestion,
  aiExplanation,
  ruleId,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (aiSuggestion) {
      navigator.clipboard.writeText(aiSuggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1/90 overflow-hidden shadow-card font-mono text-xs">
      {/* File Header */}
      <div className="px-4 py-2.5 bg-surface-0/90 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-slate-300 font-medium">{filename}</span>
        </div>
        {ruleId && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-surface-2 text-brand-300 border border-border-subtle font-semibold">
            {ruleId}
          </span>
        )}
      </div>

      {/* Code Lines */}
      <div className="py-2 overflow-x-auto select-text leading-relaxed">
        {lines.map((line, idx) => {
          if (line.type === 'header') {
            return (
              <div
                key={idx}
                className="px-4 py-1 text-slate-500 bg-surface-0/50 select-none text-[11px]"
              >
                {line.content}
              </div>
            );
          }

          const isRemoved = line.type === 'removed';
          const isAdded = line.type === 'added';

          const rowBg = isRemoved
            ? 'bg-rose-500/10 text-rose-200 border-l-2 border-rose-500'
            : isAdded
            ? 'bg-emerald-500/10 text-emerald-200 border-l-2 border-emerald-500'
            : 'text-slate-300 hover:bg-surface-2/40 border-l-2 border-transparent';

          return (
            <div
              key={idx}
              className={`flex items-center px-4 py-0.5 transition-colors font-mono ${rowBg}`}
            >
              <div className="w-8 text-right text-slate-500 select-none pr-3 text-[11px]">
                {line.oldLineNumber || ''}
              </div>
              <div className="w-8 text-right text-slate-500 select-none pr-4 text-[11px]">
                {line.newLineNumber || ''}
              </div>
              <div className="flex-1 whitespace-pre">
                <span>{line.content}</span>
              </div>
              {line.highlightRuleId && (
                <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {line.highlightRuleId}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Inline Review Section */}
      {aiSuggestion && (
        <div className="border-t border-indigo-500/20 bg-gradient-to-r from-surface-1 via-indigo-950/20 to-surface-1 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-3 h-3" />
              </div>
              <span className="font-sans font-semibold text-xs text-white">
                AI Suggested Fix
              </span>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopy}
              icon={copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            >
              {copied ? 'Copied' : 'Copy Fix'}
            </Button>
          </div>

          {aiExplanation && (
            <p className="font-sans text-xs text-slate-300 leading-relaxed mb-3">
              {aiExplanation}
            </p>
          )}

          <div className="p-3 rounded-xl bg-surface-0/90 border border-border-subtle font-mono text-[11px] text-emerald-400 whitespace-pre overflow-x-auto">
            {aiSuggestion}
          </div>
        </div>
      )}
    </div>
  );
};
