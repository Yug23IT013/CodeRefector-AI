import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Search,
  BookOpen,
  History,
  RefreshCw,
  Sparkles,
  Check,
  Copy,
} from 'lucide-react';
import { ragApi } from '../services/ragApi';
import { RAGStatus, RuleKnowledge, RAGSearchDocument } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const RAGQueryPage: React.FC = () => {
  const [status, setStatus] = useState<RAGStatus | null>(null);
  const [rules, setRules] = useState<RuleKnowledge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionType, setCollectionType] = useState<'all' | 'rules' | 'history'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    rules: RAGSearchDocument[];
    history: RAGSearchDocument[];
  } | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'rules'>('search');

  const presetQueries = [
    'SQL injection parameterized query fixes',
    'Hardcoded API keys and secrets remediation',
    'Dynamic eval / exec risks',
    'Bare except clauses anti-pattern',
    'High cyclomatic complexity refactoring',
    'Unsafe innerHTML DOM XSS',
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [statusRes, rulesRes] = await Promise.all([
        ragApi.getStatus().catch(() => null),
        ragApi.getRules().catch(() => []),
      ]);
      if (statusRes?.data) setStatus(statusRes.data);
      if (rulesRes) setRules(rulesRes);
    } catch (e) {
      console.error('Error loading RAG initial data', e);
    }
  };

  const handleSearch = async (queryText?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    setActiveTab('search');
    try {
      const res = await ragApi.query(q, collectionType, 6);
      setSearchResults({
        rules: res.results.rules || [],
        history: res.results.historical_findings || [],
      });
    } catch (e) {
      console.error('RAG search error', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await ragApi.reindex();
      if (res.stats) setStatus(res.stats);
      alert(`Knowledge base updated! ${res.rules_indexed} rules and ${res.findings_indexed} historical findings indexed.`);
    } catch (e) {
      alert('Failed to reindex: ' + e);
    } finally {
      setReindexing(false);
    }
  };

  const copyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/25 p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold">
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              <span>Vector Memory & Knowledge Base</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Retrieval-Augmented Generation (RAG)
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Grounds automated PR reviews using persistent vector embeddings of authoritative AST rule specifications, security standards, and historical code fixes from this repository.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={reindexing}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />}
            >
              <span>{reindexing ? 'Re-indexing...' : 'Sync Vector Store'}</span>
            </Button>
          </div>
        </div>

        {/* Vector Store Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-purple-500/20">
          <div className="bg-surface-0/60 rounded-xl p-3 border border-border-subtle">
            <span className="text-[11px] text-slate-400 font-medium block">Vector Engine</span>
            <span className="text-sm font-bold text-purple-300 capitalize">{status?.backend || 'ChromaDB'}</span>
          </div>
          <div className="bg-surface-0/60 rounded-xl p-3 border border-border-subtle">
            <span className="text-[11px] text-slate-400 font-medium block">Rule Specs Indexed</span>
            <span className="text-sm font-bold text-white">{status?.rule_knowledge_count ?? rules.length}</span>
          </div>
          <div className="bg-surface-0/60 rounded-xl p-3 border border-border-subtle">
            <span className="text-[11px] text-slate-400 font-medium block">Historical Findings</span>
            <span className="text-sm font-bold text-sky-400">{status?.historical_findings_count ?? 0}</span>
          </div>
          <div className="bg-surface-0/60 rounded-xl p-3 border border-border-subtle">
            <span className="text-[11px] text-slate-400 font-medium block">RAG Status</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'search'
              ? 'bg-purple-600 text-white shadow-glow-sky'
              : 'bg-surface-1 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Semantic Search & Ask</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'rules'
              ? 'bg-purple-600 text-white shadow-glow-sky'
              : 'bg-surface-1 text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Rule Knowledge Catalog ({rules.length})</span>
        </button>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Search Box */}
          <Card elevation="default" className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ask a question or search code patterns (e.g. 'How to fix SQL injection in queries?')..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-0 border border-border-subtle text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value as any)}
                  className="px-3 py-2.5 rounded-xl bg-surface-0 border border-border-subtle text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Vector Stores</option>
                  <option value="rules">Rule Knowledge</option>
                  <option value="history">Historical Precedents</option>
                </select>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                  icon={<Sparkles className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />}
                >
                  <span>{isSearching ? 'Searching...' : 'Search RAG'}</span>
                </Button>
              </div>
            </div>

            {/* Preset Query Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-xs text-slate-400 font-medium">Try asking:</span>
              {presetQueries.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(preset);
                    handleSearch(preset);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </Card>

          {/* Search Results Display */}
          {searchResults && (
            <div className="space-y-6">
              {/* Rules Matches */}
              {searchResults.rules.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Matched Rule Specifications ({searchResults.rules.length})</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.rules.map((item, idx) => (
                      <Card key={idx} elevation="default" className="p-5 border-purple-500/20 hover:border-purple-500/40 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {item.metadata?.rule_id || item.id}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {Math.round(item.similarity * 100)}% match
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-2">{item.metadata?.title}</h4>
                        <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-surface-0 p-3 rounded-lg border border-border-subtle leading-relaxed max-h-56 overflow-y-auto">
                          {item.document}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Historical Findings Matches */}
              {searchResults.history.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                    <History className="w-3.5 h-3.5" />
                    <span>Matched Historical PR Precedents ({searchResults.history.length})</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.history.map((item, idx) => (
                      <Card key={idx} elevation="default" className="p-5 border-sky-500/20 hover:border-sky-500/40 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-brand-300">
                            {item.metadata?.file_path || 'PR Code File'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {Math.round(item.similarity * 100)}% match
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-surface-0 p-3 rounded-lg border border-border-subtle leading-relaxed max-h-48 overflow-y-auto">
                          {item.document}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.rules.length === 0 && searchResults.history.length === 0 && (
                <Card elevation="default" className="p-12 text-center border-dashed">
                  <BrainCircuit className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-white">No matches found</h4>
                  <p className="text-xs text-slate-400 mt-1">Try broadening your search query or choosing "All Vector Stores".</p>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Rule Catalog View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {rules.map((rule) => (
              <Card key={rule.rule_id} elevation="default" className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-surface-2 text-purple-300 border border-purple-500/30">
                      {rule.rule_id}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white">{rule.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                          {rule.category}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] font-semibold text-rose-400 uppercase">
                          {rule.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-sans">{rule.description}</p>

                <div className="rounded-xl bg-surface-0 border border-border-subtle p-3 text-xs text-slate-300">
                  <span className="font-semibold text-emerald-400 block mb-1">Authoritative Recommendation:</span>
                  {rule.remediation}
                </div>

                {/* Bad vs Good Code Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2">
                  {rule.example_bad && (
                    <div className="rounded-xl bg-surface-0 border border-rose-500/25 p-3.5 relative">
                      <div className="text-[11px] font-bold text-rose-400 flex items-center justify-between mb-2">
                        <span>❌ Anti-Pattern / Risky Code:</span>
                        <button
                          onClick={() => copyCode(`bad_${rule.rule_id}`, rule.example_bad!)}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedId === `bad_${rule.rule_id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <pre className="text-xs text-rose-300 font-mono whitespace-pre-wrap overflow-x-auto">
                        {rule.example_bad}
                      </pre>
                    </div>
                  )}

                  {rule.example_good && (
                    <div className="rounded-xl bg-surface-0 border border-emerald-500/25 p-3.5 relative">
                      <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between mb-2">
                        <span>✅ Recommended Secure Fix:</span>
                        <button
                          onClick={() => copyCode(`good_${rule.rule_id}`, rule.example_good!)}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedId === `good_${rule.rule_id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap overflow-x-auto">
                        {rule.example_good}
                      </pre>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
