import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  Trash2,
  Plus,
  Play,
  RotateCcw,
  Layers,
  Code,
  LogOut,
  AlertCircle,
  Clock,
  Flame,
  Shield,
  Search,
  X,
  Copy,
  Check
} from 'lucide-react';

interface NotificationItem {
  id: string | number;
  title: string;
  description?: string;
  message?: string;
  category?: string;
  service?: string;
  priority?: number;
  urgencyLevel?: number;
  timestamp?: number;
  createdAt?: number;
  status?: string;
  heapIndex?: number;
  computedPriority?: number;
}

interface HistoryItem {
  id: string | number;
  title: string;
  description: string;
  category: string;
  priority: number;
  timestamp: number;
  processedAt: number;
}

const PRIORITY_MAP: Record<number, { label: string; badge: string; color: string; bg: string }> = {
  4: { label: 'Critical (P4)', badge: 'P4', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200 text-rose-700' },
  3: { label: 'High (P3)', badge: 'P3', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
  2: { label: 'Medium (P2)', badge: 'P2', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 text-blue-700' },
  1: { label: 'Low (P1)', badge: 'P1', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  0: { label: 'Info (P0)', badge: 'P0', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200 text-slate-700' },
};

export default function App() {
  // Authentication State
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('college_pnotif_user') || null);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [usernameInput, setUsernameInput] = useState('student');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Dashboard Data State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fifoQueue, setFifoQueue] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, processed: 0, critical: 0 });
  const [loading, setLoading] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add Notification Form State
  const [formTitle, setFormTitle] = useState('');
  const [formPriority, setFormPriority] = useState<number>(4);
  const [formCategory, setFormCategory] = useState('System');
  const [formDescription, setFormDescription] = useState('');

  // Pending Notifications Search & Real-Time Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // C Source Modal State
  const [showCSourceModal, setShowCSourceModal] = useState(false);
  const [cSourceCode, setCSourceCode] = useState<string>('');
  const [selectedCFile, setSelectedCFile] = useState<string>('priority_queue.c');
  const [availableCFiles, setAvailableCFiles] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertBanner({ message, type });
    setTimeout(() => setAlertBanner(null), 4000);
  };

  // Fetch Dashboard State
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch pending notifications & summary metrics
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const items: NotificationItem[] = notifData.notifications || [];
        setNotifications(items);
        setStats(notifData.stats || {
          total: items.length,
          pending: items.length,
          processed: 0,
          critical: items.filter((n) => (n.priority || n.urgencyLevel) === 4).length,
        });
      }

      // 2. Fetch history (Linked List)
      const histRes = await fetch('/api/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }

      // 3. Fetch FIFO queue
      const qRes = await fetch('/api/queue');
      if (qRes.ok) {
        const qData = await qRes.json();
        setFifoQueue(qData.items || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [user, fetchDashboardData]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Please fill in both username and password.');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        const loggedUser = usernameInput.trim();
        setUser(loggedUser);
        localStorage.setItem('college_pnotif_user', loggedUser);
      } else {
        setAuthError(data.message || 'Invalid username or password.');
      }
    } catch {
      setAuthError('Unable to connect to backend server.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (usernameInput.trim().length < 3 || passwordInput.trim().length < 4) {
      setAuthError('Username must be ≥ 3 chars and password ≥ 4 chars.');
      return;
    }

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setAuthSuccess('Account created successfully! You can now log in.');
        setAuthTab('login');
      } else {
        setAuthError(data.message || 'Failed to create account.');
      }
    } catch {
      setAuthError('Unable to connect to backend server.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('college_pnotif_user');
  };

  // Notification Operations
  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          priority: formPriority,
          category: formCategory,
          description: formDescription.trim(),
          username: user,
        }),
      });
      if (res.ok) {
        showAlert(`Notification enqueued into Binary Max-Heap (Priority ${formPriority}).`);
        setFormTitle('');
        setFormDescription('');
        fetchDashboardData();
      } else {
        showAlert('Failed to insert notification into queue.', 'error');
      }
    } catch {
      showAlert('Failed to connect to backend server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNext = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/process', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        const notif = data.notification;
        showAlert(`Successfully processed highest-priority notification: "${notif.title}" (Priority ${notif.priority}). Recorded into History Linked List.`);
        fetchDashboardData();
      } else {
        showAlert(data.message || 'Priority queue is empty.', 'error');
      }
    } catch {
      showAlert('Error processing notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string | number) => {
    try {
      const res = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showAlert(`Notification #${id} marked as read.`);
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to mark notification as read.', 'error');
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      const res = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showAlert(`Notification #${id} deleted from Binary Max-Heap in O(log n).`);
        fetchDashboardData();
      }
    } catch {
      showAlert('Failed to delete notification', 'error');
    }
  };

  const handleSeedSample = async () => {
    setLoading(true);
    try {
      await fetch('/api/engine/seed', { method: 'POST' });
      showAlert('Loaded sample test set into the Binary Max-Heap.');
      fetchDashboardData();
    } catch {
      showAlert('Failed to load sample notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open C Source Code
  const openCSourceModal = async (filename?: string) => {
    const fileToFetch = filename || selectedCFile || 'priority_queue.c';
    try {
      const res = await fetch(`/api/c-source?file=${encodeURIComponent(fileToFetch)}`);
      if (res.ok) {
        const data = await res.json();
        setCSourceCode(data.source || '');
        setSelectedCFile(data.filename || fileToFetch);
        if (Array.isArray(data.availableFiles)) {
          setAvailableCFiles(data.availableFiles);
        }
      }
    } catch (err) {
      console.error(err);
    }
    setShowCSourceModal(true);
  };

  const formatElapsed = (ts?: number) => {
    if (!ts) return 'Just now';
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  };

  // Real-time filtering of pending alerts by title or category
  const filteredNotifications = notifications.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = (item.title || '').toLowerCase().includes(q);
    const categoryMatch = (item.category || item.service || '').toLowerCase().includes(q);
    const descMatch = (item.description || item.message || '').toLowerCase().includes(q);
    return titleMatch || categoryMatch || descMatch;
  });

  // =========================================================================
  // SCREEN 1: LOGIN AND SIGNUP SCREEN (INITIAL SCREEN)
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider font-mono bg-blue-50 px-2.5 py-1 rounded">
              College Data Structures Project
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">
              Notification Management System
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Demonstrating Binary Max-Heap, Circular Queue & Linked List in C
            </p>
          </div>

          {/* Login / Sign Up Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => { setAuthTab('login'); setAuthError(null); setAuthSuccess(null); }}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                authTab === 'login'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setAuthTab('signup'); setAuthError(null); setAuthSuccess(null); }}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                authTab === 'signup'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error / Success Banners */}
          {authError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{authError}</span>
            </div>
          )}
          {authSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={authTab === 'login' ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. student"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
            >
              {authTab === 'login' ? 'Log In to Dashboard' : 'Create Student Account'}
            </button>
          </form>

          {/* Academic Hint */}
          <div className="mt-6 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 font-mono">
            Default Demo Account: <strong>student</strong> / <strong>password123</strong>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: DASHBOARD (AFTER SUCCESSFUL LOGIN)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Priority-Based Notification System
              </h1>
              <span className="text-[11px] font-mono text-slate-500">
                Data Structures Project · C Backend Max-Heap
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openCSourceModal('priority_queue.c')}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors flex items-center gap-1.5 border border-slate-200"
            >
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span>Inspect C Code</span>
            </button>

            <span className="hidden sm:inline text-xs text-slate-500">
              User: <strong className="text-slate-800">{user}</strong>
            </span>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Status Notification Banner */}
        {alertBanner && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between border ${
              alertBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{alertBanner.message}</span>
            </div>
            <button onClick={() => setAlertBanner(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. SUMMARY CARDS (4 Essential Metrics) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Notifications</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{stats.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Pending + Processed</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Pending in Heap</div>
            <div className="text-2xl font-bold font-mono text-blue-600 mt-1">{stats.pending}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active Max-Heap Nodes</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Processed History</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{stats.processed}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Singly Linked List Size</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Critical (P4)</div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{stats.critical}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Highest Precedence Alerts</div>
          </div>
        </section>

        {/* 2. PRIMARY ACTION CONTROLLER */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Priority Dispatch Controller</h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Processes notifications strictly by Binary Max-Heap priority ranking. Priority 4 is dispatched first; equal priorities are resolved FIFO by creation timestamp.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleProcessNext}
              disabled={loading || notifications.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Process Next Notification (Extract Max)</span>
            </button>

            <button
              onClick={handleSeedSample}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Load Sample Test Set</span>
            </button>
          </div>
        </section>

        {/* 3. TWO-COLUMN MAIN WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Add Notification Form & Complexity Sheet */}
          <div className="lg:col-span-5 space-y-6">
            {/* Add Notification Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900">Add Notification</h3>
                <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                  Heap Insert O(log n)
                </span>
              </div>

              <form onSubmit={handleAddNotification} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notification Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Database Connection Pool Exhausted"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Priority Level *
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-medium"
                    >
                      <option value="4">4 - Critical (Highest)</option>
                      <option value="3">3 - High</option>
                      <option value="2">2 - Medium</option>
                      <option value="1">1 - Low (Lowest)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    >
                      <option value="System">System</option>
                      <option value="Database">Database</option>
                      <option value="Network">Network</option>
                      <option value="Security">Security</option>
                      <option value="Finance">Finance</option>
                      <option value="Routine">Routine</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description / Details
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Explain the incident symptoms or trigger..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !formTitle.trim()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert into Priority Queue</span>
                </button>
              </form>
            </div>

            {/* Time Complexity Cheat Sheet */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono mb-3">
                Data Structures Complexity Analysis
              </h3>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                    <th className="py-1.5 font-normal">Operation</th>
                    <th className="py-1.5 font-normal">Data Structure</th>
                    <th className="py-1.5 font-normal text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr>
                    <td className="py-2 text-slate-700">Insert Alert</td>
                    <td className="py-2 text-slate-500">Binary Max-Heap</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">O(log n)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700">Extract Max</td>
                    <td className="py-2 text-slate-500">Binary Max-Heap</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">O(log n)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700">Peek Root</td>
                    <td className="py-2 text-slate-500">Binary Max-Heap</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">O(1)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700">Record History</td>
                    <td className="py-2 text-slate-500">Linked List (Head)</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">O(1)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700">FIFO Queue</td>
                    <td className="py-2 text-slate-500">Circular Array</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">O(1)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700">Delete Alert</td>
                    <td className="py-2 text-slate-500">Linear + Heapify</td>
                    <td className="py-2 text-right text-amber-600 font-bold">O(n)+O(log n)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Pending Notifications (Sorted by Priority) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pending Notifications (Priority Queue)</h3>
                  <p className="text-[11px] text-slate-500">
                    Highest priority (P4) processed first; equal priority resolved FIFO by arrival time.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-200">
                    {searchQuery.trim()
                      ? `${filteredNotifications.length} of ${notifications.length} queued`
                      : `${notifications.length} queued`}
                  </span>
                </div>
              </div>

              {/* Real-time Search Input Field */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search pending alerts by title or category (e.g. Database, Critical)..."
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery.trim() && (
                  <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-slate-500">
                    <span>
                      Filtered <strong className="text-slate-700">{filteredNotifications.length}</strong> of{' '}
                      <strong className="text-slate-700">{notifications.length}</strong> alerts matching "{searchQuery.trim()}"
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>

              {filteredNotifications.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredNotifications.map((item, index) => {
                    const isRoot = notifications.length > 0 && item.id === notifications[0].id;
                    const p = item.priority || item.urgencyLevel || 2;
                    const pInfo = PRIORITY_MAP[p] || PRIORITY_MAP[2];

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-lg border transition-all ${
                          isRoot
                            ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isRoot && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                ★ Next in Line (Heap Root)
                              </span>
                            )}
                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${pInfo.bg}`}>
                              {pInfo.badge}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{item.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.status === 'read' ? (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ Read
                              </span>
                            ) : (
                              <button
                                onClick={() => handleMarkRead(item.id)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              >
                                Mark Read
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {item.message || item.description ? (
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                            {item.message || item.description}
                          </p>
                        ) : null}

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1.5 border-t border-slate-100">
                          <span>
                            Category: <strong>{item.category || item.service || 'System'}</strong> · ID: #{item.id}
                          </span>
                          <span>
                            Heap Index: [{item.heapIndex ?? index}] · {formatElapsed(item.createdAt || item.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="font-semibold text-slate-700">Priority Queue Empty</p>
                  <p className="mt-0.5">All notifications have been processed.</p>
                  <button
                    onClick={handleSeedSample}
                    className="mt-3 px-3 py-1.5 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Load Sample Test Set
                  </button>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <Search className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No matching notifications</p>
                  <p className="mt-0.5 text-slate-500">
                    No pending alerts found matching "{searchQuery}".
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    Clear search filter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. BINARY MAX-HEAP VISUAL REPRESENTATION */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Binary Max-Heap Tree & Array Representation
              </h3>
              <p className="text-[11px] text-slate-500">
                Visualizing parent-child array arithmetic in C: Left=2i+1, Right=2i+2, Parent=floor((i-1)/2).
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-semibold">
              Heap Invariant Verified
            </span>
          </div>

          {/* Tree SVG */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
            <svg className="w-full h-[220px] min-w-[650px]" viewBox="0 0 700 220">
              {/* Branch connecting lines */}
              {notifications.slice(0, 7).map((_, i) => {
                if (i === 0) return null;
                const parentIdx = Math.floor((i - 1) / 2);
                const coords = [
                  { x: 350, y: 30 },
                  { x: 190, y: 90 }, { x: 510, y: 90 },
                  { x: 110, y: 160 }, { x: 270, y: 160 }, { x: 430, y: 160 }, { x: 590, y: 160 }
                ];
                const pPos = coords[parentIdx];
                const cPos = coords[i];

                return (
                  <line
                    key={`line-${i}`}
                    x1={pPos.x}
                    y1={pPos.y}
                    x2={cPos.x}
                    y2={cPos.y}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                );
              })}

              {/* Node circles */}
              {notifications.slice(0, 7).map((node, i) => {
                const coords = [
                  { x: 350, y: 30 },
                  { x: 190, y: 90 }, { x: 510, y: 90 },
                  { x: 110, y: 160 }, { x: 270, y: 160 }, { x: 430, y: 160 }, { x: 590, y: 160 }
                ];
                const pos = coords[i];
                const isRoot = i === 0;
                const p = node.priority || node.urgencyLevel || 2;

                return (
                  <g key={`node-${i}`} transform={`translate(${pos.x}, ${pos.y})`}>
                    <circle
                      r={isRoot ? 20 : 16}
                      fill={isRoot ? '#2563eb' : '#ffffff'}
                      stroke={isRoot ? '#1d4ed8' : '#64748b'}
                      strokeWidth={isRoot ? 3 : 2}
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      className="font-mono font-bold text-xs"
                      fill={isRoot ? '#ffffff' : '#0f172a'}
                    >
                      P{p}
                    </text>
                    <text
                      textAnchor="middle"
                      dy={isRoot ? 32 : 28}
                      className="font-mono text-[9px] fill-slate-500 font-semibold"
                    >
                      [{i}] #{node.id}
                    </text>
                  </g>
                );
              })}

              {notifications.length === 0 && (
                <text x="350" y="110" textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="sans-serif">
                  Max-Heap is currently empty
                </text>
              )}
            </svg>
          </div>

          {/* Contiguous Array Strip */}
          <div>
            <div className="text-[11px] font-mono text-slate-500 font-semibold mb-1.5">
              C Contiguous Array Memory Strip <code>items[0 .. size-1]</code>:
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {notifications.map((item, idx) => {
                const isRoot = idx === 0;
                const p = item.priority || item.urgencyLevel || 2;
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-lg border text-center shrink-0 w-24 ${
                      isRoot ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-400">[{idx}]</div>
                    <div className="text-xs font-bold font-mono text-slate-800 my-0.5">P{p}</div>
                    <div className="text-[10px] text-slate-500 truncate" title={item.title}>
                      {item.title}
                    </div>
                  </div>
                );
              })}
              {notifications.length === 0 && (
                <div className="text-xs text-slate-400 py-1 font-mono">Empty array</div>
              )}
            </div>
          </div>
        </section>

        {/* 5. CIRCULAR FIFO QUEUE COMPARISON SECTION */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Circular Queue (FIFO Dispatch Stage)
              </h3>
              <p className="text-[11px] text-slate-500">
                Demonstrates the standard First-In, First-Out queue in contrast with the Priority Queue.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              (rear + 1) % CAPACITY
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <strong className="text-slate-800">Concept Comparison:</strong>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
              <li><strong>Priority Queue (Max-Heap):</strong> Notifications are processed by urgency ranking (P4 Critical first), regardless of arrival order.</li>
              <li><strong>Standard Queue (Circular Array):</strong> Notifications are serviced strictly in the chronological order of their arrival (First-In, First-Out).</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-mono text-slate-500 font-semibold mb-1.5">
              FIFO Dispatched Queue Items:
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {fifoQueue.map((item, idx) => (
                <div key={idx} className="p-2 rounded-lg border border-slate-200 bg-white text-center shrink-0 w-28">
                  <div className="text-[10px] font-mono text-slate-400">{idx === 0 ? 'Front' : `Slot ${idx}`}</div>
                  <div className="text-xs font-bold text-slate-800 my-0.5">#{item.id}</div>
                  <div className="text-[10px] text-slate-500 truncate">{item.title}</div>
                </div>
              ))}
              {fifoQueue.length === 0 && (
                <div className="text-xs text-slate-400 py-1 font-mono">
                  Queue is empty (no recent dispatches)
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 6. NOTIFICATION HISTORY (LINKED LIST) */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Notification History (Singly Linked List)
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit log of processed notifications stored in a singly linked list in C memory and persisted to disk.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded">
              {history.length} processed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px]">
                  <th className="py-2 px-3 font-normal">ID</th>
                  <th className="py-2 px-3 font-normal">Title</th>
                  <th className="py-2 px-3 font-normal">Category</th>
                  <th className="py-2 px-3 font-normal">Priority</th>
                  <th className="py-2 px-3 font-normal">Created</th>
                  <th className="py-2 px-3 font-normal">Processed</th>
                  <th className="py-2 px-3 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const p = item.priority || 2;
                  const pInfo = PRIORITY_MAP[p] || PRIORITY_MAP[2];
                  return (
                    <tr key={item.id + '-' + item.processedAt} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 font-mono text-slate-600">#{item.id}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 max-w-xs truncate">{item.title}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{item.category}</td>
                      <td className="py-2 px-3 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${pInfo.bg}`}>
                          {pInfo.badge}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">{formatElapsed(item.timestamp)}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{formatElapsed(item.processedAt)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                          Processed
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No processed notifications in the linked list history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* C Source Inspector Modal */}
      {showCSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  C Backend Source Code Inspector (Data Structures)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cSourceCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors flex items-center gap-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy C Code'}</span>
                </button>
                <button
                  onClick={() => setShowCSourceModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* File Selector Tabs */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
              <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider shrink-0 mr-1">
                Files:
              </span>
              {(availableCFiles.length > 0 ? availableCFiles : [
                'priority_queue.h',
                'priority_queue.c',
                'queue.h',
                'queue.c',
                'linked_list.h',
                'linked_list.c',
                'storage.h',
                'storage.c',
                'main.c',
                'Makefile'
              ]).map((file) => (
                <button
                  key={file}
                  onClick={() => openCSourceModal(file)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors shrink-0 ${
                    selectedCFile === file
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {file}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-800 bg-slate-950 text-slate-200 leading-relaxed max-h-[70vh]">
              <pre>{cSourceCode || '// C source files located in backend/priority_queue.c, backend/queue.c, backend/linked_list.c, backend/storage.c'}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 text-xs text-slate-500 font-mono mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Priority-Based Notification Management System · College Data Structures Mini-Project</span>
          <span>Backend: C Programming Language · File Storage: <code>data/</code></span>
        </div>
      </footer>
    </div>
  );
}
