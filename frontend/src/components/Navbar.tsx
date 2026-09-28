import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  GitPullRequest,
  ShieldCheck,
  Plus,
  LogOut,
  Github,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TrackRepoModal } from './TrackRepoModal';
import { Button } from './ui/Button';

export const Navbar: React.FC = () => {
  const { user, loginWithGitHub, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDashboardActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/repos') || location.pathname.startsWith('/pulls');

  return (
    <>
      <header className="border-b border-border-subtle bg-surface-0/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-indigo-600 flex items-center justify-center shadow-glow-sky group-hover:scale-105 transition-transform duration-200">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-bold text-white tracking-tight">
                    CodeRefactor
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.2 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30">
                    AI
                  </span>
                </div>
                <span className="block text-[10px] text-slate-400 font-mono tracking-wider">
                  AST + AI Review
                </span>
              </div>
            </Link>

            {/* Navigation Links - Only shown when logged in */}
            {user && (
              <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-border-subtle">
                <Link
                  to="/dashboard"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                    isDashboardActive
                      ? 'bg-surface-2 text-white border border-border-prominent shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-surface-1'
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-brand-400" />
                  <span>Repositories</span>
                </Link>
              </nav>
            )}
          </div>


          {/* Action / Auth Controls */}
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  <span className="hidden sm:inline">Track Repo</span>
                  <span className="sm:hidden">Track</span>
                </Button>

                {/* User Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-prominent transition-all duration-200"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-6 h-6 rounded-lg object-cover border border-border-subtle"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-surface-2 flex items-center justify-center text-slate-400">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-200 hidden sm:inline">
                      @{user.username}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-2 border border-border-prominent shadow-card-hover py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-4 py-2 border-b border-border-subtle">
                        <p className="text-xs font-semibold text-white truncate">
                          {user.name || user.username}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          @{user.username}
                        </p>
                      </div>

                      <div className="py-1">
                        <Link
                          to="/dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-3 transition-colors"
                        >
                          <GitPullRequest className="w-3.5 h-3.5 mr-2.5 text-brand-400" />
                          <span>Tracked Repositories</span>
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-border-subtle">
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center px-4 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-2.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">

                <Button
                  variant="primary"
                  size="sm"
                  onClick={loginWithGitHub}
                  icon={<Github className="w-3.5 h-3.5" />}
                >
                  <span className="hidden sm:inline">Sign in with GitHub</span>
                  <span className="sm:hidden">Sign In</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Track Repo Modal */}
      <TrackRepoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent('reload-repos'));
        }}
      />
    </>
  );
};
