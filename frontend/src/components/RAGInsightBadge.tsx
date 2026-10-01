import React, { useState } from 'react';
import { BrainCircuit, BookOpen, History, X, Sparkles } from 'lucide-react';
import { ragApi } from '../services/ragApi';
import { RAGSearchDocument, RuleKnowledge } from '../types';

interface RAGInsightBadgeProps {
  ruleId: string;
  filePath: string;
}

export const RAGInsightBadge: React.FC<RAGInsightBadgeProps> = ({ ruleId, filePath }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ruleInfo, setRuleInfo] = useState<RuleKnowledge | null>(null);
  const [similarFindings, setSimilarFindings] = useState<RAGSearchDocument[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ruleData, similarData] = await Promise.all([
        ragApi.getRuleDetail(ruleId).catch(() => null),
        ragApi.getSimilarFindings(ruleId, filePath, 2).catch(() => []),
      ]);
      setRuleInfo(ruleData);
      setSimilarFindings(similarData);
    } catch (e) {
      console.error('Failed to load RAG insights', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open && !ruleInfo && similarFindings.length === 0) {
      loadData();
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all duration-200 group"
        title="View RAG Knowledge Base rules & historical precedents"
      >
        <BrainCircuit className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
        <span>RAG Insights</span>
      </button>

      {/* Modal / Drawer for RAG Precedents */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-surface-1 border border-border-prominent rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-subtle bg-surface-2/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    RAG Knowledge Base & Code Precedents
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {ruleId}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Context grounded from vector knowledge store</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400">Querying vector knowledge base...</p>
                </div>
              ) : (
                <>
                  {/* Official Rule Specification */}
                  {ruleInfo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>Rule Specification & Standard</span>
                      </div>
                      <div className="bg-surface-0 border border-border-subtle rounded-xl p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-white">{ruleInfo.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{ruleInfo.description}</p>
                        <div className="pt-2 border-t border-border-subtle">
                          <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                            Official Remediation Guideline:
                          </span>
                          <p className="text-xs text-slate-200">{ruleInfo.remediation}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historical Precedents in Codebase */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <History className="w-3.5 h-3.5 text-sky-400" />
                      <span>Historical Precedents in this Project</span>
                    </div>

                    {similarFindings.length === 0 ? (
                      <div className="p-4 rounded-xl bg-surface-0/60 border border-border-subtle text-center text-xs text-slate-400">
                        No previous violations of {ruleId} recorded in historical memory yet. This review will be indexed as precedent.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {similarFindings.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-surface-0 border border-border-subtle hover:border-purple-500/30 rounded-xl p-4 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-brand-300 font-semibold truncate max-w-sm">
                                {item.metadata?.file_path || 'Historical File'}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {Math.round(item.similarity * 100)}% match
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 font-mono bg-surface-2/40 p-2.5 rounded-lg border border-border-subtle whitespace-pre-wrap">
                              {item.document}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border-subtle bg-surface-2/40 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Grounded via ChromaDB & MiniLM Vector Embeddings
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-200 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
