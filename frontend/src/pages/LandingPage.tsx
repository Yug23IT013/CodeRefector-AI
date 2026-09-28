import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Zap,
  Github,
  GitPullRequest,
  CheckCircle2,
  Code2,
  Sparkles,
  Lock,
  Copy,
  Check,
  Cpu,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SeverityBadge } from '../components/SeverityBadge';

export const LandingPage: React.FC = () => {
  const { loginWithGitHub } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);

  const copyPatchCode = () => {
    navigator.clipboard.writeText(`event_data = json.loads(raw_payload)`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-surface-0 text-slate-100 overflow-hidden bg-grid-pattern">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-radial-gradient pointer-events-none -z-10" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        {/* Release / Model Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-1/90 border border-border-subtle text-xs font-medium text-slate-300 shadow-card mb-8 animate-fade-in hover:border-border-prominent transition-all">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400"></span>
          </span>
          <span className="font-semibold text-brand-300">CodeRefactor AI v1.0</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Deterministic AST Rules + Groq Cloud LLMs</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
          Automated Code Reviews with{' '}
          <span className="text-gradient">
            Static AST & Instant AI
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-normal">
          Intercept GitHub Pull Requests, detect critical vulnerabilities and anti-patterns with deterministic AST inspection, and receive verified inline code patches in under 3 seconds.
        </p>

        {/* Hero CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="glow"
            size="lg"
            onClick={loginWithGitHub}
            icon={<Github className="w-4 h-4" />}
          >
            Start with GitHub Free
          </Button>
        </div>


        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t border-border-subtle flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero-Config SQLite & Postgres</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-400" />
            <span>High-Speed Llama 3.3 70B & 8B</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>Constant-Time HMAC Security</span>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE DEMO PREVIEW CARD */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card
          elevation="glass"
          className="border-border-prominent shadow-glow-indigo overflow-hidden p-0"
        >
          {/* Mock Window Top Bar */}
          <div className="px-5 py-3.5 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-slate-400 pl-2">
                pull-requests #42 — app/auth.py
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                1 Security Finding Flagged
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* PR Header Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-brand-400">#42</span>
                  <h3 className="text-base font-bold text-white">
                    Refactor webhook signature and payload loader
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Opened by <span className="text-slate-200 font-medium">@octodev</span> • AST analyzed in 14ms
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity="critical" />
                <span className="text-xs font-mono text-slate-400 bg-surface-2 px-2.5 py-1 rounded-md border border-border-subtle">
                  Rule: SEC001
                </span>
              </div>
            </div>

            {/* AI Review Summary Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-surface-2 to-indigo-950/30 border border-indigo-500/25 text-xs text-slate-300 space-y-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>AI Automated Summary & Risk Assessment</span>
              </div>
              <p className="leading-relaxed">
                <strong className="text-white">Security Vulnerability Detected:</strong> Line 24 utilizes <code className="text-rose-300 bg-rose-500/10 px-1 py-0.5 rounded font-mono">eval()</code> on unauthenticated JSON webhook payloads, presenting a Critical Remote Code Execution (RCE) vector.
              </p>
            </div>

            {/* Inline Code Diff Preview */}
            <div className="rounded-xl border border-border-subtle bg-surface-0 font-mono text-xs overflow-x-auto">
              <div className="px-4 py-2 bg-surface-2/60 border-b border-border-subtle text-[11px] text-slate-400 flex items-center justify-between">
                <span>app/auth.py (Lines 22-26)</span>
                <span className="text-slate-500">Python 3.11</span>
              </div>
              <div className="p-4 space-y-1">
                <div className="text-slate-500">22   def process_github_event(raw_payload: bytes):</div>
                <div className="text-slate-500">23       # Decode JSON payload</div>
                <div className="bg-rose-500/15 text-rose-300 -mx-4 px-4 py-1 flex items-center justify-between border-l-2 border-rose-500">
                  <span>24 -     event_data = eval(raw_payload)</span>
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Dynamic Execution Risk</span>
                </div>
                <div className="bg-emerald-500/15 text-emerald-300 -mx-4 px-4 py-1 flex items-center justify-between border-l-2 border-emerald-500">
                  <span>25 +     event_data = json.loads(raw_payload)</span>
                  <button
                    onClick={copyPatchCode}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded transition-colors"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Fix'}</span>
                  </button>
                </div>
                <div className="text-slate-500">26       return event_data</div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 3. METRICS / DATA PERFORMANCE RIBBON */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card elevation="default" className="p-5 text-center">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400 mx-auto mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              &lt; 2.8s
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Average AI Review Latency
            </div>
          </Card>

          <Card elevation="default" className="p-5 text-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mx-auto mb-2">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              10+
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Deterministic AST Rule Checkers
            </div>
          </Card>

          <Card elevation="default" className="p-5 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mx-auto mb-2">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
              0
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Duplicate Comments (SHA-256 Hashing)
            </div>
          </Card>

          <Card elevation="default" className="p-5 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mx-auto mb-2">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
              100%
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              HMAC-SHA256 Webhook Verification
            </div>
          </Card>
        </div>
      </section>

      {/* 4. FEATURE HIGHLIGHTS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border-subtle">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Engineered for Developer Velocity & High Signal
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Every component is purpose-built to deliver pinpoint code intelligence without creating noisy PR comment spam.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card elevation="default" interactive glow="sky" className="p-6">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400 mb-4">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">AST Static Rules</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Detects SQL injections, hardcoded secrets, unsafe deserialization, and mutable default arguments before code merges.
            </p>
          </Card>

          <Card elevation="default" interactive glow="indigo" className="p-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Groq Cloud AI</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Powered by Groq's high-speed inference. Produces concrete line replacements and risk summaries in under 3 seconds.
            </p>
          </Card>

          <Card elevation="default" interactive glow="sky" className="p-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-4">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Inline PR Comments</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Directly posts targeted code reviews onto the exact lines of code with one-click copyable Git patch suggestions.
            </p>
          </Card>

          <Card elevation="default" interactive glow="rose" className="p-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Deduplication</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              SHA-256 fingerprinting guarantees that re-pushed PR commits never re-trigger duplicate comment notifications.
            </p>
          </Card>
        </div>
      </section>

      {/* 5. HOW IT WORKS / 3-STEP WORKFLOW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border-subtle">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-white">How It Works</h2>
          <p className="text-xs text-slate-400 mt-1">From pull request open to verified AI fix in three steps.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card elevation="default" className="p-6 relative">
            <span className="text-4xl font-extrabold text-surface-2 absolute right-5 top-5 font-mono select-none">01</span>
            <Badge variant="brand" size="sm" className="mb-3">Step 1</Badge>
            <h4 className="text-base font-bold text-white mb-2">Track Your Repository</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate via GitHub OAuth and select your repository to automatically configure the webhook endpoint.
            </p>
          </Card>

          <Card elevation="default" className="p-6 relative">
            <span className="text-4xl font-extrabold text-surface-2 absolute right-5 top-5 font-mono select-none">02</span>
            <Badge variant="purple" size="sm" className="mb-3">Step 2</Badge>
            <h4 className="text-base font-bold text-white mb-2">Open a Pull Request</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              GitHub dispatches an HMAC-verified webhook. Python AST and Groq LLMs analyze the changes asynchronously.
            </p>
          </Card>

          <Card elevation="default" className="p-6 relative">
            <span className="text-4xl font-extrabold text-surface-2 absolute right-5 top-5 font-mono select-none">03</span>
            <Badge variant="success" size="sm" className="mb-3">Step 3</Badge>
            <h4 className="text-base font-bold text-white mb-2">Review & Remediate</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore findings in the interactive dashboard or apply inline suggestion patches directly on GitHub.
            </p>
          </Card>
        </div>
      </section>

      {/* 6. BOTTOM CTA BANNER */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-3xl bg-gradient-to-r from-brand-900/40 via-surface-1 to-indigo-950/40 p-8 sm:p-12 border border-brand-500/30 text-center shadow-card-hover relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Elevate Your Pull Request Reviews Today
            </h2>
            <p className="mt-3 text-sm text-slate-300 max-w-xl mx-auto">
              Connect your repositories and receive instant, verifiable code intelligence on every pull request.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="glow"
                size="md"
                onClick={loginWithGitHub}
                icon={<Github className="w-4 h-4" />}
              >
                Sign in with GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-border-subtle py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-300">CodeRefactor AI</span>
          </div>
          <p>© 2026 CodeRefactor AI. Built for modern engineering teams.</p>
          <div className="flex items-center space-x-4">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
