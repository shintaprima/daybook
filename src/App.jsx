import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Square, Plus, X, Calendar, Clock, Tag, Trash2, Archive, ChevronDown, ChevronRight, ChevronLeft, Settings as SettingsIcon, LayoutGrid, BarChart3, Check, ArchiveRestore, Bell, Moon, Sun, Download, Upload } from 'lucide-react';

// ============================================================================
// THEME CONFIGURATION
// ============================================================================
// All colors used in the app live here. Edit hex codes to customize.
// Each color has a comment explaining where it's used.
// ============================================================================

const THEME = {
  light: {
    // Backgrounds
    bg: '#F5F4EF',              // main app background (warm off-white)
    surface: '#FFFFFF',          // card backgrounds, panels, modals
    surfaceAlt: '#FAF9F4',       // hover states, secondary surfaces, column backgrounds
    border: '#E3E1D9',           // borders and dividers between elements
    borderStrong: '#D1CFC4',     // stronger borders for emphasis (modals, focused inputs)

    // Text
    textPrimary: '#2B2D31',      // main text (headings, body)
    textSecondary: '#6B6F76',    // secondary text (metadata, captions)
    textMuted: '#9AA3AD',        // disabled, very subtle text

    // Accents
    accent: '#5F7C68',           // primary accent — buttons, links, active tabs
    accentHover: '#4D6855',      // hover for primary accent
    accentSoft: '#E8EDE8',       // soft accent backgrounds (active tab)

    // Alert / Burgundy
    alert: '#8B2438',            // overdue tasks, overload, delete confirm
    alertSoft: '#F4E3E6',        // soft alert background
  },
  dark: {
    bg: '#1C1E22',
    surface: '#26292F',
    surfaceAlt: '#2E3138',
    border: '#363941',
    borderStrong: '#4A4E57',
    textPrimary: '#EAE8E1',
    textSecondary: '#9AA3AD',
    textMuted: '#6B6F76',
    accent: '#7A9A88',
    accentHover: '#8FB09D',
    accentSoft: '#2D3832',
    alert: '#B8455A',
    alertSoft: '#3B2429',
  },
  // Status colors — two sets so dark mode has lifted brightness for legibility
  // Used on cards (left stripe), dropdowns (tinted bg + text), column headers
  status: {
    light: {
      backlog: '#9AA3AD',          // grey — parked
      todo: '#FFCE1B',             // yellow — ready
      ongoing: '#1D4ED8',          // blue — active
      done: '#6B8E6B',             // muted green — completed
    },
    dark: {
      backlog: '#B8C0CA',          // lifted grey
      todo: '#FFCE1B',             // yellow stays — already bright enough
      ongoing: '#6B9BFF',          // lifted blue for dark mode legibility
      done: '#9FC49F',              // lifted green for dark mode legibility
    },
  },
  // Categorical chart colors — for dashboard breakdowns
  chart: ['#5F7C68', '#5B7A99', '#C9A961', '#8B2438', '#B8825C', '#6B7280', '#8F7CA3', '#7A9A88'],
};

// ============================================================================
// FONT OPTIONS
// ============================================================================
// Available heading fonts. User picks in Settings.
// ============================================================================

const FONT_OPTIONS = [
  { id: 'newsreader', name: 'Newsreader', stack: '"Newsreader", Georgia, serif',
    description: 'Calm serif with clean numbers' },
  { id: 'source-serif', name: 'Source Serif', stack: '"Source Serif 4", Georgia, serif',
    description: 'Neutral and refined' },
  { id: 'spectral', name: 'Spectral', stack: '"Spectral", Georgia, serif',
    description: 'Bookish with tabular figures' },
  { id: 'fraunces', name: 'Fraunces', stack: '"Fraunces", Georgia, serif',
    description: 'Expressive serif (curlier digits)' },
];

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================
// First-time defaults. Adjustable in Settings UI.
// ============================================================================

const DEFAULT_SETTINGS = {
  themeMode: 'light',                // 'light' or 'dark'
  headingFont: 'newsreader',         // see FONT_OPTIONS ids
  statuses: [
    { id: 'backlog', name: 'Backlog', color: 'backlog' },
    { id: 'todo', name: 'To Do', color: 'todo' },
    { id: 'ongoing', name: 'On Going', color: 'ongoing' },
    { id: 'done', name: 'Done', color: 'done' },
  ],
  labels: [
    { id: 'lbl-blocked', name: 'blocked', color: '#8B2438' },
    { id: 'lbl-paused', name: 'paused', color: '#9AA3AD' },
    { id: 'lbl-personal', name: 'personal', color: '#5F7C68' },
    { id: 'lbl-learning', name: 'learning', color: '#5B7A99' },
    { id: 'lbl-side-project', name: 'side project', color: '#C9A961' },
  ],
  thresholds: {
    tasksPerWeek: 3,             // overload if more than this many active tasks/week
    hoursPerWeek: 10,            // overload if more than this many hours/week
    inactivityDays: 3,           // alert if no time tracked on open task for X days
    deadlineWarningDays: 20,     // alert this many days before end date
  },
  notifications: {
    browserPush: false,
    inApp: true,
  },
};

// Positive affirmation messages — shown when task transitions into "done"
const AFFIRMATIONS = [
  'good work!',
  'nicely done',
  'you did great!',
  "that's a wrap!",
  'yay you did it!',
];

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEYS = {
  tasks: 'daybook_tasks_v2',     // v2 because subtask data model changed
  settings: 'daybook_settings_v2',
  activeTimer: 'daybook_activeTimer_v2',
};

const loadFromStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const saveToStorage = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
};

// Migrate v1 → v2: add timeEntries to subtasks if missing
const migrateTasks = (tasks) => tasks.map(t => ({
  ...t,
  subtasks: (t.subtasks || []).map(s => ({ ...s, timeEntries: s.timeEntries || [] })),
}));

// ============================================================================
// HELPERS
// ============================================================================

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Format with seconds — used in recent sessions
const formatDurationPrecise = (seconds) => {
  if (!seconds || seconds < 0) return '0m 0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

const formatDurationLong = (seconds) => {
  if (!seconds || seconds < 0) return '0h 0m 0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const isOverdue = (task) => {
  if (!task.endDate || task.statusId === 'done' || task.archived) return false;
  return new Date(task.endDate) < new Date(new Date().toDateString());
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Get all time entries for a task — combines parent direct entries + all subtask entries
const getAllEntries = (task) => {
  const own = task.timeEntries.map(e => ({ ...e, source: 'task', taskId: task.id }));
  const sub = (task.subtasks || []).flatMap(s =>
    (s.timeEntries || []).map(e => ({ ...e, source: 'subtask', subtaskId: s.id, subtaskTitle: s.title }))
  );
  return [...own, ...sub];
};
const getTotalSeconds = (task) => getAllEntries(task).reduce((s, e) => s + e.seconds, 0);
const getSubtaskSeconds = (sub) => (sub.timeEntries || []).reduce((s, e) => s + e.seconds, 0);

// Hex color → rgba with alpha (for tinted backgrounds)
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Get status color based on current theme mode — lifted blue/green in dark for legibility
const getStatusColor = (colorName, themeMode = 'light') => {
  const palette = THEME.status[themeMode] || THEME.status.light;
  return palette[colorName] || palette.backlog;
};

// Markdown-lite: bold, italic, inline links
const renderMarkdown = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const parts = [];
    let lastIdx = 0;
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      if (m.index > lastIdx) parts.push(line.slice(lastIdx, m.index));
      parts.push({ link: { text: m[1], url: m[2] } });
      lastIdx = linkRe.lastIndex;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    if (parts.length === 0) parts.push(line);

    return (
      <div key={i} style={{ minHeight: '1.4em' }}>
        {parts.map((p, j) => {
          if (typeof p === 'object' && p.link) {
            return (
              <a key={j} href={p.link.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                {p.link.text}
              </a>
            );
          }
          // bold **text**
          const segs = [];
          let lastI = 0, mm, idx = 0;
          const boldRe = /\*\*([^*]+)\*\*/g;
          while ((mm = boldRe.exec(p)) !== null) {
            if (mm.index > lastI) segs.push(p.slice(lastI, mm.index));
            segs.push(<strong key={`b-${j}-${idx++}`}>{mm[1]}</strong>);
            lastI = boldRe.lastIndex;
          }
          if (lastI < p.length) segs.push(p.slice(lastI));
          return <span key={j}>{segs}</span>;
        })}
      </div>
    );
  });
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [settings, setSettings] = useState(() => loadFromStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  const [tasks, setTasks] = useState(() => migrateTasks(loadFromStorage(STORAGE_KEYS.tasks, [])));
  const [activeTimer, setActiveTimer] = useState(() => loadFromStorage(STORAGE_KEYS.activeTimer, null));
  const [view, setView] = useState('board');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [labelFilter, setLabelFilter] = useState([]);
  const [monthFilter, setMonthFilter] = useState('all');
  const [tick, setTick] = useState(0);

  // Affirmation popup state
  const [affirmation, setAffirmation] = useState(null);
  const lastAffirmRef = useRef(0); // for 5-second debounce

  useEffect(() => saveToStorage(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => saveToStorage(STORAGE_KEYS.tasks, tasks), [tasks]);
  useEffect(() => saveToStorage(STORAGE_KEYS.activeTimer, activeTimer), [activeTimer]);

  useEffect(() => {
    if (!activeTimer) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [activeTimer]);

  const theme = THEME[settings.themeMode];
  const headingFont = FONT_OPTIONS.find(f => f.id === settings.headingFont)?.stack || FONT_OPTIONS[0].stack;
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const cssVars = {
    '--bg': theme.bg,
    '--surface': theme.surface,
    '--surface-alt': theme.surfaceAlt,
    '--border': theme.border,
    '--border-strong': theme.borderStrong,
    '--text-primary': theme.textPrimary,
    '--text-secondary': theme.textSecondary,
    '--text-muted': theme.textMuted,
    '--accent': theme.accent,
    '--accent-hover': theme.accentHover,
    '--accent-soft': theme.accentSoft,
    '--alert': theme.alert,
    '--alert-soft': theme.alertSoft,
    '--font-heading': headingFont,
  };

  const currentTimerSeconds = useMemo(() => {
    if (!activeTimer) return 0;
    const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
    return activeTimer.mode === 'countdown' ? Math.max(0, activeTimer.duration - elapsed) : elapsed;
  }, [activeTimer, tick]);

  const activeTimerTask = activeTimer ? tasks.find(t => t.id === activeTimer.taskId) : null;
  const activeTimerSubtask = (activeTimer && activeTimer.subtaskId && activeTimerTask)
    ? activeTimerTask.subtasks.find(s => s.id === activeTimer.subtaskId) : null;

  // ========== ACTIONS ==========

  const createTask = (statusId = 'backlog') => {
    const newTask = {
      id: uid(), title: 'New Task', description: '', statusId, labels: [],
      startDate: null, endDate: null, subtasks: [], timeEntries: [], comments: [],
      createdAt: new Date().toISOString(), archived: false,
    };
    setTasks(prev => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
  };

  const updateTask = (id, patch) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      // Affirmation trigger: status transition to done
      if (patch.statusId === 'done' && t.statusId !== 'done') {
        const now = Date.now();
        if (now - lastAffirmRef.current > 5000) {
          lastAffirmRef.current = now;
          const msg = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
          setAffirmation({ id: uid(), text: msg });
          setTimeout(() => setAffirmation(null), 3000);
        }
      }
      return next;
    }));
  };

  const deleteTask = (id) => {
    if (activeTimer?.taskId === id) setActiveTimer(null);
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  const archiveTask = (id) => { updateTask(id, { archived: true }); setSelectedTaskId(null); };
  const unarchiveTask = (id) => updateTask(id, { archived: false });

  const startTimer = (taskId, subtaskId = null, mode = 'stopwatch', duration = 0) => {
    setActiveTimer({ taskId, subtaskId, mode, duration, startedAt: Date.now() });
  };

  const stopTimer = () => {
    if (!activeTimer) return;
    const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
    const task = tasks.find(t => t.id === activeTimer.taskId);
    if (task && elapsed > 0) {
      const entry = {
        id: uid(), seconds: elapsed,
        startedAt: new Date(activeTimer.startedAt).toISOString(), note: '',
      };
      if (activeTimer.subtaskId) {
        const subs = task.subtasks.map(s =>
          s.id === activeTimer.subtaskId ? { ...s, timeEntries: [...(s.timeEntries || []), entry] } : s);
        updateTask(activeTimer.taskId, { subtasks: subs });
      } else {
        updateTask(activeTimer.taskId, { timeEntries: [...task.timeEntries, entry] });
      }
    }
    setActiveTimer(null);
  };

  const logTimeManually = (taskId, subtaskId, minutes, dateIso, note = '') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const entry = {
      id: uid(), seconds: minutes * 60,
      startedAt: dateIso || new Date().toISOString(),
      note, manual: true,
    };
    if (subtaskId) {
      const subs = task.subtasks.map(s =>
        s.id === subtaskId ? { ...s, timeEntries: [...(s.timeEntries || []), entry] } : s);
      updateTask(taskId, { subtasks: subs });
    } else {
      updateTask(taskId, { timeEntries: [...task.timeEntries, entry] });
    }
  };

  const deleteTimeEntry = (taskId, subtaskId, entryId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (subtaskId) {
      const subs = task.subtasks.map(s =>
        s.id === subtaskId ? { ...s, timeEntries: s.timeEntries.filter(e => e.id !== entryId) } : s);
      updateTask(taskId, { subtasks: subs });
    } else {
      updateTask(taskId, { timeEntries: task.timeEntries.filter(e => e.id !== entryId) });
    }
  };

  // ========== FILTERS ==========

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (t.archived) return false;
    if (labelFilter.length > 0 && !labelFilter.every(l => t.labels.includes(l))) return false;
    if (monthFilter !== 'all') {
      const ref = t.endDate || t.startDate || t.createdAt;
      if (!ref) return false;
      const d = new Date(ref);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthFilter.startsWith('q-')) {
        const [, yr, q] = monthFilter.split('-');
        const qMonths = { '1':[0,1,2], '2':[3,4,5], '3':[6,7,8], '4':[9,10,11] };
        if (d.getFullYear() !== Number(yr) || !qMonths[q].includes(d.getMonth())) return false;
      } else {
        if (ym !== monthFilter) return false;
      }
    }
    return true;
  }), [tasks, labelFilter, monthFilter]);

  return (
    <div style={{ ...cssVars, background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-primary)',
      fontFamily: '"Inter Tight", -apple-system, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Serif+4:wght@400;500;600&family=Spectral:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .db-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .db-heading { font-family: var(--font-heading); }

        .db-btn { font-family: inherit; font-size: 13px; font-weight: 500;
          padding: 7px 12px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text-primary); cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px; transition: all 0.12s; }
        .db-btn:hover { background: var(--surface-alt); border-color: var(--border-strong); }
        .db-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .db-btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
        .db-btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
        .db-btn-ghost { background: transparent; border-color: transparent; }
        .db-btn-ghost:hover { background: var(--surface-alt); }
        .db-btn-danger { color: var(--alert); }
        .db-btn-danger:hover { background: var(--alert-soft); border-color: var(--alert); }

        .db-input { font-family: inherit; font-size: 13px;
          padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text-primary);
          outline: none; transition: border-color 0.12s; width: 100%; }
        .db-input:focus { border-color: var(--accent); }

        .db-card { background: var(--surface); border-radius: 8px; border: 1px solid var(--border);
          transition: all 0.12s; }
        .db-card:hover { border-color: var(--border-strong); }

        .db-tab { padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500;
          cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;
          transition: all 0.12s; border: 1px solid transparent; }
        .db-tab:hover { background: var(--surface-alt); color: var(--text-primary); }
        .db-tab-active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-soft); }

        .db-checkbox { width: 16px; height: 16px; border: 1.5px solid var(--border-strong);
          border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; background: var(--surface); transition: all 0.12s; flex-shrink: 0; }
        .db-checkbox:hover { border-color: var(--accent); }
        .db-checkbox-checked { background: var(--accent); border-color: var(--accent); color: white; }

        .db-label-chip { display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
          background: var(--surface-alt); border: 1px solid var(--border); }
        .db-label-chip-dot { width: 6px; height: 6px; border-radius: 50%; }

        .db-kbd-card { cursor: pointer; padding: 12px; border-left: 3px solid transparent; }
        .db-kbd-card:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.04); }

        .db-progress-track { height: 4px; background: var(--surface-alt); border-radius: 2px; overflow: hidden; border: 1px solid var(--border); }
        .db-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s; }

        .db-panel { background: var(--surface); border-left: 1px solid var(--border);
          height: 100vh; overflow-y: auto; padding: 24px; }

        .db-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 40;
          display: flex; align-items: center; justify-content: center; }
        .db-modal { background: var(--surface); border-radius: 10px; padding: 24px;
          max-width: 520px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.15); max-height: 80vh; overflow-y: auto; }

        .db-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .db-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .db-scrollbar::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

        .db-banner { padding: 10px 14px; border-radius: 6px; font-size: 13px;
          display: flex; align-items: center; gap: 8px; }

        /* Status-colored select dropdown (tinted bg + colored text) */
        .db-status-select { font-weight: 500; }

        /* Timesheet grid */
        .db-ts-grid { width: 100%; border-collapse: collapse; font-size: 13px; }
        .db-ts-grid th, .db-ts-grid td { border: 1px solid var(--border); padding: 8px 10px; text-align: right; }
        .db-ts-grid th:first-child, .db-ts-grid td:first-child { text-align: left; }
        .db-ts-grid th { background: var(--surface-alt); font-weight: 500; font-size: 12px;
          color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
        .db-ts-grid tr.db-ts-subrow { background: var(--surface-alt); }
        .db-ts-grid tr.db-ts-subrow td:first-child { padding-left: 32px; color: var(--text-secondary); font-size: 12px; }
        .db-ts-grid td.db-ts-total { font-weight: 500; background: var(--surface-alt); }
        .db-ts-cell-clickable { cursor: pointer; }
        .db-ts-cell-clickable:hover { background: var(--accent-soft); }

        @keyframes affirm-pop {
          0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.92); }
          12% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          88% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.96); }
        }
        @keyframes pulse-dot { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>

      <TopNav
        view={view} setView={setView}
        activeTimer={activeTimer} activeTimerTask={activeTimerTask} activeTimerSubtask={activeTimerSubtask}
        currentTimerSeconds={currentTimerSeconds} onStopTimer={stopTimer}
        themeMode={settings.themeMode}
        onToggleTheme={() => setSettings({ ...settings, themeMode: settings.themeMode === 'light' ? 'dark' : 'light' })}
      />

      <OverloadBanner tasks={tasks} thresholds={settings.thresholds} />

      <div style={{ padding: '20px 28px', paddingBottom: 60 }}>
        {view === 'board' && (
          <BoardView
            tasks={filteredTasks} allTasks={tasks} settings={settings}
            onSelectTask={setSelectedTaskId} onCreateTask={createTask} onUpdateTask={updateTask}
            labelFilter={labelFilter} setLabelFilter={setLabelFilter}
            monthFilter={monthFilter} setMonthFilter={setMonthFilter}
            activeTimer={activeTimer} onStartTimer={startTimer} onStopTimer={stopTimer}
          />
        )}
        {view === 'dashboard' && <DashboardView tasks={tasks} settings={settings} onSelectTask={setSelectedTaskId} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} tasks={tasks} setTasks={setTasks} />}
        {view === 'archive' && <ArchiveView tasks={tasks} onUnarchive={unarchiveTask} onDelete={deleteTask} onSelect={setSelectedTaskId} settings={settings} />}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask} settings={settings}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={(patch) => updateTask(selectedTask.id, patch)}
          onDelete={() => deleteTask(selectedTask.id)}
          onArchive={() => archiveTask(selectedTask.id)}
          activeTimer={activeTimer} onStartTimer={startTimer} onStopTimer={stopTimer}
          onLogTime={logTimeManually} onDeleteEntry={deleteTimeEntry}
          currentTimerSeconds={currentTimerSeconds}
        />
      )}

      {affirmation && <AffirmationPopup text={affirmation.text} />}
    </div>
  );
}

// ============================================================================
// AFFIRMATION POPUP
// ============================================================================
function AffirmationPopup({ text }) {
  return (
    <div style={{
      position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60,
      background: 'var(--surface)',
      color: 'var(--accent)',
      border: '2px solid var(--accent)',
      padding: '16px 32px', borderRadius: 12,
      fontSize: 18,
      fontFamily: 'var(--font-heading)', fontWeight: 500,
      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      animation: 'affirm-pop 3s ease forwards',
      pointerEvents: 'none',
      minWidth: 200, textAlign: 'center',
    }}>
      {text}
    </div>
  );
}

// ============================================================================
// TOP NAV
// ============================================================================
function TopNav({ view, setView, activeTimer, activeTimerTask, activeTimerSubtask, currentTimerSeconds, onStopTimer, themeMode, onToggleTheme }) {
  const activeLabel = activeTimerSubtask
    ? `${activeTimerTask?.title} → ${activeTimerSubtask.title}`
    : (activeTimerTask?.title || 'Task');

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div className="db-heading" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
          daybook<span style={{ color: 'var(--accent)' }}>.</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div className={`db-tab ${view === 'board' ? 'db-tab-active' : ''}`} onClick={() => setView('board')}>
            <LayoutGrid size={14} /> Board
          </div>
          <div className={`db-tab ${view === 'dashboard' ? 'db-tab-active' : ''}`} onClick={() => setView('dashboard')}>
            <BarChart3 size={14} /> Dashboard
          </div>
          <div className={`db-tab ${view === 'archive' ? 'db-tab-active' : ''}`} onClick={() => setView('archive')}>
            <Archive size={14} /> Archive
          </div>
          <div className={`db-tab ${view === 'settings' ? 'db-tab-active' : ''}`} onClick={() => setView('settings')}>
            <SettingsIcon size={14} /> Settings
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {activeTimer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            padding: '6px 12px', borderRadius: 20, fontSize: 13 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
              animation: 'pulse-dot 1.5s infinite' }} />
            <span className="db-mono" style={{ fontWeight: 500 }}>{formatDurationLong(currentTimerSeconds)}</span>
            <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeLabel}
            </span>
            <button onClick={onStopTimer} className="db-btn-ghost"
              style={{ padding: 2, color: 'var(--accent)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <Square size={12} fill="currentColor" />
            </button>
          </div>
        )}
        <button className="db-btn db-btn-ghost" onClick={onToggleTheme} title="Toggle theme">
          {themeMode === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// OVERLOAD BANNER
// ============================================================================
function OverloadBanner({ tasks, thresholds }) {
  const weekStart = startOfWeek(new Date());
  const stats = useMemo(() => {
    let tasksThisWeek = 0, secondsThisWeek = 0;
    tasks.forEach(t => {
      if (t.archived) return;
      const allEntries = getAllEntries(t);
      if (t.statusId === 'done' && allEntries.some(e => new Date(e.startedAt) >= weekStart)) tasksThisWeek++;
      else if (t.statusId !== 'done' && t.statusId !== 'backlog') tasksThisWeek++;
      allEntries.forEach(e => {
        if (new Date(e.startedAt) >= weekStart) secondsThisWeek += e.seconds;
      });
    });
    return { tasksThisWeek, hoursThisWeek: secondsThisWeek / 3600 };
  }, [tasks]);

  const overloaded = stats.tasksThisWeek > thresholds.tasksPerWeek || stats.hoursThisWeek > thresholds.hoursPerWeek;
  if (!overloaded) return null;

  return (
    <div style={{ padding: '0 28px', paddingTop: 12 }}>
      <div className="db-banner" style={{ background: 'var(--alert-soft)', color: 'var(--alert)', border: '1px solid var(--alert)' }}>
        <Bell size={14} />
        <span>
          Heads up — you're at <strong>{stats.tasksThisWeek} active tasks</strong> and{' '}
          <strong>{stats.hoursThisWeek.toFixed(1)}h logged</strong> this week. Time to slow down?
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// STATUS SELECT (tinted background based on status color)
// ============================================================================
function StatusSelect({ value, statuses, onChange, style = {}, size = 'normal', themeMode = 'light' }) {
  const status = statuses.find(s => s.id === value);
  const color = getStatusColor(status?.color, themeMode);
  const tintBg = hexToRgba(color, themeMode === 'dark' ? 0.18 : 0.1);
  const fontSize = size === 'small' ? 11 : 13;
  const paddingY = size === 'small' ? 2 : 7;
  const paddingLeft = size === 'small' ? 8 : 12;
  const paddingRight = size === 'small' ? 22 : 28;
  const chevronSize = size === 'small' ? 10 : 12;
  const chevronRight = size === 'small' ? 6 : 10;

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: 'inherit',
          fontSize,
          fontWeight: 500,
          padding: `${paddingY}px ${paddingRight}px ${paddingY}px ${paddingLeft}px`,
          borderRadius: 6,
          border: `1px solid ${hexToRgba(color, 0.3)}`,
          background: tintBg,
          color,
          cursor: 'pointer',
          outline: 'none',
          // Strip native arrow across all browsers
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          minWidth: size === 'small' ? 80 : 110,
        }}
      >
        {statuses.map(s => (
          <option key={s.id} value={s.id} style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}>
            {s.name}
          </option>
        ))}
      </select>
      {/* Custom chevron — overlaid, pointer-events disabled so clicks pass through to the select */}
      <ChevronDown
        size={chevronSize}
        style={{
          position: 'absolute',
          right: chevronRight,
          top: '50%',
          transform: 'translateY(-50%)',
          color,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ============================================================================
// BOARD VIEW
// ============================================================================
function BoardView({ tasks, allTasks, settings, onSelectTask, onCreateTask, onUpdateTask, labelFilter, setLabelFilter, monthFilter, setMonthFilter, activeTimer, onStartTimer, onStopTimer }) {
  const [showLabelMenu, setShowLabelMenu] = useState(false);

  const monthOptions = useMemo(() => {
    const set = new Set();
    allTasks.forEach(t => {
      const ref = t.endDate || t.startDate || t.createdAt;
      if (ref) {
        const d = new Date(ref);
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [allTasks]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="db-input" style={{ width: 'auto', minWidth: 140 }}
          value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All time</option>
          <optgroup label="Months">
            {monthOptions.map(m => (
              <option key={m} value={m}>{new Date(m + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>
            ))}
          </optgroup>
          <optgroup label="Quarters">
            {[1,2,3,4].map(q => (
              <option key={`q-${new Date().getFullYear()}-${q}`} value={`q-${new Date().getFullYear()}-${q}`}>
                Q{q} {new Date().getFullYear()}
              </option>
            ))}
          </optgroup>
        </select>

        <div style={{ position: 'relative' }}>
          <button className="db-btn" onClick={() => setShowLabelMenu(!showLabelMenu)}>
            <Tag size={13} />
            {labelFilter.length === 0 ? 'All labels' : `${labelFilter.length} label${labelFilter.length > 1 ? 's' : ''}`}
            <ChevronDown size={12} />
          </button>
          {showLabelMenu && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 30,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              {settings.labels.map(l => (
                <div key={l.id} onClick={() => {
                  setLabelFilter(labelFilter.includes(l.id) ? labelFilter.filter(x => x !== l.id) : [...labelFilter, l.id]);
                }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  background: labelFilter.includes(l.id) ? 'var(--surface-alt)' : 'transparent' }}>
                  <div className="db-checkbox" style={{
                    background: labelFilter.includes(l.id) ? 'var(--accent)' : 'var(--surface)',
                    borderColor: labelFilter.includes(l.id) ? 'var(--accent)' : 'var(--border-strong)', color: 'white' }}>
                    {labelFilter.includes(l.id) && <Check size={11} />}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span>{l.name}</span>
                </div>
              ))}
              {labelFilter.length > 0 && (
                <div onClick={() => { setLabelFilter([]); setShowLabelMenu(false); }}
                  style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', marginTop: 4,
                    fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Clear all</div>
              )}
            </div>
          )}
        </div>

        <button className="db-btn db-btn-primary" onClick={() => onCreateTask('backlog')} style={{ marginLeft: 'auto' }}>
          <Plus size={14} /> New Task
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.statuses.length}, 1fr)`, gap: 14 }}>
        {settings.statuses.map(status => {
          const colTasks = tasks.filter(t => t.statusId === status.id);
          const statusColor = getStatusColor(status.color, settings.themeMode);
          return (
            <div key={status.id} style={{ minHeight: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                paddingBottom: 8, borderBottom: `2px solid ${statusColor}` }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  {status.name}
                </span>
                <span className="db-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {colTasks.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} settings={settings} statusColor={statusColor}
                    onClick={() => onSelectTask(task.id)}
                    activeTimer={activeTimer}
                    onStartTimer={() => onStartTimer(task.id, null, 'stopwatch')}
                    onStopTimer={onStopTimer} />
                ))}
                <button className="db-btn db-btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--text-muted)' }}
                  onClick={() => onCreateTask(status.id)}>
                  <Plus size={13} /> Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// TASK CARD
// ============================================================================
function TaskCard({ task, settings, statusColor, onClick, activeTimer, onStartTimer, onStopTimer }) {
  const totalSeconds = getTotalSeconds(task);
  const subtaskProgress = task.subtasks.length > 0
    ? Math.round((task.subtasks.filter(s => s.statusId === 'done').length / task.subtasks.length) * 100) : null;
  const overdue = isOverdue(task);
  const isTimerActive = activeTimer?.taskId === task.id && !activeTimer?.subtaskId;
  const anyActiveOnThis = activeTimer?.taskId === task.id;
  const taskLabels = task.labels.map(lid => settings.labels.find(l => l.id === lid)).filter(Boolean);

  return (
    <div className="db-card db-kbd-card" onClick={onClick} style={{ borderLeft: `3px solid ${statusColor}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{task.title}</div>

          {taskLabels.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {taskLabels.map(l => (
                <span key={l.id} className="db-label-chip">
                  <span className="db-label-chip-dot" style={{ background: l.color }} />{l.name}
                </span>
              ))}
            </div>
          )}

          {subtaskProgress !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                <span>{task.subtasks.filter(s => s.statusId === 'done').length}/{task.subtasks.length} subtasks</span>
                <span className="db-mono">{subtaskProgress}%</span>
              </div>
              <div className="db-progress-track">
                <div className="db-progress-fill" style={{ width: `${subtaskProgress}%` }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
            {task.endDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                color: overdue ? 'var(--alert)' : 'var(--text-secondary)' }}>
                <Calendar size={11} /> {formatDate(task.endDate)}
                {overdue && <span style={{ fontWeight: 600 }}>· overdue</span>}
              </span>
            )}
            {totalSeconds > 0 && (
              <span className="db-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} /> {formatDuration(totalSeconds)}
              </span>
            )}
          </div>
        </div>

        <button onClick={(e) => {
          e.stopPropagation();
          if (isTimerActive) onStopTimer();
          else if (!anyActiveOnThis) onStartTimer();
        }} style={{
          padding: 4, borderRadius: 4,
          color: isTimerActive ? 'var(--alert)' : 'var(--accent)',
          cursor: anyActiveOnThis && !isTimerActive ? 'not-allowed' : 'pointer',
          opacity: anyActiveOnThis && !isTimerActive ? 0.4 : 1,
          display: 'flex', alignItems: 'center', border: 'none', background: 'transparent',
        }} title={isTimerActive ? 'Stop timer' : (anyActiveOnThis ? 'Timer running on subtask' : 'Start timer')}>
          {isTimerActive ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TASK DETAIL PANEL
// ============================================================================
function TaskDetailPanel({ task, settings, onClose, onUpdate, onDelete, onArchive, activeTimer, onStartTimer, onStopTimer, onLogTime, onDeleteEntry, currentTimerSeconds }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLogTimeModal, setShowLogTimeModal] = useState(null); // null | { subtaskId }
  const isTimerActiveOnTask = activeTimer?.taskId === task.id && !activeTimer?.subtaskId;
  const totalSeconds = getTotalSeconds(task);
  const ownSeconds = task.timeEntries.reduce((s, e) => s + e.seconds, 0);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 520, maxWidth: '100vw',
      height: '100vh', zIndex: 30, boxShadow: '-10px 0 40px rgba(0,0,0,0.08)' }}
      className="db-panel db-scrollbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <StatusSelect value={task.statusId} statuses={settings.statuses}
          themeMode={settings.themeMode}
          onChange={(v) => onUpdate({ statusId: v })} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="db-btn db-btn-ghost" onClick={onArchive} title="Archive"><Archive size={14} /></button>
          <button className="db-btn db-btn-ghost db-btn-danger" onClick={() => setConfirmDelete(true)} title="Delete"><Trash2 size={14} /></button>
          <button className="db-btn db-btn-ghost" onClick={onClose} title="Close"><X size={14} /></button>
        </div>
      </div>

      <textarea value={task.title} onChange={e => onUpdate({ title: e.target.value })}
        className="db-input db-heading"
        style={{ fontSize: 21, fontWeight: 500, padding: 8, border: '1px solid transparent',
          background: 'transparent', resize: 'none', minHeight: 40, lineHeight: 1.3 }}
        rows={Math.max(1, Math.ceil(task.title.length / 40))} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start</div>
          <input type="date" className="db-input" value={task.startDate || ''}
            onChange={e => onUpdate({ startDate: e.target.value || null })} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End</div>
          <input type="date" className="db-input" value={task.endDate || ''}
            onChange={e => onUpdate({ endDate: e.target.value || null })} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Labels</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {settings.labels.map(l => {
            const active = task.labels.includes(l.id);
            return (
              <button key={l.id} onClick={() => onUpdate({ labels: active ? task.labels.filter(x => x !== l.id) : [...task.labels, l.id] })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                  background: active ? hexToRgba(l.color, 0.12) : 'var(--surface-alt)',
                  border: `1px solid ${active ? l.color : 'var(--border)'}`,
                  color: active ? l.color : 'var(--text-secondary)', cursor: 'pointer' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />{l.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Description <span style={{ textTransform: 'none', color: 'var(--text-muted)' }}>· **bold**, *italic*, [link](url)</span>
        </div>
        <textarea value={task.description || ''} onChange={e => onUpdate({ description: e.target.value })}
          className="db-input" placeholder="Add description..."
          style={{ minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} />
        {task.description && (
          <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-alt)', borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
            {renderMarkdown(task.description)}
          </div>
        )}
      </div>

      {/* Time tracking for the parent task */}
      <div style={{ marginTop: 20, padding: 14, background: 'var(--surface-alt)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Time Tracking <span style={{ textTransform: 'none', color: 'var(--text-muted)' }}>· task + all subtasks</span>
          </div>
          <div className="db-mono" style={{ fontSize: 16, fontWeight: 500 }}>
            {formatDurationLong(totalSeconds + (activeTimer?.taskId === task.id ? currentTimerSeconds : 0))}
          </div>
        </div>

        {isTimerActiveOnTask ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="db-mono" style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)' }}>
              {formatDurationLong(currentTimerSeconds)}
            </div>
            <button className="db-btn db-btn-danger" onClick={onStopTimer} style={{ marginLeft: 'auto' }}>
              <Square size={12} fill="currentColor" /> Stop
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {[15, 30, 45, 60].map(min => (
                <button key={min} className="db-btn"
                  disabled={!!activeTimer}
                  onClick={() => onStartTimer(task.id, null, 'countdown', min * 60)}>{min}m</button>
              ))}
              <button className="db-btn db-btn-primary"
                disabled={!!activeTimer}
                onClick={() => onStartTimer(task.id, null, 'stopwatch')}>
                <Play size={12} fill="currentColor" /> Stopwatch
              </button>
              <button className="db-btn" onClick={() => setShowLogTimeModal({ subtaskId: null })}>
                <Plus size={12} /> Log time
              </button>
            </div>
            <CustomTimerInput disabled={!!activeTimer}
              onStart={(seconds) => onStartTimer(task.id, null, 'countdown', seconds)} />
          </>
        )}

        {/* Recent sessions across task + all subtasks */}
        <RecentSessions task={task} onDelete={onDeleteEntry} />
      </div>

      {/* Subtasks */}
      <Subtasks task={task} settings={settings} onUpdate={onUpdate}
        activeTimer={activeTimer} onStartTimer={onStartTimer} onStopTimer={onStopTimer}
        onOpenLogTime={(sid) => setShowLogTimeModal({ subtaskId: sid })} />

      {/* Comments */}
      <Comments task={task} onUpdate={onUpdate} />

      {confirmDelete && (
        <div className="db-modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-heading" style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Delete this task?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              This permanently removes the task, all subtasks, time entries, and comments. Consider archiving instead.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="db-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="db-btn db-btn-danger" style={{ background: 'var(--alert)', color: 'white', borderColor: 'var(--alert)' }}
                onClick={() => { onDelete(); setConfirmDelete(false); }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogTimeModal && (
        <LogTimeModal
          subtaskTitle={showLogTimeModal.subtaskId ? task.subtasks.find(s => s.id === showLogTimeModal.subtaskId)?.title : null}
          onClose={() => setShowLogTimeModal(null)}
          onLog={(min, date, note) => {
            onLogTime(task.id, showLogTimeModal.subtaskId, min, date, note);
            setShowLogTimeModal(null);
          }} />
      )}
    </div>
  );
}

// ============================================================================
// RECENT SESSIONS (task + all subtasks)
// ============================================================================
function RecentSessions({ task, onDelete }) {
  const entries = useMemo(() => {
    return getAllEntries(task)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 6);
  }, [task]);

  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: 12, fontSize: 12 }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Recent sessions</div>
      {entries.map(e => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              {formatDateTime(e.startedAt)}
              {e.manual && <span style={{ fontSize: 10, padding: '1px 5px', marginLeft: 6, background: 'var(--surface)', borderRadius: 8 }}>manual</span>}
            </div>
            {e.source === 'subtask' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {e.subtaskTitle}
              </div>
            )}
          </div>
          <span className="db-mono" style={{ marginRight: 8 }}>{formatDurationPrecise(e.seconds)}</span>
          <button onClick={() => onDelete(task.id, e.source === 'subtask' ? e.subtaskId : null, e.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            title="Delete entry"><X size={11} /></button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SUBTASKS (now with time tracking)
// ============================================================================
function Subtasks({ task, settings, onUpdate, activeTimer, onStartTimer, onStopTimer, onOpenLogTime }) {
  const [newTitle, setNewTitle] = useState('');

  const addSubtask = () => {
    if (!newTitle.trim()) return;
    onUpdate({ subtasks: [...task.subtasks, { id: uid(), title: newTitle.trim(), statusId: 'todo', timeEntries: [] }] });
    setNewTitle('');
  };

  const updateSubtask = (id, patch) => {
    onUpdate({ subtasks: task.subtasks.map(s => s.id === id ? { ...s, ...patch } : s) });
  };

  const removeSubtask = (id) => {
    if (activeTimer?.subtaskId === id) onStopTimer();
    onUpdate({ subtasks: task.subtasks.filter(s => s.id !== id) });
  };

  const doneCount = task.subtasks.filter(s => s.statusId === 'done').length;
  const progress = task.subtasks.length > 0 ? Math.round((doneCount / task.subtasks.length) * 100) : 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Subtasks {task.subtasks.length > 0 && <span style={{ textTransform: 'none' }}>· {doneCount}/{task.subtasks.length}</span>}
        </div>
        {task.subtasks.length > 0 && <span className="db-mono" style={{ fontSize: 12 }}>{progress}%</span>}
      </div>
      {task.subtasks.length > 0 && (
        <div className="db-progress-track" style={{ marginBottom: 10 }}>
          <div className="db-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {task.subtasks.map(sub => {
        const isDone = sub.statusId === 'done';
        const subSeconds = getSubtaskSeconds(sub);
        const isTimerHere = activeTimer?.taskId === task.id && activeTimer?.subtaskId === sub.id;
        const anyTimerActive = !!activeTimer;
        return (
          <div key={sub.id} style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`db-checkbox ${isDone ? 'db-checkbox-checked' : ''}`}
                onClick={() => updateSubtask(sub.id, { statusId: isDone ? 'todo' : 'done' })}>
                {isDone && <Check size={11} />}
              </div>
              <input value={sub.title} onChange={e => updateSubtask(sub.id, { title: e.target.value })}
                className="db-input"
                style={{ border: '1px solid transparent', background: 'transparent', padding: '2px 4px',
                  textDecoration: isDone ? 'line-through' : 'none',
                  color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }} />

              <StatusSelect value={sub.statusId} statuses={settings.statuses} size="small"
                themeMode={settings.themeMode}
                onChange={(v) => updateSubtask(sub.id, { statusId: v })} />

              <button onClick={() => isTimerHere ? onStopTimer() : (!anyTimerActive && onStartTimer(task.id, sub.id, 'stopwatch'))}
                disabled={anyTimerActive && !isTimerHere}
                style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                  color: isTimerHere ? 'var(--alert)' : 'var(--accent)',
                  cursor: anyTimerActive && !isTimerHere ? 'not-allowed' : 'pointer',
                  opacity: anyTimerActive && !isTimerHere ? 0.4 : 1, display: 'flex' }}
                title={isTimerHere ? 'Stop' : 'Start subtask timer'}>
                {isTimerHere ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              </button>

              <button onClick={() => onOpenLogTime(sub.id)} title="Log time manually"
                style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                <Plus size={12} />
              </button>

              <button onClick={() => removeSubtask(sub.id)}
                style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={12} />
              </button>
            </div>
            {subSeconds > 0 && (
              <div className="db-mono" style={{ fontSize: 11, color: 'var(--text-muted)',
                paddingLeft: 26, marginTop: 3 }}>
                <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                {formatDuration(subSeconds)}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSubtask()}
          placeholder="Add subtask..." className="db-input" />
        <button className="db-btn" onClick={addSubtask}><Plus size={12} /></button>
      </div>
    </div>
  );
}

// ============================================================================
// COMMENTS
// ============================================================================
function Comments({ task, onUpdate }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onUpdate({ comments: [...task.comments, { id: uid(), text: text.trim(), createdAt: new Date().toISOString() }] });
    setText('');
  };
  const remove = (id) => onUpdate({ comments: task.comments.filter(c => c.id !== id) });

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Activity log <span style={{ textTransform: 'none', color: 'var(--text-muted)' }}>· what you did, when</span>
      </div>
      {task.comments.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {[...task.comments].reverse().map(c => (
            <div key={c.id} style={{ padding: 10, background: 'var(--surface-alt)', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{renderMarkdown(c.text)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div className="db-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(c.createdAt)}</div>
                <button onClick={() => remove(c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="What did you work on? (Cmd+Enter to post)"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
        className="db-input" style={{ minHeight: 60, fontFamily: 'inherit' }} />
      <button className="db-btn db-btn-primary" onClick={submit} style={{ marginTop: 6 }}>Add entry</button>
    </div>
  );
}

// ============================================================================
// CUSTOM TIMER + LOG TIME MODAL
// ============================================================================
function CustomTimerInput({ onStart, disabled }) {
  const [minutes, setMinutes] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min="1" placeholder="Custom minutes" className="db-input"
        value={minutes} onChange={e => setMinutes(e.target.value)} style={{ width: 140 }} disabled={disabled} />
      <button className="db-btn" disabled={disabled || !minutes || minutes < 1}
        onClick={() => { onStart(Number(minutes) * 60); setMinutes(''); }}>Start</button>
    </div>
  );
}

function LogTimeModal({ subtaskTitle, onClose, onLog }) {
  const [minutes, setMinutes] = useState(30);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');

  return (
    <div className="db-modal-backdrop" onClick={onClose}>
      <div className="db-modal" onClick={e => e.stopPropagation()}>
        <div className="db-heading" style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Log time manually</div>
        {subtaskTitle && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            for subtask: <strong>{subtaskTitle}</strong>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration (minutes)</div>
          <input type="number" min="1" value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="db-input" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>When</div>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="db-input" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note (optional)</div>
          <input value={note} onChange={e => setNote(e.target.value)} className="db-input" placeholder="What did you do?" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="db-btn" onClick={onClose}>Cancel</button>
          <button className="db-btn db-btn-primary" onClick={() => onLog(minutes, new Date(date).toISOString(), note)}>
            Log {minutes}m
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================
function DashboardView({ tasks, settings, onSelectTask }) {
  const [range, setRange] = useState('month');
  const [granularity, setGranularity] = useState('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [labelFilter, setLabelFilter] = useState([]);
  const [chartGroup, setChartGroup] = useState('label');

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let s = new Date(0), e = new Date();
    if (range === 'week') s = startOfWeek(now);
    else if (range === 'month') s = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      s = new Date(now.getFullYear(), q * 3, 1);
    } else if (range === 'custom') {
      if (customStart) s = new Date(customStart);
      if (customEnd) e = new Date(customEnd);
    }
    return { startDate: s, endDate: e };
  }, [range, customStart, customEnd]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (t.archived) return false;
    if (labelFilter.length > 0 && !labelFilter.every(l => t.labels.includes(l))) return false;
    return true;
  }), [tasks, labelFilter]);

  const stats = useMemo(() => {
    let completedTasks = 0, totalSeconds = 0;
    const activeDays = new Set();
    filteredTasks.forEach(t => {
      getAllEntries(t).forEach(e => {
        const ed = new Date(e.startedAt);
        if (ed >= startDate && ed <= endDate) {
          totalSeconds += e.seconds;
          activeDays.add(ed.toDateString());
        }
      });
      if (t.statusId === 'done') {
        const all = getAllEntries(t);
        if (all.length > 0) {
          const last = all.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
          if (last && new Date(last.startedAt) >= startDate && new Date(last.startedAt) <= endDate) completedTasks++;
        }
      }
    });
    return { completedTasks, totalSeconds, activeDays: activeDays.size,
      avgSecondsPerTask: completedTasks > 0 ? totalSeconds / completedTasks : 0 };
  }, [filteredTasks, startDate, endDate]);

  const trendData = useMemo(() => {
    const buckets = {};
    const getKey = (date) => {
      const d = new Date(date);
      if (granularity === 'day') return d.toISOString().slice(0, 10);
      if (granularity === 'week') return startOfWeek(d).toISOString().slice(0, 10);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    filteredTasks.forEach(t => {
      getAllEntries(t).forEach(e => {
        const ed = new Date(e.startedAt);
        if (ed < startDate || ed > endDate) return;
        const k = getKey(ed);
        if (!buckets[k]) buckets[k] = { key: k, hours: 0, tasks: 0 };
        buckets[k].hours += e.seconds / 3600;
      });
      if (t.statusId === 'done') {
        const all = getAllEntries(t);
        if (all.length > 0) {
          const last = all.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
          const ed = new Date(last.startedAt);
          if (ed >= startDate && ed <= endDate) {
            const k = getKey(ed);
            if (!buckets[k]) buckets[k] = { key: k, hours: 0, tasks: 0 };
            buckets[k].tasks += 1;
          }
        }
      }
    });
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredTasks, startDate, endDate, granularity]);

  const barData = useMemo(() => {
    if (chartGroup === 'label') {
      const totals = {};
      settings.labels.forEach(l => { totals[l.id] = { name: l.name, color: l.color, seconds: 0 }; });
      totals['_unlabeled'] = { name: 'no label', color: '#9AA3AD', seconds: 0 };
      filteredTasks.forEach(t => {
        const taskSeconds = getAllEntries(t)
          .filter(e => { const d = new Date(e.startedAt); return d >= startDate && d <= endDate; })
          .reduce((s, e) => s + e.seconds, 0);
        if (t.labels.length === 0) totals['_unlabeled'].seconds += taskSeconds;
        else t.labels.forEach(lid => { if (totals[lid]) totals[lid].seconds += taskSeconds / t.labels.length; });
      });
      return Object.values(totals).filter(t => t.seconds > 0).sort((a, b) => b.seconds - a.seconds);
    } else {
      return filteredTasks.map((t, i) => {
        const s = getAllEntries(t)
          .filter(e => { const d = new Date(e.startedAt); return d >= startDate && d <= endDate; })
          .reduce((sum, e) => sum + e.seconds, 0);
        return { name: t.title, color: THEME.chart[i % THEME.chart.length], seconds: s };
      }).filter(t => t.seconds > 0).sort((a, b) => b.seconds - a.seconds).slice(0, 10);
    }
  }, [filteredTasks, startDate, endDate, chartGroup, settings.labels]);

  // Milestone progress chart data — tasks with subtasks only, descending
  const milestoneData = useMemo(() => {
    return filteredTasks
      .filter(t => t.subtasks.length > 0)
      .map(t => {
        const done = t.subtasks.filter(s => s.statusId === 'done').length;
        const pct = Math.round((done / t.subtasks.length) * 100);
        return { name: t.title, pct, done, total: t.subtasks.length, statusId: t.statusId };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [filteredTasks]);

  const maxTrend = Math.max(...trendData.map(d => Math.max(d.hours, d.tasks)), 1);
  const maxBar = Math.max(...barData.map(d => d.seconds), 1);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={range} onChange={e => setRange(e.target.value)} className="db-input" style={{ width: 'auto' }}>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="all">All time</option>
          <option value="custom">Custom</option>
        </select>
        {range === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="db-input" style={{ width: 'auto' }} />
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="db-input" style={{ width: 'auto' }} />
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Group by</span>
          {['day', 'week', 'month'].map(g => (
            <button key={g} className={`db-btn ${granularity === g ? 'db-btn-primary' : ''}`}
              onClick={() => setGranularity(g)} style={{ padding: '5px 10px', fontSize: 12 }}>{g}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="Tasks completed" value={stats.completedTasks} />
        <StatCard label="Total time" value={formatDuration(stats.totalSeconds)} />
        <StatCard label="Avg / task" value={formatDuration(stats.avgSecondsPerTask)} />
        <StatCard label="Active days" value={stats.activeDays} />
      </div>

      <div className="db-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="db-heading" style={{ fontSize: 16, fontWeight: 500 }}>Activity over time</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 2, background: 'var(--accent)', marginRight: 4, verticalAlign: 'middle' }} />hours</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#C9A961', marginRight: 4, verticalAlign: 'middle', borderRadius: 1 }} />tasks done</span>
          </div>
        </div>
        {trendData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No activity in this range</div>
        ) : <TrendChart data={trendData} maxValue={maxTrend} />}
      </div>

      <div className="db-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div className="db-heading" style={{ fontSize: 16, fontWeight: 500 }}>Time spent by {chartGroup}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`db-btn ${chartGroup === 'label' ? 'db-btn-primary' : ''}`} onClick={() => setChartGroup('label')} style={{ padding: '5px 10px', fontSize: 12 }}>Label</button>
            <button className={`db-btn ${chartGroup === 'task' ? 'db-btn-primary' : ''}`} onClick={() => setChartGroup('task')} style={{ padding: '5px 10px', fontSize: 12 }}>Task</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Includes time logged on subtasks rolled into parent
        </div>
        {barData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {barData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 140, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                <div style={{ flex: 1, height: 22, background: 'var(--surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(d.seconds / maxBar) * 100}%`, height: '100%', background: d.color, transition: 'width 0.4s' }} />
                </div>
                <div className="db-mono" style={{ width: 70, textAlign: 'right', fontSize: 12 }}>{formatDuration(d.seconds)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestone progress chart */}
      <div className="db-card" style={{ padding: 20 }}>
        <div className="db-heading" style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Milestone progress</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Tasks with subtasks only, sorted by % complete (closest to 100% on top)
        </div>
        {milestoneData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            No tasks with subtasks yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {milestoneData.map((d, i) => {
              const statusColor = getStatusColor(settings.statuses.find(s => s.id === d.statusId)?.color, settings.themeMode);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 4, height: 22, background: statusColor, borderRadius: 2 }} />
                  <div style={{ width: 160, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ flex: 1, height: 22, background: 'var(--surface-alt)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span className="db-mono" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.pct}%</span>
                    <span style={{ marginLeft: 4 }}>· {d.done}/{d.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timesheet section — embedded at bottom of dashboard */}
      <div style={{ marginTop: 28 }}>
        <div className="db-heading" style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Timesheet</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Daily time tracked per task. Expand a row to see subtasks. Click any cell to see the sessions behind that total.
        </div>
        <TimesheetView tasks={tasks} settings={settings} onSelectTask={onSelectTask} />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="db-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div className="db-heading db-mono" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function TrendChart({ data, maxValue }) {
  const w = 700, h = 200, padX = 40, padY = 20;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  if (data.length === 0) return null;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padX + i * xStep,
    yHours: padY + innerH - (d.hours / maxValue) * innerH,
    yTasks: padY + innerH - (d.tasks / maxValue) * innerH,
    d,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yHours}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxHeight: 260 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={padX} x2={w - padX} y1={padY + innerH * p} y2={padY + innerH * p}
          stroke="var(--border)" strokeDasharray="2 4" />
      ))}
      {points.map((p, i) => {
        const barH = (p.d.tasks / maxValue) * innerH;
        return <rect key={i} x={p.x - 6} y={padY + innerH - barH} width={12} height={barH} fill="#C9A961" opacity={0.6} rx={2} />;
      })}
      <path d={areaPath} fill="var(--accent)" opacity={0.1} />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.yHours} r={3} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5} />
      ))}
      {points.map((p, i) => {
        if (data.length > 10 && i % Math.ceil(data.length / 8) !== 0) return null;
        return (
          <text key={i} x={p.x} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="JetBrains Mono">
            {p.d.key.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================================================
// TIMESHEET VIEW
// ============================================================================
function TimesheetView({ tasks, settings, onSelectTask }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [cellDetail, setCellDetail] = useState(null); // { taskId, subtaskId, date, sessions }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 6);
  const timeMap = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.archived) return;
      // Direct task entries
      t.timeEntries.forEach(e => {
        const ed = new Date(e.startedAt);
        if (ed < weekStart || ed > addDays(weekEnd, 1)) return;
        const day = days.findIndex(d => sameDay(d, ed));
        if (day < 0) return;
        const k = `${t.id}|null|${day}`;
        if (!map[k]) map[k] = { seconds: 0, sessions: [] };
        map[k].seconds += e.seconds;
        map[k].sessions.push({ ...e, taskTitle: t.title });
      });
      // Subtask entries
      t.subtasks.forEach(s => {
        (s.timeEntries || []).forEach(e => {
          const ed = new Date(e.startedAt);
          if (ed < weekStart || ed > addDays(weekEnd, 1)) return;
          const day = days.findIndex(d => sameDay(d, ed));
          if (day < 0) return;
          const k = `${t.id}|${s.id}|${day}`;
          if (!map[k]) map[k] = { seconds: 0, sessions: [] };
          map[k].seconds += e.seconds;
          map[k].sessions.push({ ...e, taskTitle: t.title, subtaskTitle: s.title });
        });
      });
    });
    return map;
  }, [tasks, weekStart, days]);

  // Tasks visible in timesheet = those with any time in this week
  const visibleTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.archived) return false;
      for (let d = 0; d < 7; d++) {
        if (timeMap[`${t.id}|null|${d}`]) return true;
        for (const s of t.subtasks) if (timeMap[`${t.id}|${s.id}|${d}`]) return true;
      }
      return false;
    });
  }, [tasks, timeMap]);

  const getTaskDaySeconds = (taskId, day) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return 0;
    let total = (timeMap[`${taskId}|null|${day}`]?.seconds || 0);
    t.subtasks.forEach(s => { total += (timeMap[`${taskId}|${s.id}|${day}`]?.seconds || 0); });
    return total;
  };
  const getTaskWeekSeconds = (taskId) =>
    Array.from({ length: 7 }, (_, d) => getTaskDaySeconds(taskId, d)).reduce((a, b) => a + b, 0);
  const getSubtaskDaySeconds = (taskId, subtaskId, day) => timeMap[`${taskId}|${subtaskId}|${day}`]?.seconds || 0;
  const getDayTotalSeconds = (day) => visibleTasks.reduce((sum, t) => sum + getTaskDaySeconds(t.id, day), 0);
  const weekTotalSeconds = Array.from({ length: 7 }, (_, d) => getDayTotalSeconds(d)).reduce((a, b) => a + b, 0);

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const todayIdx = days.findIndex(d => sameDay(d, new Date()));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button className="db-btn" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={14} /></button>
        <div className="db-heading" style={{ fontSize: 18, fontWeight: 500, minWidth: 260, textAlign: 'center' }}>
          {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' → '}
          {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button className="db-btn" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={14} /></button>
        <button className="db-btn" onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ marginLeft: 6 }}>This week</button>
        <input type="date" className="db-input" style={{ width: 160, marginLeft: 'auto' }}
          value={weekStart.toISOString().slice(0,10)}
          onChange={e => e.target.value && setWeekStart(startOfWeek(new Date(e.target.value)))} />
      </div>

      {visibleTasks.length === 0 ? (
        <div className="db-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No time tracked this week
        </div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table className="db-ts-grid">
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Task</th>
                {days.map((d, i) => (
                  <th key={i} style={{
                    minWidth: 80,
                    background: i === todayIdx ? hexToRgba(getStatusColor('todo', settings.themeMode), 0.15) : 'var(--surface-alt)',
                  }}>
                    <div style={{ fontSize: 11 }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="db-mono" style={{ fontSize: 11, opacity: 0.7 }}>{d.getDate()}/{d.getMonth() + 1}</div>
                  </th>
                ))}
                <th style={{ minWidth: 80 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map(t => {
                const expanded = expandedTasks.has(t.id);
                const hasSubtasksWithTime = t.subtasks.some(s =>
                  Array.from({length:7}, (_,d) => getSubtaskDaySeconds(t.id, s.id, d)).some(x => x > 0));
                return (
                  <React.Fragment key={t.id}>
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasSubtasksWithTime ? (
                            <button onClick={() => toggleExpand(t.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-secondary)' }}>
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : <div style={{ width: 18 }} />}
                          <span onClick={() => onSelectTask(t.id)}
                            style={{ cursor: 'pointer', fontWeight: 500 }}>{t.title}</span>
                        </div>
                      </td>
                      {days.map((d, i) => {
                        const sec = getTaskDaySeconds(t.id, i);
                        return (
                          <td key={i}
                            className={sec > 0 ? 'db-ts-cell-clickable' : ''}
                            onClick={() => {
                              if (sec === 0) return;
                              // Collect all sessions in this cell (parent + all subtasks)
                              const sessions = [
                                ...(timeMap[`${t.id}|null|${i}`]?.sessions || []),
                                ...t.subtasks.flatMap(s => timeMap[`${t.id}|${s.id}|${i}`]?.sessions || []),
                              ];
                              setCellDetail({ taskTitle: t.title, date: d, sessions });
                            }}>
                            <span className="db-mono" style={{ color: sec > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {sec > 0 ? formatDuration(sec) : '·'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="db-ts-total db-mono">{formatDuration(getTaskWeekSeconds(t.id))}</td>
                    </tr>
                    {expanded && t.subtasks.map(s => {
                      const subHasTime = Array.from({length:7}, (_,d) => getSubtaskDaySeconds(t.id, s.id, d)).some(x => x > 0);
                      if (!subHasTime) return null;
                      return (
                        <tr key={s.id} className="db-ts-subrow">
                          <td>↳ {s.title}</td>
                          {days.map((d, i) => {
                            const sec = getSubtaskDaySeconds(t.id, s.id, i);
                            return (
                              <td key={i}
                                className={sec > 0 ? 'db-ts-cell-clickable' : ''}
                                onClick={() => {
                                  if (sec === 0) return;
                                  setCellDetail({ taskTitle: `${t.title} → ${s.title}`, date: d,
                                    sessions: timeMap[`${t.id}|${s.id}|${i}`]?.sessions || [] });
                                }}>
                                <span className="db-mono" style={{ color: sec > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                  {sec > 0 ? formatDuration(sec) : '·'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="db-ts-total db-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {formatDuration(Array.from({length:7}, (_,d) => getSubtaskDaySeconds(t.id, s.id, d)).reduce((a,b) => a+b, 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              <tr>
                <td className="db-ts-total">Daily total</td>
                {days.map((d, i) => (
                  <td key={i} className="db-ts-total db-mono">{formatDuration(getDayTotalSeconds(i))}</td>
                ))}
                <td className="db-ts-total db-mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>
                  {formatDuration(weekTotalSeconds)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {cellDetail && (
        <div className="db-modal-backdrop" onClick={() => setCellDetail(null)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-heading" style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
              {cellDetail.taskTitle}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              {cellDetail.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {cellDetail.sessions.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt)).map(s => (
              <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13 }}>
                    {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {s.manual && <span style={{ fontSize: 10, padding: '1px 5px', marginLeft: 6,
                      background: 'var(--surface-alt)', borderRadius: 8 }}>manual</span>}
                  </div>
                  {s.note && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.note}</div>}
                </div>
                <span className="db-mono" style={{ fontSize: 13, fontWeight: 500 }}>{formatDurationPrecise(s.seconds)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-strong)' }}>
              <strong>Total</strong>
              <span className="db-mono" style={{ fontWeight: 600 }}>
                {formatDurationPrecise(cellDetail.sessions.reduce((a, s) => a + s.seconds, 0))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="db-btn" onClick={() => setCellDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SETTINGS VIEW
// ============================================================================
function SettingsView({ settings, setSettings, tasks, setTasks }) {
  const exportData = () => {
    const data = { tasks, settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `daybook-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (confirm('This will replace ALL your current data. Continue?')) {
          if (data.tasks) setTasks(migrateTasks(data.tasks));
          if (data.settings) setSettings(data.settings);
        }
      } catch { alert('Invalid file'); }
    };
    reader.readAsText(file);
  };
  const requestBrowserPush = async () => {
    if (!('Notification' in window)) { alert('Browser notifications not supported'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setSettings({ ...settings, notifications: { ...settings.notifications, browserPush: true }});
      new Notification('Notifications enabled', { body: "You'll get reminders here." });
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="db-heading" style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Settings</div>

      <Section title="Appearance" subtitle="Heading font shown across the app">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FONT_OPTIONS.map(f => (
            <label key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              border: `1px solid ${settings.headingFont === f.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, cursor: 'pointer',
              background: settings.headingFont === f.id ? 'var(--accent-soft)' : 'var(--surface)',
            }}>
              <input type="radio" checked={settings.headingFont === f.id}
                onChange={() => setSettings({ ...settings, headingFont: f.id })} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: f.stack, fontSize: 20, fontWeight: 500 }}>
                  {f.name} — Tasks 2026 v3
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{f.description}</div>
              </div>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Overload & reminders" subtitle="Tells you when you're doing too much or letting things rot">
        <ThresholdRow label="Max active tasks per week" value={settings.thresholds.tasksPerWeek}
          onChange={v => setSettings({ ...settings, thresholds: { ...settings.thresholds, tasksPerWeek: v }})} suffix="tasks" />
        <ThresholdRow label="Max hours logged per week" value={settings.thresholds.hoursPerWeek}
          onChange={v => setSettings({ ...settings, thresholds: { ...settings.thresholds, hoursPerWeek: v }})} suffix="hours" />
        <ThresholdRow label="Inactivity reminder" value={settings.thresholds.inactivityDays}
          onChange={v => setSettings({ ...settings, thresholds: { ...settings.thresholds, inactivityDays: v }})} suffix="days without time tracked" />
        <ThresholdRow label="Deadline warning" value={settings.thresholds.deadlineWarningDays}
          onChange={v => setSettings({ ...settings, thresholds: { ...settings.thresholds, deadlineWarningDays: v }})} suffix="days before due" />
      </Section>

      <Section title="Notifications">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Browser push notifications</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {settings.notifications.browserPush ? 'Enabled' : 'Disabled — click to enable'}
            </div>
          </div>
          {!settings.notifications.browserPush ? (
            <button className="db-btn" onClick={requestBrowserPush}>Enable</button>
          ) : (
            <button className="db-btn" onClick={() => setSettings({ ...settings, notifications: { ...settings.notifications, browserPush: false }})}>Disable</button>
          )}
        </div>
      </Section>

      <Section title="Statuses" subtitle="Rename to fit your workflow. Colors are fixed by position.">
        {settings.statuses.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: getStatusColor(s.color, settings.themeMode) }} />
            <input className="db-input" value={s.name} onChange={e => {
              const next = [...settings.statuses];
              next[i] = { ...s, name: e.target.value };
              setSettings({ ...settings, statuses: next });
            }} />
          </div>
        ))}
      </Section>

      <LabelsManager labels={settings.labels} onChange={(labels) => setSettings({ ...settings, labels })} />

      <Section title="Data" subtitle="Backup your tasks or import from a previous export">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="db-btn" onClick={exportData}><Download size={13} /> Export JSON</button>
          <label className="db-btn" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Import JSON
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 30, paddingBottom: 22, borderBottom: '1px solid var(--border)' }}>
      <div className="db-heading" style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function ThresholdRow({ label, value, onChange, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <div style={{ fontSize: 13 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min="1" value={value} onChange={e => onChange(Number(e.target.value))}
          className="db-input" style={{ width: 70, textAlign: 'center' }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 200 }}>{suffix}</span>
      </div>
    </div>
  );
}

function LabelsManager({ labels, onChange }) {
  const palette = ['#5F7C68', '#5B7A99', '#C9A961', '#8B2438', '#B8825C', '#6B7280', '#8F7CA3', '#7A9A88', '#9AA3AD'];
  const [newName, setNewName] = useState('');

  const add = () => {
    if (!newName.trim()) return;
    onChange([...labels, { id: uid(), name: newName.trim(), color: palette[labels.length % palette.length] }]);
    setNewName('');
  };

  return (
    <Section title="Labels" subtitle="Use for context (work/personal), state (blocked/paused), or any tag">
      {labels.map((l, i) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {palette.map(c => (
              <button key={c} onClick={() => {
                const next = [...labels]; next[i] = { ...l, color: c }; onChange(next);
              }} style={{
                width: 16, height: 16, borderRadius: '50%', background: c,
                border: l.color === c ? '2px solid var(--text-primary)' : '1px solid var(--border)',
                cursor: 'pointer',
              }} />
            ))}
          </div>
          <input value={l.name} onChange={e => {
            const next = [...labels]; next[i] = { ...l, name: e.target.value }; onChange(next);
          }} className="db-input" />
          <button className="db-btn db-btn-danger" style={{ padding: 6 }} onClick={() => onChange(labels.filter(x => x.id !== l.id))}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="New label name..." className="db-input" />
        <button className="db-btn" onClick={add}><Plus size={12} /> Add</button>
      </div>
    </Section>
  );
}

// ============================================================================
// ARCHIVE VIEW
// ============================================================================
function ArchiveView({ tasks, onUnarchive, onDelete, onSelect, settings }) {
  const archived = tasks.filter(t => t.archived);
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="db-heading" style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>Archive</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>
        Tasks you've archived. They don't show on the board or count in the dashboard.
      </div>
      {archived.length === 0 ? (
        <div className="db-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No archived tasks yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {archived.map(t => {
            const total = getTotalSeconds(t);
            const status = settings.statuses.find(s => s.id === t.statusId);
            return (
              <div key={t.id} className="db-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusColor(status?.color, settings.themeMode) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {status?.name} · {formatDuration(total)}
                  </div>
                </div>
                <button className="db-btn" onClick={() => onUnarchive(t.id)}><ArchiveRestore size={12} /> Restore</button>
                <button className="db-btn db-btn-danger" onClick={() => { if (confirm('Delete permanently?')) onDelete(t.id); }}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
