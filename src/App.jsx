import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Calendar, 
  Plus, 
  Settings, 
  Layers, 
  LayoutGrid, 
  X, 
  Trash2, 
  Edit2, 
  Clock, 
  AlignLeft, 
  AlignCenter,
  AlignRight,
  CalendarDays,
  Check,
  ArrowLeft,
  FolderTree,
  CheckSquare,
  Copy,
  Paperclip,
  CheckCircle,
  FileText,
  BarChart2,
  Users,
  MessageSquare,
  Lock,
  Search,
  Filter,
  Link as LinkIcon,
  Target,
  Activity,
  ChevronDown,
  MoreHorizontal,
  RefreshCw,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Flag,
  LogOut,
  Loader2,
  Maximize2,
  Minimize2,
  Table2,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease
} from 'lucide-react';

// --- Constants & Helpers ---
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const DAYS_OF_WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const PROJECT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-800', lightBg: 'bg-blue-100', border: 'border-blue-200' },
  { bg: 'bg-red-500', text: 'text-red-800', lightBg: 'bg-red-100', border: 'border-red-200' },
  { bg: 'bg-green-500', text: 'text-green-800', lightBg: 'bg-green-100', border: 'border-green-200' },
  { bg: 'bg-purple-500', text: 'text-purple-800', lightBg: 'bg-purple-100', border: 'border-purple-200' },
  { bg: 'bg-orange-500', text: 'text-orange-800', lightBg: 'bg-orange-100', border: 'border-orange-200' },
  { bg: 'bg-pink-500', text: 'text-pink-800', lightBg: 'bg-pink-100', border: 'border-pink-200' },
  { bg: 'bg-teal-500', text: 'text-teal-800', lightBg: 'bg-teal-100', border: 'border-teal-200' },
];
const PROJECT_COLOR_HEX = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];
const getProjectColorHexByIndex = (index) =>
  PROJECT_COLOR_HEX[Number.isFinite(Number(index)) ? Number(index) : 0] || PROJECT_COLOR_HEX[0];

const generateId = () => Math.random().toString(36).substr(2, 9);
const AUTH_USER_KEY = 'pm_calendar_auth_user';
const AUTH_USERS_KEY = 'pm_calendar_users';
const ACCOUNT_DB_PREFIX = 'pm_calendar_db_';
const PROJECT_INVITES_KEY = 'pm_calendar_project_invites';
const PROJECT_INVITE_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};
const VALID_PROJECT_INVITE_STATUSES = new Set(Object.values(PROJECT_INVITE_STATUSES));
const STARTUP_VIEW_MODES = {
  CALENDAR: 'calendar',
  PROJECT: 'project',
  LAST: 'last',
};
const VALID_STARTUP_VIEWS = new Set(Object.values(STARTUP_VIEW_MODES));
const PROJECT_DASHBOARD_TABS = ['organization', 'tasks', 'team', 'notes', 'announcements'];
const DEFAULT_PROJECT_DASHBOARD_TAB = PROJECT_DASHBOARD_TABS[0];
const PROJECT_DASHBOARD_TAB_SET = new Set(PROJECT_DASHBOARD_TABS);
const DEFAULT_LAST_VISITED_VIEW = {
  type: STARTUP_VIEW_MODES.CALENDAR,
  projectId: null,
  projectTab: DEFAULT_PROJECT_DASHBOARD_TAB,
  profileOpen: false,
  projectManagerOpen: false,
};
const normalizeProjectDashboardTab = (value) =>
  PROJECT_DASHBOARD_TAB_SET.has(value) ? value : DEFAULT_PROJECT_DASHBOARD_TAB;
const normalizeProjectJoinCodeSecret = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const hashToBase36 = (value) => {
  const source = String(value || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase();
};
const deriveProjectJoinCodeSecret = (project) => {
  const ownerId = String(project?.ownerId || '').trim();
  const projectId = String(project?.id || '').trim();
  const base = hashToBase36(`${ownerId}|${projectId}`).replace(/[^A-Z0-9]/g, '');
  return base.padEnd(8, '0').slice(0, 8);
};
const ensureProjectJoinCodeSecret = (project) => {
  const explicitSecret = normalizeProjectJoinCodeSecret(project?.joinCodeSecret);
  if (explicitSecret) return explicitSecret.slice(0, 16);
  return deriveProjectJoinCodeSecret(project);
};
const generateProjectJoinCodeSecret = () => {
  const randomLeft = Math.random().toString(36).slice(2, 8).toUpperCase();
  const randomRight = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${randomLeft}${randomRight}`.slice(0, 12);
};
const buildProjectJoinCode = (project) => {
  const ownerId = String(project?.ownerId || '').trim();
  const projectId = String(project?.id || '').trim();
  const secret = ensureProjectJoinCodeSecret(project);
  if (!ownerId || !projectId || !secret) return '';
  return `PJC.${ownerId}.${projectId}.${secret}`;
};
const parseProjectJoinCode = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, '');
  if (!normalized) return null;
  const segments = normalized.split('.');
  if (segments.length !== 4) return null;
  const [prefixRaw, ownerIdRaw, projectIdRaw, secretRaw] = segments;
  const prefix = String(prefixRaw || '').trim().toUpperCase();
  const ownerId = String(ownerIdRaw || '').trim();
  const projectId = String(projectIdRaw || '').trim();
  const secret = normalizeProjectJoinCodeSecret(secretRaw);
  if (prefix !== 'PJC' || !ownerId || !projectId || !secret) return null;
  return { ownerId, projectId, secret };
};
const PROJECT_STATUS_LABELS = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
};
const PROJECT_STATUS_HIGHLIGHTS = {
  on_track: {
    tone: 'positive',
    priorityLabel: 'Stable',
    prompt: '"ดีมากเลย วันนี้คืบหน้าอีกนิด พรุ่งนี้จะเบาขึ้นเยอะนะ"',
  },
  at_risk: {
    tone: 'warning',
    priorityLabel: 'Needs Attention',
    prompt: '"ไม่เป็นไรน้า ค่อยๆ แก้ทีละจุด เดี๋ยวทุกอย่างกลับมาเข้าที่"',
  },
  off_track: {
    tone: 'critical',
    priorityLabel: 'Critical',
    prompt: '"พักหายใจลึกๆ แล้วเริ่มจากเรื่องสำคัญสุดก่อนนะ เรายังกลับมาได้เสมอ"',
  },
};
const PROJECT_STATUS_TONE_STYLES = {
  positive: {
    unseenCard: 'border-emerald-300 bg-emerald-50/80',
    unseenTitle: 'text-emerald-900',
    unseenSubtitle: 'text-emerald-800',
    unseenTime: 'text-emerald-600',
    seenCard: 'border-emerald-200 bg-emerald-50/40',
    seenTitle: 'text-emerald-900',
    seenSubtitle: 'text-emerald-700',
    seenTime: 'text-emerald-500',
    logCard: 'border-emerald-200 bg-emerald-50',
    logTitle: 'text-emerald-900',
    logSubtitle: 'text-emerald-800',
    badge: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  },
  warning: {
    unseenCard: 'border-amber-300 bg-amber-50/85',
    unseenTitle: 'text-amber-900',
    unseenSubtitle: 'text-amber-800',
    unseenTime: 'text-amber-600',
    seenCard: 'border-amber-200 bg-amber-50/45',
    seenTitle: 'text-amber-900',
    seenSubtitle: 'text-amber-700',
    seenTime: 'text-amber-500',
    logCard: 'border-amber-200 bg-amber-50',
    logTitle: 'text-amber-900',
    logSubtitle: 'text-amber-800',
    badge: 'border-amber-300 bg-amber-100 text-amber-800',
  },
  critical: {
    unseenCard: 'border-rose-300 bg-rose-50/85',
    unseenTitle: 'text-rose-900',
    unseenSubtitle: 'text-rose-800',
    unseenTime: 'text-rose-600',
    seenCard: 'border-rose-200 bg-rose-50/45',
    seenTitle: 'text-rose-900',
    seenSubtitle: 'text-rose-700',
    seenTime: 'text-rose-500',
    logCard: 'border-rose-200 bg-rose-50',
    logTitle: 'text-rose-900',
    logSubtitle: 'text-rose-800',
    badge: 'border-rose-300 bg-rose-100 text-rose-800',
  },
  neutral: {
    unseenCard: 'border-blue-200 bg-blue-50/70',
    unseenTitle: 'text-blue-900',
    unseenSubtitle: 'text-blue-700',
    unseenTime: 'text-blue-500',
    seenCard: 'border-slate-200 bg-white',
    seenTitle: 'text-slate-700',
    seenSubtitle: 'text-slate-500',
    seenTime: 'text-slate-400',
    logCard: 'border-gray-200 bg-gray-50',
    logTitle: 'text-gray-800',
    logSubtitle: 'text-gray-600',
    badge: 'border-slate-300 bg-slate-100 text-slate-700',
  },
};
const getProjectStatusToneStyles = (tone) =>
  PROJECT_STATUS_TONE_STYLES[tone] || PROJECT_STATUS_TONE_STYLES.neutral;
const PROJECT_ACTIVITY_TYPES = {
  EVENT_CREATED: 'event_created',
  TASK_CREATED: 'task_created',
  MEMBER_JOINED: 'member_joined',
  PROJECT_STATUS_CHANGED: 'project_status_changed',
  ANNOUNCEMENT: 'announcement',
};
const PROJECT_ACTIVITY_TYPE_SET = new Set(Object.values(PROJECT_ACTIVITY_TYPES));
const PROJECT_ACTIVITY_POPUP_TYPES = new Set([
  PROJECT_ACTIVITY_TYPES.EVENT_CREATED,
  PROJECT_ACTIVITY_TYPES.TASK_CREATED,
  PROJECT_ACTIVITY_TYPES.MEMBER_JOINED,
  PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED,
  PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT,
]);
const MAX_PROJECT_ACTIVITY_FEED = 280;
const PROJECT_UPDATE_POPUP_MODES = {
  NEW_ONLY: 'new_only',
  ALWAYS: 'always',
};
const PROJECT_UPDATE_TOAST_AUTO_CLOSE_MS = 5000;
const PROJECT_UPDATE_TOAST_EXIT_MS = 280;
const COLLABORATIVE_REFRESH_INTERVAL_MS = 5000;
const VALID_PROJECT_UPDATE_POPUP_MODES = new Set(Object.values(PROJECT_UPDATE_POPUP_MODES));
const DEFAULT_PROJECT_UPDATE_POPUP_MODE = PROJECT_UPDATE_POPUP_MODES.NEW_ONLY;
const normalizeProjectActivityEntry = (entry, fallbackProject = null) => {
  const type = PROJECT_ACTIVITY_TYPE_SET.has(entry?.type)
    ? entry.type
    : PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT;
  const createdAtValue = String(entry?.createdAt || '').trim();
  const createdAt = createdAtValue && !Number.isNaN(new Date(createdAtValue).getTime())
    ? createdAtValue
    : new Date().toISOString();
  const projectId =
    String(entry?.projectId || '').trim() ||
    String(fallbackProject?.id || '').trim();
  const projectName =
    String(entry?.projectName || '').trim() ||
    String(fallbackProject?.name || '').trim();

  return {
    id: String(entry?.id || generateId()).trim(),
    type,
    createdAt,
    projectId,
    projectName,
    actorId: String(entry?.actorId || '').trim(),
    actorUsername: String(entry?.actorUsername || '').trim().toLowerCase(),
    title: String(entry?.title || '').trim(),
    message: String(entry?.message || '').trim(),
    meta:
      entry?.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta)
        ? entry.meta
        : {},
  };
};
const normalizeProjectActivityFeed = (feed, fallbackProject = null) =>
  (Array.isArray(feed) ? feed : [])
    .map((entry) => normalizeProjectActivityEntry(entry, fallbackProject))
    .filter((entry) => entry.id && entry.projectId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
const appendProjectActivityEntryToProject = (project, entryInput) => {
  if (!project) return project;
  const normalizedEntry = normalizeProjectActivityEntry(
    {
      ...entryInput,
      id: entryInput?.id || generateId(),
      createdAt: entryInput?.createdAt || new Date().toISOString(),
      projectId: entryInput?.projectId || project.id,
      projectName: entryInput?.projectName || project.name,
    },
    project
  );
  const existingFeed = normalizeProjectActivityFeed(project.changeFeed, project).filter(
    (entry) => entry.id !== normalizedEntry.id
  );
  const nextFeed = [normalizedEntry, ...existingFeed].slice(0, MAX_PROJECT_ACTIVITY_FEED);
  return {
    ...project,
    changeFeed: nextFeed,
  };
};
const toLocalDayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};
const formatProjectActivityTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const stripWrappingQuotes = (value) => {
  const raw = String(value || '').trim();
  return raw.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
};
const formatDateDayMonthYear = (value) => {
  const raw = String(value || '').trim();
  const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return raw;
  const [, year, month, day] = matched;
  return `${day}/${month}/${year}`;
};
const formatActivityDateWindow = ({ startDate, startTime, endDate, endTime, showTime = true }) => {
  const safeStartDate = String(startDate || '').trim();
  const safeEndDate = String(endDate || '').trim();
  const displayStartDate = formatDateDayMonthYear(safeStartDate);
  const displayEndDate = formatDateDayMonthYear(safeEndDate);
  const safeStartTime = String(startTime || '').trim();
  const safeEndTime = String(endTime || '').trim();
  if (!safeStartDate && !safeEndDate && !safeStartTime && !safeEndTime) return '';

  if (safeStartDate && safeEndDate && safeStartDate !== safeEndDate) {
    if (!showTime) return `${displayStartDate} - ${displayEndDate}`;
    return `${displayStartDate} ${safeStartTime || '--:--'} - ${displayEndDate} ${safeEndTime || '--:--'}`.trim();
  }

  const baseDate = displayStartDate || displayEndDate;
  if (showTime && (safeStartTime || safeEndTime)) {
    return `${baseDate} ${safeStartTime || '--:--'} - ${safeEndTime || '--:--'}`.trim();
  }
  return baseDate;
};
const NOTE_DOCUMENT_SERIALIZATION_PREFIX = '__PM_NOTE_DOC_V2__';
const NOTE_IMAGE_CLIPBOARD_PREFIX = '__PM_NOTE_IMAGE__::';
const DEFAULT_NOTE_DOC_PAGE_TITLE = 'Doc 1';
const DEFAULT_NOTE_SHEET_PAGE_TITLE = 'Sheet 1';
const DEFAULT_NOTE_SHEET_ROWS = 30;
const DEFAULT_NOTE_SHEET_COLS = 12;
const DOC_COLOR_PRESETS = [
  '#000000', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7', '#f4f4f5',
  '#7f1d1d', '#dc2626', '#fb923c', '#facc15', '#22c55e', '#2dd4bf', '#3b82f6', '#1d4ed8',
  '#9333ea', '#d946ef',
  '#fca5a5', '#fda4af', '#fdba74', '#fde68a', '#86efac', '#99f6e4', '#93c5fd', '#a5b4fc',
  '#c4b5fd', '#f5d0fe',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6',
  '#b91c1c', '#c2410c', '#d97706', '#ca8a04', '#65a30d', '#15803d', '#0e7490', '#1d4ed8',
  '#4338ca', '#7e22ce',
  '#7f1d1d', '#9a3412', '#92400e', '#854d0e', '#365314', '#14532d', '#164e63', '#1e3a8a',
  '#312e81', '#581c87',
];
const DEPARTMENT_COLOR_PRESETS = Array.from(new Set(DOC_COLOR_PRESETS)).slice(0, 24);
const DOC_FONT_SIZE_OPTIONS = ['10', '11', '12', '13', '14', '16', '18', '20', '22', '24', '28', '32', '36', '40', '48', '56', '64', '72'];
const DOC_FONT_FAMILY_GROUPS = [
  {
    label: 'Popular',
    options: [
      { value: 'Arial', label: 'Arial', cssFamily: 'Arial, sans-serif' },
      { value: 'Tahoma', label: 'Tahoma', cssFamily: 'Tahoma, sans-serif' },
      { value: 'Georgia', label: 'Georgia', cssFamily: 'Georgia, serif' },
      { value: 'Times New Roman', label: 'Times New Roman', cssFamily: '"Times New Roman", serif' },
      { value: 'Inter', label: 'Inter', cssFamily: '"Inter", sans-serif' },
      { value: 'Roboto', label: 'Roboto', cssFamily: '"Roboto", sans-serif' },
      { value: 'Open Sans', label: 'Open Sans', cssFamily: '"Open Sans", sans-serif' },
      { value: 'Merriweather', label: 'Merriweather', cssFamily: '"Merriweather", serif' },
    ],
  },
  {
    label: 'Thai Handwriting',
    options: [
      { value: 'Mali', label: 'Mali (ไทยลายมือ)', cssFamily: '"Mali", cursive' },
      { value: 'Sriracha', label: 'Sriracha (ไทยลายมือ)', cssFamily: '"Sriracha", cursive' },
      { value: 'Charm', label: 'Charm (ไทยลายมือ)', cssFamily: '"Charm", cursive' },
    ],
  },
  {
    label: 'Thai Formal',
    options: [
      { value: 'Sarabun', label: 'Sarabun (ไทยทางการ)', cssFamily: '"Sarabun", sans-serif' },
      { value: 'Noto Sans Thai', label: 'Noto Sans Thai (ไทยทางการ)', cssFamily: '"Noto Sans Thai", sans-serif' },
      { value: 'Prompt', label: 'Prompt (ไทยทางการ)', cssFamily: '"Prompt", sans-serif' },
    ],
  },
];
const DOC_TABLE_CELL_ALIGN_OPTIONS = [
  { id: 'top-left', horizontal: 'left', vertical: 'top', label: 'Top left' },
  { id: 'top-center', horizontal: 'center', vertical: 'top', label: 'Top center' },
  { id: 'top-right', horizontal: 'right', vertical: 'top', label: 'Top right' },
  { id: 'middle-left', horizontal: 'left', vertical: 'middle', label: 'Middle left' },
  { id: 'middle-center', horizontal: 'center', vertical: 'middle', label: 'Middle center' },
  { id: 'middle-right', horizontal: 'right', vertical: 'middle', label: 'Middle right' },
  { id: 'bottom-left', horizontal: 'left', vertical: 'bottom', label: 'Bottom left' },
  { id: 'bottom-center', horizontal: 'center', vertical: 'bottom', label: 'Bottom center' },
  { id: 'bottom-right', horizontal: 'right', vertical: 'bottom', label: 'Bottom right' },
];
const DOC_TABLE_PAGE_ALIGN_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];
const DOC_TABLE_BORDER_DESIGN_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'outer', label: 'Outer' },
  { id: 'inner', label: 'Inner' },
  { id: 'horizontal', label: 'H' },
  { id: 'vertical', label: 'V' },
  { id: 'top', label: 'Top' },
  { id: 'right', label: 'Right' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'clear', label: 'Clear' },
];
const DOC_TABLE_BORDER_LINE_STYLE_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'double', label: 'Double' },
];
const DOC_TABLE_BORDER_WIDTH_OPTIONS = ['1', '2', '3', '4', '5', '6'];
const DOC_TABLE_BORDER_COLOR_PRESETS = [
  '#cbd5e1',
  '#111827',
  '#475569',
  '#64748b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#2563eb',
  '#7c3aed',
];
const DOC_TABLE_BORDER_ALL_COLOR_PRESETS = Array.from(
  new Set([...DOC_TABLE_BORDER_COLOR_PRESETS, ...DOC_COLOR_PRESETS])
);
const normalizeDocTableBorderDesign = (value, fallback = 'all') => {
  const normalized = String(value || '').trim().toLowerCase();
  const validValues = DOC_TABLE_BORDER_DESIGN_OPTIONS.map((item) => item.id);
  return validValues.includes(normalized) ? normalized : fallback;
};
const normalizeDocTableBorderLineStyle = (value, fallback = 'solid') => {
  const normalized = String(value || '').trim().toLowerCase();
  const validValues = DOC_TABLE_BORDER_LINE_STYLE_OPTIONS.map((item) => item.id);
  return validValues.includes(normalized) ? normalized : fallback;
};
const normalizeDocTableBorderLineWidth = (value, fallback = 1, min = 1, max = 6) => {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};
const normalizeDocTableHorizontalAlign = (value, fallback = 'left') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'center') return 'center';
  if (normalized === 'right' || normalized === 'end') return 'right';
  if (
    normalized === 'left' ||
    normalized === 'start' ||
    normalized === 'justify' ||
    normalized === '-webkit-left'
  ) {
    return 'left';
  }
  return ['left', 'center', 'right'].includes(fallback) ? fallback : 'left';
};
const normalizeDocTablePageAlign = (value, fallback = 'left') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'center') return 'center';
  if (normalized === 'right' || normalized === 'end') return 'right';
  if (normalized === 'left' || normalized === 'start') return 'left';
  return ['left', 'center', 'right'].includes(fallback) ? fallback : 'left';
};
const normalizeDocTableWrapValue = (value, fallback = false) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return Boolean(fallback);
};
const normalizeDocTableVerticalAlign = (value, fallback = 'top') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'middle' || normalized === 'center') return 'middle';
  if (normalized === 'bottom') return 'bottom';
  if (normalized === 'top') return 'top';
  return ['top', 'middle', 'bottom'].includes(fallback) ? fallback : 'top';
};
const getDocTableAlignPreviewLineStyle = (horizontal, vertical, lineIndex = 0) => {
  const safeHorizontal = normalizeDocTableHorizontalAlign(horizontal);
  const safeVertical = normalizeDocTableVerticalAlign(vertical);
  const lineWidth = 7;
  const leftPx = safeHorizontal === 'left' ? 2 : safeHorizontal === 'center' ? 5 : 8;
  const topBasePx = safeVertical === 'top' ? 3 : safeVertical === 'middle' ? 6 : 9;
  return {
    width: `${lineWidth}px`,
    left: `${leftPx}px`,
    top: `${topBasePx + lineIndex * 2}px`,
  };
};
const DocTableCellAlignPreview = ({ horizontal = 'left', vertical = 'top' }) => (
  <span className="relative inline-block w-4 h-4 rounded-[2px] border border-gray-400 bg-white">
    {[0, 1].map((lineIndex) => (
      <span
        key={`align-preview-line-${lineIndex}`}
        className="absolute h-[1.5px] rounded-full bg-blue-500"
        style={getDocTableAlignPreviewLineStyle(horizontal, vertical, lineIndex)}
      />
    ))}
  </span>
);
const DocTableBorderDesignPreview = ({ design = 'all' }) => {
  const safeDesign = normalizeDocTableBorderDesign(design, 'all');
  const frameStyle = {
    position: 'relative',
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '2px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    color: 'currentColor',
  };
  const lineElements = [];
  const pushLine = (key, style) => {
    lineElements.push(
      <span
        key={key}
        style={{
          position: 'absolute',
          backgroundColor: 'currentColor',
          pointerEvents: 'none',
          ...style,
        }}
      />
    );
  };
  if (safeDesign === 'all') {
    frameStyle.border = '2px solid currentColor';
  } else if (safeDesign === 'outer') {
    frameStyle.border = '2px dashed currentColor';
  } else if (safeDesign === 'inner') {
    pushLine('inner-h', { left: '1px', right: '1px', top: '7px', height: '1.5px' });
    pushLine('inner-v', { top: '1px', bottom: '1px', left: '7px', width: '1.5px' });
  } else if (safeDesign === 'horizontal') {
    pushLine('h-1', { left: '1px', right: '1px', top: '5px', height: '1.5px' });
    pushLine('h-2', { left: '1px', right: '1px', top: '10px', height: '1.5px' });
  } else if (safeDesign === 'vertical') {
    pushLine('v-1', { top: '1px', bottom: '1px', left: '5px', width: '1.5px' });
    pushLine('v-2', { top: '1px', bottom: '1px', left: '10px', width: '1.5px' });
  } else if (safeDesign === 'top') {
    pushLine('top', { left: '0', right: '0', top: '0', height: '2px' });
  } else if (safeDesign === 'right') {
    pushLine('right', { top: '0', bottom: '0', right: '0', width: '2px' });
  } else if (safeDesign === 'bottom') {
    pushLine('bottom', { left: '0', right: '0', bottom: '0', height: '2px' });
  } else if (safeDesign === 'left') {
    pushLine('left', { top: '0', bottom: '0', left: '0', width: '2px' });
  } else if (safeDesign === 'clear') {
    frameStyle.border = '1px dashed #cbd5e1';
    pushLine('clear-1', {
      left: '2px',
      right: '2px',
      top: '7px',
      height: '1.5px',
      backgroundColor: '#ef4444',
      transform: 'rotate(-34deg)',
      transformOrigin: 'center',
    });
  }
  return <span style={frameStyle}>{lineElements}</span>;
};
const toSheetColumnLabel = (columnIndex) => {
  let value = Number(columnIndex) + 1;
  if (!Number.isFinite(value) || value <= 0) return 'A';
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};
const normalizeTaskAssigneeIds = (taskInput) => {
  const task =
    taskInput && typeof taskInput === 'object' && !Array.isArray(taskInput)
      ? taskInput
      : {};
  const fromArray = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  const fallbackSingle = String(task.assigneeId || '').trim();
  const normalizedIds = fromArray
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (fallbackSingle && !normalizedIds.includes(fallbackSingle)) {
    normalizedIds.unshift(fallbackSingle);
  }
  return Array.from(new Set(normalizedIds));
};
const resolveTaskDepartmentsFromAssignees = (
  assigneeIdsInput,
  teamMembers,
  fallback = 'Unassigned'
) => {
  const assigneeIds = Array.isArray(assigneeIdsInput) ? assigneeIdsInput : [];
  const departments = Array.from(
    new Set(
      assigneeIds
        .map((id) =>
          String(
            (Array.isArray(teamMembers)
              ? teamMembers.find((member) => member.id === id)?.department
              : '') || ''
          ).trim()
        )
        .filter(Boolean)
    )
  );
  if (departments.length > 0) return departments;
  const safeFallback = String(fallback || '').trim();
  return [safeFallback || 'Unassigned'];
};
const resolveTaskDepartmentFromAssignees = (assigneeIdsInput, teamMembers, fallback = 'Unassigned') => {
  const departments = resolveTaskDepartmentsFromAssignees(assigneeIdsInput, teamMembers, fallback);
  if (departments.length === 1) return departments[0];
  if (departments.length > 1) return 'Multiple';
  return 'Unassigned';
};
const fromSheetColumnLabel = (labelInput) => {
  const label = String(labelInput || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(label)) return -1;
  let value = 0;
  for (let index = 0; index < label.length; index += 1) {
    value = value * 26 + (label.charCodeAt(index) - 64);
  }
  return value - 1;
};
const parseSheetCellReference = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  const matched = raw.match(/^([A-Z]+)(\d+)$/);
  if (!matched) return null;
  const col = fromSheetColumnLabel(matched[1]);
  const row = Number.parseInt(matched[2], 10) - 1;
  if (!Number.isFinite(row) || row < 0 || col < 0) return null;
  return { row, col };
};
const createDefaultNoteDocPage = (html = '') => ({
  id: `doc-${generateId()}`,
  type: 'doc',
  title: DEFAULT_NOTE_DOC_PAGE_TITLE,
  pinned: false,
  content: String(html || ''),
});
const createDefaultNoteSheetPage = () => ({
  id: `sheet-${generateId()}`,
  type: 'sheet',
  title: DEFAULT_NOTE_SHEET_PAGE_TITLE,
  pinned: false,
  rows: DEFAULT_NOTE_SHEET_ROWS,
  cols: DEFAULT_NOTE_SHEET_COLS,
  cells: {},
});
const normalizeNoteSheetCell = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const text = String(raw.text || '').slice(0, 2000);
  const style = raw.style && typeof raw.style === 'object' ? raw.style : {};
  return {
    text,
    style: {
      bold: Boolean(style.bold),
      italic: Boolean(style.italic),
      underline: Boolean(style.underline),
      align: ['left', 'center', 'right'].includes(style.align) ? style.align : 'left',
      color: String(style.color || '').trim() || '#111827',
      bgColor: String(style.bgColor || '').trim() || '#ffffff',
      fontSize: String(style.fontSize || '').trim() || '14px',
    },
  };
};
const normalizeNoteDocumentPage = (pageInput, index = 0) => {
  const raw = pageInput && typeof pageInput === 'object' ? pageInput : {};
  const type = raw.type === 'sheet' ? 'sheet' : 'doc';
  const fallbackTitle = type === 'sheet' ? `Sheet ${index + 1}` : `Doc ${index + 1}`;
  if (type === 'sheet') {
    const rawRows = Number.parseInt(raw.rows, 10);
    const rawCols = Number.parseInt(raw.cols, 10);
    const rows = Number.isFinite(rawRows) ? Math.min(120, Math.max(10, rawRows)) : DEFAULT_NOTE_SHEET_ROWS;
    const cols = Number.isFinite(rawCols) ? Math.min(26, Math.max(4, rawCols)) : DEFAULT_NOTE_SHEET_COLS;
    const cellsInput = raw.cells && typeof raw.cells === 'object' ? raw.cells : {};
    const cells = {};
    Object.entries(cellsInput).forEach(([key, value]) => {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) return;
      cells[normalizedKey] = normalizeNoteSheetCell(value);
    });
    return {
      id: String(raw.id || `sheet-${generateId()}`).trim(),
      type: 'sheet',
      title: String(raw.title || fallbackTitle).trim() || fallbackTitle,
      pinned: Boolean(raw.pinned),
      rows,
      cols,
      cells,
    };
  }
  return {
    id: String(raw.id || `doc-${generateId()}`).trim(),
    type: 'doc',
    title: String(raw.title || fallbackTitle).trim() || fallbackTitle,
    pinned: Boolean(raw.pinned),
    content: String(raw.content || ''),
  };
};
const normalizeNoteDocumentPayload = (value) => {
  const fallbackPage = createDefaultNoteDocPage(typeof value === 'string' ? value : '');
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const pagesInput = Array.isArray(value.pages) ? value.pages : [];
    const pages = (pagesInput.length > 0 ? pagesInput : [fallbackPage]).map((page, index) =>
      normalizeNoteDocumentPage(page, index)
    );
    const uniquePages = [];
    const idSet = new Set();
    pages.forEach((page, index) => {
      const pageId = page.id && !idSet.has(page.id) ? page.id : `${page.type}-${generateId()}-${index}`;
      idSet.add(pageId);
      uniquePages.push({ ...page, id: pageId });
    });
    const firstPageId = uniquePages[0]?.id || fallbackPage.id;
    const activePageId = String(value.activePageId || '').trim();
    const normalizedActivePageId = uniquePages.some((page) => page.id === activePageId)
      ? activePageId
      : firstPageId;
    return {
      pages: uniquePages,
      activePageId: normalizedActivePageId,
    };
  }
  return {
    pages: [fallbackPage],
    activePageId: fallbackPage.id,
  };
};
const parseStoredNoteDocument = (storedValue) => {
  const rawText = String(storedValue || '');
  if (!rawText.startsWith(NOTE_DOCUMENT_SERIALIZATION_PREFIX)) {
    return normalizeNoteDocumentPayload(rawText);
  }
  const payload = rawText.slice(NOTE_DOCUMENT_SERIALIZATION_PREFIX.length);
  try {
    const parsed = JSON.parse(payload);
    return normalizeNoteDocumentPayload(parsed);
  } catch {
    return normalizeNoteDocumentPayload('');
  }
};
const serializeStoredNoteDocument = (documentPayload) => {
  const normalized = normalizeNoteDocumentPayload(documentPayload);
  return `${NOTE_DOCUMENT_SERIALIZATION_PREFIX}${JSON.stringify(normalized)}`;
};
const NOTE_PRESENCE_TTL_MS = 15000;
const NOTE_PRESENCE_TYPING_MAX = 120;
const NOTE_PRESENCE_CURSOR_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
];
const hashStringToPositiveInt = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
};
const getPresenceCursorColor = (value) =>
  NOTE_PRESENCE_CURSOR_COLORS[
    hashStringToPositiveInt(value) % NOTE_PRESENCE_CURSOR_COLORS.length
  ];
const toTimestampMs = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeNoteContentMap = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  Object.entries(raw).forEach(([noteId, content]) => {
    const normalizedNoteId = String(noteId || '').trim();
    if (!normalizedNoteId) return;
    result[normalizedNoteId] = String(content || '');
  });
  return result;
};
const normalizeNoteRevisionEntry = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const updatedAtRaw = String(raw.updatedAt || '').trim();
  const updatedAt = toTimestampMs(updatedAtRaw) > 0 ? updatedAtRaw : new Date(0).toISOString();
  return {
    updatedAt,
    updatedById: String(raw.updatedById || raw.updatedBy || '').trim(),
    updatedByUsername: String(raw.updatedByUsername || '').trim().toLowerCase(),
  };
};
const normalizeNoteRevisionMap = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  Object.entries(raw).forEach(([noteId, revision]) => {
    const normalizedNoteId = String(noteId || '').trim();
    if (!normalizedNoteId) return;
    result[normalizedNoteId] = normalizeNoteRevisionEntry(revision);
  });
  return result;
};
const normalizeNotePresenceEntry = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const updatedAtRaw = String(raw.updatedAt || '').trim();
  const updatedAt = toTimestampMs(updatedAtRaw) > 0 ? updatedAtRaw : new Date().toISOString();
  return {
    userId: String(raw.userId || '').trim(),
    username: String(raw.username || '').trim().toLowerCase(),
    displayName: String(raw.displayName || '').trim(),
    avatarUrl: String(raw.avatarUrl || '').trim(),
    pageId: String(raw.pageId || '').trim(),
    pageType: raw.pageType === 'sheet' ? 'sheet' : 'doc',
    line: String(raw.line || '').trim() || '1',
    typingText: String(raw.typingText || '').trim().slice(0, NOTE_PRESENCE_TYPING_MAX),
    updatedAt,
  };
};
const normalizeProjectNotesPresence = (value, nowMs = Date.now()) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  Object.entries(raw).forEach(([noteId, notePresence]) => {
    const normalizedNoteId = String(noteId || '').trim();
    if (!normalizedNoteId) return;
    const perNoteRaw =
      notePresence && typeof notePresence === 'object' && !Array.isArray(notePresence)
        ? notePresence
        : {};
    const perNoteNormalized = {};
    Object.entries(perNoteRaw).forEach(([userId, presence]) => {
      const normalizedUserId = String(userId || '').trim();
      if (!normalizedUserId) return;
      const normalizedPresence = normalizeNotePresenceEntry({
        ...presence,
        userId: normalizedUserId,
      });
      const ageMs = nowMs - toTimestampMs(normalizedPresence.updatedAt);
      if (ageMs > NOTE_PRESENCE_TTL_MS) return;
      perNoteNormalized[normalizedUserId] = normalizedPresence;
    });
    if (Object.keys(perNoteNormalized).length > 0) {
      result[normalizedNoteId] = perNoteNormalized;
    }
  });
  return result;
};
const mergeProjectNotesContentByRevision = (
  baseContentInput,
  baseRevisionInput,
  incomingContentInput,
  incomingRevisionInput
) => {
  const baseContent = normalizeNoteContentMap(baseContentInput);
  const incomingContent = normalizeNoteContentMap(incomingContentInput);
  const baseRevision = normalizeNoteRevisionMap(baseRevisionInput);
  const incomingRevision = normalizeNoteRevisionMap(incomingRevisionInput);
  const allNoteIds = Array.from(
    new Set([
      ...Object.keys(baseContent),
      ...Object.keys(incomingContent),
      ...Object.keys(baseRevision),
      ...Object.keys(incomingRevision),
    ])
  );
  const notesContent = {};
  const noteRevisionMap = {};
  allNoteIds.forEach((noteId) => {
    const hasBaseContent = Object.prototype.hasOwnProperty.call(baseContent, noteId);
    const hasIncomingContent = Object.prototype.hasOwnProperty.call(incomingContent, noteId);
    const baseValue = hasBaseContent ? String(baseContent[noteId] || '') : '';
    const incomingValue = hasIncomingContent ? String(incomingContent[noteId] || '') : '';
    const baseMeta = baseRevision[noteId] || normalizeNoteRevisionEntry({});
    const incomingMeta = incomingRevision[noteId] || normalizeNoteRevisionEntry({});
    const baseMs = toTimestampMs(baseMeta.updatedAt);
    const incomingMs = toTimestampMs(incomingMeta.updatedAt);
    let source = 'base';
    if (incomingMs > baseMs) {
      source = 'incoming';
    } else if (baseMs === incomingMs) {
      if (!hasBaseContent && hasIncomingContent) {
        source = 'incoming';
      } else if (hasBaseContent && hasIncomingContent && incomingValue !== baseValue) {
        source = 'incoming';
      }
    }
    const selectedValue = source === 'incoming' ? incomingValue : baseValue;
    const selectedMeta = source === 'incoming' ? incomingMeta : baseMeta;
    if (!hasBaseContent && !hasIncomingContent && !toTimestampMs(selectedMeta.updatedAt)) return;
    notesContent[noteId] = selectedValue;
    noteRevisionMap[noteId] = normalizeNoteRevisionEntry(selectedMeta);
  });
  return { notesContent, noteRevisionMap };
};
const mergeProjectNotesPresence = (basePresenceInput, incomingPresenceInput, nowMs = Date.now()) => {
  const basePresence = normalizeProjectNotesPresence(basePresenceInput, nowMs);
  const incomingPresence = normalizeProjectNotesPresence(incomingPresenceInput, nowMs);
  const noteIds = Array.from(
    new Set([...Object.keys(basePresence), ...Object.keys(incomingPresence)])
  );
  const merged = {};
  noteIds.forEach((noteId) => {
    const basePerNote = basePresence[noteId] || {};
    const incomingPerNote = incomingPresence[noteId] || {};
    const userIds = Array.from(
      new Set([...Object.keys(basePerNote), ...Object.keys(incomingPerNote)])
    );
    const nextPerNote = {};
    userIds.forEach((userId) => {
      const baseEntry = basePerNote[userId];
      const incomingEntry = incomingPerNote[userId];
      if (!baseEntry && !incomingEntry) return;
      if (!baseEntry) {
        nextPerNote[userId] = incomingEntry;
        return;
      }
      if (!incomingEntry) {
        nextPerNote[userId] = baseEntry;
        return;
      }
      const baseMs = toTimestampMs(baseEntry.updatedAt);
      const incomingMs = toTimestampMs(incomingEntry.updatedAt);
      nextPerNote[userId] = incomingMs >= baseMs ? incomingEntry : baseEntry;
    });
    if (Object.keys(nextPerNote).length > 0) {
      merged[noteId] = nextPerNote;
    }
  });
  return merged;
};
const describeProjectActivityEntry = (entry) => {
  const meta = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  switch (entry?.type) {
    case PROJECT_ACTIVITY_TYPES.EVENT_CREATED: {
      const eventTitle = stripWrappingQuotes(meta.eventTitle || entry.title || 'Untitled event');
      const detailParts = [];
      const shouldShowTime = meta.showTime !== false && meta.showWhen !== false;
      const dateWindow = formatActivityDateWindow({
        startDate: meta.startDate,
        startTime: meta.startTime,
        endDate: meta.endDate,
        endTime: meta.endTime,
        showTime: shouldShowTime,
      });
      if (dateWindow) detailParts.push(`When: ${dateWindow}`);
      if (entry.actorUsername) detailParts.push(`By ${entry.actorUsername}`);
      return {
        title: `New Event: ${eventTitle || 'Untitled event'}`,
        subtitle: detailParts.join(' • ') || entry.message || 'New calendar event was added.',
      };
    }
    case PROJECT_ACTIVITY_TYPES.TASK_CREATED: {
      const taskTitle = stripWrappingQuotes(meta.taskTitle || entry.title || 'Untitled task');
      const detailParts = [];
      const shouldShowTime = meta.showTime !== false && meta.showWhen !== false;
      const dateWindow = formatActivityDateWindow({
        startDate: meta.startDate,
        startTime: meta.startTime,
        endDate: meta.endDate,
        endTime: meta.endTime,
        showTime: shouldShowTime,
      });
      if (dateWindow) detailParts.push(`Schedule: ${dateWindow}`);
      if (meta.department) detailParts.push(`Dept: ${meta.department}`);
      if (entry.actorUsername) detailParts.push(`By ${entry.actorUsername}`);
      return {
        title: `New Task: ${taskTitle || 'Untitled task'}`,
        subtitle: detailParts.join(' • ') || entry.message || 'New task was created.',
      };
    }
    case PROJECT_ACTIVITY_TYPES.MEMBER_JOINED: {
      const memberName = stripWrappingQuotes(meta.memberUsername || entry.actorUsername || 'Unknown member');
      const methodMap = {
        invitation: 'Joined via invitation',
        project_code: 'Joined via project code',
      };
      const methodDetail = methodMap[String(meta.method || '').trim()] || '';
      const detailParts = [];
      if (methodDetail) detailParts.push(methodDetail);
      if (entry.actorUsername && entry.actorUsername !== memberName) {
        detailParts.push(`By ${entry.actorUsername}`);
      }
      return {
        title: `New Member: ${memberName}`,
        subtitle: detailParts.join(' • ') || entry.message || 'A new member joined the project.',
      };
    }
    case PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED: {
      const toStatusKey = String(meta.toStatus || '').trim();
      const toStatus = PROJECT_STATUS_LABELS[toStatusKey] || meta.toStatus || 'Unknown';
      const statusHighlight = PROJECT_STATUS_HIGHLIGHTS[toStatusKey] || {
        tone: 'neutral',
        priorityLabel: 'Updated',
        prompt: '"อัปเดตแล้วนะ ลองเช็กภาพรวมอีกนิด แล้วค่อยเดินต่อแบบใจเย็นๆ"',
      };
      const detailParts = [];
      if (entry.actorUsername) detailParts.push(`By ${entry.actorUsername}`);
      return {
        title: `Project status changed: ${toStatus}`,
        subtitle: detailParts.join(' • ') || 'Status was updated.',
        isStatusUpdate: true,
        statusTone: statusHighlight.tone,
        statusPriorityLabel: statusHighlight.priorityLabel,
        statusPrompt: statusHighlight.prompt,
      };
    }
    case PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT: {
      const announcementTitle = stripWrappingQuotes(entry.title);
      const detailParts = [];
      if (entry.actorUsername) detailParts.push(`By ${entry.actorUsername}`);
      if (entry.message) detailParts.push(entry.message);
      return {
        title: `Announcement${announcementTitle ? `: ${announcementTitle}` : ''}`,
        subtitle: detailParts.join(' • ') || 'New project announcement.',
      };
    }
    default:
      return {
        title: stripWrappingQuotes(entry?.title) || 'Project update',
        subtitle: entry?.message || '',
      };
  }
};
const getRuntimeConfig = () => {
  if (typeof window === 'undefined') return {};
  const runtimeConfig = window.__PM_CALENDAR_RUNTIME_CONFIG__;
  return runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : {};
};
const RUNTIME_CONFIG = getRuntimeConfig();
const AUTH_API_BASE_URL = String(
  RUNTIME_CONFIG.VITE_AUTH_API_BASE_URL ||
    RUNTIME_CONFIG.AUTH_API_BASE_URL ||
    import.meta.env.VITE_AUTH_API_BASE_URL ||
    ''
)
  .trim()
  .replace(/\/+$/, '');
const GOOGLE_CLIENT_ID = String(
  RUNTIME_CONFIG.VITE_GOOGLE_CLIENT_ID ||
    RUNTIME_CONFIG.GOOGLE_CLIENT_ID ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    ''
).trim();
const GOOGLE_CALENDAR_PROJECT_ID = '__google_calendar__';
const GOOGLE_CALENDAR_PROJECT_META = {
  id: GOOGLE_CALENDAR_PROJECT_ID,
  name: 'Google Calendar',
  colorIndex: 6,
  isVisible: true,
  ownerId: 'google-calendar',
  ownerUsername: 'google-calendar',
  members: [],
};
const DEFAULT_GOOGLE_CALENDAR_STATUS = {
  linked: false,
  linkedEmail: '',
  linkedAt: null,
  updatedAt: null,
  selectedCalendarIds: [],
  configured: false,
  redirectUri: '',
};
const GOOGLE_CALENDAR_EVENT_COLOR_PRESETS = [
  { id: '1', label: 'Lavender', hex: '#a4bdfc' },
  { id: '2', label: 'Sage', hex: '#7ae7bf' },
  { id: '3', label: 'Grape', hex: '#dbadff' },
  { id: '4', label: 'Flamingo', hex: '#ff887c' },
  { id: '5', label: 'Banana', hex: '#fbd75b' },
  { id: '6', label: 'Tangerine', hex: '#ffb878' },
  { id: '7', label: 'Peacock', hex: '#46d6db' },
  { id: '8', label: 'Graphite', hex: '#e1e1e1' },
  { id: '9', label: 'Blueberry', hex: '#5484ed' },
  { id: '10', label: 'Basil', hex: '#51b749' },
  { id: '11', label: 'Tomato', hex: '#dc2127' },
];
const pickGoogleCalendarColorIdByHex = (hexColorInput) => {
  const sourceRgb = toRgb(hexColorInput);
  if (!sourceRgb) return '';
  let nearestColorId = '';
  let nearestDistance = Number.POSITIVE_INFINITY;
  GOOGLE_CALENDAR_EVENT_COLOR_PRESETS.forEach((preset) => {
    const presetRgb = toRgb(preset.hex);
    if (!presetRgb) return;
    const distance =
      (sourceRgb.r - presetRgb.r) ** 2 +
      (sourceRgb.g - presetRgb.g) ** 2 +
      (sourceRgb.b - presetRgb.b) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestColorId = preset.id;
    }
  });
  return nearestColorId;
};

const getLocalUsers = () => {
  try {
    const data = localStorage.getItem(AUTH_USERS_KEY);
    if (!data) return [];

    const users = JSON.parse(data);
    return Array.isArray(users)
      ? users.map((user) => ({
          ...user,
          username: String(user.username || user.name || user.email || '').trim().toLowerCase(),
          email: String(user.email || '').trim().toLowerCase(),
          avatarUrl: String(user.avatarUrl || '').trim(),
        }))
      : [];
  } catch {
    return [];
  }
};

const saveLocalUsers = (users) => {
  const normalizedUsers = users.map((user) => ({
    ...user,
    username: String(user.username || user.name || user.email || '').trim().toLowerCase(),
    email: String(user.email || '').trim().toLowerCase(),
    avatarUrl: String(user.avatarUrl || '').trim(),
  }));
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(normalizedUsers));
};

const LOCAL_TEST_USERS = [
  {
    id: 'local-test-user-1',
    username: 'test_pm_1',
    email: 'test_pm_1@local.pm',
    password: '123456',
    avatarUrl: '',
  },
  {
    id: 'local-test-user-2',
    username: 'test_pm_2',
    email: 'test_pm_2@local.pm',
    password: '123456',
    avatarUrl: '',
  },
  {
    id: 'local-test-user-3',
    username: 'test_pm_3',
    email: 'test_pm_3@local.pm',
    password: '123456',
    avatarUrl: '',
  },
];

const ensureLocalTestUsers = () => {
  if (typeof window === 'undefined' || AUTH_API_BASE_URL) return;

  const existingUsers = getLocalUsers();
  const nextUsers = [...existingUsers];
  let hasUpdates = false;

  LOCAL_TEST_USERS.forEach((seedUser) => {
    const username = String(seedUser.username || '').trim().toLowerCase();
    const email = String(seedUser.email || '').trim().toLowerCase();

    const duplicated = nextUsers.some(
      (user) => String(user.username || '').trim().toLowerCase() === username || String(user.email || '').trim().toLowerCase() === email
    );
    if (duplicated) return;

    nextUsers.push({
      ...seedUser,
      username,
      email,
    });
    hasUpdates = true;
  });

  if (hasUpdates) {
    saveLocalUsers(nextUsers);
  }
};

const normalizeAuthUser = (user) => {
  if (!user) return null;

  const username = String(user.username || user.name || user.email || '').trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();

  return {
    id: user.id || `legacy-${username || email || generateId()}`,
    username,
    email,
    avatarUrl: String(user.avatarUrl || '').trim(),
  };
};

const getAccountDbKey = (userId) => `${ACCOUNT_DB_PREFIX}${userId}`;

const readAccountDbPayload = (userId) => {
  const key = getAccountDbKey(userId);
  try {
    const rawData = localStorage.getItem(key);
    if (!rawData) return {};
    const parsed = JSON.parse(rawData);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeAccountDbPayload = (userId, payload) => {
  const key = getAccountDbKey(userId);
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  localStorage.setItem(key, JSON.stringify(safePayload));
};

const normalizeProjectInvite = (invite) => {
  const status = VALID_PROJECT_INVITE_STATUSES.has(invite?.status)
    ? invite.status
    : PROJECT_INVITE_STATUSES.PENDING;

  return {
    id: String(invite?.id || generateId()),
    projectId: String(invite?.projectId || '').trim(),
    projectName: String(invite?.projectName || '').trim(),
    ownerId: String(invite?.ownerId || '').trim(),
    ownerUsername: String(invite?.ownerUsername || '').trim().toLowerCase(),
    invitedUserId: String(invite?.invitedUserId || '').trim() || null,
    invitedUsername: String(invite?.invitedUsername || '').trim().toLowerCase(),
    invitedEmail: String(invite?.invitedEmail || '').trim().toLowerCase(),
    status,
    createdAt: String(invite?.createdAt || new Date().toISOString()),
    respondedAt: invite?.respondedAt ? String(invite.respondedAt) : null,
  };
};

const getProjectInvites = () => {
  try {
    const rawData = localStorage.getItem(PROJECT_INVITES_KEY);
    if (!rawData) return [];

    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeProjectInvite)
      .filter(
        (invite) =>
          invite.projectId &&
          invite.ownerId &&
          (invite.invitedUserId || invite.invitedUsername || invite.invitedEmail)
      );
  } catch {
    return [];
  }
};

const saveProjectInvites = (invites) => {
  const normalized = (Array.isArray(invites) ? invites : []).map(normalizeProjectInvite);
  localStorage.setItem(PROJECT_INVITES_KEY, JSON.stringify(normalized));
};

const isInviteForUser = (invite, user) => {
  const userId = String(user?.id || '').trim();
  const username = String(user?.username || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();
  if (!invite || !user) return false;

  if (invite.invitedUserId && userId && invite.invitedUserId === userId) return true;
  if (invite.invitedUsername && username && invite.invitedUsername === username) return true;
  if (invite.invitedEmail && email && invite.invitedEmail === email) return true;
  return false;
};

const isProjectAccessibleByUser = (project, user) => {
  if (!project || !user) return false;

  const userId = String(user?.id || '').trim();
  const username = String(user?.username || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();

  const ownerId = String(project?.ownerId || '').trim();
  const ownerUsername = String(project?.ownerUsername || '').trim().toLowerCase();
  if ((userId && ownerId === userId) || (username && ownerUsername === username)) {
    return true;
  }

  const projectMembers = Array.isArray(project?.members)
    ? project.members.map((member) => String(member || '').trim().toLowerCase())
    : [];
  if ((username && projectMembers.includes(username)) || (email && projectMembers.includes(email))) {
    return true;
  }

  const teamMembers = Array.isArray(project?.teamMembers) ? project.teamMembers : [];
  return teamMembers.some((member) => {
    const memberId = String(member?.id || member?.userId || '').trim();
    const memberUsername = String(member?.username || member?.name || '').trim().toLowerCase();
    const memberEmail = String(member?.email || '').trim().toLowerCase();
    return (
      (userId && memberId === userId) ||
      (username && memberUsername === username) ||
      (email && memberEmail === email)
    );
  });
};

const stripLocalOnlyProjectFields = (project) => {
  if (!project || typeof project !== 'object') return {};
  const nextProject = { ...project };
  delete nextProject.isVisible;
  // Keep note target selection local per user, but keep shared note content.
  delete nextProject.notesPreferences;
  return nextProject;
};

const cloneLocalNotesPreferences = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value };
};

const resolveAccountScopedNotesPreferences = (
  preferencesInput,
  { currentUserId = '', projectOwnerId = '' } = {}
) => {
  const preferences = cloneLocalNotesPreferences(preferencesInput);
  const normalizedCurrentUserId = String(currentUserId || '').trim();
  const normalizedProjectOwnerId = String(projectOwnerId || '').trim();
  const preferenceUserId = String(preferences.userId || '').trim();

  if (preferenceUserId) {
    if (normalizedCurrentUserId && preferenceUserId === normalizedCurrentUserId) {
      return preferences;
    }
    return {};
  }

  // Legacy preferences without userId:
  // keep only for owner account, clear for shared member accounts.
  if (
    normalizedCurrentUserId &&
    normalizedProjectOwnerId &&
    normalizedProjectOwnerId !== normalizedCurrentUserId
  ) {
    return {};
  }

  return preferences;
};

const normalizeLastVisitedView = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_LAST_VISITED_VIEW };
  }

  const profileOpen = Boolean(value.profileOpen);
  const type =
    value.type === STARTUP_VIEW_MODES.PROJECT
      ? STARTUP_VIEW_MODES.PROJECT
      : STARTUP_VIEW_MODES.CALENDAR;
  const projectId = type === STARTUP_VIEW_MODES.PROJECT ? String(value.projectId || '').trim() || null : null;
  const projectTab =
    type === STARTUP_VIEW_MODES.PROJECT
      ? normalizeProjectDashboardTab(value.projectTab)
      : DEFAULT_PROJECT_DASHBOARD_TAB;
  const projectManagerOpen =
    type === STARTUP_VIEW_MODES.CALENDAR && !profileOpen ? Boolean(value.projectManagerOpen) : false;

  if (profileOpen) {
    return {
      type: STARTUP_VIEW_MODES.CALENDAR,
      projectId: null,
      projectTab: DEFAULT_PROJECT_DASHBOARD_TAB,
      profileOpen: true,
      projectManagerOpen: false,
    };
  }

  return {
    type,
    projectId,
    projectTab,
    profileOpen: false,
    projectManagerOpen,
  };
};

const isJsonEqual = (left, right) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const postAuthApi = async (path, payload) => {
  if (!AUTH_API_BASE_URL) {
    throw new Error('Auth API is not configured. Set VITE_AUTH_API_BASE_URL or AUTH_API_BASE_URL.');
  }

  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message = result?.message || 'Authentication request failed.';
    throw new Error(message);
  }

  return result;
};

const requestCloudDataApi = async (path, options = {}) => {
  if (!AUTH_API_BASE_URL) {
    throw new Error('Auth API is not configured. Set VITE_AUTH_API_BASE_URL or AUTH_API_BASE_URL.');
  }

  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message = result?.message || 'Cloud data request failed.';
    throw new Error(message);
  }

  return result;
};

const normalizeGoogleCalendarSelection = (selectedCalendarIds) =>
  Array.from(
    new Set(
      (Array.isArray(selectedCalendarIds) ? selectedCalendarIds : [])
        .map((calendarId) => String(calendarId || '').trim())
        .filter(Boolean)
    )
  );
const GOOGLE_CALENDAR_WRITABLE_ROLES = new Set(['owner', 'writer']);
const canWriteGoogleCalendar = (calendar) =>
  GOOGLE_CALENDAR_WRITABLE_ROLES.has(String(calendar?.accessRole || '').trim().toLowerCase());

const normalizeGoogleCalendarCalendars = (calendarsInput) =>
  (Array.isArray(calendarsInput) ? calendarsInput : [])
    .map((calendar) => {
      const id = String(calendar?.id || '').trim();
      if (!id) return null;
      return {
        id,
        summary: String(calendar?.summary || id).trim() || id,
        primary: calendar?.primary === true,
        accessRole: String(calendar?.accessRole || '').trim(),
        backgroundColor: String(calendar?.backgroundColor || '').trim(),
      };
    })
    .filter(Boolean);

const normalizeGoogleCalendarStatus = (status) => ({
  ...DEFAULT_GOOGLE_CALENDAR_STATUS,
  ...(status && typeof status === 'object' ? status : {}),
  linked: Boolean(status?.linked),
  linkedEmail: String(status?.linkedEmail || '').trim().toLowerCase(),
  selectedCalendarIds: normalizeGoogleCalendarSelection(status?.selectedCalendarIds),
  configured: Boolean(status?.configured),
  redirectUri: String(status?.redirectUri || '').trim(),
});

const loadAccountDbPayload = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return {};
  const localPayload = readAccountDbPayload(normalizedUserId);

  if (!AUTH_API_BASE_URL) {
    return localPayload;
  }

  try {
    const result = await requestCloudDataApi(`/data/account/${encodeURIComponent(normalizedUserId)}`);
    const remotePayload =
      result?.payload && typeof result.payload === 'object' && !Array.isArray(result.payload)
        ? result.payload
        : {};
    const hasRemoteData = Object.keys(remotePayload).length > 0;
    const hasLocalData = Object.keys(localPayload).length > 0;

    if (!hasRemoteData && hasLocalData) {
      await saveAccountDbPayload(normalizedUserId, localPayload);
      return localPayload;
    }

    writeAccountDbPayload(normalizedUserId, remotePayload);
    return remotePayload;
  } catch (error) {
    console.warn('Failed to load account data from Firestore API, using local cache:', error.message);
    return localPayload;
  }
};

const saveAccountDbPayload = async (userId, payload) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return;

  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  writeAccountDbPayload(normalizedUserId, safePayload);

  if (!AUTH_API_BASE_URL) return;

  try {
    await requestCloudDataApi(`/data/account/${encodeURIComponent(normalizedUserId)}`, {
      method: 'PUT',
      body: { payload: safePayload },
    });
  } catch (error) {
    console.warn('Failed to save account data to Firestore API:', error.message);
  }
};

const loadProjectInvitesStore = async () => {
  const localInvites = getProjectInvites();
  if (!AUTH_API_BASE_URL) {
    return localInvites;
  }

  try {
    const result = await requestCloudDataApi('/data/project-invites');
    const remoteInvites = Array.isArray(result?.invites) ? result.invites.map(normalizeProjectInvite) : [];
    if (remoteInvites.length === 0 && localInvites.length > 0) {
      await saveProjectInvitesStore(localInvites);
      return localInvites;
    }

    saveProjectInvites(remoteInvites);
    return remoteInvites;
  } catch (error) {
    console.warn('Failed to load project invites from Firestore API, using local cache:', error.message);
    return localInvites;
  }
};

const saveProjectInvitesStore = async (invitesInput) => {
  const normalizedInvites = (Array.isArray(invitesInput) ? invitesInput : []).map(normalizeProjectInvite);
  saveProjectInvites(normalizedInvites);

  if (!AUTH_API_BASE_URL) {
    return normalizedInvites;
  }

  try {
    await requestCloudDataApi('/data/project-invites', {
      method: 'PUT',
      body: { invites: normalizedInvites },
    });
  } catch (error) {
    console.warn('Failed to save project invites to Firestore API:', error.message);
  }

  return normalizedInvites;
};

const findUserByIdentifier = async (identifier) => {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
  if (!normalizedIdentifier) return null;

  if (AUTH_API_BASE_URL) {
    try {
      const result = await requestCloudDataApi(
        `/users/lookup?identifier=${encodeURIComponent(normalizedIdentifier)}`
      );
      return normalizeAuthUser(result?.user);
    } catch {
      return null;
    }
  }

  const users = getLocalUsers();
  const matchedUser = users.find(
    (user) => user.email === normalizedIdentifier || user.username === normalizedIdentifier
  );
  return matchedUser ? normalizeAuthUser(matchedUser) : null;
};

const PopupContext = React.createContext(null);

const toPopupOptions = (messageOrOptions, options = {}) => {
  if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
    return messageOrOptions;
  }

  return {
    ...options,
    message: String(messageOrOptions || ''),
  };
};

function PopupProvider({ children }) {
  const [popupState, setPopupState] = useState(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptFormValues, setPromptFormValues] = useState({});
  const resolverRef = useRef(null);

  const closePopup = (result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPopupState(null);
    setPromptValue('');
    setPromptFormValues({});
    if (resolve) resolve(result);
  };

  const openPopup = (nextState, fallbackResult) =>
    new Promise((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(fallbackResult);
      }
      resolverRef.current = resolve;
      setPopupState(nextState);
      setPromptValue(String(nextState?.defaultValue || ''));
      if (nextState?.type === 'prompt_form') {
        const initialFormValues = {};
        const fields = Array.isArray(nextState?.fields) ? nextState.fields : [];
        fields.forEach((field, index) => {
          const fieldId = String(field?.id || `field_${index + 1}`).trim();
          if (!fieldId) return;
          initialFormValues[fieldId] = String(field?.defaultValue || '');
        });
        setPromptFormValues(initialFormValues);
      } else {
        setPromptFormValues({});
      }
    });

  const showAlert = (messageOrOptions, options = {}) => {
    const config = toPopupOptions(messageOrOptions, options);
    return openPopup(
      {
        type: 'alert',
        title: config.title || 'Notice',
        message: config.message || '',
        confirmText: config.confirmText || 'OK',
        tone: config.tone || 'info',
      },
      true
    );
  };

  const showConfirm = (messageOrOptions, options = {}) => {
    const config = toPopupOptions(messageOrOptions, options);
    return openPopup(
      {
        type: 'confirm',
        title: config.title || 'Please confirm',
        message: config.message || '',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        tone: config.tone || 'info',
      },
      false
    );
  };

  const showPrompt = (messageOrOptions, options = {}) => {
    const config = toPopupOptions(messageOrOptions, options);
    return openPopup(
      {
        type: 'prompt',
        title: config.title || 'Enter value',
        message: config.message || '',
        confirmText: config.confirmText || 'Save',
        cancelText: config.cancelText || 'Cancel',
        placeholder: config.placeholder || '',
        defaultValue: config.defaultValue || '',
        tone: config.tone || 'info',
      },
      null
    );
  };

  const showPromptForm = (messageOrOptions, options = {}) => {
    const config = toPopupOptions(messageOrOptions, options);
    const fields = Array.isArray(config.fields) ? config.fields : [];
    const normalizedFields = fields
      .map((field, index) => {
        const fieldId = String(field?.id || `field_${index + 1}`).trim();
        if (!fieldId) return null;
        return {
          id: fieldId,
          label: String(field?.label || fieldId).trim(),
          placeholder: String(field?.placeholder || '').trim(),
          defaultValue: String(field?.defaultValue || ''),
          type: String(field?.type || 'text').trim() || 'text',
        };
      })
      .filter(Boolean);
    if (normalizedFields.length === 0) return Promise.resolve(null);
    return openPopup(
      {
        type: 'prompt_form',
        title: config.title || 'Enter values',
        message: config.message || '',
        confirmText: config.confirmText || 'Save',
        cancelText: config.cancelText || 'Cancel',
        tone: config.tone || 'info',
        fields: normalizedFields,
      },
      null
    );
  };

  const value = useMemo(
    () => ({
      alert: showAlert,
      confirm: showConfirm,
      prompt: showPrompt,
      promptForm: showPromptForm,
    }),
    []
  );

  const isDanger = popupState?.tone === 'danger';
  const confirmButtonClass = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <PopupContext.Provider value={value}>
      {children}
      {popupState && (
        <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-800">{popupState.title}</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              {popupState.message && <p className="text-sm text-slate-600 whitespace-pre-wrap">{popupState.message}</p>}
              {popupState.type === 'prompt' && (
                <input
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={popupState.placeholder}
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      closePopup(promptValue);
                    }
                  }}
                />
              )}
              {popupState.type === 'prompt_form' && (
                <div className="space-y-3">
                  {(Array.isArray(popupState.fields) ? popupState.fields : []).map((field, fieldIndex) => (
                    <label key={field.id} className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-600">{field.label}</span>
                      <input
                        type={field.type || 'text'}
                        value={String(promptFormValues[field.id] || '')}
                        onChange={(e) =>
                          setPromptFormValues((prev) => ({
                            ...prev,
                            [field.id]: e.target.value,
                          }))
                        }
                        placeholder={field.placeholder || ''}
                        autoFocus={fieldIndex === 0}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              {popupState.type !== 'alert' && (
                <button
                  type="button"
                  onClick={() => closePopup(popupState.type === 'confirm' ? false : null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  {popupState.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  closePopup(
                    popupState.type === 'confirm'
                      ? true
                      : popupState.type === 'prompt'
                      ? promptValue
                      : popupState.type === 'prompt_form'
                      ? promptFormValues
                      : true
                  )
                }
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${confirmButtonClass}`}
              >
                {popupState.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

function usePopup() {
  const context = React.useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used inside PopupProvider.');
  }
  return context;
}

const migrateProjectUsername = (project, oldUsername, newUsername) => {
  const normalizedOld = String(oldUsername || '').trim().toLowerCase();
  const normalizedNew = String(newUsername || '').trim().toLowerCase();
  if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return project;

  const ownerUsername =
    String(project.ownerUsername || '').trim().toLowerCase() === normalizedOld
      ? normalizedNew
      : String(project.ownerUsername || '').trim().toLowerCase();

  const members = Array.isArray(project.members)
    ? Array.from(
        new Set(
          project.members
            .map((member) => String(member || '').trim().toLowerCase())
            .map((member) => (member === normalizedOld ? normalizedNew : member))
            .filter(Boolean)
        )
      )
    : [ownerUsername];

  const teamMembers = Array.isArray(project.teamMembers)
    ? project.teamMembers.map((member) => {
        const memberUsername = String(member?.username || member?.name || '')
          .trim()
          .toLowerCase();
        if (memberUsername !== normalizedOld) return member;

        const displayName = String(member?.name || '').trim().toLowerCase() === normalizedOld
          ? normalizedNew
          : member?.name;

        return {
          ...member,
          username: normalizedNew,
          name: displayName || normalizedNew,
        };
      })
    : project.teamMembers;

  return {
    ...project,
    ownerUsername,
    members,
    teamMembers,
  };
};

const ensureProjectOwnership = (project, owner) => {
  const members = Array.isArray(project.members) ? project.members.filter(Boolean) : [];
  const ownerUsername = project.ownerUsername || owner.username;
  const mergedMembers = members.includes(ownerUsername) ? members : [ownerUsername, ...members];
  const joinCodeSecret = ensureProjectJoinCodeSecret(project);
  const changeFeed = normalizeProjectActivityFeed(project.changeFeed, project);

  return {
    ...project,
    ownerId: project.ownerId || owner.id,
    ownerUsername,
    members: Array.from(new Set(mergedMembers)),
    joinCodeSecret,
    changeFeed,
  };
};

const MEMBER_COLORS = [
  'bg-blue-600',
  'bg-purple-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
];

const normalizeRoles = (roles) =>
  Array.from(
    new Set(
      (Array.isArray(roles) ? roles : [])
        .map((role) => String(role || '').trim())
        .filter(Boolean)
    )
  );

const normalizeDepartments = (departments) =>
  Array.from(
    new Set(
      (Array.isArray(departments) ? departments : [])
        .map((department) => String(department || '').trim())
        .filter(Boolean)
    )
  );
const normalizeDepartmentColorHex = (value) => {
  const color = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : '';
};
const pickDepartmentPresetColor = (departmentName = '') => {
  const presets = DEPARTMENT_COLOR_PRESETS.length > 0 ? DEPARTMENT_COLOR_PRESETS : ['#3b82f6'];
  const text = String(departmentName || '').trim().toLowerCase();
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return presets[Math.abs(hash) % presets.length];
};
const normalizeDepartmentColorMap = (colorMapInput, departmentsInput = []) => {
  const baseMap =
    colorMapInput && typeof colorMapInput === 'object' && !Array.isArray(colorMapInput)
      ? colorMapInput
      : {};
  const normalized = {};
  Object.entries(baseMap).forEach(([departmentName, colorValue]) => {
    const normalizedDepartmentName = String(departmentName || '').trim();
    const normalizedColorValue = normalizeDepartmentColorHex(colorValue);
    if (!normalizedDepartmentName || !normalizedColorValue) return;
    if (normalizedDepartmentName.toLowerCase() === 'unassigned') return;
    normalized[normalizedDepartmentName] = normalizedColorValue;
  });

  normalizeDepartments(departmentsInput).forEach((departmentName) => {
    if (departmentName.toLowerCase() === 'unassigned') return;
    if (!normalized[departmentName]) {
      normalized[departmentName] = pickDepartmentPresetColor(departmentName);
    }
  });

  return normalized;
};
const resolveDepartmentColorHex = (
  departmentColorMapInput,
  departmentNameInput,
  fallbackColor = '#94a3b8'
) => {
  const departmentName = String(departmentNameInput || '').trim();
  const normalizedFallback = normalizeDepartmentColorHex(fallbackColor) || '#94a3b8';
  if (!departmentName || departmentName.toLowerCase() === 'unassigned') return normalizedFallback;
  const normalizedMap = normalizeDepartmentColorMap(departmentColorMapInput, [departmentName]);
  return normalizeDepartmentColorHex(normalizedMap[departmentName]) || normalizedFallback;
};
const toRgb = (hexColorInput) => {
  const hexColor = normalizeDepartmentColorHex(hexColorInput);
  if (!hexColor) return null;
  return {
    r: Number.parseInt(hexColor.slice(1, 3), 16),
    g: Number.parseInt(hexColor.slice(3, 5), 16),
    b: Number.parseInt(hexColor.slice(5, 7), 16),
  };
};
const toRgba = (hexColorInput, alpha = 1) => {
  const rgb = toRgb(hexColorInput);
  if (!rgb) return `rgba(148, 163, 184, ${alpha})`;
  const clampedAlpha = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedAlpha})`;
};

const getInitials = (value) => {
  const text = String(value || '').trim();
  if (!text) return '?';

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return text.slice(0, 2).toUpperCase();
};

const getRoleLevel = (role, isOwner = false) => {
  if (isOwner) return 1;

  const normalizedRole = String(role || '').toLowerCase();
  if (
    normalizedRole.includes('owner') ||
    normalizedRole.includes('approver') ||
    normalizedRole.includes('manager') ||
    normalizedRole.includes('lead')
  ) {
    return 2;
  }

  return 3;
};

const buildLocalUserLookup = () => {
  const byUsername = new Map();
  const byEmail = new Map();
  const byId = new Map();

  getLocalUsers().forEach((user) => {
    const normalizedUser = normalizeAuthUser(user);
    if (!normalizedUser) return;

    const userId = String(normalizedUser.id || '').trim();
    const username = String(normalizedUser.username || '').trim().toLowerCase();
    const email = String(normalizedUser.email || '').trim().toLowerCase();
    const avatarUrl = String(normalizedUser.avatarUrl || '').trim();
    const profile = { id: userId || null, username, email, avatarUrl };

    if (profile.id) byId.set(profile.id, profile);
    if (profile.username && !byUsername.has(profile.username)) {
      byUsername.set(profile.username, profile);
    }
    if (profile.email && !byEmail.has(profile.email)) {
      byEmail.set(profile.email, profile);
    }
  });

  return { byUsername, byEmail, byId };
};

const resolveMemberProfile = (lookup, username, existingMember = null) => {
  if (!lookup) return null;

  const normalizedUsername = String(username || existingMember?.username || existingMember?.name || '')
    .trim()
    .toLowerCase();
  const memberId = String(existingMember?.userId || '').trim();
  const memberEmail = String(existingMember?.email || '').trim().toLowerCase();

  if (normalizedUsername && lookup.byUsername.has(normalizedUsername)) {
    return lookup.byUsername.get(normalizedUsername);
  }

  if (memberId && lookup.byId.has(memberId)) {
    return lookup.byId.get(memberId);
  }

  if (memberEmail && lookup.byEmail.has(memberEmail)) {
    return lookup.byEmail.get(memberEmail);
  }

  return null;
};

const buildMemberFromUsername = (username, index, ownerUsername, existingMember = null, profileUser = null) => {
  const profileUsername = String(profileUser?.username || '').trim().toLowerCase();
  const normalizedUsername = String(username || profileUsername || existingMember?.username || existingMember?.name || '')
    .trim()
    .toLowerCase();
  const safeUsername = normalizedUsername || profileUsername || `member-${index + 1}`;
  const displayName =
    String(profileUser?.username || existingMember?.name || safeUsername).trim() || safeUsername;
  const isOwner = safeUsername === ownerUsername;
  const position = String(existingMember?.position || existingMember?.role || (isOwner ? 'Project Owner' : '')).trim();
  const department = String(existingMember?.department || 'Unassigned').trim() || 'Unassigned';
  const reportsToId = existingMember?.reportsToId || null;
  const avatarUrl = String(profileUser?.avatarUrl || existingMember?.avatarUrl || '').trim();
  const email = String(profileUser?.email || existingMember?.email || '').trim().toLowerCase();
  const userId = String(profileUser?.id || existingMember?.userId || '').trim() || null;

  return {
    id: existingMember?.id || `member-${safeUsername.replace(/\s+/g, '-')}`,
    userId,
    username: safeUsername,
    name: displayName,
    email,
    avatarUrl,
    position,
    role: position, // Backward compatibility for old UI paths
    department,
    reportsToId,
    initials: getInitials(displayName),
    color: existingMember?.color || MEMBER_COLORS[index % MEMBER_COLORS.length],
    level: existingMember?.level || getRoleLevel(position, isOwner),
  };
};

const normalizeProjectTeamMembers = (project) => {
  const ownerUsername = String(project.ownerUsername || '').trim().toLowerCase();
  const storedMembers = Array.isArray(project.teamMembers) ? project.teamMembers : [];
  const projectMembers = Array.isArray(project.members) ? project.members : [];
  const userLookup = buildLocalUserLookup();

  const allUsernames = Array.from(
    new Set(
      [ownerUsername, ...projectMembers, ...storedMembers.map((member) => member.username || member.name)]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const membersByUsername = new Map();
  storedMembers.forEach((member) => {
    const key = String(member?.username || member?.name || '').trim().toLowerCase();
    if (!key || membersByUsername.has(key)) return;
    membersByUsername.set(key, member);
  });

  return allUsernames.map((username, index) => {
    const existingMember = membersByUsername.get(username);
    const profileUser = resolveMemberProfile(userLookup, username, existingMember);
    return buildMemberFromUsername(username, index, ownerUsername, existingMember, profileUser);
  });
};

const addProjectMemberRecord = (project, memberUser) => {
  const ownerUsername = String(project?.ownerUsername || '').trim().toLowerCase();
  const normalizedUsername = String(memberUser?.username || '').trim().toLowerCase();
  if (!normalizedUsername) return project;

  const members = Array.isArray(project?.members)
    ? project.members.map((member) => String(member || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const memberSet = new Set([ownerUsername, ...members].filter(Boolean));
  memberSet.add(normalizedUsername);

  const existingTeamMembers = Array.isArray(project?.teamMembers) ? project.teamMembers : [];
  const hasTeamMember = existingTeamMembers.some(
    (member) => String(member?.username || member?.name || '').trim().toLowerCase() === normalizedUsername
  );
  const normalizedProfile = normalizeAuthUser(memberUser);
  const nextTeamMembers = hasTeamMember
    ? existingTeamMembers
    : [
        ...existingTeamMembers,
        buildMemberFromUsername(
          normalizedUsername,
          existingTeamMembers.length,
          ownerUsername,
          { username: normalizedUsername, name: normalizedUsername },
          normalizedProfile
        ),
      ];

  return {
    ...project,
    members: Array.from(memberSet),
    teamMembers: nextTeamMembers,
  };
};

const removeProjectMemberRecord = (project, usernameToRemove) => {
  const normalizedUsername = String(usernameToRemove || '').trim().toLowerCase();
  const ownerUsername = String(project?.ownerUsername || '').trim().toLowerCase();
  if (!normalizedUsername || normalizedUsername === ownerUsername) return project;

  const members = Array.isArray(project?.members)
    ? project.members
        .map((member) => String(member || '').trim().toLowerCase())
        .filter((member) => member && member !== normalizedUsername)
    : [];
  const nextMembers = Array.from(new Set([ownerUsername, ...members].filter(Boolean)));

  const nextTeamMembers = Array.isArray(project?.teamMembers)
    ? project.teamMembers.filter(
        (member) => String(member?.username || member?.name || '').trim().toLowerCase() !== normalizedUsername
      )
    : project?.teamMembers;

  return {
    ...project,
    members: nextMembers,
    teamMembers: nextTeamMembers,
  };
};

// --- Main Application Component ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const data = localStorage.getItem(AUTH_USER_KEY);
      return data ? normalizeAuthUser(JSON.parse(data)) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    ensureLocalTestUsers();
  }, []);

  const handleAuthSuccess = (user) => {
    const safeUser = normalizeAuthUser(user);
    setCurrentUser(safeUser);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const handleCurrentUserUpdate = (user) => {
    const safeUser = normalizeAuthUser(user);
    setCurrentUser(safeUser);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));
  };

  return (
    <PopupProvider>
      {!currentUser ? (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      ) : (
        <CalendarApp
          currentUser={currentUser}
          onLogout={handleLogout}
          onUpdateCurrentUser={handleCurrentUserUpdate}
        />
      )}
    </PopupProvider>
  );
}

function AuthScreen({ onAuthSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const googleButtonRef = useRef(null);
  const googleTokenClientRef = useRef(null);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setIdentifier('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setIsOtpSent(false);
    setRememberMe(true);
    setAcceptTerms(false);
    setIsSubmitting(false);
    setIsSendingOtp(false);
    setError('');
    setSuccess('');
  };

  const switchMode = (loginMode) => {
    setIsLoginMode(loginMode);
    resetForm();
  };

  const syncUserToLocalCache = (user, passwordOverride = null) => {
    const normalized = normalizeAuthUser(user);
    if (!normalized) return;

    const users = getLocalUsers();
    const existingIndex = users.findIndex((entry) => entry.id === normalized.id);
    const existingPassword = existingIndex >= 0 ? String(users[existingIndex].password || '') : '';
    const nextPassword = passwordOverride !== null ? String(passwordOverride || '') : existingPassword;
    const nextUserRecord = {
      ...(existingIndex >= 0 ? users[existingIndex] : {}),
      id: normalized.id,
      username: normalized.username,
      email: normalized.email,
      avatarUrl: normalized.avatarUrl || '',
      password: nextPassword,
    };

    if (existingIndex >= 0) {
      const updated = [...users];
      updated[existingIndex] = nextUserRecord;
      saveLocalUsers(updated);
    } else {
      saveLocalUsers([...users, nextUserRecord]);
    }
  };

  const authenticateWithGoogle = async (payload) => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await postAuthApi('/auth/google', payload);
      syncUserToLocalCache(result.user);
      onAuthSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    const idToken = String(response?.credential || '').trim();
    if (!idToken) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    await authenticateWithGoogle({ idToken });
  };

  const handleGoogleButtonClick = () => {
    setError('');
    setSuccess('');

    if (!GOOGLE_CLIENT_ID) {
      setError('Google OAuth is not configured.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setError('Google SDK is loading. Please try again.');
      return;
    }

    if (googleTokenClientRef.current?.requestAccessToken) {
      googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
      return;
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason?.() || 'unknown_reason';
        setError(`Google sign-in is unavailable (${reason}). Check OAuth Authorized JavaScript origins.`);
      } else if (notification.isSkippedMoment()) {
        setError('Google sign-in was skipped. Please try again.');
      }
    });
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    let isCancelled = false;
    const initializeGoogle = () => {
      if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });

      if (window.google.accounts.oauth2?.initTokenClient) {
        googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: (tokenResponse) => {
            const accessToken = String(tokenResponse?.access_token || '').trim();
            if (!accessToken) {
              const errorText = tokenResponse?.error || 'Google sign-in failed.';
              setError(errorText);
              return;
            }

            void authenticateWithGoogle({ accessToken });
          },
          error_callback: () => {
            setError('Google popup was blocked or closed. Please allow popups and try again.');
          },
        });
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        isCancelled = true;
        googleTokenClientRef.current = null;
      };
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogle, { once: true });
      return () => {
        isCancelled = true;
        googleTokenClientRef.current = null;
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      if (!isCancelled) {
        setError('Failed to load Google SDK. Please refresh and try again.');
      }
    };
    document.head.appendChild(script);

    return () => {
      isCancelled = true;
      googleTokenClientRef.current = null;
    };
  }, [isLoginMode]);

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email before requesting OTP.');
      return;
    }

    setIsSendingOtp(true);
    setError('');
    setSuccess('');

    try {
      const result = await postAuthApi('/auth/send-otp', { email: normalizedEmail });
      setSuccess(result.message || 'OTP has been sent to your email.');
      setIsOtpSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (isLoginMode) {
        const normalizedIdentifier = identifier.trim().toLowerCase();
        if (!normalizedIdentifier || !password) {
          throw new Error('Please enter username/email and password.');
        }

        if (AUTH_API_BASE_URL) {
          const result = await postAuthApi('/auth/login', {
            identifier: normalizedIdentifier,
            password,
          });
          syncUserToLocalCache(result.user);
          onAuthSuccess(result.user);
          return;
        }

        const users = getLocalUsers();
        const matchedUser = users.find((entry) => {
          const usernameValue = String(entry.username || '').trim().toLowerCase();
          const emailValue = String(entry.email || '').trim().toLowerCase();
          return usernameValue === normalizedIdentifier || emailValue === normalizedIdentifier;
        });

        if (!matchedUser) {
          throw new Error('Invalid username/email or password.');
        }

        const storedPassword = String(matchedUser.password || '');
        if (!storedPassword) {
          throw new Error('This account does not have a local password. Please login with Google.');
        }
        if (storedPassword !== password) {
          throw new Error('Invalid username/email or password.');
        }

        onAuthSuccess(matchedUser);
        return;
      }

      const normalizedUsername = username.trim().toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedUsername || !normalizedEmail || !password) {
        throw new Error('Please fill in all required fields.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      if (!acceptTerms) {
        throw new Error('Please accept terms and privacy policy.');
      }
      if (!isOtpSent) {
        throw new Error('Please send OTP to verify your email first.');
      }
      if (!otpCode.trim()) {
        throw new Error('Please enter OTP code.');
      }

      const result = await postAuthApi('/auth/register', {
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        otp: otpCode.trim(),
      });
      syncUserToLocalCache(result.user, password);
      onAuthSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-slate-100 to-cyan-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-blue-100 overflow-hidden">
        <div className="bg-blue-600 px-6 py-5 text-white">
          <h1 className="text-2xl font-bold">PM Calendar</h1>
          <p className="text-blue-100 text-sm mt-1">
            {isLoginMode ? 'Sign in to continue' : 'Create account with email verification'}
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1 mb-4">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                isLoginMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                !isLoginMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Register
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div ref={googleButtonRef} className="hidden" />
            <button
              type="button"
              onClick={handleGoogleButtonClick}
              className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2087 1.125-.8427 2.0782-1.7964 2.7164v2.2582h2.9082c1.7018-1.5664 2.6846-3.8727 2.6846-6.6155z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1791l-2.9082-2.2582c-.8064.54-1.8409.8591-3.0482.8591-2.3441 0-4.3282-1.5827-5.0364-3.7091H.9573v2.3327C2.4382 15.9836 5.4818 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.9636 10.7127c-.18-.54-.2836-1.1168-.2836-1.7127s.1036-1.1727.2836-1.7127V4.9545H.9573C.3477 6.1691 0 7.5409 0 9s.3477 2.8309.9573 4.0455l3.0063-2.3328z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.5795c1.3214 0 2.5078.4541 3.4405 1.3459l2.5814-2.5814C13.4632.8918 11.4268 0 9 0 5.4818 0 2.4382 2.0164.9573 4.9545l3.0063 2.3328c.7082-2.1264 2.6923-3.7091 5.0364-3.7091z"
                />
              </svg>
              <span>{isLoginMode ? 'Login with Google' : 'Register with Google'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {isLoginMode ? (
              <>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or Username"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember me
                </label>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="OTP Code"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || isSubmitting}
                    className="px-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-60"
                  >
                    {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  I accept Terms of Service and Privacy Policy.
                </label>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isSendingOtp}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg py-2.5 transition-colors inline-flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoginMode ? 'Login' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ user, sizeClass = 'w-9 h-9', textClass = 'text-xs', ringClass = 'ring-2 ring-white' }) {
  const avatarUrl = String(user?.avatarUrl || '').trim();
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  if (avatarUrl && !hasImageError) {
    return (
      <img
        src={avatarUrl}
        alt={user?.username || user?.email || 'User avatar'}
        className={`${sizeClass} rounded-full object-cover bg-white ${ringClass}`}
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-semibold uppercase ${ringClass}`}
    >
      <span className={textClass}>{getInitials(user?.username || user?.email || 'U')}</span>
    </div>
  );
}

function ProfileSettingsView({
  currentUser,
  onBack,
  onLogout,
  onSaveProfile,
  onChangePassword,
  onRequestPasswordOtp,
  onVerifyPasswordOtp,
  onVerifyPasswordWithGoogle,
  projectInvitations = [],
  onRespondToProjectInvite,
}) {
  const [username, setUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('otp');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [isSavingProfileEditor, setIsSavingProfileEditor] = useState(false);
  const [passwordVerification, setPasswordVerification] = useState({
    verified: false,
    method: '',
    proof: null,
  });
  const [passwordResult, setPasswordResult] = useState(null);

  useEffect(() => {
    setUsername(currentUser.username || '');
    setEmail(currentUser.email || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setNewPassword('');
    setConfirmNewPassword('');
    setVerificationMethod('otp');
    setOtpCode('');
    setPasswordVerification({
      verified: false,
      method: '',
      proof: null,
    });
    setPasswordResult(null);
    setInviteResult(null);
  }, [currentUser.id, currentUser.username, currentUser.email, currentUser.avatarUrl]);

  useEffect(() => {
    setPasswordVerification({
      verified: false,
      method: '',
      proof: null,
    });
  }, [verificationMethod, newPassword]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileResult({ ok: false, message: 'Please select an image file only.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result || ''));
      setProfileResult(null);
    };
    reader.readAsDataURL(file);
  };

  const openProfileEditor = () => {
    setUsername(currentUser.username || '');
    setEmail(currentUser.email || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setNewPassword('');
    setConfirmNewPassword('');
    setVerificationMethod('otp');
    setOtpCode('');
    setPasswordVerification({
      verified: false,
      method: '',
      proof: null,
    });
    setPasswordResult(null);
    setProfileResult(null);
    setIsProfileEditorOpen(true);
  };

  const ensureGoogleSdkLoaded = async () => {
    if (window.google?.accounts?.oauth2) return;
    await new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        if (window.google?.accounts?.oauth2) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google SDK.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google SDK.'));
      document.head.appendChild(script);
    });
  };

  const requestGoogleAccessToken = async () => {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google OAuth is not configured.');
    }
    await ensureGoogleSdkLoaded();
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
      throw new Error('Google SDK is not ready.');
    }

    return await new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (tokenResponse) => {
          const accessToken = String(tokenResponse?.access_token || '').trim();
          if (!accessToken) {
            reject(new Error(tokenResponse?.error || 'Google verification failed.'));
            return;
          }
          resolve(accessToken);
        },
        error_callback: () => {
          reject(new Error('Google popup was blocked or closed.'));
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  };

  const handleSendOtp = async () => {
    if (!onRequestPasswordOtp) {
      setPasswordResult({ ok: false, message: 'OTP verification is unavailable.' });
      return;
    }
    setIsSendingOtp(true);
    setPasswordResult(null);
    try {
      const result = await Promise.resolve(onRequestPasswordOtp());
      setPasswordResult(result || { ok: true, message: 'OTP has been sent.' });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const normalizedOtp = String(otpCode || '').trim();
    if (!normalizedOtp) {
      setPasswordResult({ ok: false, message: 'Please enter OTP code.' });
      return;
    }
    if (!onVerifyPasswordOtp) {
      setPasswordResult({ ok: false, message: 'OTP verification is unavailable.' });
      return;
    }
    setIsVerifyingOtp(true);
    setPasswordResult(null);
    try {
      const result = await Promise.resolve(onVerifyPasswordOtp({ otp: normalizedOtp }));
      if (!result?.ok) {
        setPasswordVerification({
          verified: false,
          method: '',
          proof: null,
        });
        setPasswordResult(result || { ok: false, message: 'OTP verification failed.' });
        return;
      }
      setPasswordVerification({
        verified: true,
        method: 'otp',
        proof: result.proof || {
          method: 'otp',
          otp: normalizedOtp,
        },
      });
      setPasswordResult({ ok: true, message: result.message || 'OTP verified successfully.' });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleVerifyGoogle = async () => {
    if (!onVerifyPasswordWithGoogle) {
      setPasswordResult({ ok: false, message: 'Google verification is unavailable.' });
      return;
    }
    setIsVerifyingGoogle(true);
    setPasswordResult(null);
    try {
      const accessToken = await requestGoogleAccessToken();
      const result = await Promise.resolve(onVerifyPasswordWithGoogle({ accessToken }));
      if (!result?.ok) {
        setPasswordVerification({
          verified: false,
          method: '',
          proof: null,
        });
        setPasswordResult(result || { ok: false, message: 'Google verification failed.' });
        return;
      }
      setPasswordVerification({
        verified: true,
        method: 'google',
        proof: result.proof || {
          method: 'google',
          accessToken,
        },
      });
      setPasswordResult({ ok: true, message: result.message || 'Google account verified.' });
    } catch (error) {
      setPasswordVerification({
        verified: false,
        method: '',
        proof: null,
      });
      setPasswordResult({ ok: false, message: error.message || 'Google verification failed.' });
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedAvatarUrl = String(avatarUrl || '').trim();
    const wantsPasswordChange = Boolean(newPassword || confirmNewPassword);

    if (!normalizedUsername) {
      setProfileResult({ ok: false, message: 'Username is required.' });
      return;
    }
    if (wantsPasswordChange && (!newPassword || !confirmNewPassword)) {
      setPasswordResult({ ok: false, message: 'Please fill in new password fields.' });
      return;
    }
    if (wantsPasswordChange && newPassword !== confirmNewPassword) {
      setPasswordResult({ ok: false, message: 'New password and confirm password do not match.' });
      return;
    }
    if (wantsPasswordChange && newPassword.length < 6) {
      setPasswordResult({ ok: false, message: 'New password must be at least 6 characters.' });
      return;
    }
    if (wantsPasswordChange && (!passwordVerification.verified || !passwordVerification.proof)) {
      setPasswordResult({
        ok: false,
        message: 'Please verify identity by OTP or Google before changing password.',
      });
      return;
    }

    setIsSavingProfileEditor(true);
    setProfileResult(null);
    setPasswordResult(null);
    try {
      const profileChanged =
        normalizedUsername !== String(currentUser.username || '').trim().toLowerCase() ||
        normalizedAvatarUrl !== String(currentUser.avatarUrl || '').trim();
      let profileSaveResult = { ok: true, message: '' };
      if (profileChanged) {
        profileSaveResult = await Promise.resolve(
          onSaveProfile({ username: normalizedUsername, avatarUrl: normalizedAvatarUrl })
        );
        setProfileResult(profileSaveResult);
        if (!profileSaveResult?.ok) {
          return;
        }
      }

      if (wantsPasswordChange) {
        const passwordSaveResult = await Promise.resolve(
          onChangePassword({
            newPassword,
            verification: passwordVerification.proof,
          })
        );
        setPasswordResult(passwordSaveResult);
        if (!passwordSaveResult?.ok) {
          return;
        }
      }

      if (!profileChanged && !wantsPasswordChange) {
        setProfileResult({ ok: true, message: 'No changes to save.' });
        return;
      }

      setIsProfileEditorOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpCode('');
      setPasswordVerification({
        verified: false,
        method: '',
        proof: null,
      });
    } finally {
      setIsSavingProfileEditor(false);
    }
  };

  const handleInvitationResponse = async (inviteId, decision) => {
    if (!onRespondToProjectInvite) return;
    const result = await Promise.resolve(onRespondToProjectInvite(inviteId, decision));
    setInviteResult(result || null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to calendar
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex md:hidden items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit">
            <div className="flex flex-col items-center text-center">
              <UserAvatar
                user={currentUser}
                sizeClass="w-24 h-24"
                textClass="text-2xl"
                ringClass="ring-4 ring-white shadow-sm"
              />
              <h2 className="mt-4 text-lg font-semibold text-gray-800 break-all">
                {currentUser.username || 'username'}
              </h2>
              <p className="text-sm text-gray-500 break-all">{currentUser.email || 'email@example.com'}</p>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                Profile fields on this page are read-only. Tap the pencil icon to edit.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Profile</h3>
                <button
                  type="button"
                  onClick={openProfileEditor}
                  className="h-8 w-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-blue-600 inline-flex items-center justify-center"
                  title="Edit profile"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Username</span>
                  <p className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-800">
                    {currentUser.username || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Email</span>
                  <p className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-700 break-all">
                    {currentUser.email || '-'}
                  </p>
                </div>
              </div>
            </div>

            {projectInvitations.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Project Invitations</h3>
                  <span className="text-xs font-medium rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 border border-blue-200">
                    Pending {projectInvitations.length}
                  </span>
                </div>

                {inviteResult?.message && (
                  <p
                    className={`text-sm rounded-lg px-3 py-2 border ${
                      inviteResult.ok
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}
                  >
                    {inviteResult.message}
                  </p>
                )}

                <div className="space-y-3">
                  {projectInvitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 flex flex-col gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{invite.projectName || 'Untitled project'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Invited by <span className="font-medium text-gray-700">{invite.ownerUsername || '-'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleInvitationResponse(invite.id, PROJECT_INVITE_STATUSES.ACCEPTED)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInvitationResponse(invite.id, PROJECT_INVITE_STATUSES.DECLINED)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 text-xs font-medium"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleProfileSubmit}
            noValidate
            className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Edit profile</h3>
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-[120px,1fr] gap-4 items-start">
                <div className="flex flex-col items-center gap-2">
                  <UserAvatar
                    user={{ ...currentUser, username, avatarUrl }}
                    sizeClass="w-20 h-20"
                    textClass="text-xl"
                    ringClass="ring-2 ring-white shadow-sm"
                  />
                </div>
                <div className="space-y-4">
                  <label className="space-y-1 block">
                    <span className="text-sm font-medium text-gray-600">Username</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="username"
                      autoFocus
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-sm font-medium text-gray-600">Email</span>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-avatar-upload"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      <ImageIcon className="w-4 h-4" /> Upload image
                    </label>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" /> Remove image
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-gray-50/40">
                <h4 className="text-sm font-semibold text-gray-800">Change password (requires verification)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1 block">
                    <span className="text-sm font-medium text-gray-600">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      minLength={6}
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-sm font-medium text-gray-600">Confirm new password</span>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      minLength={6}
                    />
                  </label>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('otp')}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      verificationMethod === 'otp'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Verify by OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('google')}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      verificationMethod === 'google'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Verify by Google
                  </button>
                </div>

                {verificationMethod === 'otp' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                          isSendingOtp
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                      </button>
                      <span className="text-xs text-gray-500">OTP will be sent to {email}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter OTP code"
                        className="w-full sm:w-52 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          isVerifyingOtp
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleVerifyGoogle}
                      disabled={isVerifyingGoogle}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        isVerifyingGoogle
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-black text-white'
                      }`}
                    >
                      {isVerifyingGoogle ? 'Verifying with Google...' : 'Verify with Google account'}
                    </button>
                    <p className="text-xs text-gray-500">Use the same Gmail account as your login account.</p>
                  </div>
                )}

                {Boolean(newPassword) && (
                  <p
                    className={`text-xs px-2.5 py-2 rounded-lg border ${
                      passwordVerification.verified
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}
                  >
                    {passwordVerification.verified
                      ? `Identity verified by ${passwordVerification.method === 'google' ? 'Google' : 'OTP'}.`
                      : 'Please verify identity before saving new password.'}
                  </p>
                )}
              </div>

              {profileResult && (
                <p
                  className={`text-sm rounded-lg px-3 py-2 border ${
                    profileResult.ok
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {profileResult.message}
                </p>
              )}
              {passwordResult && (
                <p
                  className={`text-sm rounded-lg px-3 py-2 border ${
                    passwordResult.ok
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {passwordResult.message}
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfileEditor}
                className={`px-4 py-2 rounded-lg text-white ${
                  isSavingProfileEditor
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSavingProfileEditor ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CalendarApp({ currentUser, onLogout, onUpdateCurrentUser }) {
  const popup = usePopup();
  // --- State ---
  const [projects, setProjects] = useState([]);

  const [events, setEvents] = useState([]);
  const [isAccountDataHydrated, setIsAccountDataHydrated] = useState(false);

  const [isMergeView, setIsMergeView] = useState(false);
  const [mobileCalendarProjectId, setMobileCalendarProjectId] = useState(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Project Dashboard Navigation
  const [activeDashboardProjectId, setActiveDashboardProjectId] = useState(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState(DEFAULT_PROJECT_DASHBOARD_TAB);
  const [isProfileViewOpen, setIsProfileViewOpen] = useState(false);

  // Data for Event Modal
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState(null);
  const [preSelectedProjectId, setPreSelectedProjectId] = useState(null);

  // --- New Settings State ---
  const [displayRange, setDisplayRange] = useState(() => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endObj = new Date(now.getFullYear(), now.getMonth() + 11, 1);
    const end = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}`;
    return { start, end };
  });
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  const [startupView, setStartupView] = useState(STARTUP_VIEW_MODES.LAST);
  const [lastVisitedView, setLastVisitedView] = useState(() => ({ ...DEFAULT_LAST_VISITED_VIEW }));
  const [projectUpdatePopupMode, setProjectUpdatePopupMode] = useState(
    DEFAULT_PROJECT_UPDATE_POPUP_MODE
  );
  const [seenProjectUpdateIds, setSeenProjectUpdateIds] = useState([]);
  const [isProjectUpdatesPopupOpen, setIsProjectUpdatesPopupOpen] = useState(false);
  const [projectUpdateToastNotice, setProjectUpdateToastNotice] = useState(null);
  const [isProjectUpdateToastVisible, setIsProjectUpdateToastVisible] = useState(false);
  const [hasInitializedProjectUpdateSession, setHasInitializedProjectUpdateSession] = useState(false);
  const [hasPendingFullPopupOnReturn, setHasPendingFullPopupOnReturn] = useState(false);
  const [hasAppliedStartupView, setHasAppliedStartupView] = useState(false);
  const [projectInvitations, setProjectInvitations] = useState(() =>
    AUTH_API_BASE_URL ? [] : getProjectInvites()
  );
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState(() => ({
    ...DEFAULT_GOOGLE_CALENDAR_STATUS,
  }));
  const [googleCalendarCalendars, setGoogleCalendarCalendars] = useState([]);
  const [googleCalendarSelectedCalendarIds, setGoogleCalendarSelectedCalendarIds] = useState([]);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [isGoogleCalendarBusy, setIsGoogleCalendarBusy] = useState(false);
  const [isGoogleCalendarCalendarsLoading, setIsGoogleCalendarCalendarsLoading] = useState(false);
  const [isGoogleCalendarSelectionSaving, setIsGoogleCalendarSelectionSaving] = useState(false);
  const [isGoogleCalendarEventsLoading, setIsGoogleCalendarEventsLoading] = useState(false);
  const writableGoogleCalendars = useMemo(
    () => (Array.isArray(googleCalendarCalendars) ? googleCalendarCalendars : []).filter((calendar) => canWriteGoogleCalendar(calendar)),
    [googleCalendarCalendars]
  );
  const defaultWritableGoogleCalendarId = useMemo(() => {
    const selectedIds = normalizeGoogleCalendarSelection(googleCalendarSelectedCalendarIds);
    const selectedWritable = selectedIds.find((calendarId) =>
      writableGoogleCalendars.some((calendar) => calendar.id === calendarId)
    );
    return selectedWritable || writableGoogleCalendars[0]?.id || '';
  }, [googleCalendarSelectedCalendarIds, writableGoogleCalendars]);
  const projectsRef = useRef(projects);
  const eventsRef = useRef(events);
  const previousUnseenProjectUpdateIdsRef = useRef([]);
  const projectUpdateToastTimersRef = useRef({ autoHide: null, clear: null });

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event) => {
      setIsCompactViewport(event.matches);
    };

    setIsCompactViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setIsAccountDataHydrated(false);
    setHasAppliedStartupView(false);

    const hydrateFromStore = async () => {
      try {
        const [accountPayload, invites] = await Promise.all([
          loadAccountDbPayload(currentUser.id),
          loadProjectInvitesStore(),
        ]);
        if (isCancelled) return;

        setProjectInvitations(invites);

        if (Array.isArray(accountPayload.projects)) {
          setProjects(accountPayload.projects.map((project) => ensureProjectOwnership(project, currentUser)));
        } else {
          setProjects([]);
        }

        if (Array.isArray(accountPayload.events)) {
          setEvents(accountPayload.events);
        } else {
          setEvents([]);
        }

        if (accountPayload.displayRange?.start && accountPayload.displayRange?.end) {
          setDisplayRange(accountPayload.displayRange);
        }

        if (typeof accountPayload.hidePastWeeks === 'boolean') {
          setHidePastWeeks(accountPayload.hidePastWeeks);
        }

        if (VALID_STARTUP_VIEWS.has(accountPayload.startupView)) {
          setStartupView(accountPayload.startupView);
        } else {
          setStartupView(STARTUP_VIEW_MODES.LAST);
        }

        setLastVisitedView(normalizeLastVisitedView(accountPayload.lastVisitedView));
        if (VALID_PROJECT_UPDATE_POPUP_MODES.has(accountPayload.projectUpdatePopupMode)) {
          setProjectUpdatePopupMode(accountPayload.projectUpdatePopupMode);
        } else {
          setProjectUpdatePopupMode(DEFAULT_PROJECT_UPDATE_POPUP_MODE);
        }
        const hydratedSeenIds = Array.from(
          new Set(
            (Array.isArray(accountPayload.seenProjectUpdateIds) ? accountPayload.seenProjectUpdateIds : [])
              .map((id) => String(id || '').trim())
              .filter(Boolean)
          )
        );
        setSeenProjectUpdateIds(hydratedSeenIds.slice(-1400));
        setIsProjectUpdatesPopupOpen(false);
        setProjectUpdateToastNotice(null);
        setIsProjectUpdateToastVisible(false);
        setHasInitializedProjectUpdateSession(false);
        setHasPendingFullPopupOnReturn(false);
        previousUnseenProjectUpdateIdsRef.current = [];
      } catch {
        if (isCancelled) return;
        setProjects([]);
        setEvents([]);
        setStartupView(STARTUP_VIEW_MODES.LAST);
        setLastVisitedView({ ...DEFAULT_LAST_VISITED_VIEW });
        setProjectUpdatePopupMode(DEFAULT_PROJECT_UPDATE_POPUP_MODE);
        setSeenProjectUpdateIds([]);
        setIsProjectUpdatesPopupOpen(false);
        setProjectUpdateToastNotice(null);
        setIsProjectUpdateToastVisible(false);
        setHasInitializedProjectUpdateSession(false);
        setHasPendingFullPopupOnReturn(false);
        previousUnseenProjectUpdateIdsRef.current = [];
      } finally {
        if (!isCancelled) {
          setIsAccountDataHydrated(true);
        }
      }
    };

    void hydrateFromStore();
    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!isProfileViewOpen) return;
    let isCancelled = false;
    const refreshInvites = async () => {
      const latestInvites = await loadProjectInvitesStore();
      if (!isCancelled) {
        setProjectInvitations(latestInvites);
      }
    };
    void refreshInvites();
    return () => {
      isCancelled = true;
    };
  }, [isProfileViewOpen]);

  const refreshGoogleCalendarStatus = async () => {
    if (!AUTH_API_BASE_URL) {
      const fallbackStatus = normalizeGoogleCalendarStatus({
        linked: false,
        configured: false,
      });
      setGoogleCalendarStatus(fallbackStatus);
      setGoogleCalendarCalendars([]);
      setGoogleCalendarSelectedCalendarIds([]);
      return fallbackStatus;
    }

    try {
      const result = await requestCloudDataApi(
        `/google/calendar/status?userId=${encodeURIComponent(currentUser.id)}`
      );
      const normalizedStatus = normalizeGoogleCalendarStatus(result);
      setGoogleCalendarStatus(normalizedStatus);
      if (normalizedStatus.linked) {
        setGoogleCalendarSelectedCalendarIds(normalizedStatus.selectedCalendarIds);
      } else {
        setGoogleCalendarCalendars([]);
        setGoogleCalendarSelectedCalendarIds([]);
      }
      return normalizedStatus;
    } catch (error) {
      const fallbackStatus = normalizeGoogleCalendarStatus({
        linked: false,
        configured: false,
      });
      setGoogleCalendarStatus(fallbackStatus);
      setGoogleCalendarCalendars([]);
      setGoogleCalendarSelectedCalendarIds([]);
      throw error;
    }
  };

  const refreshGoogleCalendarCalendars = async () => {
    if (!AUTH_API_BASE_URL) {
      setGoogleCalendarCalendars([]);
      setGoogleCalendarSelectedCalendarIds([]);
      return { calendars: [], selectedCalendarIds: [] };
    }

    setIsGoogleCalendarCalendarsLoading(true);
    try {
      const result = await requestCloudDataApi(
        `/google/calendar/calendars?userId=${encodeURIComponent(currentUser.id)}`
      );
      const calendars = normalizeGoogleCalendarCalendars(result?.calendars);
      const availableCalendarIds = new Set(calendars.map((calendar) => calendar.id));
      const selectedCalendarIds = normalizeGoogleCalendarSelection(result?.selectedCalendarIds).filter((id) =>
        availableCalendarIds.has(id)
      );
      const effectiveSelectedCalendarIds =
        selectedCalendarIds.length > 0 ? selectedCalendarIds : calendars.map((calendar) => calendar.id);

      setGoogleCalendarCalendars(calendars);
      setGoogleCalendarSelectedCalendarIds(effectiveSelectedCalendarIds);
      setGoogleCalendarStatus((prev) =>
        normalizeGoogleCalendarStatus({
          ...prev,
          selectedCalendarIds,
          updatedAt: result?.updatedAt || prev?.updatedAt || null,
        })
      );

      return {
        calendars,
        selectedCalendarIds: effectiveSelectedCalendarIds,
      };
    } catch (error) {
      setGoogleCalendarCalendars([]);
      setGoogleCalendarSelectedCalendarIds([]);
      throw error;
    } finally {
      setIsGoogleCalendarCalendarsLoading(false);
    }
  };

  const handleSaveGoogleCalendarSelection = async (selectedCalendarIdsInput) => {
    if (!AUTH_API_BASE_URL) {
      return {
        ok: false,
        message: 'Cloud Auth API is not configured.',
      };
    }

    const selectedCalendarIds = normalizeGoogleCalendarSelection(selectedCalendarIdsInput);
    if (selectedCalendarIds.length === 0) {
      return {
        ok: false,
        message: 'Please select at least 1 calendar.',
      };
    }

    setIsGoogleCalendarSelectionSaving(true);
    try {
      const result = await requestCloudDataApi(
        `/google/calendar/calendars?userId=${encodeURIComponent(currentUser.id)}`,
        {
          method: 'PUT',
          body: { selectedCalendarIds },
        }
      );

      const calendars = normalizeGoogleCalendarCalendars(result?.calendars);
      const availableCalendarIds = new Set(calendars.map((calendar) => calendar.id));
      const savedSelectedCalendarIds = normalizeGoogleCalendarSelection(result?.selectedCalendarIds).filter((id) =>
        availableCalendarIds.has(id)
      );
      const effectiveSelectedCalendarIds =
        savedSelectedCalendarIds.length > 0
          ? savedSelectedCalendarIds
          : calendars.map((calendar) => calendar.id);

      setGoogleCalendarCalendars(calendars);
      setGoogleCalendarSelectedCalendarIds(effectiveSelectedCalendarIds);
      setGoogleCalendarStatus((prev) =>
        normalizeGoogleCalendarStatus({
          ...prev,
          selectedCalendarIds: savedSelectedCalendarIds,
          updatedAt: result?.updatedAt || prev?.updatedAt || null,
        })
      );

      return {
        ok: true,
        message: 'Google Calendar selection updated.',
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Failed to save Google Calendar selection.',
      };
    } finally {
      setIsGoogleCalendarSelectionSaving(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    setGoogleCalendarEvents([]);
    setGoogleCalendarStatus({ ...DEFAULT_GOOGLE_CALENDAR_STATUS });
    setGoogleCalendarCalendars([]);
    setGoogleCalendarSelectedCalendarIds([]);

    const loadStatus = async () => {
      if (!AUTH_API_BASE_URL) return;
      try {
        const result = await requestCloudDataApi(
          `/google/calendar/status?userId=${encodeURIComponent(currentUser.id)}`
        );
        if (isCancelled) return;
        const normalizedStatus = normalizeGoogleCalendarStatus(result);
        setGoogleCalendarStatus(normalizedStatus);
        setGoogleCalendarSelectedCalendarIds(normalizedStatus.selectedCalendarIds);
      } catch (error) {
        if (isCancelled) return;
        setGoogleCalendarStatus(
          normalizeGoogleCalendarStatus({
            linked: false,
            configured: false,
          })
        );
        setGoogleCalendarCalendars([]);
        setGoogleCalendarSelectedCalendarIds([]);
        console.warn('Failed to load Google Calendar status:', error.message);
      }
    };

    void loadStatus();
    return () => {
      isCancelled = true;
    };
  }, [currentUser.id]);

  useEffect(() => {
    const shouldLoadGoogleCalendars = showProjectModal || showEventModal;
    if (!shouldLoadGoogleCalendars || !googleCalendarStatus.linked || !AUTH_API_BASE_URL) {
      if (!googleCalendarStatus.linked) {
        setGoogleCalendarCalendars([]);
        setGoogleCalendarSelectedCalendarIds([]);
      }
      return;
    }

    let isCancelled = false;
    const loadGoogleCalendars = async () => {
      try {
        await refreshGoogleCalendarCalendars();
      } catch (error) {
        if (!isCancelled) {
          console.warn('Failed to load Google Calendar list:', error.message);
        }
      }
    };

    void loadGoogleCalendars();
    return () => {
      isCancelled = true;
    };
  }, [showProjectModal, showEventModal, googleCalendarStatus.linked, currentUser.id]);

  useEffect(() => {
    if (!isAccountDataHydrated) return;

    const dbPayload = {
      projects,
      events,
      displayRange,
      hidePastWeeks,
      startupView,
      lastVisitedView,
      projectUpdatePopupMode,
      seenProjectUpdateIds,
    };

    void saveAccountDbPayload(currentUser.id, dbPayload);
  }, [
    isAccountDataHydrated,
    currentUser.id,
    projects,
    events,
    displayRange,
    hidePastWeeks,
    startupView,
    lastVisitedView,
    projectUpdatePopupMode,
    seenProjectUpdateIds,
  ]);

  useEffect(() => {
    if (!isAccountDataHydrated || hasAppliedStartupView) return;

    const getProjectForProjectStartup = () => {
      const preferredId = String(lastVisitedView?.projectId || '').trim();
      if (preferredId && projects.some((project) => project.id === preferredId)) {
        return preferredId;
      }

      const firstVisibleProject = projects.find((project) => project.isVisible);
      return firstVisibleProject?.id || projects[0]?.id || null;
    };

    let nextProjectId = null;
    let nextProjectTab = DEFAULT_PROJECT_DASHBOARD_TAB;
    let nextProfileViewOpen = false;
    let nextProjectManagerOpen = false;

    if (startupView === STARTUP_VIEW_MODES.PROJECT) {
      nextProjectId = getProjectForProjectStartup();
    } else if (
      startupView === STARTUP_VIEW_MODES.LAST &&
      lastVisitedView?.type === STARTUP_VIEW_MODES.PROJECT
    ) {
      const savedProjectId = String(lastVisitedView.projectId || '').trim();
      nextProjectId = projects.some((project) => project.id === savedProjectId) ? savedProjectId : null;
      nextProjectTab = normalizeProjectDashboardTab(lastVisitedView.projectTab);
    } else if (startupView === STARTUP_VIEW_MODES.LAST) {
      nextProfileViewOpen = Boolean(lastVisitedView?.profileOpen);
      nextProjectManagerOpen =
        !nextProfileViewOpen &&
        !nextProjectId &&
        lastVisitedView?.type === STARTUP_VIEW_MODES.CALENDAR &&
        Boolean(lastVisitedView?.projectManagerOpen);
    }

    setActiveDashboardProjectId(nextProjectId);
    setActiveDashboardTab(nextProjectTab);
    setIsProfileViewOpen(nextProfileViewOpen);
    setShowProjectModal(nextProjectManagerOpen);
    setHasAppliedStartupView(true);
  }, [isAccountDataHydrated, hasAppliedStartupView, startupView, lastVisitedView, projects]);

  useEffect(() => {
    if (!isAccountDataHydrated || !hasAppliedStartupView) return;

    setLastVisitedView((prev) => {
      if (isProfileViewOpen) {
        if (
          prev.type === STARTUP_VIEW_MODES.CALENDAR &&
          prev.projectId === null &&
          normalizeProjectDashboardTab(prev.projectTab) === DEFAULT_PROJECT_DASHBOARD_TAB &&
          prev.profileOpen &&
          !prev.projectManagerOpen
        ) {
          return prev;
        }
        return {
          type: STARTUP_VIEW_MODES.CALENDAR,
          projectId: null,
          projectTab: DEFAULT_PROJECT_DASHBOARD_TAB,
          profileOpen: true,
          projectManagerOpen: false,
        };
      }

      if (activeDashboardProjectId) {
        const normalizedProjectTab = normalizeProjectDashboardTab(activeDashboardTab);
        if (
          prev.type === STARTUP_VIEW_MODES.PROJECT &&
          prev.projectId === activeDashboardProjectId &&
          normalizeProjectDashboardTab(prev.projectTab) === normalizedProjectTab &&
          !prev.profileOpen &&
          !prev.projectManagerOpen
        ) {
          return prev;
        }
        return {
          type: STARTUP_VIEW_MODES.PROJECT,
          projectId: activeDashboardProjectId,
          projectTab: normalizedProjectTab,
          profileOpen: false,
          projectManagerOpen: false,
        };
      }

      const normalizedCalendarManagerOpen = Boolean(showProjectModal);
      if (
        prev.type === STARTUP_VIEW_MODES.CALENDAR &&
        prev.projectId === null &&
        normalizeProjectDashboardTab(prev.projectTab) === DEFAULT_PROJECT_DASHBOARD_TAB &&
        !prev.profileOpen &&
        Boolean(prev.projectManagerOpen) === normalizedCalendarManagerOpen
      ) {
        return prev;
      }
      return {
        type: STARTUP_VIEW_MODES.CALENDAR,
        projectId: null,
        projectTab: DEFAULT_PROJECT_DASHBOARD_TAB,
        profileOpen: false,
        projectManagerOpen: normalizedCalendarManagerOpen,
      };
    });
  }, [
    isAccountDataHydrated,
    hasAppliedStartupView,
    activeDashboardProjectId,
    activeDashboardTab,
    isProfileViewOpen,
    showProjectModal,
  ]);

  // Current week calculation
  const currentWeekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, []);

  // Generate months for the scrollable view
  const monthsToRender = useMemo(() => {
    if (!displayRange.start || !displayRange.end) return [];
    const [startYear, startMonth] = displayRange.start.split('-').map(Number);
    const [endYear, endMonth] = displayRange.end.split('-').map(Number);
    
    const months = [];
    let y = startYear;
    let m = startMonth - 1; 

    while (y < endYear || (y === endYear && m <= endMonth - 1)) {
      const lastDayOfMonth = new Date(y, m + 1, 0);
      const isCompletelyPast = hidePastWeeks && lastDayOfMonth < currentWeekStart;
      
      if (!isCompletelyPast) {
        months.push({ year: y, month: m });
      }

      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (months.length > 60) break; // Limit to 5 years max to prevent infinite loops
    }
    return months;
  }, [displayRange, hidePastWeeks, currentWeekStart]);

  const mergeViewRange = useMemo(() => {
    if (!monthsToRender.length) return null;
    const firstMonth = monthsToRender[0];
    const lastMonth = monthsToRender[monthsToRender.length - 1];
    const startDate = new Date(firstMonth.year, firstMonth.month, 1);
    const endDate = new Date(lastMonth.year, lastMonth.month + 1, 1);
    return {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
    };
  }, [monthsToRender]);

  // Derived state
  const visibleProjects = projects.filter(p => p.isVisible);
  const mobileVisibleProjects = visibleProjects.slice(0, 4);
  const selectedMobileProject = useMemo(
    () => visibleProjects.find((project) => project.id === mobileCalendarProjectId) || null,
    [visibleProjects, mobileCalendarProjectId]
  );
  const effectiveMergeView = isCompactViewport ? !selectedMobileProject : isMergeView;
  const mergeViewProjects = useMemo(() => {
    if (!googleCalendarStatus.linked) return visibleProjects;
    const alreadyIncluded = visibleProjects.some((project) => project.id === GOOGLE_CALENDAR_PROJECT_ID);
    return alreadyIncluded ? visibleProjects : [...visibleProjects, GOOGLE_CALENDAR_PROJECT_META];
  }, [visibleProjects, googleCalendarStatus.linked]);
	  const mergeViewEvents = useMemo(() => {
	    if (!googleCalendarStatus.linked || googleCalendarEvents.length === 0) return events;
	    const localEventIdSet = new Set(
	      events.map((event) => String(event?.id || '').trim()).filter(Boolean)
	    );
	    const localLinkedGoogleEventIdSet = new Set(
	      events
	        .map((event) =>
	          String(event?.googleCalendarLinkedEventId || event?.googleEventId || '').trim()
	        )
	        .filter(Boolean)
	    );
	    const filteredGoogleEvents = googleCalendarEvents.filter((event) => {
	      const linkedPmEventId = String(event?.pmCalendarEventId || '').trim();
	      if (linkedPmEventId && localEventIdSet.has(linkedPmEventId)) return false;
	      const googleEventId = String(event?.googleEventId || '').trim();
	      if (googleEventId && localLinkedGoogleEventIdSet.has(googleEventId)) return false;
	      return true;
	    });
	    return [...events, ...filteredGoogleEvents];
	  }, [events, googleCalendarStatus.linked, googleCalendarEvents]);
  const mobileCalendarProjects = selectedMobileProject ? [selectedMobileProject] : mergeViewProjects;
  const mobileCalendarEvents = selectedMobileProject
    ? events.filter((event) => event.projectId === selectedMobileProject.id)
    : mergeViewEvents;
  const pendingProjectInvitations = useMemo(
    () =>
      projectInvitations.filter(
        (invite) =>
          invite.status === PROJECT_INVITE_STATUSES.PENDING && isInviteForUser(invite, currentUser)
      ),
    [projectInvitations, currentUser]
  );
  const todayProjectActivityDigest = useMemo(() => {
    const todayKey = toLocalDayKey(new Date());
    const seenSet = new Set(
      (Array.isArray(seenProjectUpdateIds) ? seenProjectUpdateIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );

    const groups = projects
      .map((project) => {
        const entries = normalizeProjectActivityFeed(project.changeFeed, project).filter((entry) => {
          if (!PROJECT_ACTIVITY_POPUP_TYPES.has(entry.type)) return false;
          return toLocalDayKey(entry.createdAt) === todayKey;
        });
        if (entries.length === 0) return null;

        const unseenEntries = entries.filter((entry) => !seenSet.has(entry.id));
        const seenEntries = entries.filter((entry) => seenSet.has(entry.id));
        const counts = {
          events: entries.filter((entry) => entry.type === PROJECT_ACTIVITY_TYPES.EVENT_CREATED).length,
          tasks: entries.filter((entry) => entry.type === PROJECT_ACTIVITY_TYPES.TASK_CREATED).length,
          members: entries.filter((entry) => entry.type === PROJECT_ACTIVITY_TYPES.MEMBER_JOINED).length,
          statuses: entries.filter(
            (entry) => entry.type === PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED
          ).length,
          announcements: entries.filter((entry) => entry.type === PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT)
            .length,
        };

        return {
          projectId: project.id,
          projectName: project.name,
          colorIndex: project.colorIndex,
          latestAt: entries[0]?.createdAt || '',
          entries,
          unseenEntries,
          seenEntries,
          counts,
        };
      })
      .filter(Boolean)
      .sort((left, right) => new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime());

    const unseenIds = groups.flatMap((group) => group.unseenEntries.map((entry) => entry.id));
    const allIds = groups.flatMap((group) => group.entries.map((entry) => entry.id));

    return {
      todayKey,
      groups,
      unseenIds,
      allIds,
      unseenSignature: unseenIds.join('|'),
      hasAnyTodayUpdates: groups.length > 0,
      hasUnseenUpdates: unseenIds.length > 0,
    };
  }, [projects, seenProjectUpdateIds]);
  const markProjectUpdateEntriesAsSeen = (entryIds) => {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(entryIds) ? entryIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
    if (normalizedIds.length === 0) return;
    setSeenProjectUpdateIds((prev) =>
      Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...normalizedIds])).slice(-1400)
    );
  };
  const closeProjectUpdatesPopup = ({ markAsSeen = true } = {}) => {
    if (markAsSeen) {
      markProjectUpdateEntriesAsSeen(todayProjectActivityDigest.allIds);
    }
    setIsProjectUpdatesPopupOpen(false);
  };
  const clearProjectUpdateToastTimers = () => {
    const { autoHide, clear } = projectUpdateToastTimersRef.current;
    if (autoHide) {
      window.clearTimeout(autoHide);
    }
    if (clear) {
      window.clearTimeout(clear);
    }
    projectUpdateToastTimersRef.current = { autoHide: null, clear: null };
  };
  const hideProjectUpdateToast = () => {
    clearProjectUpdateToastTimers();
    setIsProjectUpdateToastVisible(false);
    projectUpdateToastTimersRef.current.clear = window.setTimeout(() => {
      setProjectUpdateToastNotice(null);
      projectUpdateToastTimersRef.current.clear = null;
    }, PROJECT_UPDATE_TOAST_EXIT_MS);
  };
  const showProjectUpdateToast = (notice) => {
    if (!notice) return;
    clearProjectUpdateToastTimers();
    setProjectUpdateToastNotice(notice);
    setIsProjectUpdateToastVisible(true);
    projectUpdateToastTimersRef.current.autoHide = window.setTimeout(() => {
      hideProjectUpdateToast();
    }, PROJECT_UPDATE_TOAST_AUTO_CLOSE_MS);
  };
  const openProjectUpdatesPopup = () => {
    clearProjectUpdateToastTimers();
    setProjectUpdateToastNotice(null);
    setIsProjectUpdateToastVisible(false);
    setIsProjectUpdatesPopupOpen(true);
  };

  useEffect(() => {
    return () => {
      clearProjectUpdateToastTimers();
    };
  }, []);

  useEffect(() => {
    if (isProjectUpdatesPopupOpen) {
      clearProjectUpdateToastTimers();
      setProjectUpdateToastNotice(null);
      setIsProjectUpdateToastVisible(false);
    }
  }, [isProjectUpdatesPopupOpen]);

  useEffect(() => {
    if (!isAccountDataHydrated) return;

    const currentUnseenIds = Array.isArray(todayProjectActivityDigest.unseenIds)
      ? todayProjectActivityDigest.unseenIds
      : [];
    const previousUnseenIds = Array.isArray(previousUnseenProjectUpdateIdsRef.current)
      ? previousUnseenProjectUpdateIdsRef.current
      : [];
    const previousUnseenSet = new Set(previousUnseenIds);
    const newlyArrivedUnseenIds = currentUnseenIds.filter((id) => !previousUnseenSet.has(id));

    if (!hasInitializedProjectUpdateSession) {
      if (
        projectUpdatePopupMode === PROJECT_UPDATE_POPUP_MODES.ALWAYS ||
        todayProjectActivityDigest.hasUnseenUpdates
      ) {
        openProjectUpdatesPopup();
      }
      previousUnseenProjectUpdateIdsRef.current = currentUnseenIds;
      setHasInitializedProjectUpdateSession(true);
      return;
    }

    if (newlyArrivedUnseenIds.length > 0) {
      const unseenEntries = todayProjectActivityDigest.groups
        .flatMap((group) =>
          group.unseenEntries.map((entry) => ({
            ...entry,
            projectName: group.projectName,
            projectColorIndex: group.colorIndex,
          }))
        )
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      const newIdSet = new Set(newlyArrivedUnseenIds);
      const latestEntry = unseenEntries.find((entry) => newIdSet.has(entry.id));

      if (document.visibilityState === 'visible') {
        if (!isProjectUpdatesPopupOpen && latestEntry) {
          const description = describeProjectActivityEntry(latestEntry);
          showProjectUpdateToast({
            id: latestEntry.id,
            projectName: latestEntry.projectName || 'Project',
            colorIndex: latestEntry.projectColorIndex,
            title: description.title || 'Project update',
            subtitle: description.subtitle || '',
            createdAt: latestEntry.createdAt,
            newCount: newlyArrivedUnseenIds.length,
            isStatusUpdate: Boolean(description.isStatusUpdate),
            statusTone: description.statusTone || 'neutral',
            statusPriorityLabel: description.statusPriorityLabel || '',
            statusPrompt: description.statusPrompt || '',
          });
        }
      } else {
        setHasPendingFullPopupOnReturn(true);
      }
    }

    previousUnseenProjectUpdateIdsRef.current = currentUnseenIds;
  }, [
    isAccountDataHydrated,
    hasInitializedProjectUpdateSession,
    projectUpdatePopupMode,
    todayProjectActivityDigest.hasUnseenUpdates,
    todayProjectActivityDigest.unseenSignature,
    todayProjectActivityDigest.groups,
    isProjectUpdatesPopupOpen,
  ]);

  useEffect(() => {
    if (!isAccountDataHydrated) return undefined;

    const handleReturnToVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!hasPendingFullPopupOnReturn) return;
      setHasPendingFullPopupOnReturn(false);
      openProjectUpdatesPopup();
    };

    window.addEventListener('focus', handleReturnToVisible);
    document.addEventListener('visibilitychange', handleReturnToVisible);
    return () => {
      window.removeEventListener('focus', handleReturnToVisible);
      document.removeEventListener('visibilitychange', handleReturnToVisible);
    };
  }, [isAccountDataHydrated, hasPendingFullPopupOnReturn]);

  useEffect(() => {
    if (!AUTH_API_BASE_URL) {
      setGoogleCalendarEvents([]);
      setIsGoogleCalendarEventsLoading(false);
      return;
    }
    if (!isAccountDataHydrated) {
      setIsGoogleCalendarEventsLoading(false);
      return;
    }
    if (!googleCalendarStatus.linked || !effectiveMergeView || !mergeViewRange) {
      setGoogleCalendarEvents([]);
      setIsGoogleCalendarEventsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsGoogleCalendarEventsLoading(true);

    const loadGoogleEvents = async () => {
      try {
        const result = await requestCloudDataApi(
          `/google/calendar/events?userId=${encodeURIComponent(currentUser.id)}&timeMin=${encodeURIComponent(
            mergeViewRange.timeMin
          )}&timeMax=${encodeURIComponent(mergeViewRange.timeMax)}`
        );
        if (isCancelled) return;
        const normalizedEvents = Array.isArray(result?.events)
          ? result.events.filter((event) => event && event.source === 'google')
          : [];
        setGoogleCalendarEvents(normalizedEvents);
      } catch (error) {
        if (isCancelled) return;
        setGoogleCalendarEvents([]);
        console.warn('Failed to load Google Calendar events:', error.message);
      } finally {
        if (!isCancelled) {
          setIsGoogleCalendarEventsLoading(false);
        }
      }
    };

    void loadGoogleEvents();
    return () => {
      isCancelled = true;
    };
  }, [
    isAccountDataHydrated,
    currentUser.id,
    googleCalendarStatus.linked,
    googleCalendarSelectedCalendarIds,
    effectiveMergeView,
    mergeViewRange,
  ]);

  useEffect(() => {
    if (!AUTH_API_BASE_URL || !isAccountDataHydrated) return undefined;

    let isCancelled = false;

    const refreshCollaborativeSnapshot = async () => {
      try {
        const [latestPayload, latestInvites] = await Promise.all([
          loadAccountDbPayload(currentUser.id),
          loadProjectInvitesStore(),
        ]);
        if (isCancelled) return;

        const normalizedInvites = Array.isArray(latestInvites)
          ? latestInvites.map(normalizeProjectInvite)
          : [];
        setProjectInvitations((prevInvites) =>
          isJsonEqual(prevInvites, normalizedInvites) ? prevInvites : normalizedInvites
        );

        const localProjectsSnapshot = Array.isArray(projectsRef.current)
          ? projectsRef.current.map((project) => ensureProjectOwnership(project, currentUser))
          : [];
        const localEventsSnapshot = Array.isArray(eventsRef.current) ? eventsRef.current : [];
        const baseProjects = Array.isArray(latestPayload.projects)
          ? latestPayload.projects.map((project) => ensureProjectOwnership(project, currentUser))
          : [];
        const baseEvents = Array.isArray(latestPayload.events) ? latestPayload.events : [];
        const invitedOwnerIds = normalizedInvites
          .filter(
            (invite) =>
              invite.status !== PROJECT_INVITE_STATUSES.DECLINED &&
              isInviteForUser(invite, currentUser)
          )
          .map((invite) => String(invite.ownerId || '').trim())
          .filter(Boolean);
        const ownerIds = Array.from(
          new Set(
            [
              ...baseProjects
                .map((project) => String(project.ownerId || '').trim())
                .filter((ownerId) => ownerId && ownerId !== currentUser.id),
              ...invitedOwnerIds,
            ].filter(Boolean)
          )
        );

        const ownerPayloads = await Promise.all(
          ownerIds.map(async (ownerId) => {
            try {
              const payload = await loadAccountDbPayload(ownerId);
              return [ownerId, payload];
            } catch (error) {
              console.warn(`Failed to load shared owner payload (${ownerId}):`, error.message);
              return [ownerId, null];
            }
          })
        );
        if (isCancelled) return;

        const ownerProjectById = new Map();
        const ownerEventsByProjectId = new Map();

        ownerPayloads.forEach(([, payload]) => {
          const ownerProjects = Array.isArray(payload?.projects) ? payload.projects : [];
          const ownerEvents = Array.isArray(payload?.events) ? payload.events : [];

          ownerProjects.forEach((project) => {
            const projectId = String(project?.id || '').trim();
            if (!projectId) return;
            ownerProjectById.set(projectId, project);
            ownerEventsByProjectId.set(
              projectId,
              ownerEvents.filter((event) => event.projectId === projectId)
            );
          });
        });

        const baseEventsByProjectId = new Map();
        baseEvents.forEach((event) => {
          const projectId = String(event?.projectId || '').trim();
          if (!projectId) return;
          if (!baseEventsByProjectId.has(projectId)) {
            baseEventsByProjectId.set(projectId, []);
          }
          baseEventsByProjectId.get(projectId).push(event);
        });

        const localVisibilityByProjectId = new Map(
          localProjectsSnapshot.map((project) => [project.id, Boolean(project.isVisible)])
        );
        const localNotesPreferencesByProjectId = new Map(
          localProjectsSnapshot.map((project) => [
            project.id,
            resolveAccountScopedNotesPreferences(project.notesPreferences, {
              currentUserId: currentUser.id,
              projectOwnerId: project.ownerId,
            }),
          ])
        );
        const localProjectById = new Map(
          localProjectsSnapshot.map((project) => [String(project.id || '').trim(), project])
        );
        const nextProjectsById = new Map();

        baseProjects.forEach((project) => {
          const projectId = String(project?.id || '').trim();
          if (!projectId) return;

          if (project.ownerId === currentUser.id) {
            const localProject = localProjectById.get(projectId);
            if (!localProject) {
              nextProjectsById.set(projectId, project);
              return;
            }
            const mergedNotes = mergeProjectNotesContentByRevision(
              project.notesContent,
              project.noteRevisionMap,
              localProject.notesContent,
              localProject.noteRevisionMap
            );
            const mergedNotesPresence = mergeProjectNotesPresence(
              project.notesPresence,
              localProject.notesPresence
            );
            nextProjectsById.set(
              projectId,
              ensureProjectOwnership(
                {
                  ...project,
                  notesContent: mergedNotes.notesContent,
                  noteRevisionMap: mergedNotes.noteRevisionMap,
                  notesPresence: mergedNotesPresence,
                  notesPreferences: resolveAccountScopedNotesPreferences(localProject.notesPreferences, {
                    currentUserId: currentUser.id,
                    projectOwnerId: project.ownerId,
                  }),
                  isVisible: Boolean(localProject.isVisible),
                },
                currentUser
              )
            );
            return;
          }

          const ownerProject = ownerProjectById.get(projectId);
          if (!ownerProject) {
            const localProject = localProjectById.get(projectId);
            if (!localProject) {
              nextProjectsById.set(projectId, project);
              return;
            }
            const mergedNotes = mergeProjectNotesContentByRevision(
              project.notesContent,
              project.noteRevisionMap,
              localProject.notesContent,
              localProject.noteRevisionMap
            );
            const mergedNotesPresence = mergeProjectNotesPresence(
              project.notesPresence,
              localProject.notesPresence
            );
            const preservedVisibility = localVisibilityByProjectId.get(projectId);
            const preservedNotesPreferences = localNotesPreferencesByProjectId.has(projectId)
              ? localNotesPreferencesByProjectId.get(projectId)
              : {};
            nextProjectsById.set(
              projectId,
              ensureProjectOwnership(
                {
                  ...project,
                  notesContent: mergedNotes.notesContent,
                  noteRevisionMap: mergedNotes.noteRevisionMap,
                  notesPresence: mergedNotesPresence,
                  notesPreferences: preservedNotesPreferences,
                  isVisible:
                    typeof preservedVisibility === 'boolean'
                      ? preservedVisibility
                      : Boolean(project.isVisible),
                },
                currentUser
              )
            );
            return;
          }

          const localProject = localProjectById.get(projectId);
          const mergedNotes = mergeProjectNotesContentByRevision(
            ownerProject.notesContent,
            ownerProject.noteRevisionMap,
            localProject?.notesContent,
            localProject?.noteRevisionMap
          );
          const mergedNotesPresence = mergeProjectNotesPresence(
            ownerProject.notesPresence,
            localProject?.notesPresence
          );
          const preservedVisibility = localVisibilityByProjectId.get(projectId);
          const preservedNotesPreferences = localNotesPreferencesByProjectId.has(projectId)
            ? localNotesPreferencesByProjectId.get(projectId)
            : {};
          nextProjectsById.set(
            projectId,
            ensureProjectOwnership(
              {
                ...ownerProject,
                notesContent: mergedNotes.notesContent,
                noteRevisionMap: mergedNotes.noteRevisionMap,
                notesPresence: mergedNotesPresence,
                notesPreferences: preservedNotesPreferences,
                isVisible:
                  typeof preservedVisibility === 'boolean'
                    ? preservedVisibility
                    : Boolean(ownerProject.isVisible),
              },
              currentUser
            )
          );
        });

        localProjectsSnapshot.forEach((project) => {
          const projectId = String(project?.id || '').trim();
          if (!projectId || project.ownerId !== currentUser.id) return;
          if (!nextProjectsById.has(projectId)) {
            nextProjectsById.set(projectId, project);
          }
        });

        ownerProjectById.forEach((ownerProject, projectId) => {
          if (!projectId || nextProjectsById.has(projectId)) return;
          const normalizedOwnerProject = ensureProjectOwnership(ownerProject, currentUser);
          if (normalizedOwnerProject.ownerId === currentUser.id) return;
          if (!isProjectAccessibleByUser(normalizedOwnerProject, currentUser)) return;

          const localProject = localProjectById.get(projectId);
          const mergedNotes = mergeProjectNotesContentByRevision(
            normalizedOwnerProject.notesContent,
            normalizedOwnerProject.noteRevisionMap,
            localProject?.notesContent,
            localProject?.noteRevisionMap
          );
          const mergedNotesPresence = mergeProjectNotesPresence(
            normalizedOwnerProject.notesPresence,
            localProject?.notesPresence
          );
          const preservedVisibility = localVisibilityByProjectId.get(projectId);
          const preservedNotesPreferences = localNotesPreferencesByProjectId.has(projectId)
            ? localNotesPreferencesByProjectId.get(projectId)
            : {};
          nextProjectsById.set(
            projectId,
            ensureProjectOwnership(
              {
                ...normalizedOwnerProject,
                notesContent: mergedNotes.notesContent,
                noteRevisionMap: mergedNotes.noteRevisionMap,
                notesPresence: mergedNotesPresence,
                notesPreferences: preservedNotesPreferences,
                isVisible:
                  typeof preservedVisibility === 'boolean'
                    ? preservedVisibility
                    : Boolean(normalizedOwnerProject.isVisible),
              },
              currentUser
            )
          );
        });

        const nextProjects = Array.from(nextProjectsById.values());

        const ownedProjectIds = new Set(
          nextProjects
            .filter((project) => project.ownerId === currentUser.id)
            .map((project) => project.id)
        );

        const mergedEvents = [
          ...baseEvents.filter((event) => ownedProjectIds.has(event.projectId)),
          ...localEventsSnapshot.filter((event) => ownedProjectIds.has(event.projectId)),
        ];

        nextProjects.forEach((project) => {
          if (project.ownerId === currentUser.id) return;
          const projectId = String(project?.id || '').trim();
          if (!projectId) return;

          const sharedEvents = ownerEventsByProjectId.get(projectId);
          if (Array.isArray(sharedEvents) && sharedEvents.length > 0) {
            mergedEvents.push(...sharedEvents);
            return;
          }

          const cachedSharedEvents = baseEventsByProjectId.get(projectId);
          if (Array.isArray(cachedSharedEvents) && cachedSharedEvents.length > 0) {
            mergedEvents.push(...cachedSharedEvents);
          }
        });

        const dedupedEventsMap = new Map();
        mergedEvents.forEach((event) => {
          const dedupeKey = event?.id
            ? `id:${event.id}`
            : `f:${event?.projectId || ''}|${event?.title || ''}|${event?.startDate || ''}|${event?.endDate || ''}|${event?.startTime || ''}|${event?.endTime || ''}`;
          dedupedEventsMap.set(dedupeKey, event);
        });
        const nextEvents = Array.from(dedupedEventsMap.values());

        setProjects((prevProjects) => (isJsonEqual(prevProjects, nextProjects) ? prevProjects : nextProjects));
        setEvents((prevEvents) => (isJsonEqual(prevEvents, nextEvents) ? prevEvents : nextEvents));
      } catch (error) {
        if (!isCancelled) {
          console.warn('Failed to refresh collaborative snapshot from cloud:', error.message);
        }
      }
    };

    const runRefresh = () => {
      void refreshCollaborativeSnapshot();
    };

    const collaborativeRefreshIntervalMs = activeDashboardProjectId
      ? activeDashboardTab === 'notes'
        ? 800
        : 1400
      : COLLABORATIVE_REFRESH_INTERVAL_MS;
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    }, collaborativeRefreshIntervalMs);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    runRefresh();

    return () => {
      isCancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAccountDataHydrated, currentUser, activeDashboardProjectId, activeDashboardTab]);

  useEffect(() => {
    if (!isCompactViewport) return;
    if (selectedMobileProject) return;
    if (mobileCalendarProjectId === null) return;
    setMobileCalendarProjectId(null);
  }, [isCompactViewport, selectedMobileProject, mobileCalendarProjectId]);

  // --- Handlers ---
  const handleLinkGoogleCalendar = async () => {
    if (!AUTH_API_BASE_URL) {
      await popup.alert({
        title: 'Feature unavailable',
        message: 'Cloud Auth API is not configured. Set AUTH_API_BASE_URL before linking Google Calendar.',
      });
      return;
    }

    setIsGoogleCalendarBusy(true);
    try {
      const result = await requestCloudDataApi(
        `/google/calendar/auth-url?userId=${encodeURIComponent(currentUser.id)}`
      );
      const authUrl = String(result?.authUrl || '').trim();
      if (!authUrl) {
        throw new Error('Server did not return Google authorization URL.');
      }

      const popupWidth = 520;
      const popupHeight = 680;
      const left = Math.max(0, Math.floor((window.screen.width - popupWidth) / 2));
      const top = Math.max(0, Math.floor((window.screen.height - popupHeight) / 2));
      const popupWindow = window.open(
        authUrl,
        'pm-calendar-google-calendar-link',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popupWindow) {
        throw new Error('Popup blocked. Please allow popups and try again.');
      }

      const linkResult = await new Promise((resolve) => {
        let done = false;
        const complete = (payload) => {
          if (done) return;
          done = true;
          window.clearInterval(closeChecker);
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          resolve(payload);
        };

        const onMessage = (event) => {
          if (!event?.data || event.data.type !== 'PM_CALENDAR_GOOGLE_CALENDAR_LINK') return;
          complete(event.data);
        };

        const closeChecker = window.setInterval(() => {
          if (popupWindow.closed) {
            complete({
              ok: false,
              message: 'Google link window was closed before completion.',
            });
          }
        }, 350);

        const timeout = window.setTimeout(() => {
          complete({
            ok: false,
            message: 'Google link timed out. Please try again.',
          });
        }, 180000);

        window.addEventListener('message', onMessage);
      });

      if (!linkResult?.ok) {
        throw new Error(linkResult?.message || 'Failed to link Google Calendar.');
      }

      const status = await refreshGoogleCalendarStatus();
      if (status?.linked) {
        try {
          await refreshGoogleCalendarCalendars();
        } catch (error) {
          console.warn('Failed to load Google Calendar list after linking:', error.message);
        }
      }
      await popup.alert({
        title: 'Google Calendar linked',
        message: `Linked account: ${status?.linkedEmail || currentUser.email}`,
      });
    } catch (error) {
      await popup.alert({
        title: 'Unable to link Google Calendar',
        message: error.message || 'Unexpected error while linking Google Calendar.',
      });
    } finally {
      setIsGoogleCalendarBusy(false);
    }
  };

  const handleUnlinkGoogleCalendar = async () => {
    if (!AUTH_API_BASE_URL) return;

    const confirmed = await popup.confirm({
      title: 'Unlink Google Calendar',
      message: 'Google events will be removed from Merge view. Continue?',
      confirmText: 'Unlink',
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsGoogleCalendarBusy(true);
    try {
      await requestCloudDataApi(`/google/calendar/link?userId=${encodeURIComponent(currentUser.id)}`, {
        method: 'DELETE',
      });
      setGoogleCalendarEvents([]);
      setGoogleCalendarCalendars([]);
      setGoogleCalendarSelectedCalendarIds([]);
      await refreshGoogleCalendarStatus();
      await popup.alert({
        title: 'Google Calendar unlinked',
        message: 'Google Calendar connection has been removed.',
      });
    } catch (error) {
      await popup.alert({
        title: 'Unable to unlink Google Calendar',
        message: error.message || 'Unexpected error while unlinking Google Calendar.',
      });
    } finally {
      setIsGoogleCalendarBusy(false);
    }
  };
  const handleAddEventToGoogleCalendar = async (eventData, options = {}) => {
    if (!AUTH_API_BASE_URL) {
      return {
        ok: false,
        message: 'Cloud Auth API is not configured.',
      };
    }
    if (!googleCalendarStatus.linked) {
      return {
        ok: false,
        message: 'Google Calendar is not linked for this account.',
      };
    }

    const payload =
      eventData && typeof eventData === 'object' && !Array.isArray(eventData) ? eventData : {};
    const title = String(payload.title || '').trim();
    const startDate = String(payload.startDate || '').trim();
    const endDate = String(payload.endDate || startDate).trim();
    if (!title || !endDate) {
      return {
        ok: false,
        message: 'Missing title or date for Google Calendar event.',
      };
    }

    const writableCalendarIds = new Set(
      (Array.isArray(googleCalendarCalendars) ? googleCalendarCalendars : [])
        .filter((calendar) => canWriteGoogleCalendar(calendar))
        .map((calendar) => String(calendar.id || '').trim())
        .filter(Boolean)
    );
    let targetCalendarId = String(options.calendarId || '').trim();
    if (targetCalendarId && writableCalendarIds.size > 0 && !writableCalendarIds.has(targetCalendarId)) {
      return {
        ok: false,
        message: 'Selected Google Calendar is read-only. Please choose a calendar with writer access.',
      };
    }
    if (!targetCalendarId && writableCalendarIds.size > 0) {
      targetCalendarId = Array.from(writableCalendarIds)[0] || '';
    }
    if (!targetCalendarId) {
      return {
        ok: false,
        message:
          'No writable Google Calendar available. Please grant "Make changes to events" permission first.',
      };
    }

    const eventColorId = String(options.colorId || '').trim();
    const pmCalendarEventId = String(options.pmCalendarEventId || payload.id || '').trim();
    const googleEventId = String(options.googleEventId || payload.googleCalendarLinkedEventId || '').trim();
    const timeZone =
      String(
        (typeof Intl !== 'undefined' &&
          Intl.DateTimeFormat &&
          Intl.DateTimeFormat().resolvedOptions().timeZone) ||
          ''
      ).trim() || 'UTC';

    try {
      const result = await requestCloudDataApi(
        `/google/calendar/events?userId=${encodeURIComponent(currentUser.id)}`,
        {
          method: 'POST',
          body: {
            title,
            description: String(payload.description || '').trim(),
            startDate,
            endDate,
            startTime: String(payload.startTime || '').trim(),
            endTime: String(payload.endTime || '').trim(),
            showTime: payload.showTime !== false,
            recordType: String(payload.recordType || '').trim(),
            department: String(payload.department || '').trim(),
            calendarId: targetCalendarId,
            colorId: eventColorId,
            pmCalendarEventId,
            googleEventId,
            timeZone,
          },
        }
      );

      const createdEvent =
        result?.event && typeof result.event === 'object' && !Array.isArray(result.event)
          ? result.event
          : null;
      if (createdEvent && createdEvent.source === 'google') {
        const selectedIds = normalizeGoogleCalendarSelection(googleCalendarSelectedCalendarIds);
        const shouldDisplayInMerge =
          selectedIds.length === 0 || selectedIds.includes(String(createdEvent.calendarId || '').trim());
        if (shouldDisplayInMerge) {
          setGoogleCalendarEvents((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const dedupe = new Map();
            [...list, createdEvent].forEach((item) => {
              const key =
                String(item?.pmCalendarEventId || '').trim() || String(item?.id || '').trim();
              if (!key) return;
              dedupe.set(key, item);
            });
            return Array.from(dedupe.values()).sort((left, right) => {
              const leftKey = `${left.startDate || ''}T${left.startTime || ''}`;
              const rightKey = `${right.startDate || ''}T${right.startTime || ''}`;
              return leftKey.localeCompare(rightKey);
            });
          });
        }
      }

      return { ok: true, event: createdEvent };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Failed to add event to Google Calendar.',
      };
    }
  };
  const handleDeleteGoogleCalendarEvent = async (eventInput, options = {}) => {
    if (!AUTH_API_BASE_URL) {
      return {
        ok: false,
        message: 'Cloud Auth API is not configured.',
      };
    }
    if (!googleCalendarStatus.linked) {
      return {
        ok: false,
        message: 'Google Calendar is not linked for this account.',
      };
    }

    const eventValue =
      eventInput && typeof eventInput === 'object' && !Array.isArray(eventInput) ? eventInput : {};
    const calendarId = String(options.calendarId || eventValue.googleCalendarId || eventValue.calendarId || '').trim();
    const googleEventId = String(options.googleEventId || eventValue.googleCalendarLinkedEventId || eventValue.googleEventId || '').trim();
    const pmCalendarEventId = String(options.pmCalendarEventId || eventValue.id || '').trim();
    if (!calendarId || !googleEventId) {
      return {
        ok: false,
        message: 'Google Calendar id or event id is missing.',
      };
    }

    try {
      await requestCloudDataApi(`/google/calendar/events?userId=${encodeURIComponent(currentUser.id)}`, {
        method: 'DELETE',
        body: {
          calendarId,
          googleEventId,
          pmCalendarEventId,
        },
      });
      setGoogleCalendarEvents((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (event) =>
            !(
              String(event?.calendarId || '').trim() === calendarId &&
              String(event?.googleEventId || '').trim() === googleEventId
            )
        )
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Failed to delete Google Calendar event.',
      };
    }
  };

  const syncSharedProjectEventsToOwner = async (
    projectId,
    nextEventsSnapshot,
    projectsSnapshot = projects
  ) => {
    if (!AUTH_API_BASE_URL) return;

    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;

    const targetProject = projectsSnapshot.find((project) => project.id === normalizedProjectId);
    if (!targetProject) return;

    const ownerId = String(targetProject.ownerId || '').trim();
    if (!ownerId || ownerId === currentUser.id) return;

    try {
      const ownerPayload = await loadAccountDbPayload(ownerId);
      const ownerEvents = Array.isArray(ownerPayload.events) ? ownerPayload.events : [];
      const sharedProjectEvents = (Array.isArray(nextEventsSnapshot) ? nextEventsSnapshot : []).filter(
        (event) => event.projectId === normalizedProjectId
      );
      const nextOwnerEvents = [
        ...ownerEvents.filter((event) => event.projectId !== normalizedProjectId),
        ...sharedProjectEvents,
      ];

      await saveAccountDbPayload(ownerId, {
        ...ownerPayload,
        events: nextOwnerEvents,
      });
    } catch (error) {
      console.warn('Failed to sync shared project events to owner payload:', error.message);
    }
  };

  const syncSharedProjectDetailsToOwner = async (projectId, nextProjectsSnapshot = projects) => {
    if (!AUTH_API_BASE_URL) return;

    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;

    const targetProject = (Array.isArray(nextProjectsSnapshot) ? nextProjectsSnapshot : []).find(
      (project) => project.id === normalizedProjectId
    );
    if (!targetProject) return;

    const ownerId = String(targetProject.ownerId || '').trim();
    if (!ownerId || ownerId === currentUser.id) return;

    try {
      const ownerPayload = await loadAccountDbPayload(ownerId);
      const ownerProjects = Array.isArray(ownerPayload.projects) ? ownerPayload.projects : [];
      const ownerProjectIndex = ownerProjects.findIndex(
        (project) => String(project?.id || '').trim() === normalizedProjectId
      );
      if (ownerProjectIndex < 0) return;

      const ownerProject = ownerProjects[ownerProjectIndex];
      const ownerReference = {
        id: ownerId,
        username:
          String(ownerProject?.ownerUsername || '').trim().toLowerCase() ||
          String(targetProject.ownerUsername || '').trim().toLowerCase() ||
          currentUser.username,
      };
      const mergedNotesState = mergeProjectNotesContentByRevision(
        ownerProject?.notesContent,
        ownerProject?.noteRevisionMap,
        targetProject?.notesContent,
        targetProject?.noteRevisionMap
      );
      const mergedNotesPresence = mergeProjectNotesPresence(
        ownerProject?.notesPresence,
        targetProject?.notesPresence
      );
      const mergedOwnerProject = ensureProjectOwnership(
        {
          ...ownerProject,
          ...stripLocalOnlyProjectFields(targetProject),
          isVisible: Boolean(ownerProject?.isVisible),
          notesPreferences: ownerProject?.notesPreferences || {},
          notesContent: mergedNotesState.notesContent,
          noteRevisionMap: mergedNotesState.noteRevisionMap,
          notesPresence: mergedNotesPresence,
        },
        ownerReference
      );
      if (isJsonEqual(ownerProject, mergedOwnerProject)) {
        return;
      }

      const nextOwnerProjects = [...ownerProjects];
      nextOwnerProjects[ownerProjectIndex] = mergedOwnerProject;

      await saveAccountDbPayload(ownerId, {
        ...ownerPayload,
        projects: nextOwnerProjects,
      });
    } catch (error) {
      console.warn('Failed to sync shared project details to owner payload:', error.message);
    }
  };

  const syncSharedProjectDetailsForProjects = (projectIds, nextProjectsSnapshot = projects) => {
    const uniqueProjectIds = Array.from(
      new Set(
        (Array.isArray(projectIds) ? projectIds : [])
          .map((projectId) => String(projectId || '').trim())
          .filter(Boolean)
      )
    );

    uniqueProjectIds.forEach((projectId) => {
      void syncSharedProjectDetailsToOwner(projectId, nextProjectsSnapshot);
    });
  };

  const syncSharedEventsForProjects = (projectIds, nextEventsSnapshot, projectsSnapshot = projects) => {
    const uniqueProjectIds = Array.from(
      new Set(
        (Array.isArray(projectIds) ? projectIds : [])
          .map((projectId) => String(projectId || '').trim())
          .filter(Boolean)
      )
    );

    uniqueProjectIds.forEach((projectId) => {
      void syncSharedProjectEventsToOwner(projectId, nextEventsSnapshot, projectsSnapshot);
    });
  };
  const appendProjectActivityLog = (projectId, entryInput, { syncToOwner = true } = {}) => {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;

    setProjects((prevProjects) => {
      let didUpdate = false;
      const nextProjects = prevProjects.map((project) => {
        if (String(project?.id || '').trim() !== normalizedProjectId) return project;
        didUpdate = true;
        return appendProjectActivityEntryToProject(project, {
          ...entryInput,
          projectId: project.id,
          projectName: project.name,
          actorId: currentUser.id,
          actorUsername: currentUser.username,
        });
      });

      if (didUpdate && syncToOwner) {
        syncSharedProjectDetailsForProjects([normalizedProjectId], nextProjects);
      }

      return nextProjects;
    });
  };
  const saveTaskForProject = (projectId, taskData) => {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;
    const normalizedAssigneeIds = normalizeTaskAssigneeIds(taskData);
    const normalizedTaskData = {
      ...(taskData && typeof taskData === 'object' ? taskData : {}),
      assigneeIds: normalizedAssigneeIds,
      assigneeId: normalizedAssigneeIds[0] || '',
      recordType: 'task',
    };
    const isUpdate = Boolean(taskData?.id);
    const localTaskId = isUpdate ? String(taskData.id || '').trim() : generateId();
    const localTaskProjectId = normalizedProjectId;
    let nextEvents = events;
    let persistedTask = null;

    if (isUpdate) {
      nextEvents = events.map((event) =>
        String(event.id || '').trim() === localTaskId
          ? { ...event, ...normalizedTaskData, projectId: localTaskProjectId, recordType: 'task' }
          : event
      );
      persistedTask =
        nextEvents.find((event) => String(event.id || '').trim() === localTaskId) ||
        { ...normalizedTaskData, id: localTaskId, projectId: localTaskProjectId, recordType: 'task' };
      setEvents(nextEvents);
      syncSharedEventsForProjects([localTaskProjectId], nextEvents);
    } else {
      const createdTask = {
        ...normalizedTaskData,
        id: localTaskId,
        projectId: localTaskProjectId,
        recordType: 'task',
      };
      persistedTask = createdTask;
      nextEvents = [...events, createdTask];
      setEvents(nextEvents);
      syncSharedEventsForProjects([localTaskProjectId], nextEvents);
      appendProjectActivityLog(normalizedProjectId, {
        type: PROJECT_ACTIVITY_TYPES.TASK_CREATED,
        title: String(createdTask.title || '').trim(),
        message: 'New task was created.',
        meta: {
          taskTitle: String(createdTask.title || '').trim() || 'Untitled task',
          startDate: String(createdTask.startDate || '').trim(),
          startTime: String(createdTask.startTime || '').trim(),
          endDate: String(createdTask.endDate || '').trim(),
          endTime: String(createdTask.endTime || '').trim(),
          department: String(createdTask.department || '').trim() || 'Unassigned',
          showTime: Boolean(
            String(createdTask.startTime || '').trim() ||
              String(createdTask.endTime || '').trim()
          ),
        },
      });
    }

    const hasGoogleLink = googleCalendarStatus.linked && Boolean(defaultWritableGoogleCalendarId);
    if (!hasGoogleLink || !persistedTask) return;

    void (async () => {
      const targetProject = projects.find((projectItem) => projectItem.id === localTaskProjectId) || null;
      const departmentName = String(persistedTask.department || '').trim() || 'Unassigned';
      const departmentColorHex = resolveDepartmentColorHex(
        targetProject?.departmentColors,
        departmentName,
        getProjectColorHexByIndex(targetProject?.colorIndex)
      );
      const googleColorId = pickGoogleCalendarColorIdByHex(departmentColorHex);
      const googleCalendarId =
        String(persistedTask.googleCalendarId || '').trim() || defaultWritableGoogleCalendarId;
      const googleResult = await handleAddEventToGoogleCalendar(
        {
          ...persistedTask,
          title: String(persistedTask.title || '').trim() || 'Untitled task',
          description: String(persistedTask.description || '').trim(),
          startDate: String(persistedTask.startDate || persistedTask.endDate || '').trim(),
          endDate: String(persistedTask.endDate || persistedTask.startDate || '').trim(),
          startTime: String(persistedTask.startTime || '').trim(),
          endTime: String(persistedTask.endTime || '').trim(),
          showTime: Boolean(
            String(persistedTask.startTime || '').trim() || String(persistedTask.endTime || '').trim()
          ),
        },
        {
          calendarId: googleCalendarId,
          colorId: googleColorId,
          pmCalendarEventId: localTaskId,
          googleEventId: String(persistedTask.googleCalendarLinkedEventId || '').trim(),
        }
      );
      if (!googleResult.ok) return;
      const createdGoogleEvent =
        googleResult.event && typeof googleResult.event === 'object' ? googleResult.event : null;
      if (!createdGoogleEvent) return;
      const nextEventsWithGoogleLink = (Array.isArray(eventsRef.current) ? eventsRef.current : []).map((event) =>
        String(event.id || '').trim() === localTaskId
          ? {
              ...event,
              googleCalendarLinked: true,
              googleCalendarId: String(createdGoogleEvent.calendarId || googleCalendarId).trim(),
              googleCalendarLinkedEventId: String(createdGoogleEvent.googleEventId || '').trim(),
              googleCalendarLinkedAt: new Date().toISOString(),
            }
          : event
      );
      setEvents(nextEventsWithGoogleLink);
      syncSharedEventsForProjects([localTaskProjectId], nextEventsWithGoogleLink);
    })();
  };

  const handleDayClick = (dateStr, projectId) => {
    setEditingEvent(null);
    setSelectedDateForNewEvent(dateStr);
    setPreSelectedProjectId(projectId || (visibleProjects.length > 0 ? visibleProjects[0].id : ''));
    setShowEventModal(true);
  };

  const handleNewEventClick = () => {
    setEditingEvent(null);
    // ตั้งค่าเริ่มต้นเป็นวันที่ปัจจุบัน
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setSelectedDateForNewEvent(todayStr);
    setPreSelectedProjectId(
      selectedMobileProject?.id ||
        (visibleProjects.length > 0 ? visibleProjects[0].id : (projects.length > 0 ? projects[0].id : ''))
    );
    setShowEventModal(true);
  };

  const handleMobileProjectSelect = (projectId) => {
    if (!isCompactViewport) return;
    if (!projectId) {
      setMobileCalendarProjectId(null);
      return;
    }

    if (mobileCalendarProjectId === projectId) {
      setActiveDashboardTab(DEFAULT_PROJECT_DASHBOARD_TAB);
      setActiveDashboardProjectId(projectId);
      return;
    }

    setMobileCalendarProjectId(projectId);
  };

  const renderMobileProjectButton = (project) => {
    const isActive = selectedMobileProject?.id === project.id;
    return (
      <button
        key={`mobile-project-${project.id}`}
        type="button"
        onClick={() => handleMobileProjectSelect(project.id)}
        title={project.name}
        className={`h-9 w-auto flex-none inline-flex items-center justify-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold border whitespace-nowrap transition-colors ${
          isActive
            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PROJECT_COLORS[project.colorIndex].bg}`}></span>
        <span>{project.name}</span>
      </button>
    );
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation(); // Prevent triggering day click
    if (event?.source === 'google') {
      void (async () => {
        const shouldDelete = await popup.confirm({
          title: 'Google Calendar event',
          message:
            `Delete this event from Google Calendar?\n\n` +
            `${event.title || '(Untitled)'}\n${event.startDate} ${event.startTime} - ${event.endDate} ${event.endTime}`,
          confirmText: 'Delete',
          cancelText: 'Close',
          tone: 'danger',
        });
        if (!shouldDelete) return;
        const deleteResult = await handleDeleteGoogleCalendarEvent(event, {
          calendarId: event.calendarId,
          googleEventId: event.googleEventId,
        });
        if (!deleteResult.ok) {
          await popup.alert({
            title: 'Google Calendar delete failed',
            message: deleteResult.message || 'Could not delete event from Google Calendar.',
          });
          return;
        }
        await popup.alert({
          title: 'Deleted',
          message: 'Event was removed from Google Calendar.',
        });
      })();
      return;
    }
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const saveEvent = async (eventData) => {
    const payload =
      eventData && typeof eventData === 'object' && !Array.isArray(eventData) ? eventData : {};
    const googleCalendarOptions =
      payload.googleCalendarOptions &&
      typeof payload.googleCalendarOptions === 'object' &&
      !Array.isArray(payload.googleCalendarOptions)
        ? payload.googleCalendarOptions
        : null;
    const eventPayload = { ...payload };
    delete eventPayload.googleCalendarOptions;
    if (String(eventPayload.recordType || '').trim().toLowerCase() !== 'task') {
      eventPayload.recordType = 'event';
    }
    let nextEvents = events;
    let localEventId = '';
    let localEventProjectId = String(eventPayload.projectId || '').trim();
    const baseSyncProjectIds = [];

    if (editingEvent) {
      localEventId = String(editingEvent.id || '').trim();
      if (!localEventProjectId) {
        localEventProjectId = String(editingEvent.projectId || '').trim();
      }
      nextEvents = events.map((event) =>
        event.id === editingEvent.id ? { ...event, ...eventPayload } : event
      );
      baseSyncProjectIds.push(editingEvent.projectId, localEventProjectId);
    } else {
      const createdEvent = {
        ...eventPayload,
        id: generateId(),
        status: 'To Do',
        department: 'Unassigned',
        assigneeId: 'u' + (Math.floor(Math.random() * 5) + 1),
        recordType: 'event',
      };
      localEventId = String(createdEvent.id || '').trim();
      localEventProjectId = String(createdEvent.projectId || '').trim();
      nextEvents = [...events, createdEvent];
      baseSyncProjectIds.push(localEventProjectId);
      appendProjectActivityLog(createdEvent.projectId, {
        type: PROJECT_ACTIVITY_TYPES.EVENT_CREATED,
        title: String(createdEvent.title || '').trim(),
        message: 'New event was added.',
        meta: {
          eventTitle: String(createdEvent.title || '').trim() || 'Untitled event',
          startDate: String(createdEvent.startDate || '').trim(),
          startTime: createdEvent.showTime === false ? '' : String(createdEvent.startTime || '').trim(),
          endDate: String(createdEvent.endDate || '').trim(),
          endTime: createdEvent.showTime === false ? '' : String(createdEvent.endTime || '').trim(),
          showTime: createdEvent.showTime !== false,
        },
      });
    }
    setEvents(nextEvents);
    syncSharedEventsForProjects(baseSyncProjectIds, nextEvents);
    setShowEventModal(false);
    if (googleCalendarOptions?.enabled) {
      const existingLinkedGoogleCalendarId = String(editingEvent?.googleCalendarId || '').trim();
      const existingLinkedGoogleEventId = String(editingEvent?.googleCalendarLinkedEventId || '').trim();
      const googleResult = await handleAddEventToGoogleCalendar(eventPayload, {
        ...googleCalendarOptions,
        calendarId: existingLinkedGoogleCalendarId || googleCalendarOptions.calendarId,
        pmCalendarEventId: localEventId,
        googleEventId: existingLinkedGoogleEventId,
      });
      if (!googleResult.ok) {
        await popup.alert({
          title: 'Google Calendar add failed',
          message: googleResult.message || 'Could not add event to Google Calendar.',
        });
      } else {
        const createdGoogleEvent =
          googleResult.event && typeof googleResult.event === 'object' ? googleResult.event : null;
        const googleLinkPatch = {
          googleCalendarLinked: true,
          googleCalendarId:
            String(createdGoogleEvent?.calendarId || googleCalendarOptions.calendarId || '').trim() || '',
          googleCalendarLinkedEventId: String(createdGoogleEvent?.googleEventId || '').trim() || '',
          googleCalendarLinkedAt: new Date().toISOString(),
        };
        const nextEventsWithGoogleLink = nextEvents.map((event) =>
          String(event.id || '').trim() === localEventId ? { ...event, ...googleLinkPatch } : event
        );
        setEvents(nextEventsWithGoogleLink);
        syncSharedEventsForProjects([localEventProjectId], nextEventsWithGoogleLink);
        await popup.alert({
          title: 'Google Calendar synced',
          message: 'Event has been added to Google Calendar.',
        });
      }
    }
  };

  const updateEvent = (eventId, updates) => {
    const existingEvent = events.find((event) => event.id === eventId) || null;
    const nextEvents = events.map((event) => (event.id === eventId ? { ...event, ...updates } : event));
    setEvents(nextEvents);
    const updatedEvent = nextEvents.find((event) => event.id === eventId) || null;
    syncSharedEventsForProjects([existingEvent?.projectId, updatedEvent?.projectId], nextEvents);
  };

  const deleteEvent = async (eventId) => {
    const targetEvent = events.find((event) => event.id === eventId) || null;
    const linkedGoogleEventId = String(targetEvent?.googleCalendarLinkedEventId || '').trim();
    const linkedGoogleCalendarId = String(targetEvent?.googleCalendarId || '').trim();
    if (linkedGoogleEventId && linkedGoogleCalendarId) {
      const deleteGoogleResult = await handleDeleteGoogleCalendarEvent(targetEvent, {
        calendarId: linkedGoogleCalendarId,
        googleEventId: linkedGoogleEventId,
        pmCalendarEventId: String(targetEvent?.id || '').trim(),
      });
      if (!deleteGoogleResult.ok) {
        await popup.alert({
          title: 'Google Calendar delete failed',
          message: deleteGoogleResult.message || 'Could not delete linked Google Calendar event.',
        });
        return false;
      }
    }
    const nextEvents = events.filter((event) => event.id !== eventId);
    setEvents(nextEvents);
    syncSharedEventsForProjects([targetEvent?.projectId], nextEvents);
    setShowEventModal(false);
    return true;
  };

  const toggleProjectVisibility = (projectId) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        // Prevent enabling if already 4 visible
        if (!p.isVisible && visibleProjects.length >= 4) {
          void popup.alert({
            title: 'Display limit',
            message: 'คุณสามารถแสดงได้สูงสุดเพียง 4 โปรเจกต์ในหน้าจอหลัก',
          });
          return p;
        }
        return { ...p, isVisible: !p.isVisible };
      }
      return p;
    }));
  };

  const saveProject = (projectData) => {
    if (projectData.id) {
      const targetProject = projects.find((project) => project.id === projectData.id);
      if (targetProject && targetProject.ownerId !== currentUser.id) {
        void popup.alert({
          title: 'Permission denied',
          message: 'Only the project creator can edit this project.',
        });
        return;
      }

      setProjects(
        projects.map((project) => {
          if (project.id !== projectData.id) return project;
          return ensureProjectOwnership({ ...project, ...projectData }, currentUser);
        })
      );
    } else {
      const newProject = { 
        ...projectData, 
        id: generateId(), 
        isVisible: visibleProjects.length < 4,
        status: 'on_track',
        description: '',
        milestones: [],
        ownerId: currentUser.id,
        ownerUsername: currentUser.username,
        members: [currentUser.username],
        teamMembers: [],
        positions: [],
        roles: [],
        departments: [],
        departmentColors: {},
        joinCodeSecret: generateProjectJoinCodeSecret(),
        changeFeed: [],
      };
      setProjects([...projects, newProject]);
    }
  };

  const regenerateProjectJoinCode = (projectId) => {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      return { ok: false, message: 'Project not found.' };
    }

    let result = { ok: false, message: 'Project not found.' };
    setProjects((prevProjects) => {
      let didUpdate = false;
      const nextProjects = prevProjects.map((project) => {
        if (String(project?.id || '').trim() !== normalizedProjectId) return project;
        if (String(project?.ownerId || '').trim() !== currentUser.id) {
          result = { ok: false, message: 'Only the project creator can refresh project code.' };
          return project;
        }
        didUpdate = true;
        const nextProject = {
          ...project,
          joinCodeSecret: generateProjectJoinCodeSecret(),
        };
        result = {
          ok: true,
          message: 'Project code has been refreshed. Older code can no longer be used.',
          code: buildProjectJoinCode(nextProject),
        };
        return nextProject;
      });

      if (didUpdate) {
        syncSharedProjectDetailsForProjects([normalizedProjectId], nextProjects);
      }

      return nextProjects;
    });

    return result;
  };

  const joinProjectByCode = async (codeInput) => {
    const parsedCode = parseProjectJoinCode(codeInput);
    if (!parsedCode) {
      return { ok: false, message: 'Invalid project code format.' };
    }

    const { ownerId, projectId, secret } = parsedCode;
    const ownerPayload = await loadAccountDbPayload(ownerId);
    const ownerProjects = Array.isArray(ownerPayload.projects) ? ownerPayload.projects : [];
    const ownerProjectIndex = ownerProjects.findIndex(
      (project) => String(project?.id || '').trim() === projectId
    );
    if (ownerProjectIndex < 0) {
      return { ok: false, message: 'Project code is invalid or project no longer exists.' };
    }

    const ownerProject = ownerProjects[ownerProjectIndex];
    const ownerReference = {
      id: ownerId,
      username:
        String(ownerProject?.ownerUsername || '').trim().toLowerCase() ||
        String(currentUser.username || '').trim().toLowerCase(),
    };
    const normalizedOwnerProject = ensureProjectOwnership(ownerProject, ownerReference);
    const expectedSecret = ensureProjectJoinCodeSecret(normalizedOwnerProject);
    if (expectedSecret !== secret) {
      return { ok: false, message: 'This project code has expired. Ask owner for a new code.' };
    }

    if (isProjectAccessibleByUser(normalizedOwnerProject, currentUser)) {
      return { ok: false, message: `You are already a member of "${normalizedOwnerProject.name}".` };
    }

    const nextOwnerProject = appendProjectActivityEntryToProject(
      addProjectMemberRecord(normalizedOwnerProject, currentUser),
      {
        type: PROJECT_ACTIVITY_TYPES.MEMBER_JOINED,
        title: `${currentUser.username} joined the project`,
        message: `${currentUser.username} joined via project code.`,
        actorId: currentUser.id,
        actorUsername: currentUser.username,
        meta: {
          memberUsername: currentUser.username,
          method: 'project_code',
        },
      }
    );
    const nextOwnerProjects = [...ownerProjects];
    nextOwnerProjects[ownerProjectIndex] = nextOwnerProject;
    await saveAccountDbPayload(ownerId, {
      ...ownerPayload,
      projects: nextOwnerProjects,
    });

    const ownerEvents = Array.isArray(ownerPayload.events) ? ownerPayload.events : [];
    const acceptedProjectEvents = ownerEvents.filter(
      (event) => String(event?.projectId || '').trim() === projectId
    );

    setProjects((prevProjects) => {
      const existing = prevProjects.find((project) => project.id === nextOwnerProject.id);
      const preservedNotesPreferences = resolveAccountScopedNotesPreferences(
        existing?.notesPreferences,
        {
          currentUserId: currentUser.id,
          projectOwnerId: existing?.ownerId || nextOwnerProject.ownerId,
        }
      );
      if (existing) {
        return prevProjects.map((project) =>
          project.id === nextOwnerProject.id
            ? {
                ...nextOwnerProject,
                notesPreferences: preservedNotesPreferences,
                isVisible: Boolean(existing.isVisible),
              }
            : project
        );
      }

      const visibleCount = prevProjects.filter((project) => project.isVisible).length;
      return [
        ...prevProjects,
        {
          ...nextOwnerProject,
          notesPreferences: {},
          isVisible: visibleCount < 4,
        },
      ];
    });
    setEvents((prevEvents) => {
      const remaining = prevEvents.filter((event) => event.projectId !== nextOwnerProject.id);
      return [...remaining, ...acceptedProjectEvents];
    });

    return {
      ok: true,
      message: `Joined project "${nextOwnerProject.name}" successfully.`,
    };
  };

  const updateProjectDetails = (projectId, updates) => {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;
    const safeUpdatesInput =
      updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {};

    setProjects((prevProjects) => {
      let didUpdate = false;
      const nextProjects = prevProjects.map((project) => {
        if (project.id !== normalizedProjectId) return project;
        didUpdate = true;

        const isOwner = String(project.ownerId || '').trim() === currentUser.id;
        const safeUpdates = { ...safeUpdatesInput };
        const noteContentPatchInput =
          safeUpdates.noteContentPatch &&
          typeof safeUpdates.noteContentPatch === 'object' &&
          !Array.isArray(safeUpdates.noteContentPatch)
            ? safeUpdates.noteContentPatch
            : null;
        const noteRevisionPatchInput =
          safeUpdates.noteRevisionPatch &&
          typeof safeUpdates.noteRevisionPatch === 'object' &&
          !Array.isArray(safeUpdates.noteRevisionPatch)
            ? safeUpdates.noteRevisionPatch
            : null;
        const notePresencePatchInput =
          safeUpdates.notePresencePatch &&
          typeof safeUpdates.notePresencePatch === 'object' &&
          !Array.isArray(safeUpdates.notePresencePatch)
            ? safeUpdates.notePresencePatch
            : null;
        const replaceChangeFeed = safeUpdates.replaceChangeFeed === true;
        delete safeUpdates.noteContentPatch;
        delete safeUpdates.noteRevisionPatch;
        delete safeUpdates.notePresencePatch;
        delete safeUpdates.replaceChangeFeed;
        if (!isOwner) {
          delete safeUpdates.name;
          delete safeUpdates.ownerId;
          delete safeUpdates.ownerUsername;
          delete safeUpdates.joinCodeSecret;
        }
        if (noteContentPatchInput || noteRevisionPatchInput) {
          const mergedNotes = mergeProjectNotesContentByRevision(
            project.notesContent,
            project.noteRevisionMap,
            noteContentPatchInput || {},
            noteRevisionPatchInput || {}
          );
          safeUpdates.notesContent = mergedNotes.notesContent;
          safeUpdates.noteRevisionMap = mergedNotes.noteRevisionMap;
        }
        if (notePresencePatchInput) {
          safeUpdates.notesPresence = mergeProjectNotesPresence(
            project.notesPresence,
            notePresencePatchInput
          );
        }
        if (Array.isArray(safeUpdates.changeFeed)) {
          const requestedFeed = normalizeProjectActivityFeed(safeUpdates.changeFeed, project);
          if (replaceChangeFeed) {
            safeUpdates.changeFeed = requestedFeed.slice(0, MAX_PROJECT_ACTIVITY_FEED);
          } else {
            const existingFeed = normalizeProjectActivityFeed(project.changeFeed, project);
            const mergedFeedById = new Map();
            [...requestedFeed, ...existingFeed].forEach((entry) => {
              if (!entry?.id) return;
              if (!mergedFeedById.has(entry.id)) {
                mergedFeedById.set(entry.id, entry);
              }
            });
            safeUpdates.changeFeed = Array.from(mergedFeedById.values())
              .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
              .slice(0, MAX_PROJECT_ACTIVITY_FEED);
          }
        }
        const previousStatus = String(project.status || '').trim();
        let nextProject = ensureProjectOwnership({ ...project, ...safeUpdates }, currentUser);
        const nextStatus = String(nextProject.status || '').trim();
        if (nextStatus && previousStatus !== nextStatus) {
          nextProject = appendProjectActivityEntryToProject(nextProject, {
            type: PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED,
            title: `Status changed to ${PROJECT_STATUS_LABELS[nextStatus] || nextStatus}`,
            message: `${PROJECT_STATUS_LABELS[previousStatus] || previousStatus || 'Unknown'} -> ${
              PROJECT_STATUS_LABELS[nextStatus] || nextStatus
            }`,
            actorId: currentUser.id,
            actorUsername: currentUser.username,
            meta: {
              fromStatus: previousStatus,
              toStatus: nextStatus,
            },
          });
        }
        return nextProject;
      });

      if (didUpdate) {
        syncSharedProjectDetailsForProjects([normalizedProjectId], nextProjects);
      }

      return nextProjects;
    });
  };

  const deleteProject = (projectId) => {
    const projectToDelete = projects.find((project) => project.id === projectId);
    if (!projectToDelete) return;

    if (projectToDelete.ownerId !== currentUser.id) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only the project creator can delete this project.',
      });
      return;
    }

    setProjectInvitations((prevInvites) => {
      const nextInvites = prevInvites.filter(
        (invite) => !(invite.projectId === projectId && invite.ownerId === currentUser.id)
      );
      void saveProjectInvitesStore(nextInvites);
      return nextInvites;
    });

    setProjects(projects.filter(p => p.id !== projectId));
    setEvents(events.filter(ev => ev.projectId !== projectId)); // Cascade delete
    if (activeDashboardProjectId === projectId) setActiveDashboardProjectId(null);
  };

  const inviteMemberToProject = async (projectId, identifier) => {
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    if (!normalizedIdentifier) {
      return { ok: false, message: 'Please enter username or email to invite.' };
    }

    const invitedUser = await findUserByIdentifier(normalizedIdentifier);

    if (!invitedUser) {
      return { ok: false, message: 'This user does not exist.' };
    }
    if (invitedUser.id === currentUser.id) {
      return { ok: false, message: 'You cannot invite yourself.' };
    }

    const targetProject = projects.find((project) => project.id === projectId);
    if (!targetProject) {
      return { ok: false, message: 'Project not found.' };
    }

    if (!isProjectAccessibleByUser(targetProject, currentUser)) {
      return { ok: false, message: 'Only project members can invite new members.' };
    }

    const ownerReference = {
      id: String(targetProject.ownerId || '').trim() || currentUser.id,
      username: String(targetProject.ownerUsername || '').trim().toLowerCase() || currentUser.username,
    };
    const normalizedProject = ensureProjectOwnership(targetProject, ownerReference);
    if (isProjectAccessibleByUser(normalizedProject, invitedUser)) {
      return { ok: false, message: 'This user is already in the project.' };
    }

    const allInvites = await loadProjectInvitesStore();
    const duplicatedPendingInvite = allInvites.some(
      (invite) =>
        invite.status === PROJECT_INVITE_STATUSES.PENDING &&
        invite.projectId === projectId &&
        invite.ownerId === normalizedProject.ownerId &&
        ((invite.invitedUserId && invite.invitedUserId === invitedUser.id) ||
          invite.invitedUsername === invitedUser.username ||
          invite.invitedEmail === invitedUser.email)
    );
    if (duplicatedPendingInvite) {
      return { ok: false, message: 'This user already has a pending invitation for this project.' };
    }

    const nextInvites = [
      ...allInvites,
      normalizeProjectInvite({
        id: generateId(),
        projectId,
        projectName: normalizedProject.name,
        ownerId: normalizedProject.ownerId,
        ownerUsername: normalizedProject.ownerUsername,
        invitedUserId: invitedUser.id,
        invitedUsername: invitedUser.username,
        invitedEmail: invitedUser.email,
        status: PROJECT_INVITE_STATUSES.PENDING,
        createdAt: new Date().toISOString(),
      }),
    ];

    await saveProjectInvitesStore(nextInvites);
    setProjectInvitations(nextInvites);

    return {
      ok: true,
      message: `Invitation sent to ${invitedUser.username}. They can accept it in Profile settings.`,
    };
  };

  const respondToProjectInvite = async (inviteId, decision) => {
    const nextStatus =
      decision === PROJECT_INVITE_STATUSES.ACCEPTED
        ? PROJECT_INVITE_STATUSES.ACCEPTED
        : PROJECT_INVITE_STATUSES.DECLINED;

    const latestInvites = await loadProjectInvitesStore();
    const inviteIndex = latestInvites.findIndex((invite) => invite.id === inviteId);
    if (inviteIndex < 0) {
      return { ok: false, message: 'Invitation not found.' };
    }

    const targetInvite = latestInvites[inviteIndex];
    if (!isInviteForUser(targetInvite, currentUser)) {
      return { ok: false, message: 'You cannot respond to this invitation.' };
    }

    if (targetInvite.status !== PROJECT_INVITE_STATUSES.PENDING) {
      return { ok: false, message: 'This invitation has already been answered.' };
    }

    if (nextStatus === PROJECT_INVITE_STATUSES.ACCEPTED) {
      const ownerPayload = await loadAccountDbPayload(targetInvite.ownerId);
      const ownerProjects = Array.isArray(ownerPayload.projects) ? ownerPayload.projects : [];
      const ownerEvents = Array.isArray(ownerPayload.events) ? ownerPayload.events : [];

      let acceptedProject = null;
      const nextOwnerProjects = ownerProjects.map((project) => {
        if (project.id !== targetInvite.projectId) return project;
        const updatedProject = appendProjectActivityEntryToProject(
          addProjectMemberRecord(project, currentUser),
          {
            type: PROJECT_ACTIVITY_TYPES.MEMBER_JOINED,
            title: `${currentUser.username} joined the project`,
            message: `${currentUser.username} accepted project invitation.`,
            actorId: currentUser.id,
            actorUsername: currentUser.username,
            meta: {
              memberUsername: currentUser.username,
              method: 'invitation',
            },
          }
        );
        acceptedProject = updatedProject;
        return updatedProject;
      });

      if (!acceptedProject) {
        return { ok: false, message: 'Project was not found. It may have been deleted by the owner.' };
      }

      await saveAccountDbPayload(targetInvite.ownerId, {
        ...ownerPayload,
        projects: nextOwnerProjects,
      });

      const ownerReference = {
        id: targetInvite.ownerId,
        username: acceptedProject.ownerUsername || targetInvite.ownerUsername || currentUser.username,
      };
      const normalizedAcceptedProject = ensureProjectOwnership(acceptedProject, ownerReference);
      const acceptedProjectEvents = ownerEvents.filter((event) => event.projectId === normalizedAcceptedProject.id);

      setProjects((prevProjects) => {
        const existing = prevProjects.find((project) => project.id === normalizedAcceptedProject.id);
        const preservedNotesPreferences = resolveAccountScopedNotesPreferences(
          existing?.notesPreferences,
          {
            currentUserId: currentUser.id,
            projectOwnerId: existing?.ownerId || normalizedAcceptedProject.ownerId,
          }
        );
        if (existing) {
          return prevProjects.map((project) =>
            project.id === normalizedAcceptedProject.id
              ? {
                  ...normalizedAcceptedProject,
                  notesPreferences: preservedNotesPreferences,
                  isVisible: existing.isVisible,
                }
              : project
          );
        }

        const visibleCount = prevProjects.filter((project) => project.isVisible).length;
        return [
          ...prevProjects,
          {
            ...normalizedAcceptedProject,
            notesPreferences: {},
            isVisible: visibleCount < 4,
          },
        ];
      });

      setEvents((prevEvents) => {
        const remaining = prevEvents.filter((event) => event.projectId !== normalizedAcceptedProject.id);
        return [...remaining, ...acceptedProjectEvents];
      });
    }

    const updatedInvite = {
      ...targetInvite,
      invitedUserId: currentUser.id,
      invitedUsername: currentUser.username,
      invitedEmail: currentUser.email,
      status: nextStatus,
      respondedAt: new Date().toISOString(),
    };
    const nextInvites = [...latestInvites];
    nextInvites[inviteIndex] = normalizeProjectInvite(updatedInvite);

    await saveProjectInvitesStore(nextInvites);
    setProjectInvitations(nextInvites);

    return {
      ok: true,
      message:
        nextStatus === PROJECT_INVITE_STATUSES.ACCEPTED
          ? `Joined project "${targetInvite.projectName}".`
          : `Declined invitation to "${targetInvite.projectName}".`,
    };
  };

  const leaveProject = async (projectId) => {
    const targetProject = projects.find((project) => project.id === projectId);
    if (!targetProject) {
      return { ok: false, message: 'Project not found.' };
    }

    if (targetProject.ownerId === currentUser.id) {
      return { ok: false, message: 'Project owner cannot leave this project. You can delete it instead.' };
    }

    const shouldLeave = await popup.confirm({
      title: 'Leave project',
      message: `Leave project "${targetProject.name}"?`,
      confirmText: 'Leave',
      tone: 'danger',
    });
    if (!shouldLeave) {
      return { ok: false, cancelled: true, message: 'Leave project cancelled.' };
    }

    const ownerPayload = await loadAccountDbPayload(targetProject.ownerId);
    const ownerProjects = Array.isArray(ownerPayload.projects) ? ownerPayload.projects : [];
    const nextOwnerProjects = ownerProjects.map((project) =>
      project.id === targetProject.id ? removeProjectMemberRecord(project, currentUser.username) : project
    );
    if (ownerProjects.length > 0) {
      await saveAccountDbPayload(targetProject.ownerId, {
        ...ownerPayload,
        projects: nextOwnerProjects,
      });
    }

    setProjects((prevProjects) => prevProjects.filter((project) => project.id !== projectId));
    setEvents((prevEvents) => prevEvents.filter((event) => event.projectId !== projectId));
    if (activeDashboardProjectId === projectId) {
      setActiveDashboardProjectId(null);
    }

    return { ok: true, message: `You left "${targetProject.name}".` };
  };

  const handleSaveProfile = async ({ username, avatarUrl }) => {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();
    const normalizedAvatarUrl = String(avatarUrl || '').trim();

    if (!normalizedUsername || !normalizedEmail) {
      return { ok: false, message: 'Username and email are required.' };
    }

    const users = getLocalUsers();
    const existingUser = users.find((user) => user.id === currentUser.id);
    if (!existingUser) {
      return { ok: false, message: 'Current user record not found.' };
    }

    if (users.some((user) => user.id !== currentUser.id && user.username === normalizedUsername)) {
      return { ok: false, message: 'This username is already taken.' };
    }

    if (users.some((user) => user.id !== currentUser.id && user.email === normalizedEmail)) {
      return { ok: false, message: 'This email is already registered.' };
    }

    if (AUTH_API_BASE_URL) {
      try {
        await requestCloudDataApi(`/users/${encodeURIComponent(currentUser.id)}/profile`, {
          method: 'PUT',
          body: {
            username: normalizedUsername,
            avatarUrl: normalizedAvatarUrl,
          },
        });
      } catch (error) {
        return { ok: false, message: error.message || 'Failed to update profile on server.' };
      }
    }

    const oldUsername = String(existingUser.username || '').trim().toLowerCase();
    const oldEmail = String(existingUser.email || '').trim().toLowerCase();
    const nextUsers = users.map((user) =>
      user.id === currentUser.id
        ? { ...user, username: normalizedUsername, email: normalizedEmail, avatarUrl: normalizedAvatarUrl }
        : user
    );
    saveLocalUsers(nextUsers);

    const nextCurrentUser = normalizeAuthUser({
      ...existingUser,
      username: normalizedUsername,
      email: normalizedEmail,
      avatarUrl: normalizedAvatarUrl,
    });
    onUpdateCurrentUser(nextCurrentUser);
    const usernameChanged = Boolean(oldUsername && oldUsername !== normalizedUsername);
    const nextProjects = usernameChanged
      ? projects.map((project) =>
          ensureProjectOwnership(
            migrateProjectUsername(project, oldUsername, normalizedUsername),
            nextCurrentUser
          )
        )
      : projects;

    if (usernameChanged) {
      setProjects(nextProjects);
    }

    setProjectInvitations((prevInvites) => {
      const nextInvites = prevInvites.map((invite) => {
        let nextInvite = invite;

        if (String(invite.ownerId || '').trim() === currentUser.id) {
          nextInvite = { ...nextInvite, ownerUsername: normalizedUsername };
        }

        const isInviteTargetingCurrentUser =
          (invite.invitedUserId && invite.invitedUserId === currentUser.id) ||
          (!invite.invitedUserId &&
            (String(invite.invitedUsername || '').trim().toLowerCase() === oldUsername ||
              String(invite.invitedEmail || '').trim().toLowerCase() === oldEmail));

        if (isInviteTargetingCurrentUser) {
          nextInvite = {
            ...nextInvite,
            invitedUserId: currentUser.id,
            invitedUsername: normalizedUsername,
            invitedEmail: normalizedEmail,
          };
        }

        return normalizeProjectInvite(nextInvite);
      });

      void saveProjectInvitesStore(nextInvites);
      return nextInvites;
    });

    void saveAccountDbPayload(currentUser.id, {
      projects: nextProjects,
      events,
      displayRange,
      hidePastWeeks,
      startupView,
      lastVisitedView,
      projectUpdatePopupMode,
      seenProjectUpdateIds,
    });

    return { ok: true, message: 'Profile updated successfully.' };
  };

  const handleRequestPasswordOtp = async () => {
    const email = String(currentUser.email || '').trim().toLowerCase();
    if (!email) {
      return { ok: false, message: 'Current account email is missing.' };
    }
    if (!AUTH_API_BASE_URL) {
      return { ok: false, message: 'OTP verification requires Cloud Auth API.' };
    }
    try {
      const result = await postAuthApi('/auth/send-otp', { email });
      return { ok: true, message: result.message || 'OTP has been sent.' };
    } catch (error) {
      return { ok: false, message: error.message || 'Failed to send OTP.' };
    }
  };

  const handleVerifyPasswordOtp = async ({ otp }) => {
    const email = String(currentUser.email || '').trim().toLowerCase();
    const normalizedOtp = String(otp || '').trim();
    if (!email) {
      return { ok: false, message: 'Current account email is missing.' };
    }
    if (!normalizedOtp) {
      return { ok: false, message: 'OTP code is required.' };
    }
    if (!AUTH_API_BASE_URL) {
      return { ok: false, message: 'OTP verification requires Cloud Auth API.' };
    }
    try {
      const result = await postAuthApi('/auth/verify-otp', { email, otp: normalizedOtp });
      return {
        ok: true,
        message: result.message || 'OTP verified successfully.',
        proof: {
          method: 'otp',
          otp: normalizedOtp,
        },
      };
    } catch (error) {
      return { ok: false, message: error.message || 'OTP verification failed.' };
    }
  };

  const handleVerifyPasswordWithGoogle = async ({ accessToken, idToken }) => {
    if (!AUTH_API_BASE_URL) {
      return { ok: false, message: 'Google verification requires Cloud Auth API.' };
    }
    const normalizedAccessToken = String(accessToken || '').trim();
    const normalizedIdToken = String(idToken || '').trim();
    if (!normalizedAccessToken && !normalizedIdToken) {
      return { ok: false, message: 'Google token is missing.' };
    }

    try {
      const result = await postAuthApi('/auth/google', {
        ...(normalizedAccessToken ? { accessToken: normalizedAccessToken } : {}),
        ...(normalizedIdToken ? { idToken: normalizedIdToken } : {}),
      });
      const verifiedUser = normalizeAuthUser(result.user);
      const currentEmail = String(currentUser.email || '').trim().toLowerCase();
      if (!verifiedUser?.email || verifiedUser.email !== currentEmail) {
        return {
          ok: false,
          message: 'Google account does not match your current login account.',
        };
      }

      return {
        ok: true,
        message: 'Google account verified.',
        proof: {
          method: 'google',
          accessToken: normalizedAccessToken,
          idToken: normalizedIdToken,
        },
      };
    } catch (error) {
      return { ok: false, message: error.message || 'Google verification failed.' };
    }
  };

  const handleChangePassword = async ({ newPassword, verification }) => {
    const normalizedNewPassword = String(newPassword || '');
    const verificationMethod = String(verification?.method || '').trim().toLowerCase();

    if (!normalizedNewPassword) {
      return { ok: false, message: 'Please fill in new password.' };
    }

    if (normalizedNewPassword.length < 6) {
      return { ok: false, message: 'New password must be at least 6 characters.' };
    }
    if (!verificationMethod) {
      return { ok: false, message: 'Identity verification is required.' };
    }

    if (AUTH_API_BASE_URL) {
      const body = {
        newPassword: normalizedNewPassword,
        verificationMethod,
      };
      if (verificationMethod === 'otp') {
        body.otp = String(verification?.otp || '').trim();
      } else if (verificationMethod === 'google') {
        body.accessToken = String(verification?.accessToken || '').trim();
        body.idToken = String(verification?.idToken || '').trim();
      }

      try {
        const result = await requestCloudDataApi(`/users/${encodeURIComponent(currentUser.id)}/password`, {
          method: 'PUT',
          body,
        });

        const users = getLocalUsers();
        const nextUsers = users.map((user) =>
          user.id === currentUser.id ? { ...user, password: normalizedNewPassword } : user
        );
        saveLocalUsers(nextUsers);
        return { ok: true, message: result.message || 'Password changed successfully.' };
      } catch (error) {
        return { ok: false, message: error.message || 'Failed to change password.' };
      }
    }

    const users = getLocalUsers();
    const existingUser = users.find((user) => user.id === currentUser.id);
    if (!existingUser) {
      return { ok: false, message: 'Current user record not found.' };
    }

    const nextUsers = users.map((user) =>
      user.id === currentUser.id ? { ...user, password: normalizedNewPassword } : user
    );
    saveLocalUsers(nextUsers);

    return { ok: true, message: 'Password changed successfully.' };
  };
  const projectUpdatesOverlay = (
    <>
      {projectUpdateToastNotice && !isProjectUpdatesPopupOpen && (
        <ProjectUpdatesToast
          notice={projectUpdateToastNotice}
          isVisible={isProjectUpdateToastVisible}
          onClose={hideProjectUpdateToast}
          onOpenDetails={() => {
            setHasPendingFullPopupOnReturn(false);
            openProjectUpdatesPopup();
          }}
        />
      )}

      {isProjectUpdatesPopupOpen && (
        <ProjectUpdatesPopup
          groups={todayProjectActivityDigest.groups}
          popupMode={projectUpdatePopupMode}
          onPopupModeChange={setProjectUpdatePopupMode}
          onClose={closeProjectUpdatesPopup}
        />
      )}
    </>
  );

  if (!isAccountDataHydrated) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Loading your calendar...
        </div>
      </div>
    );
  }

  if (isProfileViewOpen) {
    return (
      <ProfileSettingsView
        currentUser={currentUser}
        onBack={() => setIsProfileViewOpen(false)}
        onLogout={onLogout}
        onSaveProfile={handleSaveProfile}
        onChangePassword={handleChangePassword}
        onRequestPasswordOtp={handleRequestPasswordOtp}
        onVerifyPasswordOtp={handleVerifyPasswordOtp}
        onVerifyPasswordWithGoogle={handleVerifyPasswordWithGoogle}
        projectInvitations={pendingProjectInvitations}
        onRespondToProjectInvite={respondToProjectInvite}
      />
    );
  }

  // --- Render App View vs Project Dashboard View ---
  if (activeDashboardProjectId) {
    const activeProject = projects.find(p => p.id === activeDashboardProjectId);
    if (activeProject) {
      return (
        <>
          <ProjectDashboard
            project={activeProject}
            currentUser={currentUser}
            events={events.filter(e => e.projectId === activeProject.id)}
            onBack={() => setActiveDashboardProjectId(null)}
            onUpdateEvent={updateEvent}
            onSaveTask={(taskData) => {
              saveTaskForProject(activeProject.id, taskData);
            }}
            onDeleteTask={deleteEvent}
            onUpdateProject={updateProjectDetails}
            onInviteMember={inviteMemberToProject}
            activeTab={activeDashboardTab}
            onActiveTabChange={setActiveDashboardTab}
          />
          {projectUpdatesOverlay}
        </>
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-sm md:text-base">
      
      {/* --- Top Navigation Bar --- */}
      <header className="bg-white shadow-sm border-b px-3 sm:px-4 md:px-6 py-3 shrink-0 z-20">
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="w-6 h-6 text-blue-600 shrink-0" />
              <h1 className="text-lg font-bold text-gray-800 truncate">Multi-Project Calendar</h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowProjectModal(true)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Manage projects"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsProfileViewOpen(true)}
                className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-gray-100 transition-colors"
                title="Open profile settings"
              >
                <UserAvatar user={currentUser} sizeClass="w-8 h-8" textClass="text-[11px]" />
              </button>
            </div>
          </div>

          <div
            className="mt-1.5 flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            <button
              type="button"
              onClick={() => handleMobileProjectSelect(null)}
              className={`h-9 w-auto flex-none inline-flex items-center justify-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold border whitespace-nowrap transition-colors ${
                !selectedMobileProject
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3 h-3" />
              Merge
            </button>
            {mobileVisibleProjects.map((project) => renderMobileProjectButton(project))}
          </div>
        </div>

        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Multi-Project Calendar</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg border">
              <button
                onClick={() => setIsMergeView(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                  !isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Split View</span>
              </button>
              <button
                onClick={() => setIsMergeView(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                  isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Merge View</span>
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            <button
              onClick={handleNewEventClick}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Event</span>
            </button>

            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Manage Project</span>
            </button>

            <button
              type="button"
              onClick={() => setIsProfileViewOpen(true)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-100 transition-colors"
              title="Open profile settings"
            >
              <UserAvatar user={currentUser} sizeClass="w-8 h-8" textClass="text-[11px]" />
              <div className="hidden lg:flex flex-col leading-tight text-left">
                <span className="text-[11px] text-gray-400">Signed in as</span>
                <span className="text-sm font-semibold text-gray-700 truncate max-w-[180px]">
                  {currentUser.username || currentUser.email}
                </span>
              </div>
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-3 py-2 rounded-lg font-medium transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Calendar Board --- */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 relative">
        {visibleProjects.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-gray-400 gap-4">
            <LayoutGrid className="w-16 h-16 opacity-50" />
            <p className="text-lg">กรุณาเลือกหรือเพิ่มโปรเจกต์จากเมนู "จัดการ Project"</p>
          </div>
        ) : (
          <div className={!isCompactViewport && !effectiveMergeView ? 'min-w-[800px]' : 'w-full'}> {/* Ensure it doesn't squish too much on small screens */}
            
            {!isCompactViewport && (
              <>
                {/* Sticky Project Headers (Only in Split View) */}
                {!effectiveMergeView && (
                  <div className="sticky top-0 z-10 flex bg-white shadow-sm border-b">
                    {visibleProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => {
                          setActiveDashboardTab(DEFAULT_PROJECT_DASHBOARD_TAB);
                          setActiveDashboardProjectId(project.id);
                        }}
                        className="flex-1 text-center border-r last:border-r-0 relative overflow-hidden cursor-pointer hover:bg-blue-50 transition-colors group flex flex-col items-center justify-center h-14"
                      >
                        <div className={`absolute top-0 left-0 w-full h-1 ${PROJECT_COLORS[project.colorIndex].bg}`}></div>
                        <span className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors text-base">{project.name}</span>
                        <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1">
                          Click again to open project management
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Merge View Sticky Header */}
                {effectiveMergeView && (
                  <div className="sticky top-0 z-10 bg-white shadow-sm border-b text-center h-14 flex items-center justify-center px-3 gap-2">
                    <span className="font-bold text-gray-700 text-sm sm:text-base md:text-lg">Merged Calendar ({visibleProjects.length})</span>
                    {googleCalendarStatus.linked && isGoogleCalendarEventsLoading && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Syncing Google
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Months List (Continuous Scroll) */}
            {monthsToRender.length === 0 ? (
              <div className="flex justify-center items-center h-48 text-gray-500">
                ไม่มีสัปดาห์ที่จะแสดงผลในช่วงเวลาที่เลือก
              </div>
            ) : (
              <div className="flex flex-col">
                {monthsToRender.map(({ month, year }, idx) => (
                  <div key={`${year}-${month}`} className="border-b-4 border-gray-200">
                    {/* Month Title */}
                    <div className={`bg-gray-100 py-2 px-3 sm:px-4 border-b border-gray-200 ${isCompactViewport ? '' : 'sticky top-14 z-[5] shadow-sm'}`}>
                      <h2 className="text-base sm:text-lg font-bold text-gray-800 whitespace-nowrap">
                        {THAI_MONTHS[month]} {year}
                      </h2>
                    </div>

                    <div className="flex">
                      {isCompactViewport ? (
                        <div className="flex-1 bg-white p-2">
                          <MonthGrid
                            year={year}
                            month={month}
                            projects={mobileCalendarProjects}
                            allProjects={projects}
                            events={mobileCalendarEvents}
                            showEventTime={false}
                            onDayClick={(dateStr) => handleDayClick(dateStr, selectedMobileProject?.id || null)}
                            onEventClick={handleEventClick}
                            hidePastWeeks={hidePastWeeks}
                            currentWeekStart={currentWeekStart}
                          />
                        </div>
                      ) : effectiveMergeView ? (
                        // Merge View: 1 Full Width Calendar
                        <div className="flex-1 bg-white p-2">
                          <MonthGrid 
                            year={year} 
                            month={month} 
                            projects={mergeViewProjects} 
                            allProjects={projects}
                            events={mergeViewEvents}
                            showEventTime
                            onDayClick={(dateStr) => handleDayClick(dateStr, null)}
                            onEventClick={handleEventClick}
                            hidePastWeeks={hidePastWeeks}
                            currentWeekStart={currentWeekStart}
                          />
                        </div>
                      ) : (
                        // Split View: 4 Calendars Side-by-Side
                        visibleProjects.map((project) => (
                          <div key={project.id} className="flex-1 border-r last:border-r-0 border-gray-200 bg-white p-2">
                            <MonthGrid 
                              year={year} 
                              month={month} 
                              projects={[project]} 
                              allProjects={projects}
                              events={events.filter(e => e.projectId === project.id)}
                              showEventTime={false}
                              onDayClick={(dateStr) => handleDayClick(dateStr, project.id)}
                              onEventClick={handleEventClick}
                              hidePastWeeks={hidePastWeeks}
                              currentWeekStart={currentWeekStart}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {isCompactViewport && (
        <button
          type="button"
          onClick={handleNewEventClick}
          className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-12 h-12 rounded-full bg-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.25)] hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
          title="Add event"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {projectUpdatesOverlay}

      {/* --- Modals --- */}
      {showProjectModal && (
        <ProjectManagerModal 
          projects={projects}
          currentUser={currentUser}
          onClose={() => setShowProjectModal(false)}
          onToggleVisibility={toggleProjectVisibility}
          onSaveProject={saveProject}
          onDeleteProject={deleteProject}
          onLeaveProject={leaveProject}
          onInviteMember={inviteMemberToProject}
          onJoinProjectByCode={joinProjectByCode}
          onRegenerateProjectCode={regenerateProjectJoinCode}
          displayRange={displayRange}
          setDisplayRange={setDisplayRange}
          hidePastWeeks={hidePastWeeks}
          setHidePastWeeks={setHidePastWeeks}
          startupView={startupView}
          setStartupView={setStartupView}
          googleCalendarStatus={googleCalendarStatus}
          googleCalendarCalendars={googleCalendarCalendars}
          googleCalendarSelectedCalendarIds={googleCalendarSelectedCalendarIds}
          onLinkGoogleCalendar={handleLinkGoogleCalendar}
          onUnlinkGoogleCalendar={handleUnlinkGoogleCalendar}
          onSaveGoogleCalendarSelection={handleSaveGoogleCalendarSelection}
          isGoogleCalendarBusy={isGoogleCalendarBusy}
          isGoogleCalendarCalendarsLoading={isGoogleCalendarCalendarsLoading}
          isGoogleCalendarSelectionSaving={isGoogleCalendarSelectionSaving}
        />
      )}

      {showEventModal && (
        <EventModal
          event={editingEvent}
          projects={projects} // Show all available projects in dropdown
          defaultDate={selectedDateForNewEvent}
          defaultProjectId={preSelectedProjectId}
          googleCalendarStatus={googleCalendarStatus}
          googleCalendarCalendars={googleCalendarCalendars}
          googleCalendarSelectedCalendarIds={googleCalendarSelectedCalendarIds}
          isGoogleCalendarCalendarsLoading={isGoogleCalendarCalendarsLoading}
          onClose={() => setShowEventModal(false)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}

    </div>
  );
}


// ==========================================
// Sub-Components
// ==========================================

// --- Editable Section Component (Vision & Mission) ---
const EditableSection = ({ title, icon: Icon, value, placeholder, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 leading-snug">
          <Icon className="w-5 h-5 text-gray-500" />
          {title}
        </h3>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea 
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">ยกเลิก</button>
            <button 
              onClick={handleSave} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> บันทึก
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none whitespace-pre-wrap">
          {value ? (
            <p>{value}</p>
          ) : (
            <p className="text-gray-400 italic">ยังไม่มีข้อมูล คลิกปุ่มแก้ไขเพื่อเพิ่ม...</p>
          )}
        </div>
      )}
    </div>
  );
};

const NoteTargetSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
}) => {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => {
      const haystack = `${option.label || ''} ${option.subLabel || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center gap-2 hover:border-blue-300 transition-colors"
      >
        {selectedOption?.member ? (
          <UserAvatar
            user={selectedOption.member}
            sizeClass="w-8 h-8"
            textClass="text-[10px]"
            ringClass="ring-2 ring-white shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
            {(selectedOption?.label || placeholder || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {selectedOption?.label || placeholder}
          </p>
          {selectedOption?.subLabel && (
            <p className="text-[11px] text-gray-500 truncate">{selectedOption.subLabel}</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2.5 transition-colors ${
                    option.value === value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {option.member ? (
                    <UserAvatar
                      user={option.member}
                      sizeClass="w-7 h-7"
                      textClass="text-[10px]"
                      ringClass="ring-2 ring-white"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">
                      {option.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{option.label}</p>
                    {option.subLabel && <p className="text-[11px] text-gray-500 truncate">{option.subLabel}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Project Dashboard View (Like Asana) ---
function ProjectDashboard({
  project,
  currentUser,
  events,
  onBack,
  onUpdateEvent,
  onSaveTask,
  onDeleteTask,
  onUpdateProject,
  onInviteMember,
  activeTab: activeTabProp,
  onActiveTabChange,
}) {
  const popup = usePopup();
  // เปลี่ยนค่าเริ่มต้นให้เปิดหน้า Project Organization เป็นอันดับแรก
  const [activeTabLocal, setActiveTabLocal] = useState(DEFAULT_PROJECT_DASHBOARD_TAB);
  const activeTab = normalizeProjectDashboardTab(activeTabProp ?? activeTabLocal);
  const setActiveTab = (nextTab) => {
    const normalizedTab = normalizeProjectDashboardTab(nextTab);
    if (typeof onActiveTabChange === 'function') {
      onActiveTabChange(normalizedTab);
      return;
    }
    setActiveTabLocal(normalizedTab);
  };
  const projectColor = PROJECT_COLORS[project.colorIndex] || PROJECT_COLORS[0];
  const isProjectHost =
    String(project.ownerId || '').trim() === String(currentUser.id || '').trim();

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  // States for Production-ready Project Organization
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState('');
  
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  
  // Local state for Team Notes
  const normalizePinnedIds = (value) =>
    Array.from(
      new Set(
        (Array.isArray(value) ? value : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
  const arePinnedIdListsEqual = (left, right) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  };
  const initialNotesPreferences = resolveAccountScopedNotesPreferences(project.notesPreferences, {
    currentUserId: currentUser.id,
    projectOwnerId: project.ownerId,
  });
  const initialTaskView = initialNotesPreferences.taskView === 'table' ? 'table' : 'gallery';
  const [noteSection, setNoteSection] = useState(
    initialNotesPreferences.section === 'member' ? 'member' : 'department'
  ); // 'department' | 'member'
  const [selectedDepartmentNoteId, setSelectedDepartmentNoteId] = useState(
    initialNotesPreferences.selectedDepartment || ''
  );
  const [selectedMemberNoteId, setSelectedMemberNoteId] = useState(
    initialNotesPreferences.selectedMemberId || ''
  );
  const [pinnedDepartmentNoteIds, setPinnedDepartmentNoteIds] = useState(
    normalizePinnedIds(initialNotesPreferences.pinnedDepartments)
  );
  const [pinnedMemberNoteIds, setPinnedMemberNoteIds] = useState(
    normalizePinnedIds(initialNotesPreferences.pinnedMembers)
  );
  const notesSidebarBubbleMovedRef = useRef(false);
  const notesFullEditorRootRef = useRef(null);
  const resolveNotesSidebarMinTop = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 92;
    let minTop = 92;
    const noteEditorHeader = document.querySelector('[data-note-editor-full-header="true"]');
    if (noteEditorHeader instanceof HTMLElement) {
      const headerRect = noteEditorHeader.getBoundingClientRect();
      if (Number.isFinite(headerRect.bottom)) {
        minTop = Math.max(minTop, Math.round(headerRect.bottom + 10));
      }
    }
    const sheetColumnHeader = document.querySelector('[data-note-sheet-column-header="true"]');
    if (sheetColumnHeader instanceof HTMLElement) {
      const sheetHeaderRect = sheetColumnHeader.getBoundingClientRect();
      if (Number.isFinite(sheetHeaderRect.bottom)) {
        minTop = Math.max(minTop, Math.round(sheetHeaderRect.bottom + 8));
      }
    }
    return minTop;
  }, []);
  const clampNotesSidebarFloatingTop = useCallback((value) => {
    if (typeof window === 'undefined' || !Number.isFinite(value)) return 110;
    const minTop = resolveNotesSidebarMinTop();
    const maxTop = Math.max(minTop, window.innerHeight - 72);
    return Math.min(Math.max(value, minTop), maxTop);
  }, [resolveNotesSidebarMinTop]);
  const [notesSidebarFloatingTop, setNotesSidebarFloatingTop] = useState(() =>
    110
  );
  const [isNotesFullSidebarCollapsed, setIsNotesFullSidebarCollapsed] = useState(
    Boolean(initialNotesPreferences.fullSidebarCollapsed)
  );
  const [isNotesFullEditorOpen, setIsNotesFullEditorOpen] = useState(
    Boolean(initialNotesPreferences.fullEditorOpen)
  );
  const [taskView, setTaskView] = useState(initialTaskView);
  const [notesContent, setNotesContent] = useState(normalizeNoteContentMap(project.notesContent));
  const [noteRevisionMap, setNoteRevisionMap] = useState(
    normalizeNoteRevisionMap(project.noteRevisionMap)
  );
  const [notesPresence, setNotesPresence] = useState(
    normalizeProjectNotesPresence(project.notesPresence)
  );
  const notesPresenceFlushTimerRef = useRef(null);
  const [teamMembers, setTeamMembers] = useState(() => normalizeProjectTeamMembers(project));
  const [projectPositions, setProjectPositions] = useState(() => normalizeRoles(project.positions || project.roles));
  const [projectDepartments, setProjectDepartments] = useState(() => normalizeDepartments(project.departments));
  const [projectDepartmentColors, setProjectDepartmentColors] = useState(() =>
    normalizeDepartmentColorMap(project.departmentColors, project.departments)
  );
  const [isOrgEditMode, setIsOrgEditMode] = useState(false);
  const [optionsPopupType, setOptionsPopupType] = useState(null); // 'position' | 'department' | null
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newDepartmentColor, setNewDepartmentColor] = useState(DEPARTMENT_COLOR_PRESETS[0] || '#3b82f6');
  const [editingOptionOriginal, setEditingOptionOriginal] = useState('');
  const [editingOptionValue, setEditingOptionValue] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false);

  const normalizeAnnouncementRecord = (value) => {
    const message = String(value?.message || '').trim();
    if (!message) return null;
    const createdAtRaw = String(value?.createdAt || '').trim();
    const createdAt =
      createdAtRaw && !Number.isNaN(new Date(createdAtRaw).getTime())
        ? createdAtRaw
        : new Date().toISOString();
    return {
      id: String(value?.id || generateId()).trim(),
      message,
      createdAt,
      createdBy: String(value?.createdBy || '').trim().toLowerCase(),
    };
  };
  const activeAnnouncement = normalizeAnnouncementRecord(project.activeAnnouncement);
  const announcementHistory = (Array.isArray(project.announcementHistory) ? project.announcementHistory : [])
    .map((item) => normalizeAnnouncementRecord(item))
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const projectChangeFeed = normalizeProjectActivityFeed(project.changeFeed, project);

  useEffect(() => {
    const nextTeamMembers = normalizeProjectTeamMembers(project);
    const nextProjectPositions = normalizeRoles(project.positions || project.roles);
    const nextProjectDepartments = normalizeDepartments(project.departments);
    const nextProjectDepartmentColors = normalizeDepartmentColorMap(
      project.departmentColors,
      nextProjectDepartments
    );
    const nextNotesContent = normalizeNoteContentMap(project.notesContent);
    const nextNoteRevisionMap = normalizeNoteRevisionMap(project.noteRevisionMap);
    setTeamMembers((prev) => (isJsonEqual(prev, nextTeamMembers) ? prev : nextTeamMembers));
    setProjectPositions((prev) =>
      isJsonEqual(prev, nextProjectPositions) ? prev : nextProjectPositions
    );
    setProjectDepartments((prev) =>
      isJsonEqual(prev, nextProjectDepartments) ? prev : nextProjectDepartments
    );
    setProjectDepartmentColors((prev) =>
      isJsonEqual(prev, nextProjectDepartmentColors) ? prev : nextProjectDepartmentColors
    );
    setNotesContent((prev) => (isJsonEqual(prev, nextNotesContent) ? prev : nextNotesContent));
    setNoteRevisionMap((prev) =>
      isJsonEqual(prev, nextNoteRevisionMap) ? prev : nextNoteRevisionMap
    );
  }, [
    project.id,
    project.teamMembers,
    project.positions,
    project.roles,
    project.departments,
    project.departmentColors,
    project.notesContent,
    project.noteRevisionMap,
    project.members,
    project.ownerUsername,
  ]);
  useEffect(() => {
    const nextNotesPresence = normalizeProjectNotesPresence(project.notesPresence);
    setNotesPresence((prev) => (isJsonEqual(prev, nextNotesPresence) ? prev : nextNotesPresence));
  }, [project.id, project.notesPresence]);

  useEffect(() => {
    const nextNotesPreferences = resolveAccountScopedNotesPreferences(project.notesPreferences, {
      currentUserId: currentUser.id,
      projectOwnerId: project.ownerId,
    });
    const nextNoteSection = nextNotesPreferences.section === 'member' ? 'member' : 'department';
    const nextDepartmentNoteId = nextNotesPreferences.selectedDepartment || '';
    const nextMemberNoteId = nextNotesPreferences.selectedMemberId || '';
    const nextPinnedDepartments = normalizePinnedIds(nextNotesPreferences.pinnedDepartments);
    const nextPinnedMembers = normalizePinnedIds(nextNotesPreferences.pinnedMembers);
    const nextSidebarCollapsed = Boolean(nextNotesPreferences.fullSidebarCollapsed);
    const nextFullEditorOpen = Boolean(nextNotesPreferences.fullEditorOpen);
    const nextTaskView = nextNotesPreferences.taskView === 'table' ? 'table' : 'gallery';

    setNoteSection((prev) => (prev === nextNoteSection ? prev : nextNoteSection));
    setSelectedDepartmentNoteId((prev) => (prev === nextDepartmentNoteId ? prev : nextDepartmentNoteId));
    setSelectedMemberNoteId((prev) => (prev === nextMemberNoteId ? prev : nextMemberNoteId));
    setPinnedDepartmentNoteIds((prev) =>
      arePinnedIdListsEqual(prev, nextPinnedDepartments) ? prev : nextPinnedDepartments
    );
    setPinnedMemberNoteIds((prev) =>
      arePinnedIdListsEqual(prev, nextPinnedMembers) ? prev : nextPinnedMembers
    );
    setIsNotesFullSidebarCollapsed((prev) => (prev === nextSidebarCollapsed ? prev : nextSidebarCollapsed));
    setIsNotesFullEditorOpen((prev) => (prev === nextFullEditorOpen ? prev : nextFullEditorOpen));
    setTaskView((prev) => (prev === nextTaskView ? prev : nextTaskView));
  }, [project.id, project.notesPreferences, project.ownerId, currentUser.id]);
  
  const statusConfig = {
    on_track: { label: 'On Track (ตามแผน)', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
    at_risk: { label: 'At Risk (มีความเสี่ยง)', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
    off_track: { label: 'Off Track (ล่าช้า)', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  };

  const TABS = [
    { id: 'organization', icon: FolderTree, label: 'Project Organization' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Management' },
    { id: 'team', icon: Users, label: 'Team Management' },
    { id: 'notes', icon: FileText, label: 'Team Notes' },
    { id: 'announcements', icon: MessageSquare, label: 'Announcements' },
  ];

  useEffect(() => {
    if (typeof onActiveTabChange === 'function') {
      const normalizedTab = normalizeProjectDashboardTab(activeTabProp);
      if (activeTabProp !== normalizedTab) {
        onActiveTabChange(normalizedTab);
      }
      return;
    }
    setActiveTabLocal(DEFAULT_PROJECT_DASHBOARD_TAB);
  }, [project.id, onActiveTabChange, activeTabProp]);

  const canManageMembers = isProjectAccessibleByUser(project, currentUser);

  const persistTeamManagement = (
    membersInput,
    positionsInput = projectPositions,
    departmentsInput = projectDepartments,
    departmentColorsInput = projectDepartmentColors
  ) => {
    const ownerUsername = String(project.ownerUsername || '').trim().toLowerCase();
    const membersByUsername = new Map();
    const userLookup = buildLocalUserLookup();

    (Array.isArray(membersInput) ? membersInput : []).forEach((member) => {
      const username = String(member?.username || member?.name || '').trim().toLowerCase();
      if (!username || membersByUsername.has(username)) return;
      membersByUsername.set(username, member);
    });

    const usernames = Array.from(new Set([ownerUsername, ...membersByUsername.keys()].filter(Boolean)));
    const normalizedMembers = usernames.map((username, index) => {
      const existingMember = membersByUsername.get(username);
      const profileUser = resolveMemberProfile(userLookup, username, existingMember);
      return buildMemberFromUsername(username, index, ownerUsername, existingMember, profileUser);
    });
    const normalizedPositions = normalizeRoles(positionsInput);
    const normalizedDepartments = normalizeDepartments([
      ...departmentsInput,
      ...normalizedMembers.map((member) => member.department || 'Unassigned'),
      'Unassigned',
    ]);
    const normalizedDepartmentColors = normalizeDepartmentColorMap(
      departmentColorsInput,
      normalizedDepartments
    );
    const memberUsernames = normalizedMembers.map((member) => member.username);

    setTeamMembers(normalizedMembers);
    setProjectPositions(normalizedPositions);
    setProjectDepartments(normalizedDepartments);
    setProjectDepartmentColors(normalizedDepartmentColors);

    onUpdateProject(project.id, {
      members: memberUsernames,
      teamMembers: normalizedMembers,
      positions: normalizedPositions,
      roles: normalizedPositions, // Backward compatibility for old records
      departments: normalizedDepartments,
      departmentColors: normalizedDepartmentColors,
    });
  };

  const CREATE_POSITION_OPTION = '__create_position__';
  const CREATE_DEPARTMENT_OPTION = '__create_department__';

  const handleCreatePosition = async (memberId = null, optionName = '') => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage positions.',
      });
      return null;
    }

    const positionName =
      optionName ||
      (await popup.prompt({
        title: 'Create position',
        message: 'Enter a new position name',
        placeholder: 'e.g. Product Manager',
      }));
    if (!positionName) return null;

    const trimmedPosition = positionName.trim();
    if (!trimmedPosition) return null;

    const duplicated = projectPositions.some(
      (position) => position.toLowerCase() === trimmedPosition.toLowerCase()
    );
    if (duplicated) {
      void popup.alert({
        title: 'Duplicate position',
        message: 'This position already exists.',
      });
      return null;
    }

    const nextPositions = [...projectPositions, trimmedPosition];
    const nextMembers = memberId
      ? teamMembers.map((member) => {
          if (member.id !== memberId) return member;
          const isOwner = member.username === project.ownerUsername;
          return {
            ...member,
            position: trimmedPosition,
            role: trimmedPosition,
            level: getRoleLevel(trimmedPosition, isOwner),
          };
        })
      : teamMembers;

    persistTeamManagement(nextMembers, nextPositions, projectDepartments);
    return trimmedPosition;
  };

  const handleCreateDepartment = async (memberId = null, optionName = '', optionColor = '') => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage departments.',
      });
      return null;
    }

    const departmentName =
      optionName ||
      (await popup.prompt({
        title: 'Create department',
        message: 'Enter a new department name',
        placeholder: 'e.g. Engineering',
      }));
    if (!departmentName) return null;

    const trimmedDepartment = departmentName.trim();
    if (!trimmedDepartment) return null;

    const duplicated = projectDepartments.some(
      (department) => department.toLowerCase() === trimmedDepartment.toLowerCase()
    );
    if (duplicated) {
      void popup.alert({
        title: 'Duplicate department',
        message: 'This department already exists.',
      });
      return null;
    }

    const nextDepartments = normalizeDepartments([...projectDepartments, trimmedDepartment, 'Unassigned']);
    const nextDepartmentColors = normalizeDepartmentColorMap(
      {
        ...projectDepartmentColors,
        [trimmedDepartment]:
          normalizeDepartmentColorHex(optionColor) || pickDepartmentPresetColor(trimmedDepartment),
      },
      nextDepartments
    );
    const nextMembers = memberId
      ? teamMembers.map((member) =>
          member.id === memberId ? { ...member, department: trimmedDepartment } : member
        )
      : teamMembers;

    persistTeamManagement(nextMembers, projectPositions, nextDepartments, nextDepartmentColors);
    return trimmedDepartment;
  };

  const handleAssignPosition = async (memberId, selectedPosition) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage positions.',
      });
      return;
    }

    if (selectedPosition === CREATE_POSITION_OPTION) {
      await handleCreatePosition(memberId);
      return;
    }

    const nextMembers = teamMembers.map((member) => {
      if (member.id !== memberId) return member;

      const isOwner = member.username === project.ownerUsername;
      return {
        ...member,
        position: selectedPosition,
        role: selectedPosition,
        level: getRoleLevel(selectedPosition, isOwner),
      };
    });

    persistTeamManagement(nextMembers, projectPositions, projectDepartments);
  };

  const handleAssignDepartment = async (memberId, selectedDepartment) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage departments.',
      });
      return;
    }

    if (selectedDepartment === CREATE_DEPARTMENT_OPTION) {
      await handleCreateDepartment(memberId);
      return;
    }

    const nextMembers = teamMembers.map((member) =>
      member.id === memberId ? { ...member, department: selectedDepartment } : member
    );

    persistTeamManagement(nextMembers, projectPositions, projectDepartments);
  };

  const handleDeletePositionOption = async (positionName) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage positions.',
      });
      return;
    }

    const normalizedTarget = String(positionName || '').trim().toLowerCase();
    if (!normalizedTarget) return;

    const shouldDelete = await popup.confirm({
      title: 'Delete position',
      message: `Delete position "${positionName}"?`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;

    const nextPositions = projectPositions.filter(
      (position) => String(position || '').trim().toLowerCase() !== normalizedTarget
    );
    const nextMembers = teamMembers.map((member) => {
      if (String(member.position || '').trim().toLowerCase() !== normalizedTarget) return member;

      const fallbackPosition = member.username === project.ownerUsername ? 'Project Owner' : '';
      return {
        ...member,
        position: fallbackPosition,
        role: fallbackPosition,
        level: getRoleLevel(fallbackPosition, member.username === project.ownerUsername),
      };
    });

    persistTeamManagement(nextMembers, nextPositions, projectDepartments);
  };

  const handleDeleteDepartmentOption = async (departmentName) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage departments.',
      });
      return;
    }

    const normalizedTarget = String(departmentName || '').trim().toLowerCase();
    if (!normalizedTarget || normalizedTarget === 'unassigned') return;

    const shouldDelete = await popup.confirm({
      title: 'Delete department',
      message: `Delete department "${departmentName}"?`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;

    const nextDepartments = projectDepartments.filter(
      (department) => String(department || '').trim().toLowerCase() !== normalizedTarget
    );
    const nextDepartmentColors = normalizeDepartmentColorMap(
      Object.fromEntries(
        Object.entries(projectDepartmentColors).filter(
          ([departmentName]) => String(departmentName || '').trim().toLowerCase() !== normalizedTarget
        )
      ),
      nextDepartments
    );
    const nextMembers = teamMembers.map((member) =>
      String(member.department || '').trim().toLowerCase() === normalizedTarget
        ? { ...member, department: 'Unassigned' }
        : member
    );

    persistTeamManagement(nextMembers, projectPositions, nextDepartments, nextDepartmentColors);
  };

  const handleRenamePositionOption = (currentName, nextName) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage positions.',
      });
      return false;
    }

    const currentTrimmed = String(currentName || '').trim();
    const nextTrimmed = String(nextName || '').trim();
    if (!currentTrimmed || !nextTrimmed) return false;
    if (currentTrimmed.toLowerCase() === nextTrimmed.toLowerCase()) return false;

    const duplicated = projectPositions.some(
      (position) =>
        String(position || '').trim().toLowerCase() === nextTrimmed.toLowerCase() &&
        String(position || '').trim().toLowerCase() !== currentTrimmed.toLowerCase()
    );
    if (duplicated) {
      void popup.alert({
        title: 'Duplicate position',
        message: 'This position already exists.',
      });
      return false;
    }

    const nextPositions = projectPositions.map((position) =>
      String(position || '').trim().toLowerCase() === currentTrimmed.toLowerCase() ? nextTrimmed : position
    );
    const nextMembers = teamMembers.map((member) => {
      if (String(member.position || '').trim().toLowerCase() !== currentTrimmed.toLowerCase()) return member;
      const isOwner = member.username === project.ownerUsername;
      return {
        ...member,
        position: nextTrimmed,
        role: nextTrimmed,
        level: getRoleLevel(nextTrimmed, isOwner),
      };
    });

    persistTeamManagement(nextMembers, nextPositions, projectDepartments);
    return true;
  };

  const handleRenameDepartmentOption = (currentName, nextName) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can manage departments.',
      });
      return false;
    }

    const currentTrimmed = String(currentName || '').trim();
    const nextTrimmed = String(nextName || '').trim();
    if (!currentTrimmed || !nextTrimmed) return false;
    if (currentTrimmed.toLowerCase() === 'unassigned') return false;
    if (currentTrimmed.toLowerCase() === nextTrimmed.toLowerCase()) return false;

    const duplicated = projectDepartments.some(
      (department) =>
        String(department || '').trim().toLowerCase() === nextTrimmed.toLowerCase() &&
        String(department || '').trim().toLowerCase() !== currentTrimmed.toLowerCase()
    );
    if (duplicated) {
      void popup.alert({
        title: 'Duplicate department',
        message: 'This department already exists.',
      });
      return false;
    }

    const nextDepartments = projectDepartments.map((department) =>
      String(department || '').trim().toLowerCase() === currentTrimmed.toLowerCase() ? nextTrimmed : department
    );
    const nextDepartmentColors = normalizeDepartmentColorMap(
      Object.fromEntries(
        Object.entries(projectDepartmentColors).map(([departmentName, colorValue]) => {
          if (String(departmentName || '').trim().toLowerCase() === currentTrimmed.toLowerCase()) {
            return [nextTrimmed, colorValue];
          }
          return [departmentName, colorValue];
        })
      ),
      nextDepartments
    );
    const nextMembers = teamMembers.map((member) =>
      String(member.department || '').trim().toLowerCase() === currentTrimmed.toLowerCase()
        ? { ...member, department: nextTrimmed }
        : member
    );

    persistTeamManagement(nextMembers, projectPositions, nextDepartments, nextDepartmentColors);
    return true;
  };

  const openOptionsPopup = (type) => {
    if (!canManageMembers) return;
    setOptionsPopupType(type);
    setNewOptionValue('');
    setNewDepartmentColor(DEPARTMENT_COLOR_PRESETS[0] || '#3b82f6');
    setEditingOptionOriginal('');
    setEditingOptionValue('');
  };

  const closeOptionsPopup = () => {
    setOptionsPopupType(null);
    setNewOptionValue('');
    setNewDepartmentColor(DEPARTMENT_COLOR_PRESETS[0] || '#3b82f6');
    setEditingOptionOriginal('');
    setEditingOptionValue('');
  };

  const handleAddMember = async () => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can invite new members.',
      });
      return;
    }

    const identifier = await popup.prompt({
      title: 'Invite member',
      message: 'Invite member by username or email',
      placeholder: 'username or email',
      confirmText: 'Invite',
    });
    if (!identifier) return;

    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) return;
    if (!onInviteMember) {
      void popup.alert({
        title: 'Invite unavailable',
        message: 'Invitation service is not available right now.',
      });
      return;
    }

    const result = await Promise.resolve(onInviteMember(project.id, normalizedIdentifier));
    void popup.alert({
      title: result?.ok ? 'Invitation sent' : 'Invite failed',
      message: result?.message || 'Unable to process invitation.',
    });
  };

  const removeMember = async (id) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can remove members.',
      });
      return;
    }

    const targetMember = teamMembers.find((member) => member.id === id);
    if (!targetMember) return;

    if (targetMember.username === project.ownerUsername) {
      void popup.alert({
        title: 'Action blocked',
        message: 'Cannot remove project owner.',
      });
      return;
    }

    const shouldRemove = await popup.confirm({
      title: 'Remove member',
      message: 'Remove this member from the project?',
      confirmText: 'Remove',
      tone: 'danger',
    });
    if (shouldRemove) {
      const nextMembers = teamMembers.filter((member) => member.id !== id);
      persistTeamManagement(nextMembers, projectPositions, projectDepartments);
    }
  };
  const publishProjectAnnouncement = () => {
    const message = String(announcementDraft || '').trim();
    if (!message) {
      void popup.alert({
        title: 'Announcement required',
        message: 'Please enter announcement message before publishing.',
      });
      return;
    }
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can publish announcements.',
      });
      return;
    }

    const nextAnnouncement = {
      id: generateId(),
      message,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.username,
    };
    const nextAnnouncementHistory = activeAnnouncement
      ? [activeAnnouncement, ...announcementHistory]
      : announcementHistory;

    const nextProjectWithFeed = appendProjectActivityEntryToProject(project, {
      type: PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT,
      title: 'Project announcement',
      message,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      meta: {
        announcementId: nextAnnouncement.id,
      },
    });

    onUpdateProject(project.id, {
      activeAnnouncement: nextAnnouncement,
      announcementHistory: nextAnnouncementHistory.slice(0, 80),
      changeFeed: nextProjectWithFeed.changeFeed,
    });
    setAnnouncementDraft('');
  };

  // --- Task Management View Logic ---
  const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
  const DEPARTMENTS = useMemo(
    () =>
      normalizeDepartments([
        ...projectDepartments,
        ...teamMembers.map((member) => member.department || 'Unassigned'),
        'Unassigned',
      ]),
    [projectDepartments, teamMembers]
  );
  const ASSIGNABLE_DEPARTMENTS = useMemo(
    () =>
      DEPARTMENTS.filter(
        (department) => String(department || '').trim().toLowerCase() !== 'unassigned'
      ),
    [DEPARTMENTS]
  );
  const NOTE_DEPARTMENTS = ASSIGNABLE_DEPARTMENTS;
  const optionsPopupItems =
    optionsPopupType === 'position'
      ? projectPositions
      : optionsPopupType === 'department'
      ? ASSIGNABLE_DEPARTMENTS
      : [];
  const activeNoteId = noteSection === 'department' ? selectedDepartmentNoteId : selectedMemberNoteId;
  const departmentNoteOptions = useMemo(
    () => NOTE_DEPARTMENTS.map((department) => ({ value: department, label: department })),
    [NOTE_DEPARTMENTS]
  );
  const orderedDepartmentNoteOptions = useMemo(() => {
    const pinnedSet = new Set(pinnedDepartmentNoteIds);
    return [...departmentNoteOptions].sort((left, right) => {
      const leftPinned = pinnedSet.has(left.value) ? 1 : 0;
      const rightPinned = pinnedSet.has(right.value) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      return String(left.label || '').localeCompare(String(right.label || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }, [departmentNoteOptions, pinnedDepartmentNoteIds]);
  const memberNoteOptions = useMemo(
    () =>
      teamMembers.map((member) => ({
        value: member.id,
        label: member.name,
        subLabel: member.position || 'No position',
        member,
      })),
    [teamMembers]
  );
  const orderedMemberNoteOptions = useMemo(() => {
    const pinnedSet = new Set(pinnedMemberNoteIds);
    return [...memberNoteOptions].sort((left, right) => {
      const leftPinned = pinnedSet.has(left.value) ? 1 : 0;
      const rightPinned = pinnedSet.has(right.value) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      return String(left.label || '').localeCompare(String(right.label || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }, [memberNoteOptions, pinnedMemberNoteIds]);
  const togglePinDepartmentNote = (departmentId) => {
    const normalizedId = String(departmentId || '').trim();
    if (!normalizedId) return;
    setPinnedDepartmentNoteIds((prev) => {
      const exists = prev.includes(normalizedId);
      if (exists) return prev.filter((id) => id !== normalizedId);
      return [normalizedId, ...prev.filter((id) => id !== normalizedId)];
    });
  };
  const togglePinMemberNote = (memberId) => {
    const normalizedId = String(memberId || '').trim();
    if (!normalizedId) return;
    setPinnedMemberNoteIds((prev) => {
      const exists = prev.includes(normalizedId);
      if (exists) return prev.filter((id) => id !== normalizedId);
      return [normalizedId, ...prev.filter((id) => id !== normalizedId)];
    });
  };
  const selectedNoteMember = useMemo(
    () => teamMembers.find((member) => member.id === activeNoteId) || null,
    [teamMembers, activeNoteId]
  );
  const activeNoteTitle =
    noteSection === 'department'
      ? `บันทึกของฝ่าย: ${activeNoteId}`
      : `บันทึกของ: ${selectedNoteMember?.name || 'Unknown'}`;
  const currentNoteTargetOptions =
    noteSection === 'department' ? orderedDepartmentNoteOptions : orderedMemberNoteOptions;
  const handleSaveNoteContent = (id, content) => {
    const normalizedNoteId = String(id || '').trim();
    if (!normalizedNoteId) return;
    const revision = {
      updatedAt: new Date().toISOString(),
      updatedById: currentUser.id,
      updatedByUsername: currentUser.username,
    };
    const nextNotes = { ...notesContent, [normalizedNoteId]: String(content || '') };
    const nextRevisionMap = { ...noteRevisionMap, [normalizedNoteId]: revision };
    setNotesContent(nextNotes);
    setNoteRevisionMap(nextRevisionMap);
    onUpdateProject(project.id, {
      noteContentPatch: { [normalizedNoteId]: String(content || '') },
      noteRevisionPatch: { [normalizedNoteId]: revision },
    });
  };

  const flushPresencePatch = (patch, delayMs = 220) => {
    if (notesPresenceFlushTimerRef.current) {
      window.clearTimeout(notesPresenceFlushTimerRef.current);
    }
    notesPresenceFlushTimerRef.current = window.setTimeout(() => {
      onUpdateProject(project.id, { notePresencePatch: patch });
    }, delayMs);
  };

  const handleNotePresenceUpdate = (noteId, payload) => {
    const normalizedNoteId = String(noteId || '').trim();
    if (!normalizedNoteId) return;

    const normalizedPresence = normalizeNotePresenceEntry({
      ...(payload && typeof payload === 'object' ? payload : {}),
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.username,
      avatarUrl: currentUser.avatarUrl || '',
      updatedAt: new Date().toISOString(),
    });

    const nextPresence = normalizeProjectNotesPresence({
      ...notesPresence,
      [normalizedNoteId]: {
        ...(notesPresence[normalizedNoteId] || {}),
        [currentUser.id]: normalizedPresence,
      },
    });
    setNotesPresence(nextPresence);
    flushPresencePatch({
      [normalizedNoteId]: {
        [currentUser.id]: normalizedPresence,
      },
    });
  };

  const activeNotePresenceItems = useMemo(() => {
    if (!activeNoteId) return [];
    const byUser = notesPresence[activeNoteId] || {};
    return Object.values(byUser)
      .map((entry) => normalizeNotePresenceEntry(entry))
      .filter((entry) => entry.userId && entry.userId !== currentUser.id)
      .sort((left, right) => toTimestampMs(right.updatedAt) - toTimestampMs(left.updatedAt));
  }, [notesPresence, activeNoteId, currentUser.id]);

  useEffect(
    () => () => {
      if (notesPresenceFlushTimerRef.current) {
        window.clearTimeout(notesPresenceFlushTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const staleThreshold = Date.now() - NOTE_PRESENCE_TTL_MS;
    const hasStalePresence = Object.values(notesPresence).some((perNote) =>
      Object.values(perNote || {}).some((entry) => toTimestampMs(entry?.updatedAt) < staleThreshold)
    );
    if (!hasStalePresence) return;
    setNotesPresence((prevPresence) => normalizeProjectNotesPresence(prevPresence));
  }, [notesPresence]);

  useEffect(() => {
    if (activeTab !== 'notes' || !activeNoteId) return undefined;
    handleNotePresenceUpdate(activeNoteId, { typingText: '' });
    const heartbeat = window.setInterval(() => {
      handleNotePresenceUpdate(activeNoteId, { typingText: '' });
    }, 2600);
    return () => window.clearInterval(heartbeat);
  }, [activeTab, activeNoteId, noteSection]);

  useEffect(() => {
    const nextDepartment = NOTE_DEPARTMENTS.includes(selectedDepartmentNoteId)
      ? selectedDepartmentNoteId
      : NOTE_DEPARTMENTS[0] || '';

    if (nextDepartment !== selectedDepartmentNoteId) {
      setSelectedDepartmentNoteId(nextDepartment);
      return;
    }

    const memberExists = teamMembers.some((member) => member.id === selectedMemberNoteId);
    const nextMemberId = memberExists ? selectedMemberNoteId : teamMembers[0]?.id || '';
    if (nextMemberId !== selectedMemberNoteId) {
      setSelectedMemberNoteId(nextMemberId);
    }
  }, [NOTE_DEPARTMENTS, selectedDepartmentNoteId, teamMembers, selectedMemberNoteId]);

  useEffect(() => {
    const currentNotesPreferences = resolveAccountScopedNotesPreferences(project.notesPreferences, {
      currentUserId: currentUser.id,
      projectOwnerId: project.ownerId,
    });
    const currentNoteSection = currentNotesPreferences.section === 'member' ? 'member' : 'department';
    const currentDepartmentNoteId = currentNotesPreferences.selectedDepartment || '';
    const currentMemberNoteId = currentNotesPreferences.selectedMemberId || '';
    const currentPinnedDepartments = normalizePinnedIds(currentNotesPreferences.pinnedDepartments);
    const currentPinnedMembers = normalizePinnedIds(currentNotesPreferences.pinnedMembers);
    const currentSidebarCollapsed = Boolean(currentNotesPreferences.fullSidebarCollapsed);
    const currentFullEditorOpen = Boolean(currentNotesPreferences.fullEditorOpen);
    const currentTaskView = currentNotesPreferences.taskView === 'table' ? 'table' : 'gallery';

    const hasChanges =
      currentNoteSection !== noteSection ||
      currentDepartmentNoteId !== selectedDepartmentNoteId ||
      currentMemberNoteId !== selectedMemberNoteId ||
      !arePinnedIdListsEqual(currentPinnedDepartments, pinnedDepartmentNoteIds) ||
      !arePinnedIdListsEqual(currentPinnedMembers, pinnedMemberNoteIds) ||
      currentSidebarCollapsed !== isNotesFullSidebarCollapsed ||
      currentFullEditorOpen !== isNotesFullEditorOpen ||
      currentTaskView !== taskView;

    if (!hasChanges) return;

    onUpdateProject(project.id, {
      notesPreferences: {
        section: noteSection,
        selectedDepartment: selectedDepartmentNoteId,
        selectedMemberId: selectedMemberNoteId,
        pinnedDepartments: pinnedDepartmentNoteIds,
        pinnedMembers: pinnedMemberNoteIds,
        fullSidebarCollapsed: isNotesFullSidebarCollapsed,
        fullEditorOpen: isNotesFullEditorOpen,
        taskView,
        userId: currentUser.id,
      },
    });
  }, [
    noteSection,
    selectedDepartmentNoteId,
    selectedMemberNoteId,
    pinnedDepartmentNoteIds,
    pinnedMemberNoteIds,
    isNotesFullSidebarCollapsed,
    isNotesFullEditorOpen,
    taskView,
    project.id,
    project.notesPreferences,
    project.ownerId,
    currentUser.id,
    onUpdateProject,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setNotesSidebarFloatingTop((prev) => clampNotesSidebarFloatingTop(prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampNotesSidebarFloatingTop]);
  useEffect(() => {
    if (activeTab !== 'notes' || !isNotesFullEditorOpen) return undefined;
    if (typeof window === 'undefined') return undefined;
    const syncTop = () => {
      setNotesSidebarFloatingTop((prevTop) => clampNotesSidebarFloatingTop(prevTop));
    };
    const rafId = window.requestAnimationFrame(syncTop);
    const rootNode = notesFullEditorRootRef.current;
    if (!(rootNode instanceof HTMLElement) || typeof MutationObserver === 'undefined') {
      return () => window.cancelAnimationFrame(rafId);
    }
    let scheduledSyncRafId = null;
    const scheduleSync = () => {
      if (scheduledSyncRafId !== null) return;
      scheduledSyncRafId = window.requestAnimationFrame(() => {
        scheduledSyncRafId = null;
        syncTop();
      });
    };
    const mutationObserver = new MutationObserver(() => {
      scheduleSync();
    });
    mutationObserver.observe(rootNode, { subtree: true, childList: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      if (scheduledSyncRafId !== null) {
        window.cancelAnimationFrame(scheduledSyncRafId);
      }
      mutationObserver.disconnect();
    };
  }, [activeTab, isNotesFullEditorOpen, clampNotesSidebarFloatingTop]);
  useEffect(() => {
    if (activeTab !== 'notes') {
      setIsNotesFullEditorOpen(false);
    }
  }, [activeTab]);

  const handleNotesSidebarBubblePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const pointerId = event.pointerId;
      const startY = event.clientY;
      const startTop = notesSidebarFloatingTop;
      let moved = false;
      notesSidebarBubbleMovedRef.current = false;

      const handlePointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const deltaY = moveEvent.clientY - startY;
        if (Math.abs(deltaY) >= 3) {
          moved = true;
          notesSidebarBubbleMovedRef.current = true;
        }
        setNotesSidebarFloatingTop(clampNotesSidebarFloatingTop(startTop + deltaY));
      };

      const handlePointerUp = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        if (moved) {
          window.setTimeout(() => {
            notesSidebarBubbleMovedRef.current = false;
          }, 0);
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [clampNotesSidebarFloatingTop, notesSidebarFloatingTop]
  );

  const [statusFilter, setStatusFilter] = useState([]);
  const [deptFilter, setDeptFilter] = useState([]);
  const defaultTaskAssigneeFilterIds = useMemo(() => {
    const normalizedCurrentUserId = String(currentUser?.id || '').trim();
    return normalizedCurrentUserId ? [normalizedCurrentUserId] : [];
  }, [currentUser?.id]);
  const [assigneeFilterIds, setAssigneeFilterIds] = useState(defaultTaskAssigneeFilterIds);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeProjectLogMenuEntryId, setActiveProjectLogMenuEntryId] = useState('');
  
  // Slide-over Pane State
  const [paneTask, setPaneTask] = useState(null);
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  
  useEffect(() => {
    setAssigneeFilterIds(defaultTaskAssigneeFilterIds);
  }, [project.id, defaultTaskAssigneeFilterIds]);

  const normalizedTaskAssigneeFilters = normalizeTaskAssigneeIds({
    assigneeIds: assigneeFilterIds,
  });
  const normalizedDefaultTaskAssigneeFilters = normalizeTaskAssigneeIds({
    assigneeIds: defaultTaskAssigneeFilterIds,
  });
  const hasCustomizedAssigneeFilter =
    normalizedTaskAssigneeFilters.length > 0 &&
    (normalizedTaskAssigneeFilters.length !== normalizedDefaultTaskAssigneeFilters.length ||
      normalizedTaskAssigneeFilters.some(
        (assigneeId) => !normalizedDefaultTaskAssigneeFilters.includes(assigneeId)
      ));
  const isTaskFilterActive =
    statusFilter.length > 0 || deptFilter.length > 0 || hasCustomizedAssigneeFilter;
  const filteredTasks = events.filter(ev => {
    const normalizedRecordType = String(ev.recordType || '').trim().toLowerCase();
    const isTaskRecord =
      normalizedRecordType === 'task' ||
      (!normalizedRecordType &&
        (Array.isArray(ev.assigneeIds) ||
          typeof ev.hasExplicitStartDate === 'boolean' ||
          typeof ev.hasExplicitStartTime === 'boolean'));
    if (!isTaskRecord) return false;
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(ev.status || 'To Do');
    const matchDept = deptFilter.length === 0 || deptFilter.includes(ev.department || 'Unassigned');
    const eventAssigneeIds = normalizeTaskAssigneeIds(ev);
    const matchAssignee =
      !hasCustomizedAssigneeFilter ||
      normalizedTaskAssigneeFilters.some((assigneeId) => eventAssigneeIds.includes(assigneeId));
    return matchStatus && matchDept && matchAssignee;
  });

  const handleStatusChange = (eventId, newStatus) => {
    if (onUpdateEvent) {
      onUpdateEvent(eventId, { status: newStatus });
    }
  };

  const getAssignee = (id) =>
    teamMembers.find((member) => member.id === id) || {
      id: '',
      name: 'Unassigned',
      initials: '?',
      color: 'bg-gray-400',
      avatarUrl: '',
      position: '',
      role: '',
    };
  const sortedTaskFilterMembers = useMemo(
    () =>
      [...teamMembers].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), undefined, {
          sensitivity: 'base',
        })
      ),
    [teamMembers]
  );
  const toggleAssigneeFilter = (memberId) => {
    const normalizedId = String(memberId || '').trim();
    if (!normalizedId) return;
    setAssigneeFilterIds((prev) => {
      const current = normalizeTaskAssigneeIds({ assigneeIds: prev });
      if (current.includes(normalizedId)) {
        return current.filter((id) => id !== normalizedId);
      }
      return [...current, normalizedId];
    });
  };
  const getTaskAssignees = (taskInput) => {
    const assigneeIds = normalizeTaskAssigneeIds(taskInput);
    if (!assigneeIds.length) return [getAssignee('')];
    return assigneeIds.map((assigneeId) => getAssignee(assigneeId));
  };

  const openTaskDetail = (task) => {
    setPaneTask(task);
    setIsPaneOpen(true);
  };

  const openAddTask = () => {
    setPaneTask(null);
    setIsPaneOpen(true);
  };
  const handleDeleteProjectLogEntry = async (entryId) => {
    const normalizedEntryId = String(entryId || '').trim();
    if (!normalizedEntryId || !isProjectHost) return;
    const targetEntry = projectChangeFeed.find((entry) => String(entry.id || '').trim() === normalizedEntryId);
    if (!targetEntry) return;
    const shouldDelete = await popup.confirm({
      title: 'Delete update log',
      message: 'Delete this project update log entry?',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    const nextChangeFeed = projectChangeFeed.filter(
      (entry) => String(entry.id || '').trim() !== normalizedEntryId
    );
    onUpdateProject(project.id, {
      changeFeed: nextChangeFeed,
      replaceChangeFeed: true,
    });
    setActiveProjectLogMenuEntryId('');
  };
  useEffect(() => {
    if (activeTab !== 'announcements') {
      setActiveProjectLogMenuEntryId('');
    }
  }, [activeTab]);
  useEffect(() => {
    if (!activeProjectLogMenuEntryId) return undefined;
    const closeMenuIfClickedOutside = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-project-log-menu]')) return;
      setActiveProjectLogMenuEntryId('');
    };
    document.addEventListener('pointerdown', closeMenuIfClickedOutside);
    return () => document.removeEventListener('pointerdown', closeMenuIfClickedOutside);
  }, [activeProjectLogMenuEntryId]);

  const memberMapById = useMemo(() => {
    const map = {};
    teamMembers.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [teamMembers]);

  const orgTree = useMemo(() => {
    const childrenMap = {};
    const roots = [];

    teamMembers.forEach((member) => {
      childrenMap[member.id] = [];
    });

    teamMembers.forEach((member) => {
      const managerId = member.reportsToId;
      if (!managerId || !memberMapById[managerId] || managerId === member.id) {
        roots.push(member);
      } else {
        childrenMap[managerId].push(member);
      }
    });

    return { roots, childrenMap };
  }, [teamMembers, memberMapById]);

  const handleChangeMemberManager = (memberId, managerId) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project members can edit organization structure.',
      });
      return;
    }

    if (memberId === managerId) {
      void popup.alert({
        title: 'Invalid structure',
        message: 'A member cannot report to themselves.',
      });
      return;
    }

    const nextMembers = teamMembers.map((member) => {
      if (member.id !== memberId) return member;
      return {
        ...member,
        reportsToId: managerId || null,
      };
    });

    persistTeamManagement(nextMembers, projectPositions, projectDepartments);
  };

  const renderOrgTree = (member, lineage = new Set()) => {
    const memberId = String(member?.id || '').trim();
    if (!memberId || lineage.has(memberId)) return null;

    const nextLineage = new Set(lineage);
    nextLineage.add(memberId);

    const children = (orgTree.childrenMap[memberId] || []).filter((child) => {
      const childId = String(child?.id || '').trim();
      return childId && !nextLineage.has(childId);
    });

    return (
      <li key={memberId} className="pm-org-item">
        <div className="pm-org-node-wrap">
          <OrgNode member={member} />
        </div>
        {children.length > 0 && (
          <ul className="pm-org-children">
            {children.map((child) => renderOrgTree(child, nextLineage))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans relative">
      {/* Dashboard Header */}
      <header className={`px-3 md:px-6 py-2 md:py-4 flex items-center gap-2 md:gap-4 border-b shrink-0 ${projectColor.lightBg}`}>
        <button 
          onClick={onBack}
          className="p-1.5 md:p-2 hover:bg-white/50 rounded-full transition-colors text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${projectColor.bg}`}></div>
        <h1 className="text-base md:text-2xl font-bold text-gray-800 truncate">{project.name}</h1>
      </header>

      {/* Dashboard Body */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 bg-gray-50 border-r flex-col shrink-0 overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Management</p>
            <nav className="space-y-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div
          className="md:hidden border-b bg-gray-50/90 px-2 py-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <nav className="flex items-center gap-1.5 min-w-max">
            {TABS.map((tab) => (
              <button
                key={`mobile-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white px-3 sm:px-4 md:px-8 py-3 md:py-8">
          <div className="max-w-6xl mx-auto">
            
            <div className="mb-4 md:mb-6 pb-2 md:pb-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              {activeTab === 'notes' && (
                <div className="w-full md:w-auto inline-flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
                  <button
                    onClick={() => {
                      setNoteSection('department');
                      if (!selectedDepartmentNoteId) {
                        setSelectedDepartmentNoteId(NOTE_DEPARTMENTS[0] || '');
                      }
                    }}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      noteSection === 'department'
                        ? 'bg-white shadow-sm text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    แยกตามฝ่าย
                  </button>
                  <button
                    onClick={() => {
                      setNoteSection('member');
                      if (!selectedMemberNoteId && teamMembers.length > 0) {
                        setSelectedMemberNoteId(teamMembers[0].id);
                      }
                    }}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      noteSection === 'member'
                        ? 'bg-white shadow-sm text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    แยกตามแต่ละคน
                  </button>
                </div>
              )}
            </div>

            {/* Content Mockups Based on Active Tab */}
            {activeTab === 'organization' && (
              <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
                {/* Main Content (Left) */}
                <div className="order-2 lg:order-1 flex-1 space-y-4 md:space-y-6">
                  
                  {/* Vision Section */}
                  <EditableSection 
                    title="วิสัยทัศน์ (Vision)" 
                    icon={Target} 
                    value={project.vision} 
                    placeholder="กรอกวิสัยทัศน์ของโครงการที่นี่..."
                    onSave={(newVision) => onUpdateProject(project.id, { vision: newVision })}
                  />

                  {/* Mission Section */}
                  <EditableSection 
                    title="พันธกิจ (Mission)" 
                    icon={Flag} 
                    value={project.mission} 
                    placeholder="กรอกพันธกิจของโครงการที่นี่..."
                    onSave={(newMission) => onUpdateProject(project.id, { mission: newMission })}
                  />

                  {/* Description Section */}
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3 md:mb-4 gap-2">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 leading-snug">
                        <AlignLeft className="w-5 h-5 text-gray-500" />
                        รายละเอียดโปรเจกต์ (Project Description)
                      </h3>
                      {!isEditingDesc && (
                        <button 
                          onClick={() => {
                            setEditDescText(project.description || '');
                            setIsEditingDesc(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {isEditingDesc ? (
                      <div className="flex flex-col gap-3">
                        <textarea 
                          value={editDescText}
                          onChange={e => setEditDescText(e.target.value)}
                          placeholder="เพิ่มรายละเอียดและเป้าหมายของโปรเจกต์ที่นี่..."
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          autoFocus
                        ></textarea>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setIsEditingDesc(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">ยกเลิก</button>
                          <button 
                            onClick={() => {
                              onUpdateProject(project.id, { description: editDescText });
                              setIsEditingDesc(false);
                            }} 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            บันทึก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none whitespace-pre-wrap">
                        {project.description ? (
                          <p>{project.description}</p>
                        ) : (
                          <p className="text-gray-400 italic">ยังไม่มีรายละเอียดโปรเจกต์ คลิกปุ่มแก้ไขเพื่อเพิ่มข้อมูล</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Milestones / Goals Section */}
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start md:items-center gap-3 mb-3 md:mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 leading-snug">
                        <Target className="w-5 h-5 text-gray-500" />
                        เป้าหมายหลัก & จุดวิกฤต (Milestones)
                      </h3>
                      {!isAddingMilestone && (
                        <button 
                          onClick={() => setIsAddingMilestone(true)}
                          className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 md:px-3 py-1.5 rounded-lg transition-colors shrink-0"
                        >
                          <Plus className="w-4 h-4" /> เพิ่มเป้าหมาย
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {(project.milestones || []).map((m, i) => (
                        <div key={m.id || i} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-transparent transition-colors group">
                          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => {
                            const updatedMilestones = (project.milestones || []).map(ms => ms.id === m.id ? { ...ms, status: ms.status === 'completed' ? 'pending' : 'completed' } : ms);
                            onUpdateProject(project.id, { milestones: updatedMilestones });
                          }}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${m.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                              {m.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`font-medium ${m.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.name}</span>
                          </div>
                          <div className="flex items-center gap-3 md:gap-4">
                            <span className={`text-sm ${m.status === 'completed' ? 'text-gray-400' : 'text-blue-600 font-medium'}`}>{m.date}</span>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                const shouldDelete = await popup.confirm({
                                  title: 'Delete milestone',
                                  message: 'ลบเป้าหมายนี้?',
                                  confirmText: 'Delete',
                                  tone: 'danger',
                                });
                                if (shouldDelete) {
                                  const updatedMilestones = (project.milestones || []).filter(ms => ms.id !== m.id);
                                  onUpdateProject(project.id, { milestones: updatedMilestones });
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {(project.milestones || []).length === 0 && !isAddingMilestone && (
                        <div className="text-center py-6 text-gray-400 text-sm italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          ยังไม่มีเป้าหมายของโปรเจกต์
                        </div>
                      )}

                      {/* Add Milestone Form */}
                      {isAddingMilestone && (
                        <div className="p-3 md:p-4 bg-blue-50/50 rounded-lg border border-blue-100 flex flex-col gap-3 mt-4">
                          <input 
                            type="text" 
                            placeholder="ชื่อเป้าหมาย / Milestone..." 
                            value={newMilestoneName}
                            onChange={e => setNewMilestoneName(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <input 
                              type="date" 
                              value={newMilestoneDate}
                              onChange={e => setNewMilestoneDate(e.target.value)}
                              className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                            />
                            <button 
                              onClick={() => {
                                if (!newMilestoneName || !newMilestoneDate) {
                                  void popup.alert({
                                    title: 'Incomplete form',
                                    message: 'Please provide milestone name and date.',
                                  });
                                  return;
                                }
                                const updatedMilestones = [...(project.milestones || []), { id: generateId(), name: newMilestoneName, date: newMilestoneDate, status: 'pending' }];
                                onUpdateProject(project.id, { milestones: updatedMilestones });
                                setNewMilestoneName('');
                                setNewMilestoneDate('');
                                setIsAddingMilestone(false);
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              เพิ่ม
                            </button>
                            <button 
                              onClick={() => setIsAddingMilestone(false)}
                              className="text-gray-600 hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Sidebar (Right) */}
                <div className="order-1 lg:order-2 w-full lg:w-[340px] flex flex-col gap-3 md:gap-6 shrink-0">
                  
                  {/* Status Dropdown */}
                  <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm relative">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> สถานะโปรเจกต์
                    </h3>
                    <div 
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${statusConfig[project.status || 'on_track'].bg} ${statusConfig[project.status || 'on_track'].text} ${statusConfig[project.status || 'on_track'].border}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${statusConfig[project.status || 'on_track'].dot} shadow-sm`}></div>
                      <span className="font-semibold flex-1">{statusConfig[project.status || 'on_track'].label}</span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </div>
                    
                    {/* Status Dropdown Menu */}
                    {isStatusDropdownOpen && (
                      <div className="absolute top-[85px] left-5 right-5 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <div 
                            key={key}
                            onClick={() => { 
                              onUpdateProject(project.id, { status: key });
                              setIsStatusDropdownOpen(false); 
                            }}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b last:border-0 ${(project.status || 'on_track') === key ? 'bg-gray-50' : ''}`}
                          >
                            <div className={`w-3 h-3 rounded-full ${config.dot}`}></div>
                            <span className={`font-medium ${config.text}`}>{config.label}</span>
                            {(project.status || 'on_track') === key && <Check className="w-4 h-4 ml-auto text-gray-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-3 flex items-center justify-between">
                      <span>คลิกเพื่อเปลี่ยนสถานะ</span>
                    </p>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                
                {/* Controls: Filter & View Toggle */}
                <div className="flex items-center md:justify-between gap-2 md:gap-4 bg-gray-50 p-2 md:p-4 rounded-xl border border-gray-200">
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setShowFilterPopup(!showFilterPopup)}
                      className="relative h-10 w-10 md:h-auto md:w-auto flex items-center justify-center md:justify-start gap-2 bg-white border border-gray-300 hover:bg-gray-50 px-0 md:px-4 md:py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors shadow-sm shrink-0 [&>span:first-of-type]:hidden md:[&>span:first-of-type]:inline"
                    >
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span>ฟิลเตอร์</span>
                      {isTaskFilterActive && (
                        <span className="absolute top-1.5 right-1.5 md:static md:ml-1 w-2 h-2 rounded-full bg-blue-500"></span>
                      )}
                    </button>
                    
                    {/* Filter Popup */}
                    {showFilterPopup && (
                      <div className="absolute top-full left-0 mt-2 w-[min(18rem,calc(100vw-2.5rem))] md:w-72 bg-white border border-gray-200 shadow-xl rounded-xl p-4 z-20">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-gray-800">ตั้งค่าฟิลเตอร์</h4>
                          <button onClick={() => setShowFilterPopup(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                          {/* Status Filter */}
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-2 block uppercase tracking-wider">สถานะ (Status)</label>
                            <div className="space-y-1">
                              {TASK_STATUSES.map(s => (
                                <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={statusFilter.includes(s)}
                                    onChange={(e) => {
                                      if (e.target.checked) setStatusFilter([...statusFilter, s]);
                                      else setStatusFilter(statusFilter.filter(item => item !== s));
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300 cursor-pointer"
                                  />
                                  {s}
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-px bg-gray-100 w-full"></div>
                          
                          {/* Department Filter */}
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-2 block uppercase tracking-wider">ฝ่าย (Department)</label>
                            <div className="space-y-1">
                              {DEPARTMENTS.map(d => (
                                <label key={d} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={deptFilter.includes(d)}
                                    onChange={(e) => {
                                      if (e.target.checked) setDeptFilter([...deptFilter, d]);
                                      else setDeptFilter(deptFilter.filter(item => item !== d));
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300 cursor-pointer"
                                  />
                                  {d}
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-px bg-gray-100 w-full"></div>

                          {/* Assignee Filter */}
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-2 block uppercase tracking-wider">Assignee</label>
                            <div className="space-y-1">
                              {sortedTaskFilterMembers.map((member) => {
                                const checked = normalizedTaskAssigneeFilters.includes(member.id);
                                return (
                                  <label
                                    key={`task-filter-assignee-${member.id}`}
                                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleAssigneeFilter(member.id)}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300 cursor-pointer"
                                    />
                                    <UserAvatar
                                      user={member}
                                      sizeClass="w-5 h-5"
                                      textClass="text-[9px]"
                                      ringClass="ring-1 ring-white"
                                    />
                                    <span className="truncate">{member.name}</span>
                                  </label>
                                );
                              })}
                              {sortedTaskFilterMembers.length === 0 && (
                                <p className="text-xs text-gray-400 px-1.5 py-1">No members in project</p>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-gray-100 flex justify-end">
                            <button 
                              onClick={() => {
                                setStatusFilter([]);
                                setDeptFilter([]);
                                setAssigneeFilterIds([]);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!isTaskFilterActive}
                            >
                              ล้างฟิลเตอร์ทั้งหมด
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
	                  <div className="flex items-center gap-2 md:gap-3 shrink-0 md:ml-auto">
	                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm shrink-0">
	                      <button 
	                        onClick={() => setTaskView('gallery')}
	                        className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md flex items-center gap-1.5 md:gap-2 transition-colors ${taskView === 'gallery' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
	                      >
	                        <LayoutGrid className="w-4 h-4" /> Gallery
	                      </button>
	                      <button 
	                        onClick={() => setTaskView('table')}
	                        className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md flex items-center gap-1.5 md:gap-2 transition-colors ${taskView === 'table' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
	                      >
	                        <AlignLeft className="w-4 h-4" /> Table
	                      </button>
	                    </div>
                    
                    {/* Production Ready "Add Task" Button */}
                    <button 
                      onClick={openAddTask}
                      className="h-10 w-10 md:h-auto md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-0 md:px-4 md:py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" /> <span className="hidden md:inline">เพิ่ม Task</span>
                    </button>
                  </div>
                </div>

                {/* View Content */}
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-lg">ไม่มีงานที่ตรงกับฟิลเตอร์ที่เลือก</p>
                    <p className="text-sm mt-1">ลองเปลี่ยนการตั้งค่าฟิลเตอร์หรือเพิ่มงานใหม่บนปฏิทิน</p>
                  </div>
                ) : (
                  <>
                    {/* --- Table View --- */}
                    {taskView === 'table' && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                              <tr>
                                <th className="px-5 py-4 font-medium">ชื่องาน (Task)</th>
                                <th className="px-5 py-4 font-medium">ผู้รับผิดชอบ (Assignee)</th>
                                <th className="px-5 py-4 font-medium">ฝ่าย (Department)</th>
                                <th className="px-5 py-4 font-medium">กำหนดส่ง (Due Date)</th>
                                <th className="px-5 py-4 font-medium w-40">สถานะ (Status)</th>
                              </tr>
                            </thead>
	                            <tbody className="divide-y divide-gray-100">
	                              {filteredTasks.map(task => {
	                                const taskAssignees = getTaskAssignees(task);
	                                const extraAssigneeCount = Math.max(0, taskAssignees.length - 2);
	                                return (
	                                  <tr key={task.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTaskDetail(task)}>
	                                    <td className="px-5 py-4 font-medium text-gray-800">{task.title}</td>
	                                    <td className="px-5 py-4">
		                                      <div className="flex items-center gap-2.5 min-w-0">
		                                        <div className="flex -space-x-2 shrink-0">
		                                          {taskAssignees.slice(0, 2).map((assignee, index) => (
		                                            <span
		                                              key={`${task.id}-assignee-${assignee.id || assignee.name}-${index}`}
		                                            >
		                                              <UserAvatar
		                                                user={assignee}
		                                                sizeClass="w-8 h-8"
		                                                textClass="text-[10px]"
		                                                ringClass="ring-2 ring-white shadow-sm"
		                                              />
		                                            </span>
		                                          ))}
		                                        </div>
	                                        <div className="min-w-0">
	                                          <span className="text-gray-700 font-medium block truncate">
	                                            {taskAssignees.slice(0, 2).map((assignee) => assignee.name).join(', ')}
	                                          </span>
	                                          {extraAssigneeCount > 0 && (
	                                            <span className="text-[11px] text-gray-500">+{extraAssigneeCount} more</span>
	                                          )}
	                                        </div>
	                                      </div>
	                                    </td>
                                    <td className="px-5 py-4">
                                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{task.department || 'Unassigned'}</span>
                                    </td>
                                    <td className="px-5 py-4 text-gray-600">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{task.endDate}</span>
                                        {String(task.endTime || '').trim() ? (
                                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {task.endTime}
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="relative inline-block">
                                        <select
                                          value={task.status || 'To Do'}
                                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                          className={`text-xs font-bold rounded-full pl-3 pr-8 py-1.5 outline-none cursor-pointer appearance-none border transition-colors
                                            ${task.status === 'Done' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                                              task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 
                                              task.status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' : 
                                              'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}
                                          `}
                                        >
                                          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* --- Gallery View --- */}
	                    {taskView === 'gallery' && (
	                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
	                        {filteredTasks.map(task => {
	                          const taskAssignees = getTaskAssignees(task);
	                          const primaryAssignee = taskAssignees[0] || getAssignee('');
	                          const extraAssigneeCount = Math.max(0, taskAssignees.length - 1);
	                          return (
	                            <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col group cursor-pointer" onClick={() => openTaskDetail(task)}>
                              <div className="flex justify-between items-start mb-4">
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[11px] font-medium border border-gray-200 truncate max-w-[100px]">{task.department || 'Unassigned'}</span>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={task.status || 'To Do'}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                    className={`text-[10px] font-bold rounded-full pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none border transition-colors
                                      ${task.status === 'Done' ? 'bg-green-50 text-green-700 border-green-200' : 
                                        task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                        task.status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                        'bg-gray-50 text-gray-700 border-gray-200'}
                                    `}
                                  >
                                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                </div>
                              </div>
                              <h4 className="font-semibold text-gray-800 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{task.title}</h4>
                              <p className="text-xs text-gray-500 mb-5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {task.endDate}
                                {String(task.endTime || '').trim() ? (
                                  <span className="bg-gray-100 px-1.5 rounded">{task.endTime}</span>
                                ) : null}
                              </p>
		                              <div className="flex items-center gap-2.5 mt-auto pt-4 border-t border-gray-100">
		                                <UserAvatar
		                                  user={primaryAssignee}
		                                  sizeClass="w-7 h-7"
		                                  textClass="text-[10px]"
		                                  ringClass="ring-1 ring-white shadow-sm"
		                                />
		                                <div className="flex-1 overflow-hidden">
	                                  <span className="text-sm text-gray-700 font-medium block truncate">
	                                    {primaryAssignee.name}
	                                    {extraAssigneeCount > 0 ? ` +${extraAssigneeCount}` : ''}
	                                  </span>
	                                  <span className="text-[10px] text-gray-400 block truncate">
	                                    {primaryAssignee.position || primaryAssignee.role || 'Team Member'}
	                                  </span>
	                                </div>
	                              </div>
	                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-6 md:space-y-8">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Project Members</h3>
                      <p className="text-sm text-gray-500 mt-1">Manage member, position and department from one place.</p>
                    </div>
                    <button
                      onClick={handleAddMember}
                      disabled={!canManageMembers}
                      title={canManageMembers ? 'Invite member' : 'Only project member can invite'}
                      className={`w-full md:w-auto flex items-center justify-center gap-2 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm ${canManageMembers ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
                    >
                      <Plus className="w-4 h-4" /> Add member
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-6 py-4 font-medium w-[34%]">Member</th>
                          <th className="px-6 py-4 font-medium w-[25%]">
                            <span className="inline-flex items-center gap-1.5">
                              Position
                              <button
                                type="button"
                                onClick={() => openOptionsPopup('position')}
                                disabled={!canManageMembers}
                                className={`p-1 rounded-md ${
                                  canManageMembers
                                    ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={canManageMembers ? 'Manage position options' : 'Only project members can manage'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </th>
                          <th className="px-6 py-4 font-medium w-[25%]">
                            <span className="inline-flex items-center gap-1.5">
                              Department
                              <button
                                type="button"
                                onClick={() => openOptionsPopup('department')}
                                disabled={!canManageMembers}
                                className={`p-1 rounded-md ${
                                  canManageMembers
                                    ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={canManageMembers ? 'Manage department options' : 'Only project members can manage'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </th>
                          <th className="px-6 py-4 font-medium text-right w-[16%]"></th>
                        </tr>
                      </thead>
	                      <tbody className="divide-y divide-gray-100">
		                        {teamMembers.map((member) => {
                              const memberDepartment = ASSIGNABLE_DEPARTMENTS.includes(member.department)
                                ? member.department
                                : '';
                              const memberDepartmentColor = memberDepartment
                                ? resolveDepartmentColorHex(projectDepartmentColors, memberDepartment, '#94a3b8')
                                : '#94a3b8';
                              const memberDepartmentStyle = memberDepartment
                                ? {
                                    borderColor: toRgba(memberDepartmentColor, 0.5),
                                    boxShadow: `inset 0 0 0 1px ${toRgba(memberDepartmentColor, 0.18)}`,
                                  }
                                : undefined;
                              return (
		                          <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
	                            <td className="px-6 py-4 flex items-center gap-4">
	                              <UserAvatar
	                                user={member}
	                                sizeClass="w-10 h-10"
	                                textClass="text-[11px]"
	                                ringClass="ring-2 ring-white shadow-sm"
	                              />
	                              <div className="min-w-0">
	                                <span className="font-medium text-gray-800 block truncate">{member.name}</span>
	                                <span className="text-xs text-gray-400 block truncate">@{member.username}</span>
	                              </div>
	                            </td>
                            <td className="px-6 py-4">
                              {projectPositions.length === 0 ? (
                                <button
                                  onClick={() => {
                                    void handleCreatePosition();
                                  }}
                                  disabled={!canManageMembers}
                                  className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${canManageMembers ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                                >
                                  Add position
                                </button>
                              ) : (
	                                <select
	                                  value={member.position || ''}
	                                  onChange={(e) => {
	                                    void handleAssignPosition(member.id, e.target.value);
	                                  }}
	                                  disabled={!canManageMembers}
	                                  className="w-full h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
	                                >
	                                  {!member.position && <option value="">Select position</option>}
                                  {member.position && !projectPositions.includes(member.position) && (
                                    <option value={member.position}>{member.position}</option>
                                  )}
                                  {projectPositions.map((position) => (
                                    <option key={position} value={position}>
                                      {position}
                                    </option>
                                  ))}
                                  <option value={CREATE_POSITION_OPTION}>+ Create new position</option>
                                </select>
                              )}
                            </td>
                            <td className="px-6 py-4">
	                              {ASSIGNABLE_DEPARTMENTS.length === 0 ? (
	                                <button
	                                  onClick={() => {
	                                    openOptionsPopup('department');
	                                  }}
	                                  disabled={!canManageMembers}
	                                  className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${canManageMembers ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
	                                >
                                  Add department
                                </button>
                              ) : (
                                <div className="relative">
                                  {memberDepartment && (
                                    <span
                                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-white/70"
                                      style={{ backgroundColor: memberDepartmentColor }}
                                    />
                                  )}
	                                <select
	                                  value={memberDepartment}
	                                  onChange={(e) => {
	                                    void handleAssignDepartment(member.id, e.target.value);
	                                  }}
	                                  disabled={!canManageMembers}
                                    className={`w-full h-9 rounded-lg border bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 ${
                                      memberDepartment ? 'pl-7' : ''
                                    }`}
                                    style={memberDepartmentStyle}
	                                >
	                                  <option value="">Select department</option>
	                                  {ASSIGNABLE_DEPARTMENTS.map((department) => (
	                                    <option key={department} value={department}>
	                                      {department}
	                                    </option>
	                                  ))}
	                                  <option value={CREATE_DEPARTMENT_OPTION}>+ Create new department</option>
	                                </select>
                                </div>
	                              )}
	                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  void removeMember(member.id);
                                }}
                                disabled={!canManageMembers}
                                className={`p-2 rounded-lg transition-all ${canManageMembers ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100' : 'text-gray-300 cursor-not-allowed opacity-40'}`}
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
		                          </tr>
	                        );
	                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-8 overflow-hidden relative">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 md:mb-8">
                    <h3 className="text-lg font-semibold text-gray-800">Organization Structure</h3>
                    <button
                      onClick={() => setIsOrgEditMode((prev) => !prev)}
                      disabled={!canManageMembers}
                      className={`text-sm font-medium flex items-center gap-1 bg-white border px-3 py-1.5 rounded-lg shadow-sm ${canManageMembers ? 'text-gray-500 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      <Edit2 className="w-4 h-4" /> {isOrgEditMode ? 'Done' : 'Edit structure'}
                    </button>
                  </div>

                  {isOrgEditMode && canManageMembers && (
                    <div className="mb-6 md:mb-8 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
                      {teamMembers.map((member) => (
                        <div key={`manager-${member.id}`} className="grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-3 items-center">
                          <span className="text-sm font-medium text-gray-700 truncate">{member.name}</span>
                          <select
                            value={member.reportsToId || ''}
                            onChange={(e) => handleChangeMemberManager(member.id, e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">No manager (root)</option>
                            {teamMembers
                              .filter((candidate) => candidate.id !== member.id)
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {orgTree.roots.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">No member in structure yet.</div>
                    ) : (
                      <div className="overflow-x-auto pb-2">
                        <div className="pm-org-forest min-w-max">
                          {orgTree.roots.map((rootMember) => (
                            <div key={`root-${rootMember.id}`} className="pm-org-island">
                              <ul className="pm-org-root">
                                {renderOrgTree(rootMember)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <style>{`
                    .pm-org-forest {
                      display: flex;
                      justify-content: center;
                      align-items: flex-start;
                      gap: 3rem;
                      padding: 0.5rem 0.25rem 1rem;
                    }
                    .pm-org-island {
                      display: flex;
                      justify-content: center;
                    }
                    .pm-org-root {
                      display: flex;
                      justify-content: center;
                      width: max-content;
                      margin: 0 auto;
                      padding: 0;
                      list-style: none;
                    }
                    .pm-org-item {
                      position: relative;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      padding: 0 0.9rem;
                    }
                    .pm-org-node-wrap {
                      display: flex;
                      justify-content: center;
                    }
                    .pm-org-children {
                      display: flex;
                      justify-content: center;
                      position: relative;
                      margin: 1.1rem 0 0;
                      padding: 1.45rem 0 0;
                      list-style: none;
                    }
                    .pm-org-children::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 50%;
                      margin-left: -1px;
                      width: 2px;
                      height: 1.45rem;
                      background: #64748b;
                    }
                    .pm-org-children > .pm-org-item::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      height: 0;
                      border-top: 2px solid #64748b;
                    }
                    .pm-org-children > .pm-org-item:only-child::before {
                      display: none;
                    }
                    .pm-org-children > .pm-org-item:first-child::before {
                      left: 50%;
                    }
                    .pm-org-children > .pm-org-item:last-child::before {
                      right: 50%;
                    }
                    .pm-org-children > .pm-org-item > .pm-org-node-wrap {
                      position: relative;
                      z-index: 1;
                      padding-top: 1.45rem;
                    }
                    .pm-org-children > .pm-org-item > .pm-org-node-wrap::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 50%;
                      margin-left: -1px;
                      width: 2px;
                      height: 1.45rem;
                      background: #64748b;
                    }
                    @media (max-width: 768px) {
                      .pm-org-item {
                        padding-left: 0.5rem;
                        padding-right: 0.5rem;
                      }
                    }
                  `}</style>
                </div>
              </div>
            )}
            {activeTab === 'announcements' && (
              <div className="space-y-4 md:space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">Latest Announcement</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        This announcement appears in member popup as a new update.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementHistory((prev) => !prev)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      {showAnnouncementHistory ? 'Hide history' : 'View history'}
                    </button>
                  </div>

                  {activeAnnouncement ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                      <p className="text-sm font-semibold text-blue-900">{activeAnnouncement.message}</p>
                      <p className="text-[11px] text-blue-700 mt-1">
                        By {activeAnnouncement.createdBy || 'unknown'} at{' '}
                        {new Date(activeAnnouncement.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-400">
                      No active announcement yet.
                    </div>
                  )}

                  {showAnnouncementHistory && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Announcement History
                      </p>
                      {announcementHistory.length === 0 ? (
                        <p className="text-xs text-gray-400">No previous announcement.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {announcementHistory.map((item) => (
                            <div key={item.id} className="rounded-md border border-gray-200 bg-white px-2.5 py-2">
                              <p className="text-sm text-gray-700">{item.message}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {item.createdBy || 'unknown'} • {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block">
                      Publish New Announcement
                    </label>
                    <textarea
                      value={announcementDraft}
                      onChange={(event) => setAnnouncementDraft(event.target.value)}
                      rows={3}
                      placeholder="Write announcement for all project members..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={publishProjectAnnouncement}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                      >
                        Publish announcement
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
                  <h3 className="text-base font-semibold text-gray-800 mb-3">Project Update Log</h3>
                  {projectChangeFeed.length === 0 ? (
                    <p className="text-sm text-gray-400">No update log yet.</p>
                  ) : (
	                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
	                      {projectChangeFeed.map((entry) => {
	                        const detail = describeProjectActivityEntry(entry);
	                        const toneStyles = detail.isStatusUpdate
	                          ? getProjectStatusToneStyles(detail.statusTone)
	                          : getProjectStatusToneStyles('neutral');
		                        return (
		                          <div key={entry.id} className={`rounded-lg border px-3 py-2.5 ${toneStyles.logCard}`}>
		                            <div className="flex items-start justify-between gap-2">
		                              <div className="min-w-0 flex-1">
		                                <div className="flex flex-wrap items-center gap-1.5">
	                                  <p className={`text-sm font-semibold ${toneStyles.logTitle}`}>{detail.title}</p>
	                                  {detail.isStatusUpdate && detail.statusPriorityLabel && (
	                                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${toneStyles.badge}`}>
	                                      {detail.statusPriorityLabel}
	                                    </span>
	                                  )}
	                                </div>
		                                {detail.isStatusUpdate && detail.statusPrompt && (
		                                  <p className={`text-[11px] mt-0.5 ${toneStyles.logSubtitle}`}>{detail.statusPrompt}</p>
		                                )}
		                              </div>
		                              <div className="flex items-start gap-1.5 shrink-0">
		                                <span className={`text-[11px] shrink-0 pt-1 ${toneStyles.seenTime}`}>
		                                  {new Date(entry.createdAt).toLocaleString()}
		                                </span>
		                                {isProjectHost && (
		                                  <div className="relative" data-project-log-menu>
		                                    <button
		                                      type="button"
		                                      onClick={() =>
		                                        setActiveProjectLogMenuEntryId((prev) =>
		                                          prev === entry.id ? '' : entry.id
		                                        )
		                                      }
			                                      className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
			                                      title="Delete log options"
			                                    >
			                                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
			                                    </button>
		                                    {activeProjectLogMenuEntryId === entry.id && (
		                                      <div className="absolute right-0 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
		                                        <button
		                                          type="button"
		                                          onClick={() => void handleDeleteProjectLogEntry(entry.id)}
		                                          className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
		                                        >
		                                          Delete
		                                        </button>
		                                      </div>
		                                    )}
		                                  </div>
		                                )}
		                              </div>
		                            </div>
		                            {detail.subtitle && (
		                              <p className={`text-xs mt-1 ${toneStyles.logSubtitle}`}>{detail.subtitle}</p>
		                            )}
	                          </div>
	                        );
	                      })}
	                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'notes' && (
              <div className="flex flex-col min-h-[65vh] md:h-[calc(100vh-180px)]">
                 {/* Content Area */}
                 <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0 min-w-0">
                    {/* Selector */}
                    <div className="w-full md:w-72 bg-white border border-gray-200 rounded-xl shadow-sm p-3 shrink-0 space-y-2">
                      <div className="md:hidden space-y-2">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          {noteSection === 'department' ? 'Select department' : 'Select member'}
                        </p>
                        <NoteTargetSelect
                          options={currentNoteTargetOptions}
                          value={activeNoteId}
                          onChange={(nextValue) => {
                            if (noteSection === 'department') {
                              setSelectedDepartmentNoteId(nextValue);
                            } else {
                              setSelectedMemberNoteId(nextValue);
                            }
                          }}
                          placeholder={noteSection === 'department' ? 'Choose department' : 'Choose member'}
                          searchPlaceholder={noteSection === 'department' ? 'Search department...' : 'Search member...'}
                          emptyText={noteSection === 'department' ? 'No department found' : 'No member found'}
                        />
                      </div>
                      <div className="hidden md:block space-y-2">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          {noteSection === 'department' ? 'Select department' : 'Select member'}
                        </p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <div className="max-h-[46vh] overflow-y-auto divide-y divide-gray-100">
                            {currentNoteTargetOptions.map((option) => {
                              const isActive = option.value === activeNoteId;
                              const isPinned =
                                noteSection === 'department'
                                  ? pinnedDepartmentNoteIds.includes(option.value)
                                  : pinnedMemberNoteIds.includes(option.value);
                              return (
                                <div
                                  key={`notes-inline-${noteSection}-${option.value}`}
                                  className="flex items-center gap-1 px-2 py-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (noteSection === 'department') {
                                        setSelectedDepartmentNoteId(option.value);
                                      } else {
                                        setSelectedMemberNoteId(option.value);
                                      }
                                    }}
                                    className={`flex-1 min-w-0 text-left px-2.5 py-2 rounded-md border text-sm transition-colors ${
                                      isActive
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {noteSection === 'member' && option.member ? (
                                        <UserAvatar
                                          user={option.member}
                                          sizeClass="w-8 h-8"
                                          textClass="text-[10px]"
                                          ringClass="ring-2 ring-white shadow-sm"
                                        />
                                      ) : (
                                        <div
                                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                            isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                          }`}
                                        >
                                          {String(option.label || '?').slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className={`truncate font-medium ${
                                            isActive ? 'text-blue-700' : 'text-gray-700'
                                          }`}
                                        >
                                          {option.label}
                                        </p>
                                        {option.subLabel && (
                                          <p className="truncate text-[11px] text-gray-500 mt-0.5">
                                            {option.subLabel}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (noteSection === 'department') {
                                        togglePinDepartmentNote(option.value);
                                      } else {
                                        togglePinMemberNote(option.value);
                                      }
                                    }}
                                    className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${
                                      isPinned
                                        ? 'text-amber-600 border-amber-200 bg-amber-50'
                                        : 'text-gray-400 border-gray-200 hover:text-amber-600 hover:bg-amber-50'
                                    }`}
                                    title={isPinned ? 'Unpin' : 'Pin to top'}
                                  >
                                    <Flag className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Note Editor Area */}
                    <div className="flex-1 h-full min-h-[380px] md:min-h-0 min-w-0 overflow-hidden">
                      {activeNoteId ? (
                        <NoteEditor
                          noteId={activeNoteId}
                          noteTitle={activeNoteTitle}
                          initialContent={notesContent[activeNoteId] || ''}
                          onSave={handleSaveNoteContent}
                          presenceItems={activeNotePresenceItems}
                          onPresenceUpdate={handleNotePresenceUpdate}
                          isFullScreen={false}
                          onToggleFullScreen={() => setIsNotesFullEditorOpen(true)}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 bg-gray-50/50">
                           <FileText className="w-12 h-12 mb-3 text-gray-300" />
                           <p className="font-medium text-lg text-gray-500">กรุณาเลือกรายการทางซ้ายมือ</p>
                           <p className="text-sm mt-1">เพื่อเปิดดูหรือแก้ไขบันทึก (Notes)</p>
                        </div>
                      )}
                    </div>
                 </div>
                 
		                 <style>{`
		                    .rich-editor:empty:before {
		                      content: attr(data-placeholder);
		                      color: #9ca3af;
		                      pointer-events: none;
		                      display: block;
		                    }
                        .rich-editor {
                          position: relative;
                        }
                        .rich-editor ul {
                          list-style: disc;
                          padding-left: 1.5rem;
                          margin: 0.4rem 0;
                        }
                        .rich-editor ol {
                          list-style: decimal;
                          padding-left: 1.5rem;
                          margin: 0.4rem 0;
                        }
                        .rich-editor li {
                          margin: 0.15rem 0;
                        }
                        .rich-editor a {
                          color: #2563eb;
                          text-decoration: underline;
                          text-decoration-color: currentColor;
                          cursor: pointer;
                        }
                        .rich-editor img[data-note-image-id] {
                          z-index: 20;
                          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18);
                        }
		                 `}</style>
		              </div>
		            )}

	          </div>
	        </main>
	      </div>

	      {activeTab === 'notes' && isNotesFullEditorOpen && (
	        <div
	          ref={notesFullEditorRootRef}
	          className="fixed inset-0 z-[95] bg-slate-100/95 backdrop-blur-sm"
	        >
	          <div className="h-full flex flex-col">
	            <div className="flex-1 min-h-0 min-w-0 p-0 md:p-0 flex flex-col md:flex-row gap-0">
              {isNotesFullEditorOpen && (
                <div
                  className="fixed right-2 md:right-4 z-[110] flex flex-col-reverse md:flex-row items-end md:items-start gap-2 max-w-[calc(100vw-16px)]"
                  style={{ top: notesSidebarFloatingTop }}
                >
                  {!isNotesFullSidebarCollapsed && (
                    <aside className="w-[min(88vw,320px)] max-w-[calc(100vw-16px)] bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-xl">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Notes Panel</p>
                      <div className="inline-flex w-full bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            setNoteSection('department');
                            if (!selectedDepartmentNoteId) {
                              setSelectedDepartmentNoteId(NOTE_DEPARTMENTS[0] || '');
                            }
                          }}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            noteSection === 'department'
                              ? 'bg-white shadow-sm text-blue-700'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          By Department
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteSection('member');
                            if (!selectedMemberNoteId && teamMembers.length > 0) {
                              setSelectedMemberNoteId(teamMembers[0].id);
                            }
                          }}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            noteSection === 'member'
                              ? 'bg-white shadow-sm text-blue-700'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          By Member
                        </button>
                      </div>

                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {noteSection === 'department' ? 'Select department' : 'Select member'}
                      </p>

                      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <div className="max-h-[56vh] overflow-y-auto divide-y divide-gray-100">
                          {(noteSection === 'department' ? orderedDepartmentNoteOptions : orderedMemberNoteOptions).map(
                            (option) => {
                              const isActive = option.value === activeNoteId;
                              const isPinned =
                                noteSection === 'department'
                                  ? pinnedDepartmentNoteIds.includes(option.value)
                                  : pinnedMemberNoteIds.includes(option.value);
                              return (
                                <div key={`${noteSection}-${option.value}`} className="flex items-center gap-1 px-2 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (noteSection === 'department') {
                                        setSelectedDepartmentNoteId(option.value);
                                      } else {
                                        setSelectedMemberNoteId(option.value);
                                      }
                                    }}
                                    className={`flex-1 min-w-0 text-left px-2.5 py-2 rounded-md border text-sm transition-colors ${
                                      isActive
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {noteSection === 'member' && option.member ? (
                                        <UserAvatar
                                          user={option.member}
                                          sizeClass="w-8 h-8"
                                          textClass="text-[10px]"
                                          ringClass="ring-2 ring-white shadow-sm"
                                        />
                                      ) : null}
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{option.label}</p>
                                        {option.subLabel && (
                                          <p className="truncate text-[11px] text-gray-500 mt-0.5">{option.subLabel}</p>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (noteSection === 'department') {
                                        togglePinDepartmentNote(option.value);
                                      } else {
                                        togglePinMemberNote(option.value);
                                      }
                                    }}
                                    className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${
                                      isPinned
                                        ? 'text-amber-600 border-amber-200 bg-amber-50'
                                        : 'text-gray-400 border-gray-200 hover:text-amber-600 hover:bg-amber-50'
                                    }`}
                                    title={isPinned ? 'Unpin' : 'Pin to top'}
                                  >
                                    <Flag className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="md:hidden">
                        <NoteTargetSelect
                          options={noteSection === 'department' ? departmentNoteOptions : memberNoteOptions}
                          value={activeNoteId}
                          onChange={(nextValue) => {
                            if (noteSection === 'department') {
                              setSelectedDepartmentNoteId(nextValue);
                            } else {
                              setSelectedMemberNoteId(nextValue);
                            }
                          }}
                          placeholder={noteSection === 'department' ? 'Choose department' : 'Choose member'}
                          searchPlaceholder={noteSection === 'department' ? 'Search department...' : 'Search member...'}
                          emptyText={noteSection === 'department' ? 'No department found' : 'No member found'}
                        />
                      </div>
                    </aside>
                  )}

                  <button
                    type="button"
                    onPointerDown={handleNotesSidebarBubblePointerDown}
                    onClick={() => {
                      if (notesSidebarBubbleMovedRef.current) {
                        notesSidebarBubbleMovedRef.current = false;
                        return;
                      }
                      setIsNotesFullSidebarCollapsed((prev) => !prev);
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                        keyEvent.preventDefault();
                        setIsNotesFullSidebarCollapsed((prev) => !prev);
                      }
                    }}
                    className="h-11 w-11 md:h-12 md:w-12 rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 inline-flex items-center justify-center shadow-md"
                    style={{ touchAction: 'none' }}
                    title={isNotesFullSidebarCollapsed ? 'Open notes panel' : 'Close notes panel'}
                  >
                    <FolderTree className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
	                {activeNoteId ? (
	                  <NoteEditor
	                    noteId={activeNoteId}
	                    noteTitle={activeNoteTitle}
	                    initialContent={notesContent[activeNoteId] || ''}
	                    onSave={handleSaveNoteContent}
	                    presenceItems={activeNotePresenceItems}
	                    onPresenceUpdate={handleNotePresenceUpdate}
	                    isFullScreen
	                    onToggleFullScreen={() => setIsNotesFullEditorOpen(false)}
                      onBackToProject={() => setIsNotesFullEditorOpen(false)}
	                  />
	                ) : (
	                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 bg-white">
	                    <FileText className="w-12 h-12 mb-3 text-gray-300" />
	                    <p className="font-medium text-lg text-gray-500">Please select a note from the left sidebar</p>
	                  </div>
	                )}
	              </div>
	            </div>
	          </div>
	        </div>
	      )}

	      {/* Slide-over Task Detail/Edit Pane */}
	      <TaskDetailPane 
	        isOpen={isPaneOpen} 
	        onClose={() => setIsPaneOpen(false)} 
	        task={paneTask} 
	        onSave={(data) => { onSaveTask(data); setIsPaneOpen(false); }}
	        onDelete={async (id) => {
            const deleted = await onDeleteTask(id);
            if (deleted !== false) {
              setIsPaneOpen(false);
            }
          }}
	        currentUserId={currentUser.id}
	        teamMembers={teamMembers}
	        TASK_STATUSES={TASK_STATUSES}
	        DEPARTMENTS={DEPARTMENTS}
          departmentColors={projectDepartmentColors}
	      />

      {optionsPopupType && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {optionsPopupType === 'position' ? 'Manage Positions' : 'Manage Departments'}
              </h3>
              <button
                type="button"
                onClick={closeOptionsPopup}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

	            <div className="p-5 space-y-4">
	              <div className="flex items-center gap-2">
	                <input
	                  type="text"
	                  value={newOptionValue}
	                  onChange={(e) => setNewOptionValue(e.target.value)}
	                  placeholder={optionsPopupType === 'position' ? 'New position' : 'New department'}
	                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
	                />
                <button
                  type="button"
                  onClick={async () => {
	                    if (optionsPopupType === 'position') {
	                      const created = await handleCreatePosition(null, newOptionValue);
	                      if (created) setNewOptionValue('');
	                    } else {
	                      const created = await handleCreateDepartment(
	                        null,
	                        newOptionValue,
	                        newDepartmentColor
	                      );
	                      if (created) {
	                        setNewOptionValue('');
	                        setNewDepartmentColor(DEPARTMENT_COLOR_PRESETS[0] || '#3b82f6');
	                      }
	                    }
	                  }}
	                  className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
	                >
	                  Add
	                </button>
	              </div>
	              {optionsPopupType === 'department' && (
	                <div>
	                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
	                    Department color
	                  </p>
	                  <div className="flex flex-wrap gap-1.5">
	                    {DEPARTMENT_COLOR_PRESETS.map((colorValue) => {
	                      const isActiveColor = newDepartmentColor === colorValue;
	                      return (
	                        <button
	                          key={`department-color-preset-${colorValue}`}
	                          type="button"
	                          onClick={() => setNewDepartmentColor(colorValue)}
	                          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-105 ${
	                            isActiveColor ? 'border-gray-700' : 'border-white ring-1 ring-gray-300'
	                          }`}
	                          style={{ backgroundColor: colorValue }}
	                          title={colorValue}
	                        />
	                      );
	                    })}
	                  </div>
	                </div>
	              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {optionsPopupItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    {optionsPopupType === 'position' ? 'No positions yet' : 'No departments yet'}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {optionsPopupItems.map((optionValue) => {
                      const normalizedValue = String(optionValue || '').trim().toLowerCase();
                      const isLockedOption =
                        optionsPopupType === 'department' && normalizedValue === 'unassigned';
                      const isEditing =
                        String(editingOptionOriginal || '').trim().toLowerCase() === normalizedValue;

                      return (
                        <div key={`${optionsPopupType}-${optionValue}`} className="px-4 py-3 flex items-center gap-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingOptionValue}
                              onChange={(e) => setEditingOptionValue(e.target.value)}
                              className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
	                          ) : (
	                            <span className={`flex-1 text-sm ${isLockedOption ? 'text-gray-400' : 'text-gray-700'}`}>
	                              <span className="inline-flex items-center gap-2">
	                                {optionsPopupType === 'department' && (
	                                  <span
	                                    className="w-2.5 h-2.5 rounded-full border border-gray-200"
	                                    style={{
	                                      backgroundColor: resolveDepartmentColorHex(
	                                        projectDepartmentColors,
	                                        optionValue
	                                      ),
	                                    }}
	                                  />
	                                )}
	                                <span>{optionValue}</span>
	                              </span>
	                            </span>
	                          )}

                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated =
                                    optionsPopupType === 'position'
                                      ? handleRenamePositionOption(editingOptionOriginal, editingOptionValue)
                                      : handleRenameDepartmentOption(editingOptionOriginal, editingOptionValue);

                                  if (updated) {
                                    setEditingOptionOriginal('');
                                    setEditingOptionValue('');
                                  }
                                }}
                                className="p-1.5 rounded-md text-green-600 hover:bg-green-50"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOptionOriginal('');
                                  setEditingOptionValue('');
                                }}
                                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOptionOriginal(optionValue);
                                  setEditingOptionValue(optionValue);
                                }}
                                disabled={isLockedOption}
                                className={`p-1.5 rounded-md ${
                                  isLockedOption
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={isLockedOption ? 'Cannot edit this option' : 'Edit'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (optionsPopupType === 'position') {
                                    void handleDeletePositionOption(optionValue);
                                  } else {
                                    void handleDeleteDepartmentOption(optionValue);
                                  }
                                }}
                                disabled={isLockedOption}
                                className={`p-1.5 rounded-md ${
                                  isLockedOption
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                }`}
                                title={isLockedOption ? 'Cannot delete this option' : 'Delete'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Task Detail & Edit Slide-over Pane ---
function TaskDetailPane({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
  currentUserId = '',
  teamMembers,
  TASK_STATUSES,
  DEPARTMENTS = [],
  departmentColors = {},
}) {
  const popup = usePopup();
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('To Do');
  const [department, setDepartment] = useState('Unassigned');
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [hasStartDate, setHasStartDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [hasStartTime, setHasStartTime] = useState(false);
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const resolveDepartmentForAssignees = (memberIds, fallback = 'Unassigned') =>
    resolveTaskDepartmentFromAssignees(memberIds, teamMembers, fallback);
  const getAssigneeById = (memberId) =>
    teamMembers.find((candidate) => candidate.id === memberId) || {
      id: memberId || '',
      name: memberId ? 'Unknown member' : 'Unassigned',
      initials: memberId ? String(memberId).slice(0, 1).toUpperCase() : '?',
      color: 'bg-gray-400',
      avatarUrl: '',
      position: '',
      role: '',
      department: 'Unassigned',
    };
  const assigneeGroups = useMemo(() => {
    const grouped = {};
    teamMembers.forEach((member) => {
      const departmentName = String(member.department || '').trim() || 'Unassigned';
      if (!grouped[departmentName]) grouped[departmentName] = [];
      grouped[departmentName].push(member);
    });
    const order = Array.from(
      new Set(
        [...(Array.isArray(DEPARTMENTS) ? DEPARTMENTS : []), ...Object.keys(grouped)]
          .map((department) => String(department || '').trim())
          .filter(Boolean)
      )
    );
    return order
      .filter((department) => Array.isArray(grouped[department]) && grouped[department].length > 0)
      .map((department) => ({
        department,
        members: [...grouped[department]].sort((left, right) =>
          String(left.name || '').localeCompare(String(right.name || ''), undefined, {
            sensitivity: 'base',
          })
        ),
      }));
  }, [teamMembers, DEPARTMENTS]);
  const selectedAssignees = useMemo(() => {
    const selected = normalizeTaskAssigneeIds({ assigneeIds }).map((id) => getAssigneeById(id));
    return selected.length > 0 ? selected : [getAssigneeById('')];
  }, [assigneeIds, teamMembers]);
  const assigneeSummaryText = useMemo(() => {
    const validIds = normalizeTaskAssigneeIds({ assigneeIds });
    if (!validIds.length) return 'Select assignees...';
    const names = validIds.map((id) => getAssigneeById(id).name);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }, [assigneeIds, teamMembers]);
  const relatedDepartments = useMemo(
    () =>
      resolveTaskDepartmentsFromAssignees(
        normalizeTaskAssigneeIds({ assigneeIds }),
        teamMembers,
        'Unassigned'
      ),
    [assigneeIds, teamMembers]
  );
  const getDepartmentBadgeStyle = (departmentName) => {
    const safeDepartment = String(departmentName || '').trim() || 'Unassigned';
    if (safeDepartment.toLowerCase() === 'unassigned') {
      return {
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        color: '#64748b',
      };
    }
    const colorHex = resolveDepartmentColorHex(departmentColors, safeDepartment, '#64748b');
    return {
      borderColor: toRgba(colorHex, 0.45),
      backgroundColor: toRgba(colorHex, 0.14),
      color: colorHex,
    };
  };
  const toggleAssigneeSelection = (memberId) => {
    const normalizedId = String(memberId || '').trim();
    if (!normalizedId) return;
    setAssigneeIds((prev) => {
      const current = normalizeTaskAssigneeIds({ assigneeIds: prev });
      if (current.includes(normalizedId)) {
        return current.filter((id) => id !== normalizedId);
      }
      return [...current, normalizedId];
    });
  };

  // Update form when task changes or panel opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setIsEditing(false); // Default to view mode if opening existing task
        const mappedAssigneeIds = normalizeTaskAssigneeIds(task);
        const mappedDepartment = resolveDepartmentForAssignees(
          mappedAssigneeIds,
          task.department || 'Unassigned'
        );
        const taskStartDate = String(task.startDate || '').trim();
        const taskStartTime = String(task.startTime || '').trim();
        const hasTaskStartDate =
          typeof task.hasExplicitStartDate === 'boolean'
            ? task.hasExplicitStartDate
            : Boolean(taskStartDate);
        const hasTaskStartTime =
          typeof task.hasExplicitStartTime === 'boolean'
            ? task.hasExplicitStartTime
            : Boolean(taskStartTime);
        setTitle(task.title || '');
        setStatus(task.status || 'To Do');
        setDepartment(mappedDepartment);
        setAssigneeIds(mappedAssigneeIds);
        setHasStartDate(hasTaskStartDate);
        setStartDate(hasTaskStartDate ? taskStartDate : '');
        setEndDate(task.endDate || '');
        setHasStartTime(hasTaskStartTime);
        setStartTime(hasTaskStartTime ? taskStartTime : '');
        setEndTime(String(task.endTime || '').trim());
        setDescription(task.description || '');
      } else {
        setIsEditing(true); // Force edit mode for new task
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const preferredMember =
          teamMembers.find((member) => String(member.id || '').trim() === String(currentUserId || '').trim()) ||
          teamMembers[0] ||
          null;
        const defaultAssigneeIds = preferredMember ? [preferredMember.id] : [];
        setTitle('');
        setStatus('To Do');
        setDepartment(resolveDepartmentForAssignees(defaultAssigneeIds, 'Unassigned'));
        setAssigneeIds(defaultAssigneeIds);
        setHasStartDate(false);
        setStartDate('');
        setEndDate(todayStr);
        setHasStartTime(false);
        setStartTime('');
        setEndTime('');
        setDescription('');
      }
      setIsAssigneePickerOpen(false);
    }
  }, [task, isOpen, teamMembers, currentUserId]);
  useEffect(() => {
    if (!isOpen) return;
    const linkedDepartment = resolveDepartmentForAssignees(assigneeIds, department);
    if (linkedDepartment !== department) {
      setDepartment(linkedDepartment);
    }
  }, [assigneeIds, teamMembers, isOpen, department]);

  // Handle Save
  const handleSave = (e) => {
    e.preventDefault();
    if (!title || !endDate) {
      void popup.alert({
        title: 'Incomplete form',
        message: 'Please provide task name and due date.',
      });
      return;
    }
    const normalizedAssigneeIds = normalizeTaskAssigneeIds({ assigneeIds });
    const normalizedStartDate =
      hasStartDate && String(startDate || '').trim() ? String(startDate || '').trim() : String(endDate || '').trim();
    const normalizedStartTime =
      hasStartTime && String(startTime || '').trim() ? String(startTime || '').trim() : '';

    onSave({
      id: task?.id,
      title,
      status,
      department: resolveDepartmentForAssignees(normalizedAssigneeIds, department),
      assigneeId: normalizedAssigneeIds[0] || '',
      assigneeIds: normalizedAssigneeIds,
      startDate: normalizedStartDate,
      endDate: String(endDate || '').trim() || normalizedStartDate,
      startTime: normalizedStartTime,
      endTime: String(endTime || '').trim(),
      hasExplicitStartDate: Boolean(hasStartDate && String(startDate || '').trim()),
      hasExplicitStartTime: Boolean(hasStartTime && String(startTime || '').trim()),
      description,
    });
  };

  if (!isOpen) return null;

  const currentAssignees = selectedAssignees;

  return (
    <>
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-gray-900/40 z-40 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* Slide-over Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full flex justify-end pointer-events-none"
        style={{ direction: 'ltr' }}
      >
        <div className="pointer-events-auto h-[100dvh] max-h-[100dvh] w-[min(540px,100vw)] max-w-full bg-white shadow-2xl transition-transform duration-300 flex flex-col border-l border-slate-200 rounded-none overflow-hidden relative">
        
        {/* Header Options */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
          <div className="flex items-center gap-2">
            {!isEditing && task && (
              <button 
                onClick={() => onSave({ ...task, status: 'Done' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${task.status === 'Done' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                <CheckCircle className="w-4 h-4" /> {task.status === 'Done' ? 'Completed' : 'Mark Complete'}
              </button>
            )}
            {isEditing && <span className="font-bold text-gray-700">{task ? 'แก้ไข Task' : 'สร้าง Task ใหม่'}</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={async () => {
                    const shouldDelete = await popup.confirm({
                      title: 'Delete task',
                      message: 'คุณแน่ใจหรือไม่ที่จะลบ Task นี้?',
                      confirmText: 'Delete',
                      tone: 'danger',
                    });
                    if (shouldDelete) onDelete(task.id);
                  }} 
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            // --- Edit / Create Form ---
            <form id="task-form" onSubmit={handleSave} noValidate className="p-6 flex flex-col gap-6">
              <div>
                <input 
                  type="text" 
                  placeholder="Task Name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-2xl font-bold border-none focus:ring-0 placeholder-gray-300 w-full p-0 text-gray-800 outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-y-5 gap-x-2 text-sm">
                <div className="text-gray-500 flex items-center gap-2"><Users className="w-4 h-4" /> ผู้รับผิดชอบ</div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsAssigneePickerOpen(true)}
                    className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 text-left text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-100 transition-colors"
                  >
                    {assigneeSummaryText}
                  </button>
                  {normalizeTaskAssigneeIds({ assigneeIds }).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {normalizeTaskAssigneeIds({ assigneeIds }).map((assigneeId) => {
                        const assignee = getAssigneeById(assigneeId);
	                        return (
	                          <span
	                            key={`task-pane-selected-assignee-${assigneeId}`}
	                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
	                          >
	                            <UserAvatar
	                              user={assignee}
	                              sizeClass="w-4 h-4"
	                              textClass="text-[8px]"
	                              ringClass="ring-1 ring-white"
	                            />
	                            {assignee.name}
	                          </span>
	                        );
	                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400">You can select multiple assignees.</p>
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Start</div>
                <div className="grid grid-cols-2 gap-2">
                  {hasStartDate ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHasStartDate(false);
                          setStartDate('');
                        }}
                        className="px-2.5 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                      <span className="text-sm text-gray-500">No start date</span>
                      <button
                        type="button"
                        onClick={() => {
                          setHasStartDate(true);
                          if (!startDate) setStartDate(endDate || '');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Set
                      </button>
                    </div>
                  )}
                  {hasStartTime ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHasStartTime(false);
                          setStartTime('');
                        }}
                        className="px-2.5 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                      <span className="text-sm text-gray-500">No start time</span>
                      <button
                        type="button"
                        onClick={() => setHasStartTime(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Set
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> วันที่สิ้นสุด</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={endDate} min={hasStartDate ? startDate : ''} onChange={e => setEndDate(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Activity className="w-4 h-4" /> สถานะ</div>
                <div>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Layers className="w-4 h-4" /> ฝ่าย</div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {relatedDepartments.length > 0 ? (
                      relatedDepartments.map((departmentName) => (
                        <span
                          key={`task-related-edit-dept-${departmentName}`}
                          className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold"
                          style={getDepartmentBadgeStyle(departmentName)}
                        >
                          {departmentName}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-500">
                        Unassigned
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Linked from selected assignees</p>
                </div>
              </div>

              <div className="mt-2 border-t pt-5 border-gray-100">
                <div className="text-gray-500 flex items-center gap-2 mb-3 text-sm"><AlignLeft className="w-4 h-4" /> คำอธิบาย (Description)</div>
                <textarea 
                  placeholder="เพิ่มคำอธิบายรายละเอียดงาน..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border-gray-300 border rounded-lg p-3 bg-gray-50 min-h-[150px] outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                ></textarea>
              </div>
            </form>
          ) : (
            // --- View Mode ---
            <div className="p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-y-6 text-sm">
                <div className="text-gray-500">ผู้รับผิดชอบ</div>
                                <div className="flex flex-wrap items-center gap-2.5">
	                  {currentAssignees.map((assignee, index) => (
	                    <div
	                      key={`task-pane-view-assignee-${assignee.id || assignee.name}-${index}`}
	                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1"
	                    >
	                      <UserAvatar
	                        user={assignee}
	                        sizeClass="w-7 h-7"
	                        textClass="text-[10px]"
	                        ringClass="ring-1 ring-white shadow-sm"
	                      />
	                      <span className="font-medium text-gray-800 text-sm">{assignee.name}</span>
	                    </div>
	                  ))}
                </div>

                <div className="text-gray-500">วันที่เริ่มต้น</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {hasStartDate ? startDate : 'No start date'}
                  {hasStartTime && startTime ? (
                    <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{startTime}</span>
                  ) : null}
                </div>

                <div className="text-gray-500">กำหนดส่ง</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {endDate}
                  {endTime ? (
                    <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{endTime}</span>
                  ) : null}
                </div>

                <div className="text-gray-500">สถานะ</div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border 
                    ${status === 'Done' ? 'bg-green-50 text-green-700 border-green-200' : 
                      status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                      'bg-gray-50 text-gray-700 border-gray-200'}
                  `}>
                    {status}
                  </span>
                </div>

                <div className="text-gray-500">ฝ่าย (Department)</div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {relatedDepartments.map((departmentName) => (
                      <span
                        key={`task-related-view-dept-${departmentName}`}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                        style={getDepartmentBadgeStyle(departmentName)}
                      >
                        {departmentName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t pt-6 border-gray-100">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">คำอธิบาย</h4>
                {description ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">ไม่มีคำอธิบายเพิ่มเติม</p>
                )}
              </div>
            </div>
          )}
        </div>

        {isEditing && isAssigneePickerOpen && (
          <div className="absolute inset-0 z-[5] bg-white/80 backdrop-blur-[1px] p-3 md:p-4">
            <div className="h-full rounded-xl border border-gray-200 bg-white shadow-lg flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Select assignees</p>
                  <p className="text-[11px] text-gray-500">Grouped by department</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssigneePickerOpen(false)}
                  className="h-8 w-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                  title="Close"
                >
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {assigneeGroups.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">
                    No members available
                  </div>
                ) : (
                  assigneeGroups.map((group) => (
                    <div
                      key={`task-assignee-group-${group.department}`}
                      className="rounded-lg border border-gray-200 overflow-hidden"
                    >
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {group.department}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {group.members.map((member) => {
                          const checked = normalizeTaskAssigneeIds({ assigneeIds }).includes(member.id);
                          return (
	                            <label
	                              key={`task-assignee-option-${member.id}`}
	                              className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
	                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAssigneeSelection(member.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
	                              <UserAvatar
	                                user={member}
	                                sizeClass="w-6 h-6"
	                                textClass="text-[10px]"
	                                ringClass="ring-1 ring-white"
	                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-700 font-medium truncate">{member.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {member.position || member.role || 'Team Member'}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAssigneeIds([])}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssigneePickerOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions (Only show when editing) */}
        {isEditing && (
          <div className="p-4 border-t bg-white flex justify-end gap-3 shrink-0">
            {task && (
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ยกเลิก
              </button>
            )}
            {!task && (
              <button 
                type="button" 
                onClick={onClose}
                className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ปิด
              </button>
            )}
            <button 
              type="submit" 
              form="task-form"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              บันทึก
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

// Helper component for Org Chart Nodes
function OrgNode({ member }) {
  return (
    <div className="mx-auto w-[220px] rounded-2xl border border-slate-200 bg-white px-4 pt-5 pb-4 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.55)] flex flex-col items-center text-center transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.55)]">
      <div className="mb-3">
        <UserAvatar
          user={member}
          sizeClass="w-14 h-14"
          textClass="text-sm"
          ringClass="ring-[3px] ring-white shadow-md"
        />
      </div>
      <p className="font-semibold text-slate-800 text-[15px] leading-tight truncate w-full">{member.name}</p>
      <p className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 max-w-full truncate">
        {member.position || member.role || 'Team Member'}
      </p>
    </div>
  );
}

// --- Note Editor Component for Team Notes ---
function NoteEditor({
  noteId,
  noteTitle,
  initialContent,
  onSave,
  presenceItems = [],
  onPresenceUpdate = null,
  isFullScreen = false,
  onToggleFullScreen = null,
  onBackToProject = null,
}) {
  const popup = usePopup();
  const editorContainerRef = React.useRef(null);
  const docViewportRef = React.useRef(null);
  const pagePickerRef = React.useRef(null);
  const sheetQuickMenuRef = React.useRef(null);
  const docTextColorPickerRef = React.useRef(null);
  const docHighlightColorPickerRef = React.useRef(null);
  const docUnderlineMenuRef = React.useRef(null);
  const docFontSizeMenuRef = React.useRef(null);
  const docInsertTableMenuRef = React.useRef(null);
  const docTableFillColorPickerRef = React.useRef(null);
  const docTableBorderColorPickerRef = React.useRef(null);
  const docTableCellAlignMenuRef = React.useRef(null);
  const docTableResizeMenuRef = React.useRef(null);
  const docTableResizeOverlayRef = React.useRef(null);
  const docTableExtraToolsMenuRef = React.useRef(null);
  const docLinkMenuRef = React.useRef(null);
  const imageMenuRef = React.useRef(null);
  const editorRef = React.useRef(null);
  const sheetPaneRef = React.useRef(null);
  const uploadInputRef = React.useRef(null);
  const dragImageIdRef = React.useRef('');
  const docImagePointerDragRef = React.useRef(null);
  const docImageResizeRef = React.useRef(null);
  const docImageClipboardRef = React.useRef(null);
  const previousNoteIdRef = React.useRef(noteId);
  const lastHydratedDocPageRef = React.useRef('');
  const docTableSelectionRangeRef = React.useRef(null);
  const docTableRangeDragRef = React.useRef({
    active: false,
    tableId: '',
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    hasMoved: false,
  });
  const docTableCornerResizeRef = React.useRef({
    active: false,
    tableId: '',
    direction: 'se',
    hasMoved: false,
    startClientX: 0,
    startClientY: 0,
    startFrameWidth: 0,
    startFrameHeight: 0,
    startScale: 100,
    cellMetrics: [],
  });
  const presenceTimerRef = React.useRef(null);
  const longPressTimerRef = React.useRef(null);
  const touchDragStateRef = React.useRef({
    imageId: '',
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const [imageMenuState, setImageMenuState] = useState(null);
  const [activeImageFrame, setActiveImageFrame] = useState(null);
  const [activeCropFrame, setActiveCropFrame] = useState(null);
  const [imageCropModeId, setImageCropModeId] = useState('');
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    highlight: false,
  });
  const [docTextColorValue, setDocTextColorValue] = useState('#111827');
  const [docHighlightColorValue, setDocHighlightColorValue] = useState('#fef08a');
  const [isDocTextColorPickerOpen, setIsDocTextColorPickerOpen] = useState(false);
  const [isDocHighlightColorPickerOpen, setIsDocHighlightColorPickerOpen] = useState(false);
  const [docUnderlineStyle, setDocUnderlineStyle] = useState('solid');
  const [isDocUnderlineMenuOpen, setIsDocUnderlineMenuOpen] = useState(false);
  const [isDocFontSizeMenuOpen, setIsDocFontSizeMenuOpen] = useState(false);
  const [isDocInsertTableMenuOpen, setIsDocInsertTableMenuOpen] = useState(false);
  const [isDocTableFillColorPickerOpen, setIsDocTableFillColorPickerOpen] = useState(false);
  const [isDocTableBorderColorPickerOpen, setIsDocTableBorderColorPickerOpen] = useState(false);
  const [isDocTableCellAlignMenuOpen, setIsDocTableCellAlignMenuOpen] = useState(false);
  const [isDocTableResizeMenuOpen, setIsDocTableResizeMenuOpen] = useState(false);
  const [isDocTableExtraToolsMenuOpen, setIsDocTableExtraToolsMenuOpen] = useState(false);
  const [docLinkMenuState, setDocLinkMenuState] = useState(null);
  const [docFontFamilyValue, setDocFontFamilyValue] = useState('');
  const [docFontSizeValue, setDocFontSizeValue] = useState('14');
  const [docFontSizeDraft, setDocFontSizeDraft] = useState('14');
  const [docTableFillColorValue, setDocTableFillColorValue] = useState('#ffffff');
  const [docTableBorderColorValue, setDocTableBorderColorValue] = useState('#cbd5e1');
  const [docTableBorderDesignValue, setDocTableBorderDesignValue] = useState('all');
  const [docTableBorderLineStyleValue, setDocTableBorderLineStyleValue] = useState('solid');
  const [docTableBorderLineWidthValue, setDocTableBorderLineWidthValue] = useState('1');
  const [docTableCellAlignValue, setDocTableCellAlignValue] = useState({
    horizontal: 'left',
    vertical: 'top',
  });
  const [docTablePageAlignValue, setDocTablePageAlignValue] = useState('left');
  const [docTableContentLockEnabled, setDocTableContentLockEnabled] = useState(false);
  const [docTableWrapEnabled, setDocTableWrapEnabled] = useState(false);
  const [docTableScaleDraft, setDocTableScaleDraft] = useState('100');
  const [docTableDraftRows, setDocTableDraftRows] = useState('4');
  const [docTableDraftCols, setDocTableDraftCols] = useState('4');
  const [docTableHoverRows, setDocTableHoverRows] = useState(0);
  const [docTableHoverCols, setDocTableHoverCols] = useState(0);
  const [docTableSelectionState, setDocTableSelectionState] = useState(null);
  const [activeDocTableResizeFrame, setActiveDocTableResizeFrame] = useState(null);
  const [docPresenceCursorFrames, setDocPresenceCursorFrames] = useState([]);
  const [noteDocument, setNoteDocument] = useState(() => parseStoredNoteDocument(initialContent));
  const [activePageId, setActivePageId] = useState(() => parseStoredNoteDocument(initialContent).activePageId);
  const [noteEditHistory, setNoteEditHistory] = useState({ past: [], future: [] });
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const [sheetSelection, setSheetSelection] = useState({ row: 0, col: 0 });
  const [sheetSelectionRange, setSheetSelectionRange] = useState({
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  });
  const [sheetEditingCell, setSheetEditingCell] = useState(null);
  const [sheetQuickMenu, setSheetQuickMenu] = useState(null);
  const [sheetClipboardState, setSheetClipboardState] = useState(null);
  const [isCompactSheetViewport, setIsCompactSheetViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  const [isMobileNoteViewport, setIsMobileNoteViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [mobileToolbarSection, setMobileToolbarSection] = useState('');
  const isDesktopSheetViewport = !isCompactSheetViewport;
  const sheetSelectionDragRef = React.useRef({
    active: false,
    start: { row: 0, col: 0 },
    hasMoved: false,
  });
  const noteDocumentRef = React.useRef(noteDocument);
  const NOTE_EDITOR_HISTORY_LIMIT = 120;
  React.useEffect(() => {
    noteDocumentRef.current = noteDocument;
  }, [noteDocument]);
  const activePage = useMemo(
    () => noteDocument.pages.find((page) => page.id === activePageId) || noteDocument.pages[0] || createDefaultNoteDocPage(''),
    [noteDocument, activePageId]
  );
  const isActiveDocPage = activePage?.type !== 'sheet';
  const isActiveSheetPage = activePage?.type === 'sheet';
  const persistNoteDocument = (nextDocumentInput, options = {}) => {
    const normalized = normalizeNoteDocumentPayload(nextDocumentInput);
    const nextSerialized = serializeStoredNoteDocument(normalized);
    const previousSnapshot = noteDocumentRef.current || noteDocument;
    const previousSerialized = serializeStoredNoteDocument(previousSnapshot);
    if (nextSerialized === previousSerialized) {
      noteDocumentRef.current = normalized;
      setNoteDocument(normalized);
      return;
    }
    if (options.recordHistory !== false) {
      setNoteEditHistory((prevHistory) => {
        const nextPast = [...prevHistory.past, previousSerialized];
        if (nextPast.length > NOTE_EDITOR_HISTORY_LIMIT) {
          nextPast.splice(0, nextPast.length - NOTE_EDITOR_HISTORY_LIMIT);
        }
        return {
          past: nextPast,
          future: [],
        };
      });
    }
    noteDocumentRef.current = normalized;
    setNoteDocument(normalized);
    onSave(noteId, nextSerialized);
  };
  const applyNoteHistorySnapshot = (serializedSnapshot) => {
    const parsedSnapshot = parseStoredNoteDocument(serializedSnapshot);
    const normalizedSnapshot = normalizeNoteDocumentPayload(parsedSnapshot);
    noteDocumentRef.current = normalizedSnapshot;
    setNoteDocument(normalizedSnapshot);
    setActivePageId(normalizedSnapshot.activePageId);
    setSheetSelection({ row: 0, col: 0 });
    setSheetSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 },
    });
    setSheetEditingCell(null);
    setSheetQuickMenu(null);
    setSheetClipboardState(null);
    sheetSelectionDragRef.current.active = false;
    sheetSelectionDragRef.current.hasMoved = false;
    setImageMenuState(null);
    setActiveImageFrame(null);
    setActiveCropFrame(null);
    clearDocTableSelection();
    onSave(noteId, serializeStoredNoteDocument(normalizedSnapshot));
    schedulePresenceUpdate('');
  };
  const handleUndoNoteChange = () => {
    let snapshotToApply = '';
    setNoteEditHistory((prevHistory) => {
      if (!prevHistory.past.length) return prevHistory;
      snapshotToApply = String(prevHistory.past[prevHistory.past.length - 1] || '');
      const currentSerialized = serializeStoredNoteDocument(
        normalizeNoteDocumentPayload(noteDocumentRef.current || noteDocument)
      );
      const nextPast = prevHistory.past.slice(0, -1);
      const nextFuture = [currentSerialized, ...prevHistory.future];
      if (nextFuture.length > NOTE_EDITOR_HISTORY_LIMIT) {
        nextFuture.splice(NOTE_EDITOR_HISTORY_LIMIT);
      }
      return {
        past: nextPast,
        future: nextFuture,
      };
    });
    if (!snapshotToApply) return;
    applyNoteHistorySnapshot(snapshotToApply);
  };
  const handleRedoNoteChange = () => {
    let snapshotToApply = '';
    setNoteEditHistory((prevHistory) => {
      if (!prevHistory.future.length) return prevHistory;
      snapshotToApply = String(prevHistory.future[0] || '');
      const currentSerialized = serializeStoredNoteDocument(
        normalizeNoteDocumentPayload(noteDocumentRef.current || noteDocument)
      );
      const nextPast = [...prevHistory.past, currentSerialized];
      if (nextPast.length > NOTE_EDITOR_HISTORY_LIMIT) {
        nextPast.splice(0, nextPast.length - NOTE_EDITOR_HISTORY_LIMIT);
      }
      return {
        past: nextPast,
        future: prevHistory.future.slice(1),
      };
    });
    if (!snapshotToApply) return;
    applyNoteHistorySnapshot(snapshotToApply);
  };
  const updateActivePage = (updater) => {
    persistNoteDocument({
      ...noteDocument,
      pages: noteDocument.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const nextPage = updater(page);
        return normalizeNoteDocumentPage(nextPage);
      }),
      activePageId: activePage.id,
    });
  };
  const getSheetCellKey = (row, col) => `r${row}c${col}`;
  const normalizeSheetCellCoord = (row, col) => {
    const maxRow = Math.max(0, Number(activePage?.rows || 1) - 1);
    const maxCol = Math.max(0, Number(activePage?.cols || 1) - 1);
    const safeRow = Number.isFinite(Number(row)) ? Number(row) : 0;
    const safeCol = Number.isFinite(Number(col)) ? Number(col) : 0;
    return {
      row: Math.min(maxRow, Math.max(0, safeRow)),
      col: Math.min(maxCol, Math.max(0, safeCol)),
    };
  };
  const setSingleSheetSelection = (row, col) => {
    const coord = normalizeSheetCellCoord(row, col);
    setSheetSelection(coord);
    setSheetSelectionRange({
      start: coord,
      end: coord,
    });
    return coord;
  };
  const beginSheetRangeSelection = (row, col) => {
    if (!isActiveSheetPage) return;
    setSheetEditingCell(null);
    const coord = setSingleSheetSelection(row, col);
    sheetSelectionDragRef.current = {
      active: true,
      start: coord,
      hasMoved: false,
    };
    schedulePresenceUpdate('');
  };
  const extendSheetRangeSelection = (row, col) => {
    if (!isActiveSheetPage || !sheetSelectionDragRef.current.active) return;
    const nextEnd = normalizeSheetCellCoord(row, col);
    const start = normalizeSheetCellCoord(
      sheetSelectionDragRef.current.start.row,
      sheetSelectionDragRef.current.start.col
    );
    setSheetSelection(nextEnd);
    setSheetSelectionRange({
      start,
      end: nextEnd,
    });
    if (nextEnd.row !== start.row || nextEnd.col !== start.col) {
      sheetSelectionDragRef.current.hasMoved = true;
    }
  };
  const endSheetRangeSelection = () => {
    if (!sheetSelectionDragRef.current.active) return;
    sheetSelectionDragRef.current.active = false;
  };
  const setSheetSelectionWithCollapsedRange = (updater) => {
    setSheetSelection((prevSelection) => {
      const nextRaw =
        typeof updater === 'function' ? updater(prevSelection) : updater || prevSelection;
      const nextCoord = normalizeSheetCellCoord(nextRaw.row, nextRaw.col);
      setSheetSelectionRange({
        start: nextCoord,
        end: nextCoord,
      });
      return nextCoord;
    });
  };
  const selectedSheetCellKey = getSheetCellKey(sheetSelection.row, sheetSelection.col);
  const selectedSheetCell =
    isActiveSheetPage && activePage?.cells?.[selectedSheetCellKey]
      ? normalizeNoteSheetCell(activePage.cells[selectedSheetCellKey])
      : normalizeNoteSheetCell({});
  const canUndoNoteChange = noteEditHistory.past.length > 0;
  const canRedoNoteChange = noteEditHistory.future.length > 0;
  React.useEffect(() => {
    if (isActiveSheetPage) {
      const nextSheetSize = String(selectedSheetCell?.style?.fontSize || '14').replace(/px$/i, '');
      setDocFontSizeDraft(nextSheetSize || '14');
      return;
    }
    setDocFontSizeDraft(docFontSizeValue);
  }, [docFontSizeValue, isActiveSheetPage, selectedSheetCell?.style?.fontSize]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const resetTouchDragState = () => {
    const currentImageId = touchDragStateRef.current.imageId;
    if (currentImageId) {
      const imageNode = getImageById(currentImageId);
      if (imageNode) {
        imageNode.style.opacity = '';
        imageNode.style.cursor = 'grab';
      }
    }
    touchDragStateRef.current = {
      imageId: '',
      active: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
    };
    clearLongPressTimer();
  };

  const getImageById = (imageId) => {
    if (!imageId || !editorRef.current) return null;
    return editorRef.current.querySelector(`img[data-note-image-id="${imageId}"]`);
  };
  const setSelectedImageVisual = (imageId = '') => {
    if (!editorRef.current) return;
    const images = editorRef.current.querySelectorAll('img[data-note-image-id]');
    images.forEach((imageNode) => {
      if (imageNode.dataset.noteImageId === imageId) {
        imageNode.dataset.noteImageSelected = 'true';
        imageNode.style.outline = '2px solid rgba(37, 99, 235, 0.95)';
        imageNode.style.outlineOffset = '0';
      } else {
        imageNode.dataset.noteImageSelected = 'false';
        imageNode.style.outline = 'none';
        imageNode.style.outlineOffset = '0';
      }
    });
  };
  const syncEditorCanvasMetrics = () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const images = editor.querySelectorAll('img[data-note-image-id]');
    let maxImageBottom = 0;
    images.forEach((imageNode) => {
      const posY = Number.parseFloat(String(imageNode.dataset.posY || '0'));
      const nodeHeight = imageNode.getBoundingClientRect().height || imageNode.offsetHeight || 0;
      const imageBottom = Math.max(0, (Number.isFinite(posY) ? posY : 0) + nodeHeight);
      maxImageBottom = Math.max(maxImageBottom, imageBottom);
    });
    const editorScrollHeight = editor.scrollHeight || 0;
    const targetMinHeight = Math.max(420, maxImageBottom + 220, editorScrollHeight);
    editor.style.minHeight = `${targetMinHeight}px`;
  };
  const getImageFrameInViewport = (imageId) => {
    if (!imageId) return null;
    const imageNode = getImageById(imageId);
    if (!imageNode) return null;
    const viewportNode = docViewportRef.current || editorContainerRef.current;
    if (!viewportNode) return null;
    const viewportRect = viewportNode.getBoundingClientRect();
    const imageRect = imageNode.getBoundingClientRect();
    const viewportScrollLeft = Number(viewportNode.scrollLeft || 0);
    const viewportScrollTop = Number(viewportNode.scrollTop || 0);
    return {
      imageId,
      x: imageRect.left - viewportRect.left + viewportScrollLeft,
      y: imageRect.top - viewportRect.top + viewportScrollTop,
      width: imageRect.width,
      height: imageRect.height,
    };
  };
  const getNormalizedImageCropRect = (imageNode, imageWidth, imageHeight) => {
    const safeImageWidth = Math.max(1, Number(imageWidth) || 1);
    const safeImageHeight = Math.max(1, Number(imageHeight) || 1);
    const minCropSize = 24;
    const parsedLeft = Number.parseFloat(String(imageNode?.dataset?.cropLeft || '0'));
    const parsedTop = Number.parseFloat(String(imageNode?.dataset?.cropTop || '0'));
    const parsedWidth = Number.parseFloat(String(imageNode?.dataset?.cropWidth || `${safeImageWidth}`));
    const parsedHeight = Number.parseFloat(String(imageNode?.dataset?.cropHeight || `${safeImageHeight}`));
    let left = Number.isFinite(parsedLeft) ? parsedLeft : 0;
    let top = Number.isFinite(parsedTop) ? parsedTop : 0;
    let width = Number.isFinite(parsedWidth) ? parsedWidth : safeImageWidth;
    let height = Number.isFinite(parsedHeight) ? parsedHeight : safeImageHeight;
    width = Math.max(minCropSize, Math.min(safeImageWidth, width));
    height = Math.max(minCropSize, Math.min(safeImageHeight, height));
    left = Math.max(0, Math.min(safeImageWidth - width, left));
    top = Math.max(0, Math.min(safeImageHeight - height, top));
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    };
  };
  const getImageCropFrameInViewport = (imageId) => {
    const imageNode = getImageById(imageId);
    const imageFrame = getImageFrameInViewport(imageId);
    if (!imageNode || !imageFrame) return null;
    const cropRect = getNormalizedImageCropRect(imageNode, imageFrame.width, imageFrame.height);
    return {
      imageId,
      x: imageFrame.x + cropRect.left,
      y: imageFrame.y + cropRect.top,
      width: cropRect.width,
      height: cropRect.height,
    };
  };
  const refreshActiveImageFrame = (imageId) => {
    const nextImageId = String(imageId || imageMenuState?.imageId || '').trim();
    if (!nextImageId) {
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      return;
    }
    const imageFrame = getImageFrameInViewport(nextImageId);
    setActiveImageFrame(imageFrame);
    const imageNode = getImageById(nextImageId);
    const cropEnabled = String(imageNode?.dataset?.cropMode || 'off') === 'on';
    if (cropEnabled && imageFrame) {
      setActiveCropFrame(getImageCropFrameInViewport(nextImageId));
    } else {
      setActiveCropFrame(null);
    }
  };

  const applyImageLayout = (imgElement, layout) => {
    if (!imgElement) return;
    const parsedX = Number.parseFloat(String(imgElement.dataset.posX || '24'));
    const parsedY = Number.parseFloat(String(imgElement.dataset.posY || '24'));
    const safeX = Number.isFinite(parsedX) ? parsedX : 24;
    const safeY = Number.isFinite(parsedY) ? parsedY : 24;
    const cropMode = String(imgElement.dataset.cropMode || 'off') === 'on';
    const naturalWidth = Number(imgElement.naturalWidth || 0);
    const naturalHeight = Number(imgElement.naturalHeight || 0);
    const aspectRatio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 0;
    const linkedUrl = String(imgElement.dataset.linkUrl || '').trim();
    imgElement.dataset.layout = layout || 'free';
    imgElement.dataset.posX = String(Math.max(0, safeX));
    imgElement.dataset.posY = String(Math.max(0, safeY));
    imgElement.style.maxWidth = 'unset';
    imgElement.style.maxHeight = 'unset';
    imgElement.style.borderRadius = '10px';
    imgElement.style.cursor = 'grab';
    imgElement.style.position = 'absolute';
    imgElement.style.left = `${Math.max(0, safeX)}px`;
    imgElement.style.top = `${Math.max(0, safeY)}px`;
    imgElement.style.zIndex = '20';
    imgElement.style.float = 'none';
    imgElement.style.margin = '0';
    imgElement.style.touchAction = 'manipulation';
    imgElement.style.resize = 'none';
    imgElement.style.overflow = 'visible';
    imgElement.style.minWidth = '40px';
    imgElement.style.minHeight = '40px';
    imgElement.style.userSelect = 'none';
    imgElement.style.pointerEvents = 'auto';
    imgElement.contentEditable = 'false';
    imgElement.style.display = 'block';
    imgElement.style.width = imgElement.style.width || '420px';
    if (cropMode) {
      imgElement.style.height = imgElement.style.height || '260px';
    } else if (aspectRatio > 0) {
      const widthPx = Math.max(
        40,
        Math.round(
          Number.parseFloat(String(imgElement.style.width || '420')) || imgElement.getBoundingClientRect().width || 420
        )
      );
      const nextHeight = Math.max(40, Math.round(widthPx / aspectRatio));
      imgElement.style.height = `${nextHeight}px`;
    } else {
      imgElement.style.height = 'auto';
    }
    imgElement.style.objectFit = 'contain';
    imgElement.style.objectPosition = 'center center';
    if (cropMode) {
      const elementWidth = Math.max(1, imgElement.getBoundingClientRect().width || imgElement.offsetWidth || 1);
      const elementHeight = Math.max(1, imgElement.getBoundingClientRect().height || imgElement.offsetHeight || 1);
      const cropRect = getNormalizedImageCropRect(imgElement, elementWidth, elementHeight);
      const cropRight = Math.max(0, elementWidth - cropRect.left - cropRect.width);
      const cropBottom = Math.max(0, elementHeight - cropRect.top - cropRect.height);
      imgElement.dataset.cropLeft = String(cropRect.left);
      imgElement.dataset.cropTop = String(cropRect.top);
      imgElement.dataset.cropWidth = String(cropRect.width);
      imgElement.dataset.cropHeight = String(cropRect.height);
      imgElement.style.clipPath = `inset(${cropRect.top}px ${cropRight}px ${cropBottom}px ${cropRect.left}px round 10px)`;
    } else {
      imgElement.style.clipPath = 'none';
    }
    if (linkedUrl) {
      imgElement.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(37, 99, 235, 0.2)';
    } else {
      imgElement.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.18)';
    }
  };

  const normalizeColorHexValue = (value, fallback = '#000000') => {
    const fallbackHex = String(fallback || '#000000').trim().toLowerCase();
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return fallbackHex;
    const transparentRaw = raw.replace(/\s+/g, '');
    if (
      transparentRaw === 'transparent' ||
      transparentRaw === 'rgba(0,0,0,0)' ||
      transparentRaw === 'rgb(0,0,0,0)' ||
      /^rgba\(\d{1,3},\d{1,3},\d{1,3},0(?:\.0+)?\)$/.test(transparentRaw)
    ) {
      return 'transparent';
    }
    const shortHexMatch = raw.match(/^#([0-9a-f]{3})$/i);
    if (shortHexMatch) {
      const [r, g, b] = shortHexMatch[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    const fullHexMatch = raw.match(/^#([0-9a-f]{6})$/i);
    if (fullHexMatch) {
      return `#${fullHexMatch[1]}`.toLowerCase();
    }
    const rgbMatch = raw.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i
    );
    if (rgbMatch) {
      const toHex = (channelValue) => {
        const channel = Math.max(0, Math.min(255, Number.parseInt(channelValue, 10) || 0));
        return channel.toString(16).padStart(2, '0');
      };
      return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
    }
    return fallbackHex;
  };
  const normalizeDocTableScale = (value, fallback = 100, min = 1, max = 400) => {
    const parsed = Number.parseFloat(String(value || '').trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };
  const getDocTableCellPosition = (cellElement) => {
    if (!cellElement) return null;
    const row = Number.parseInt(String(cellElement.dataset.noteRow || ''), 10);
    const col = Number.parseInt(String(cellElement.dataset.noteCol || ''), 10);
    const rowSpan = Number.parseInt(String(cellElement.dataset.noteRowSpan || '1'), 10);
    const colSpan = Number.parseInt(String(cellElement.dataset.noteColSpan || '1'), 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return {
      row,
      col,
      rowSpan: Number.isFinite(rowSpan) && rowSpan > 0 ? rowSpan : 1,
      colSpan: Number.isFinite(colSpan) && colSpan > 0 ? colSpan : 1,
    };
  };
  const getDocTableSelectionBounds = (selectionInput) => {
    if (!selectionInput) return null;
    const startRow = Number.parseInt(String(selectionInput.startRow || '0'), 10);
    const startCol = Number.parseInt(String(selectionInput.startCol || '0'), 10);
    const endRow = Number.parseInt(String(selectionInput.endRow ?? startRow), 10);
    const endCol = Number.parseInt(String(selectionInput.endCol ?? startCol), 10);
    if (
      !Number.isFinite(startRow) ||
      !Number.isFinite(startCol) ||
      !Number.isFinite(endRow) ||
      !Number.isFinite(endCol)
    ) {
      return null;
    }
    return {
      minRow: Math.min(startRow, endRow),
      maxRow: Math.max(startRow, endRow),
      minCol: Math.min(startCol, endCol),
      maxCol: Math.max(startCol, endCol),
    };
  };
  const normalizeDocTableStructure = (tableElement) => {
    if (!tableElement) return;
    tableElement.setAttribute('data-note-inline-table', 'true');
    if (!tableElement.dataset.noteTableId) {
      tableElement.dataset.noteTableId = `table-${generateId()}`;
    }
    tableElement.dataset.noteTableScale = String(
      Math.round(normalizeDocTableScale(tableElement.dataset.noteTableScale || '100'))
    );
    tableElement.dataset.noteTablePageAlign = normalizeDocTablePageAlign(
      tableElement.dataset.noteTablePageAlign || 'left',
      'left'
    );
    tableElement.dataset.noteTableWrap = String(
      normalizeDocTableWrapValue(tableElement.dataset.noteTableWrap, false)
    );
    const occupiedCells = [];
    const tableRows = Array.from(tableElement.rows || []);
    tableRows.forEach((rowElement, rowIndex) => {
      let colCursor = 0;
      const rowCells = Array.from(rowElement.cells || []);
      rowCells.forEach((cellElement) => {
        while (occupiedCells[rowIndex]?.[colCursor]) {
          colCursor += 1;
        }
        const rowSpanRaw = Number.parseInt(
          String(cellElement.getAttribute('rowspan') || cellElement.rowSpan || '1'),
          10
        );
        const colSpanRaw = Number.parseInt(
          String(cellElement.getAttribute('colspan') || cellElement.colSpan || '1'),
          10
        );
        const rowSpan = Number.isFinite(rowSpanRaw) && rowSpanRaw > 0 ? rowSpanRaw : 1;
        const colSpan = Number.isFinite(colSpanRaw) && colSpanRaw > 0 ? colSpanRaw : 1;
        cellElement.dataset.noteTableCell = 'true';
        cellElement.dataset.noteRow = String(rowIndex);
        cellElement.dataset.noteCol = String(colCursor);
        cellElement.dataset.noteRowSpan = String(rowSpan);
        cellElement.dataset.noteColSpan = String(colSpan);
        for (let fillRow = rowIndex; fillRow < rowIndex + rowSpan; fillRow += 1) {
          if (!occupiedCells[fillRow]) occupiedCells[fillRow] = [];
          for (let fillCol = colCursor; fillCol < colCursor + colSpan; fillCol += 1) {
            occupiedCells[fillRow][fillCol] = true;
          }
        }
        colCursor += colSpan;
      });
    });
  };
  const getDocTableCellsInBounds = (tableElement, boundsInput) => {
    if (!tableElement || !boundsInput) return [];
    const cells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    return cells.filter((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      if (!pos) return false;
      const endRow = pos.row + Math.max(1, pos.rowSpan) - 1;
      const endCol = pos.col + Math.max(1, pos.colSpan) - 1;
      return (
        pos.row <= boundsInput.maxRow &&
        endRow >= boundsInput.minRow &&
        pos.col <= boundsInput.maxCol &&
        endCol >= boundsInput.minCol
      );
    });
  };
  const getDocTableCellAtCoordinate = (tableElement, rowInput, colInput) => {
    if (!tableElement) return null;
    const row = Number.parseInt(String(rowInput), 10);
    const col = Number.parseInt(String(colInput), 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    const cells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    return (
      cells.find((cellElement) => {
        const pos = getDocTableCellPosition(cellElement);
        return pos && pos.row === row && pos.col === col;
      }) || null
    );
  };
  const getDocTableElementById = (tableIdInput) => {
    const tableId = String(tableIdInput || '').trim();
    if (!tableId || !editorRef.current) return null;
    return editorRef.current.querySelector(
      `table[data-note-inline-table="true"][data-note-table-id="${tableId}"]`
    );
  };
  const clearDocTableSelectionVisuals = () => {
    if (!editorRef.current) return;
    const activeTables = editorRef.current.querySelectorAll(
      'table[data-note-inline-table="true"][data-note-table-active]'
    );
    activeTables.forEach((tableElement) => {
      tableElement.removeAttribute('data-note-table-active');
      tableElement.removeAttribute('data-note-table-single-selection');
    });
    const selectedCells = editorRef.current.querySelectorAll('[data-note-table-selected]');
    selectedCells.forEach((cellElement) => {
      cellElement.removeAttribute('data-note-table-selected');
    });
    const rangeCells = editorRef.current.querySelectorAll(
      '[data-note-table-range-top], [data-note-table-range-right], [data-note-table-range-bottom], [data-note-table-range-left]'
    );
    rangeCells.forEach((cellElement) => {
      cellElement.removeAttribute('data-note-table-range-top');
      cellElement.removeAttribute('data-note-table-range-right');
      cellElement.removeAttribute('data-note-table-range-bottom');
      cellElement.removeAttribute('data-note-table-range-left');
    });
  };
  const getDocTableCellAlignValue = (cellElement) => {
    if (!cellElement) {
      return { horizontal: 'left', vertical: 'top' };
    }
    const computedStyle = window.getComputedStyle(cellElement);
    return {
      horizontal: normalizeDocTableHorizontalAlign(
        cellElement.style.textAlign || computedStyle.textAlign || 'left'
      ),
      vertical: normalizeDocTableVerticalAlign(
        cellElement.style.verticalAlign || computedStyle.verticalAlign || 'top'
      ),
    };
  };
  const getDocTablePageAlignFromTable = (tableElement) => {
    if (!tableElement) return 'left';
    const datasetAlign = normalizeDocTablePageAlign(tableElement.dataset.noteTablePageAlign || '', '');
    if (datasetAlign) return datasetAlign;
    const computedStyle = window.getComputedStyle(tableElement);
    const marginLeft = String(tableElement.style.marginLeft || computedStyle.marginLeft || '').trim().toLowerCase();
    const marginRight = String(tableElement.style.marginRight || computedStyle.marginRight || '').trim().toLowerCase();
    if (marginLeft === 'auto' && marginRight === 'auto') return 'center';
    if (marginLeft === 'auto') return 'right';
    return 'left';
  };
  const getDocTableContentLockFromTable = (tableElement) =>
    String(tableElement?.dataset?.noteTableLockSize || '').trim().toLowerCase() === 'true';
  const getDocTableWrapFromTable = (tableElement) =>
    normalizeDocTableWrapValue(tableElement?.dataset?.noteTableWrap, false);
  const syncDocTableToolbarColorsFromCell = (cellElement) => {
    if (!cellElement) return;
    const computedStyle = window.getComputedStyle(cellElement);
    const bgColor = normalizeColorHexValue(
      cellElement.style.backgroundColor || '#ffffff',
      '#ffffff'
    );
    const borderColor = normalizeColorHexValue(
      cellElement.style.borderColor || computedStyle.borderTopColor || computedStyle.borderColor || '',
      '#cbd5e1'
    );
    const borderLineStyle = normalizeDocTableBorderLineStyle(
      cellElement.style.borderTopStyle ||
        cellElement.style.borderStyle ||
        computedStyle.borderTopStyle ||
        computedStyle.borderStyle ||
        'solid',
      'solid'
    );
    const borderLineWidth = normalizeDocTableBorderLineWidth(
      cellElement.style.borderTopWidth ||
        cellElement.style.borderWidth ||
        computedStyle.borderTopWidth ||
        computedStyle.borderWidth ||
        '1',
      1
    );
    const alignValue = getDocTableCellAlignValue(cellElement);
    const tableElement = cellElement.closest('table[data-note-inline-table="true"]');
    setDocTableFillColorValue(bgColor);
    setDocTableBorderColorValue(borderColor);
    setDocTableBorderLineStyleValue(borderLineStyle);
    setDocTableBorderLineWidthValue(String(borderLineWidth));
    setDocTableCellAlignValue(alignValue);
    setDocTablePageAlignValue(getDocTablePageAlignFromTable(tableElement));
    setDocTableContentLockEnabled(getDocTableContentLockFromTable(tableElement));
    setDocTableWrapEnabled(getDocTableWrapFromTable(tableElement));
  };
  const applyDocTableSelectionVisual = (selectionInput) => {
    clearDocTableSelectionVisuals();
    const tableId = String(selectionInput?.tableId || '').trim();
    if (!tableId) return false;
    const tableElement = getDocTableElementById(tableId);
    if (!tableElement) return false;
    normalizeDocTableStructure(tableElement);
    const bounds = getDocTableSelectionBounds(selectionInput);
    if (!bounds) return false;
    const selectedCells = getDocTableCellsInBounds(tableElement, bounds);
    if (!selectedCells.length) return false;
    tableElement.dataset.noteTableActive = 'true';
    const isSingleSelection = selectedCells.length === 1;
    if (isSingleSelection) {
      tableElement.dataset.noteTableSingleSelection = 'true';
    } else {
      tableElement.removeAttribute('data-note-table-single-selection');
    }
    selectedCells.forEach((cellElement) => {
      cellElement.dataset.noteTableSelected = 'true';
      if (isSingleSelection) return;
      const pos = getDocTableCellPosition(cellElement);
      if (!pos) return;
      const endRow = pos.row + Math.max(1, pos.rowSpan) - 1;
      const endCol = pos.col + Math.max(1, pos.colSpan) - 1;
      if (pos.row <= bounds.minRow && endRow >= bounds.minRow) {
        cellElement.dataset.noteTableRangeTop = 'true';
      }
      if (pos.col <= bounds.minCol && endCol >= bounds.minCol) {
        cellElement.dataset.noteTableRangeLeft = 'true';
      }
      if (pos.row <= bounds.maxRow && endRow >= bounds.maxRow) {
        cellElement.dataset.noteTableRangeBottom = 'true';
      }
      if (pos.col <= bounds.maxCol && endCol >= bounds.maxCol) {
        cellElement.dataset.noteTableRangeRight = 'true';
      }
    });
    syncDocTableToolbarColorsFromCell(selectedCells[0]);
    setDocTableScaleDraft(
      String(Math.round(normalizeDocTableScale(tableElement.dataset.noteTableScale || '100')))
    );
    return true;
  };
  const applyDocTableSelectionByRange = (tableElement, startRow, startCol, endRow, endCol) => {
    if (!tableElement) return null;
    normalizeDocTableStructure(tableElement);
    const tableId = String(tableElement.dataset.noteTableId || '').trim();
    if (!tableId) return null;
    const nextSelection = {
      tableId,
      startRow: Number.parseInt(String(startRow || '0'), 10) || 0,
      startCol: Number.parseInt(String(startCol || '0'), 10) || 0,
      endRow: Number.parseInt(String(endRow || '0'), 10) || 0,
      endCol: Number.parseInt(String(endCol || '0'), 10) || 0,
    };
    setDocTableSelectionState(nextSelection);
    applyDocTableSelectionVisual(nextSelection);
    scheduleDocTableCaretPlacement(nextSelection);
    return nextSelection;
  };
  const clearDocTableSelection = () => {
    docTableRangeDragRef.current.active = false;
    docTableRangeDragRef.current.tableId = '';
    docTableRangeDragRef.current.hasMoved = false;
    docTableCornerResizeRef.current.active = false;
    docTableCornerResizeRef.current.tableId = '';
    docTableCornerResizeRef.current.hasMoved = false;
    clearDocTableSelectionVisuals();
    setDocTableSelectionState(null);
    setActiveDocTableResizeFrame(null);
    setIsDocTableFillColorPickerOpen(false);
    setIsDocTableBorderColorPickerOpen(false);
    setIsDocTableCellAlignMenuOpen(false);
    setIsDocTableResizeMenuOpen(false);
    setIsDocTableExtraToolsMenuOpen(false);
  };
  const getDocTableDimensions = (tableElement) => {
    if (!tableElement) return { rows: 1, cols: 1 };
    normalizeDocTableStructure(tableElement);
    const cells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    if (!cells.length) return { rows: 1, cols: 1 };
    let maxRowExclusive = 1;
    let maxColExclusive = 1;
    cells.forEach((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      if (!pos) return;
      maxRowExclusive = Math.max(maxRowExclusive, pos.row + Math.max(1, pos.rowSpan));
      maxColExclusive = Math.max(maxColExclusive, pos.col + Math.max(1, pos.colSpan));
    });
    return {
      rows: Math.max(1, maxRowExclusive),
      cols: Math.max(1, maxColExclusive),
    };
  };
  const getDocTableSelectionSnapshot = () => {
    if (!docTableSelectionState?.tableId) return null;
    const tableElement = getDocTableElementById(docTableSelectionState.tableId);
    if (!tableElement) return null;
    normalizeDocTableStructure(tableElement);
    const bounds = getDocTableSelectionBounds(docTableSelectionState);
    if (!bounds) return null;
    const selectedCells = getDocTableCellsInBounds(tableElement, bounds).sort((leftCell, rightCell) => {
      const leftPos = getDocTableCellPosition(leftCell) || { row: 0, col: 0 };
      const rightPos = getDocTableCellPosition(rightCell) || { row: 0, col: 0 };
      if (leftPos.row !== rightPos.row) return leftPos.row - rightPos.row;
      return leftPos.col - rightPos.col;
    });
    if (!selectedCells.length) return null;
    return {
      tableElement,
      bounds,
      selectedCells,
    };
  };
  const getDocTableSelectionFrameInViewport = (selectionInput = docTableSelectionState) => {
    const selectionState = selectionInput || docTableSelectionState;
    const tableId = String(selectionState?.tableId || '').trim();
    if (!tableId) return null;
    const tableElement = getDocTableElementById(tableId);
    if (!tableElement) return null;
    normalizeDocTableStructure(tableElement);
    const bounds = getDocTableSelectionBounds(selectionState);
    if (!bounds) return null;
    const selectedCells = getDocTableCellsInBounds(tableElement, bounds);
    if (!selectedCells.length) return null;
    const viewportNode = docViewportRef.current || editorContainerRef.current;
    if (!viewportNode) return null;
    const viewportRect = viewportNode.getBoundingClientRect();
    const viewportScrollLeft = Number(viewportNode.scrollLeft || 0);
    const viewportScrollTop = Number(viewportNode.scrollTop || 0);
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    selectedCells.forEach((cellElement) => {
      const cellRect = cellElement.getBoundingClientRect();
      if (!Number.isFinite(cellRect.left) || !Number.isFinite(cellRect.top)) return;
      minLeft = Math.min(minLeft, cellRect.left);
      minTop = Math.min(minTop, cellRect.top);
      maxRight = Math.max(maxRight, cellRect.right);
      maxBottom = Math.max(maxBottom, cellRect.bottom);
    });
    if (
      !Number.isFinite(minLeft) ||
      !Number.isFinite(minTop) ||
      !Number.isFinite(maxRight) ||
      !Number.isFinite(maxBottom)
    ) {
      return null;
    }
    return {
      tableId,
      x: minLeft - viewportRect.left + viewportScrollLeft,
      y: minTop - viewportRect.top + viewportScrollTop,
      width: Math.max(1, maxRight - minLeft),
      height: Math.max(1, maxBottom - minTop),
    };
  };
  const getDocTableCellFromTarget = (targetNode) => {
    if (!editorRef.current) return null;
    const elementTarget =
      typeof Element !== 'undefined' && targetNode instanceof Element
        ? targetNode
        : targetNode && targetNode.parentElement instanceof Element
        ? targetNode.parentElement
        : null;
    if (!elementTarget) return null;
    const cellElement = elementTarget.closest('td, th');
    if (!cellElement || !editorRef.current.contains(cellElement)) return null;
    const tableElement = cellElement.closest('table[data-note-inline-table="true"]');
    if (!tableElement || !editorRef.current.contains(tableElement)) return null;
    normalizeDocTableStructure(tableElement);
    return cellElement;
  };
  const placeDocTableCaretFromSelection = (selectionInput) => {
    if (!isActiveDocPage || !editorRef.current) return false;
    const tableId = String(selectionInput?.tableId || '').trim();
    if (!tableId) return false;
    const bounds = getDocTableSelectionBounds(selectionInput);
    if (!bounds) return false;
    if (bounds.minRow !== bounds.maxRow || bounds.minCol !== bounds.maxCol) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      return false;
    }
    const tableElement = getDocTableElementById(tableId);
    if (!tableElement) return false;
    normalizeDocTableStructure(tableElement);
    const preferredRow = Number.parseInt(
      String(selectionInput?.endRow ?? bounds.maxRow),
      10
    );
    const preferredCol = Number.parseInt(
      String(selectionInput?.endCol ?? bounds.maxCol),
      10
    );
    const targetRow = Number.isFinite(preferredRow) ? preferredRow : bounds.maxRow;
    const targetCol = Number.isFinite(preferredCol) ? preferredCol : bounds.maxCol;
    const targetCell =
      getDocTableCellAtCoordinate(tableElement, targetRow, targetCol) ||
      getDocTableCellAtCoordinate(tableElement, bounds.minRow, bounds.minCol);
    if (!targetCell) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    try {
      editorRef.current.focus({ preventScroll: true });
    } catch {
      editorRef.current.focus();
    }
    const range = document.createRange();
    const normalizedHtml = String(targetCell.innerHTML || '').trim().toLowerCase();
    if (!normalizedHtml || normalizedHtml === '<br>') {
      range.setStart(targetCell, 0);
    } else {
      range.selectNodeContents(targetCell);
      range.collapse(false);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };
  const scheduleDocTableCaretPlacement = (selectionInput) => {
    const nextSelection = selectionInput || docTableSelectionState;
    if (!nextSelection) return;
    window.requestAnimationFrame(() => {
      placeDocTableCaretFromSelection(nextSelection);
    });
  };
  const setDocTableCellPlainText = (cellElement, textValue) => {
    if (!cellElement) return;
    const safeText = String(textValue || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').slice(0, 2000);
    if (!safeText) {
      cellElement.innerHTML = '<br>';
      return;
    }
    const lines = safeText.split('\n');
    const html = lines
      .map((lineValue) =>
        String(lineValue || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      )
      .join('<br>');
    cellElement.innerHTML = html;
  };
  const getDocTableCellPlainText = (cellElement) => {
    if (!cellElement) return '';
    const readNodeText = (node) => {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return String(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      const elementNode = node;
      const tagName = String(elementNode.tagName || '').toLowerCase();
      if (tagName === 'br') {
        return '\n';
      }
      let textValue = '';
      elementNode.childNodes.forEach((childNode) => {
        textValue += readNodeText(childNode);
      });
      const blockTags = new Set([
        'p',
        'div',
        'li',
        'ul',
        'ol',
        'pre',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ]);
      if (blockTags.has(tagName) && textValue && !textValue.endsWith('\n')) {
        textValue += '\n';
      }
      return textValue;
    };
    const raw = readNodeText(cellElement);
    return raw
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '');
  };
  const applyTextToSelectedDocTableCells = (nextText, mode = 'replace') => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return false;
    const safeMode = ['replace', 'append', 'backspace', 'clear'].includes(mode) ? mode : 'replace';
    selectionSnapshot.selectedCells.forEach((cellElement) => {
      const currentText = getDocTableCellPlainText(cellElement);
      if (safeMode === 'clear') {
        setDocTableCellPlainText(cellElement, '');
        return;
      }
      if (safeMode === 'append') {
        setDocTableCellPlainText(cellElement, `${currentText}${String(nextText || '')}`);
        return;
      }
      if (safeMode === 'backspace') {
        setDocTableCellPlainText(cellElement, currentText.slice(0, -1));
        return;
      }
      setDocTableCellPlainText(cellElement, nextText);
    });
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
    if (docTableSelectionState) {
      scheduleDocTableCaretPlacement(docTableSelectionState);
    }
    return true;
  };
  const pasteTextIntoDocTableSelection = (rawText) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return false;
    const normalizedText = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalizedText) return false;
    const rows = normalizedText.split('\n');
    if (rows.length > 1 && rows[rows.length - 1] === '') {
      rows.pop();
    }
    const matrix = rows.map((line) => line.split('\t'));
    if (!matrix.length) return false;
    const { tableElement, bounds } = selectionSnapshot;
    normalizeDocTableStructure(tableElement);
    const tableDimensions = getDocTableDimensions(tableElement);
    const startRow = bounds.minRow;
    const startCol = bounds.minCol;
    matrix.forEach((rowValues, rowOffset) => {
      const row = startRow + rowOffset;
      if (row >= tableDimensions.rows) return;
      rowValues.forEach((value, colOffset) => {
        const col = startCol + colOffset;
        if (col >= tableDimensions.cols) return;
        const targetCell = getDocTableCellAtCoordinate(tableElement, row, col);
        if (!targetCell) return;
        setDocTableCellPlainText(targetCell, String(value || ''));
      });
    });
    const pastedMaxRow = Math.min(tableDimensions.rows - 1, startRow + matrix.length - 1);
    const widestColCount = matrix.reduce((maxColCount, rowValues) => Math.max(maxColCount, rowValues.length), 1);
    const pastedMaxCol = Math.min(tableDimensions.cols - 1, startCol + widestColCount - 1);
    const nextSelection = applyDocTableSelectionByRange(
      tableElement,
      startRow,
      startCol,
      pastedMaxRow,
      pastedMaxCol
    );
    handleInput();
    if (nextSelection) {
      applyDocTableSelectionVisual(nextSelection);
      scheduleDocTableCaretPlacement(nextSelection);
    }
    return true;
  };
  const beginDocTableRangeSelection = (cellElement) => {
    if (!isActiveDocPage || !cellElement) return;
    const tableElement = cellElement.closest('table[data-note-inline-table="true"]');
    if (!tableElement || !editorRef.current?.contains(tableElement)) return;
    normalizeDocTableStructure(tableElement);
    const pos = getDocTableCellPosition(cellElement);
    const tableId = String(tableElement.dataset.noteTableId || '').trim();
    if (!pos || !tableId) return;
    docTableRangeDragRef.current = {
      active: true,
      tableId,
      startRow: pos.row,
      startCol: pos.col,
      endRow: pos.row,
      endCol: pos.col,
      hasMoved: false,
    };
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    setIsDocInsertTableMenuOpen(false);
    applyDocTableSelectionByRange(tableElement, pos.row, pos.col, pos.row, pos.col);
  };
  const extendDocTableRangeSelection = (cellElement) => {
    const dragState = docTableRangeDragRef.current;
    if (!dragState?.active || !cellElement) return;
    const tableElement = cellElement.closest('table[data-note-inline-table="true"]');
    if (!tableElement) return;
    normalizeDocTableStructure(tableElement);
    const tableId = String(tableElement.dataset.noteTableId || '').trim();
    if (!tableId || tableId !== dragState.tableId) return;
    const pos = getDocTableCellPosition(cellElement);
    if (!pos) return;
    if (pos.row === dragState.endRow && pos.col === dragState.endCol) return;
    dragState.hasMoved = true;
    dragState.endRow = pos.row;
    dragState.endCol = pos.col;
    applyDocTableSelectionByRange(
      tableElement,
      dragState.startRow,
      dragState.startCol,
      pos.row,
      pos.col
    );
  };
  const endDocTableRangeSelection = () => {
    const dragState = docTableRangeDragRef.current;
    if (!dragState.active) return;
    const shouldPlaceCaret = !dragState.hasMoved;
    const finalSelection = {
      tableId: dragState.tableId,
      startRow: dragState.startRow,
      startCol: dragState.startCol,
      endRow: dragState.endRow,
      endCol: dragState.endCol,
    };
    docTableRangeDragRef.current.active = false;
    if (shouldPlaceCaret) {
      scheduleDocTableCaretPlacement(finalSelection);
    }
  };

  const normalizeEditorImages = () => {
    if (!editorRef.current) return;
    editorRef.current.style.position = 'relative';
    const images = editorRef.current.querySelectorAll('img');
    images.forEach((imgElement) => {
      if (!imgElement.dataset.noteImageId) {
        imgElement.dataset.noteImageId = `img-${generateId()}`;
      }
      imgElement.setAttribute('draggable', 'true');
      applyImageLayout(imgElement, imgElement.dataset.layout || 'free');
    });
    const links = editorRef.current.querySelectorAll('a[href]');
    links.forEach((linkNode) => {
      if (!linkNode.dataset.noteLinkId) {
        linkNode.dataset.noteLinkId = `link-${generateId()}`;
      }
      linkNode.target = '_blank';
      linkNode.rel = 'noopener noreferrer';
    });
    const tables = editorRef.current.querySelectorAll('table[data-note-inline-table="true"]');
    tables.forEach((tableElement) => {
      normalizeDocTableStructure(tableElement);
    });
    const selectedImageId = String(imageMenuState?.imageId || '').trim();
    setSelectedImageVisual(selectedImageId);
    syncEditorCanvasMetrics();
    if (selectedImageId) {
      refreshActiveImageFrame(selectedImageId);
    }
  };
  const syncActiveFormats = () => {
    if (!isActiveDocPage) {
      setActiveFormats({
        bold: false,
        italic: false,
        underline: false,
        highlight: false,
      });
      return;
    }
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) {
      setActiveFormats({
        bold: false,
        italic: false,
        underline: false,
        highlight: false,
      });
      return;
    }

    const queryState = (command) => {
      try {
        return Boolean(document.queryCommandState(command));
      } catch {
        return false;
      }
    };
    const isTransparentHighlightColor = (value) => {
      const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
      if (!normalized) return true;
      return (
        normalized === 'transparent' ||
        normalized === 'rgba(0,0,0,0)' ||
        normalized === 'rgb(0,0,0,0)' ||
        normalized === 'inherit' ||
        normalized === 'initial' ||
        normalized === 'unset'
      );
    };
    const detectUnderlineFromSelectionStyle = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.rangeCount === 0) return false;
      let node = activeSelection.anchorNode;
      if (!node) return false;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elementNode = node;
          if (String(elementNode.tagName || '').toLowerCase() === 'u') {
            return true;
          }
          const inlineDecoration = String(
            elementNode.style?.textDecorationLine || elementNode.style?.textDecoration || ''
          ).toLowerCase();
          if (inlineDecoration.includes('underline')) {
            return true;
          }
          const computedDecoration = String(
            window.getComputedStyle(elementNode).textDecorationLine || ''
          ).toLowerCase();
          if (computedDecoration.includes('underline')) {
            return true;
          }
        }
        node = node.parentNode;
      }
      return false;
    };
    const isUnderlinedNow = queryState('underline') || detectUnderlineFromSelectionStyle();
    const detectHighlightFromSelectionStyle = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.rangeCount === 0) return false;
      try {
        const queryHighlightValue = String(
          document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || ''
        );
        if (!isTransparentHighlightColor(queryHighlightValue)) {
          return true;
        }
      } catch {
        // Ignore unsupported command.
      }
      const editorBackground = String(window.getComputedStyle(editor).backgroundColor || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
      let node = activeSelection.anchorNode;
      if (!node) return false;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elementNode = node;
          if (String(elementNode.tagName || '').toLowerCase() === 'mark') {
            return true;
          }
          const inlineBg = String(elementNode.style?.backgroundColor || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
          if (!isTransparentHighlightColor(inlineBg)) {
            return true;
          }
          const computedBg = String(window.getComputedStyle(elementNode).backgroundColor || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
          if (!isTransparentHighlightColor(computedBg) && computedBg !== editorBackground) {
            return true;
          }
        }
        node = node.parentNode;
      }
      return false;
    };
    const isHighlightedNow = detectHighlightFromSelectionStyle();

    setActiveFormats({
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: isUnderlinedNow,
      highlight: isHighlightedNow,
    });
  };
  const getSanitizedDocEditorHtml = () => {
    if (!editorRef.current) return '';
    const clone = editorRef.current.cloneNode(true);
    clone.querySelectorAll('[data-note-table-selected]').forEach((cellElement) => {
      cellElement.removeAttribute('data-note-table-selected');
    });
    clone
      .querySelectorAll(
        '[data-note-table-range-top], [data-note-table-range-right], [data-note-table-range-bottom], [data-note-table-range-left]'
      )
      .forEach((cellElement) => {
        cellElement.removeAttribute('data-note-table-range-top');
        cellElement.removeAttribute('data-note-table-range-right');
        cellElement.removeAttribute('data-note-table-range-bottom');
        cellElement.removeAttribute('data-note-table-range-left');
      });
    clone
      .querySelectorAll('table[data-note-inline-table="true"][data-note-table-active]')
      .forEach((tableElement) => {
        tableElement.removeAttribute('data-note-table-active');
      });
    clone.querySelectorAll('[data-note-table-cell]').forEach((cellElement) => {
      cellElement.removeAttribute('data-note-table-cell');
      cellElement.removeAttribute('data-note-row');
      cellElement.removeAttribute('data-note-col');
      cellElement.removeAttribute('data-note-row-span');
      cellElement.removeAttribute('data-note-col-span');
    });
    return clone.innerHTML;
  };

  const handleInput = () => {
    if (!isActiveDocPage) return;
    normalizeEditorImages();
    if (editorRef.current) {
      const nextContent = getSanitizedDocEditorHtml();
      updateActivePage((page) => ({
        ...page,
        content: nextContent,
      }));
    }
    syncActiveFormats();
    schedulePresenceUpdate(getEditorTypingPreview());
  };

  const openImageMenu = (imgElement) => {
    if (!imgElement || !editorContainerRef.current) return;
    const container = editorContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imageRect = imgElement.getBoundingClientRect();
    const rawX = imageRect.left - containerRect.left + editorContainerRef.current.scrollLeft;
    const rawY = imageRect.bottom - containerRect.top + editorContainerRef.current.scrollTop + 8;
    const maxX = Math.max(8, container.clientWidth - 360);
    const imageId = String(imgElement.dataset.noteImageId || '').trim();
    const linkedUrl = String(imgElement.dataset.linkUrl || '').trim();
    const cropModeOn = String(imgElement.dataset.cropMode || 'off') === 'on';
    setImageMenuState({
      imageId,
      linkedUrl,
      isLinked: Boolean(linkedUrl),
      x: Math.min(Math.max(8, rawX), maxX),
      y: Math.max(8, rawY),
    });
    setImageCropModeId(cropModeOn ? imageId : '');
    setSelectedImageVisual(imageId);
    setDocLinkMenuState(null);
    refreshActiveImageFrame(imageId);
  };

  const getCaretRangeFromPoint = (clientX, clientY) => {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(clientX, clientY);
    }
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (position) {
        const range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
      }
    }
    return null;
  };

  const placeImageAtPoint = (imageId, clientX, clientY) => {
    if (!editorRef.current || !imageId) return null;
    const editor = editorRef.current;
    const movingImage = getImageById(imageId);
    if (!movingImage) return null;
    if (movingImage.parentElement !== editor) {
      editor.appendChild(movingImage);
    }
    const editorRect = editor.getBoundingClientRect();
    const targetX = clientX - editorRect.left + editor.scrollLeft - movingImage.offsetWidth / 2;
    const targetY = clientY - editorRect.top + editor.scrollTop - movingImage.offsetHeight / 2;
    movingImage.dataset.posX = String(Math.max(0, targetX));
    movingImage.dataset.posY = String(Math.max(0, targetY));
    movingImage.style.left = `${Math.max(0, targetX)}px`;
    movingImage.style.top = `${Math.max(0, targetY)}px`;
    movingImage.style.position = 'absolute';
    movingImage.style.zIndex = '20';
    syncEditorCanvasMetrics();
    refreshActiveImageFrame(imageId);

    return movingImage;
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('Missing image file.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const resultSrc = typeof reader.result === 'string' ? reader.result : '';
        if (!resultSrc) {
          reject(new Error('Could not read image data.'));
          return;
        }
        resolve(resultSrc);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed reading image file.'));
      reader.readAsDataURL(file);
    });
  const extractImageSrcFromHtmlClipboard = (htmlText) => {
    const rawHtml = String(htmlText || '').trim();
    if (!rawHtml) return '';
    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(rawHtml, 'text/html');
      const imageNode = documentNode.querySelector('img[src]');
      return String(imageNode?.getAttribute('src') || '').trim();
    } catch {
      return '';
    }
  };
  const buildImageClipboardPayload = (imageNode) => {
    if (!imageNode) return null;
    const rect = imageNode.getBoundingClientRect();
    const widthValue = String(imageNode.style.width || '').trim();
    const heightValue = String(imageNode.style.height || '').trim();
    const width = widthValue || `${Math.max(40, Math.round(rect.width || 420))}px`;
    const height = heightValue || `${Math.max(40, Math.round(rect.height || 260))}px`;
    const src = String(imageNode.getAttribute('src') || imageNode.src || '').trim();
    if (!src) return null;
    const datasetKeys = [
      'layout',
      'linkUrl',
      'cropCommitted',
      'cropOriginalSrc',
      'cropRatioLeft',
      'cropRatioTop',
      'cropRatioWidth',
      'cropRatioHeight',
    ];
    const data = {};
    datasetKeys.forEach((key) => {
      const value = String(imageNode.dataset?.[key] || '').trim();
      if (value) {
        data[key] = value;
      }
    });
    return {
      src,
      width,
      height,
      alt: String(imageNode.getAttribute('alt') || 'uploaded-note-image').trim() || 'uploaded-note-image',
      data,
    };
  };
  const applyImageClipboardPayload = (imageNode, payloadInput) => {
    if (!imageNode || !payloadInput || typeof payloadInput !== 'object') return;
    const payload = payloadInput;
    const width = String(payload.width || '').trim();
    const height = String(payload.height || '').trim();
    const alt = String(payload.alt || '').trim();
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    if (width) {
      imageNode.style.width = width;
    }
    if (height) {
      imageNode.style.height = height;
    }
    if (alt) {
      imageNode.alt = alt;
    }
    Object.entries(data).forEach(([key, value]) => {
      const safeValue = String(value || '').trim();
      if (safeValue) {
        imageNode.dataset[key] = safeValue;
      }
    });
    imageNode.dataset.cropMode = 'off';
    applyImageLayout(imageNode, String(data.layout || imageNode.dataset.layout || 'free').trim() || 'free');
  };
  const insertImageAtCursor = (imageSrc, payloadInput = null) => {
    if (!editorRef.current || !imageSrc) return;
    const editor = editorRef.current;
    editor.focus();

    const imageNode = document.createElement('img');
    imageNode.src = imageSrc;
    imageNode.alt = 'uploaded-note-image';
    imageNode.dataset.noteImageId = `img-${generateId()}`;
    imageNode.setAttribute('draggable', 'true');
    const selection = window.getSelection();
    let initialX = 24;
    let initialY = 24;
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0).cloneRange();
      const rangeRect = range.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      if (rangeRect.width || rangeRect.height) {
        initialX = rangeRect.left - editorRect.left + editor.scrollLeft;
        initialY = rangeRect.bottom - editorRect.top + editor.scrollTop + 8;
      }
    }
    imageNode.dataset.posX = String(Math.max(0, initialX));
    imageNode.dataset.posY = String(Math.max(0, initialY));
    applyImageLayout(imageNode, 'free');
    if (payloadInput && typeof payloadInput === 'object') {
      applyImageClipboardPayload(imageNode, payloadInput);
    }
    editor.appendChild(imageNode);

    openImageMenu(imageNode);
    handleInput();
    return imageNode;
  };

  const handleUploadImage = (event) => {
    if (!isActiveDocPage) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const resultSrc = typeof reader.result === 'string' ? reader.result : '';
      if (!resultSrc) return;
      insertImageAtCursor(resultSrc);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const commitCropForImage = (imageNode, options = {}) => {
    const { persist = true, reopenMenu = false } = options;
    if (!imageNode) return false;
    const imageId = String(imageNode.dataset.noteImageId || '').trim();
    if (!imageId) return false;
    const isCropModeOn = String(imageNode.dataset.cropMode || 'off') === 'on';
    if (!isCropModeOn) {
      if (imageCropModeId === imageId) {
        setImageCropModeId('');
      }
      return false;
    }
    const frameRect = imageNode.getBoundingClientRect();
    const frameWidth = Math.max(1, Number(frameRect.width || 1));
    const frameHeight = Math.max(1, Number(frameRect.height || 1));
    const cropRect = getNormalizedImageCropRect(imageNode, frameWidth, frameHeight);
    const ratioLeft = cropRect.left / frameWidth;
    const ratioTop = cropRect.top / frameHeight;
    const ratioWidth = cropRect.width / frameWidth;
    const ratioHeight = cropRect.height / frameHeight;
    const existingOriginalSrc = String(imageNode.dataset.cropOriginalSrc || '').trim();
    const currentSrc = String(imageNode.getAttribute('src') || imageNode.src || '').trim();
    const originalSrc = existingOriginalSrc || currentSrc;
    if (originalSrc) {
      imageNode.dataset.cropOriginalSrc = originalSrc;
    }
    imageNode.dataset.cropRatioLeft = String(ratioLeft);
    imageNode.dataset.cropRatioTop = String(ratioTop);
    imageNode.dataset.cropRatioWidth = String(ratioWidth);
    imageNode.dataset.cropRatioHeight = String(ratioHeight);

    let committedSrc = currentSrc;
    try {
      const sourceWidth = Math.max(1, Number(imageNode.naturalWidth || 0));
      const sourceHeight = Math.max(1, Number(imageNode.naturalHeight || 0));
      if (sourceWidth > 0 && sourceHeight > 0) {
        const sourceX = Math.max(0, Math.min(sourceWidth - 1, Math.round(ratioLeft * sourceWidth)));
        const sourceY = Math.max(0, Math.min(sourceHeight - 1, Math.round(ratioTop * sourceHeight)));
        const sourceCropWidth = Math.max(
          1,
          Math.min(sourceWidth - sourceX, Math.round(ratioWidth * sourceWidth))
        );
        const sourceCropHeight = Math.max(
          1,
          Math.min(sourceHeight - sourceY, Math.round(ratioHeight * sourceHeight))
        );
        const canvas = document.createElement('canvas');
        canvas.width = sourceCropWidth;
        canvas.height = sourceCropHeight;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(
            imageNode,
            sourceX,
            sourceY,
            sourceCropWidth,
            sourceCropHeight,
            0,
            0,
            sourceCropWidth,
            sourceCropHeight
          );
          committedSrc = canvas.toDataURL('image/png');
        }
      }
    } catch {
      // Ignore crop export errors (for example unsupported cross-origin source).
    }
    if (committedSrc) {
      imageNode.src = committedSrc;
    }
    const committedWidth = Math.max(40, Math.round(cropRect.width));
    const committedHeight = Math.max(40, Math.round(cropRect.height));
    imageNode.dataset.cropCommitted = 'true';
    imageNode.dataset.cropMode = 'off';
    imageNode.dataset.cropLeft = '0';
    imageNode.dataset.cropTop = '0';
    imageNode.dataset.cropWidth = String(committedWidth);
    imageNode.dataset.cropHeight = String(committedHeight);
    imageNode.style.width = `${committedWidth}px`;
    imageNode.style.height = `${committedHeight}px`;
    imageNode.style.clipPath = 'none';
    setImageCropModeId('');
    applyImageLayout(imageNode, imageNode.dataset.layout || 'free');
    syncEditorCanvasMetrics();
    refreshActiveImageFrame(imageId);
    if (reopenMenu) {
      openImageMenu(imageNode);
    }
    if (persist) {
      handleInput();
    }
    return true;
  };
  const activateCropForImage = (imageNode) => {
    if (!imageNode) return;
    const imageId = String(imageNode.dataset.noteImageId || '').trim();
    if (!imageId) return;
    const visibleRect = imageNode.getBoundingClientRect();
    const visibleWidth = Math.max(1, Math.round(visibleRect.width || 1));
    const visibleHeight = Math.max(1, Math.round(visibleRect.height || 1));
    const isCommitted = String(imageNode.dataset.cropCommitted || 'false') === 'true';
    const storedOriginalSrc = String(imageNode.dataset.cropOriginalSrc || '').trim();
    const ratioLeft = Number.parseFloat(String(imageNode.dataset.cropRatioLeft || '0'));
    const ratioTop = Number.parseFloat(String(imageNode.dataset.cropRatioTop || '0'));
    const ratioWidth = Number.parseFloat(String(imageNode.dataset.cropRatioWidth || '1'));
    const ratioHeight = Number.parseFloat(String(imageNode.dataset.cropRatioHeight || '1'));
    const hasStoredRatios =
      Number.isFinite(ratioLeft) &&
      Number.isFinite(ratioTop) &&
      Number.isFinite(ratioWidth) &&
      Number.isFinite(ratioHeight) &&
      ratioWidth > 0.01 &&
      ratioHeight > 0.01;

    if (isCommitted && storedOriginalSrc && hasStoredRatios) {
      const fullFrameWidth = Math.max(48, Math.round(visibleWidth / Math.max(0.01, ratioWidth)));
      const fullFrameHeight = Math.max(48, Math.round(visibleHeight / Math.max(0.01, ratioHeight)));
      imageNode.src = storedOriginalSrc;
      imageNode.style.width = `${fullFrameWidth}px`;
      imageNode.style.height = `${fullFrameHeight}px`;
      imageNode.dataset.cropLeft = String(Math.max(0, Math.round(ratioLeft * fullFrameWidth)));
      imageNode.dataset.cropTop = String(Math.max(0, Math.round(ratioTop * fullFrameHeight)));
      imageNode.dataset.cropWidth = String(
        Math.max(24, Math.min(fullFrameWidth, Math.round(ratioWidth * fullFrameWidth)))
      );
      imageNode.dataset.cropHeight = String(
        Math.max(24, Math.min(fullFrameHeight, Math.round(ratioHeight * fullFrameHeight)))
      );
    } else {
      imageNode.dataset.cropLeft = String(
        Number.parseFloat(String(imageNode.dataset.cropLeft || '0')) || 0
      );
      imageNode.dataset.cropTop = String(
        Number.parseFloat(String(imageNode.dataset.cropTop || '0')) || 0
      );
      imageNode.dataset.cropWidth = String(
        Number.parseFloat(String(imageNode.dataset.cropWidth || `${visibleWidth}`)) || visibleWidth
      );
      imageNode.dataset.cropHeight = String(
        Number.parseFloat(String(imageNode.dataset.cropHeight || `${visibleHeight}`)) || visibleHeight
      );
    }
    imageNode.dataset.cropMode = 'on';
    applyImageLayout(imageNode, imageNode.dataset.layout || 'free');
    setImageCropModeId(imageId);
    syncEditorCanvasMetrics();
    refreshActiveImageFrame(imageId);
    openImageMenu(imageNode);
  };
  const handleCropImage = () => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const imageId = String(targetImage.dataset.noteImageId || '').trim();
    const currentlyInCropMode =
      imageCropModeId === imageId || String(targetImage.dataset.cropMode || 'off') === 'on';
    if (currentlyInCropMode) {
      commitCropForImage(targetImage, { persist: true, reopenMenu: true });
      return;
    }
    activateCropForImage(targetImage);
  };

  const getActiveSelectedImageId = () => {
    const imageIdFromMenu = String(imageMenuState?.imageId || '').trim();
    if (imageIdFromMenu) return imageIdFromMenu;
    const selectedImageNode =
      editorRef.current?.querySelector?.('img[data-note-image-id][data-note-image-selected="true"]') || null;
    return String(selectedImageNode?.dataset?.noteImageId || '').trim();
  };
  const handleDeleteImageById = (imageIdInput) => {
    const imageId = String(imageIdInput || '').trim();
    if (!imageId) return false;
    const targetImage = getImageById(imageId);
    if (!targetImage) return false;
    targetImage.remove();
    const activeMenuImageId = String(imageMenuState?.imageId || '').trim();
    if (!activeMenuImageId || activeMenuImageId === imageId) {
      setImageMenuState(null);
    }
    setActiveImageFrame(null);
    setActiveCropFrame(null);
    if (imageCropModeId === imageId) {
      setImageCropModeId('');
    }
    setSelectedImageVisual('');
    handleInput();
    return true;
  };
  const handleCopyOrCutImageById = async (imageIdInput, isCut) => {
    const imageId = String(imageIdInput || '').trim();
    if (!imageId) return;
    const targetImage = getImageById(imageId);
    if (!targetImage) return;
    const payload = buildImageClipboardPayload(targetImage);
    if (!payload) return;
    const token = `img-${generateId()}`;
    docImageClipboardRef.current = {
      token,
      payload,
      cut: Boolean(isCut),
      createdAt: Date.now(),
    };
    const clipboardMarker = `${NOTE_IMAGE_CLIPBOARD_PREFIX}${token}`;
    let wroteClipboard = false;
    try {
      if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        const response = await fetch(payload.src);
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          const clipboardType = String(blob.type || 'image/png').trim() || 'image/png';
          await navigator.clipboard.write([
            new ClipboardItem({
              [clipboardType]: blob,
            }),
          ]);
          wroteClipboard = true;
        }
      }
    } catch {
      wroteClipboard = false;
    }
    try {
      if (!wroteClipboard && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardMarker);
        wroteClipboard = true;
      }
    } catch {
      // Ignore clipboard permission errors.
    }
    if (isCut) {
      handleDeleteImageById(imageId);
    }
  };
  const handleCopyOrCutImage = async (isCut) => {
    const imageId = getActiveSelectedImageId();
    if (!imageId) return;
    await handleCopyOrCutImageById(imageId, isCut);
  };

  const normalizeExternalLink = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  };
  const handleDeleteImage = () => {
    const imageId = getActiveSelectedImageId();
    if (!imageId) return;
    handleDeleteImageById(imageId);
  };
  const handleSetImageLink = async () => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const currentLink = String(targetImage.dataset.linkUrl || '').trim();
    const nextLinkRaw = await popup.prompt({
      title: currentLink ? 'Edit image link' : 'Add image link',
      message: 'Paste URL (https://...)',
      placeholder: 'https://example.com',
      defaultValue: currentLink,
    });
    if (nextLinkRaw === null) return;
    const normalizedLink = normalizeExternalLink(nextLinkRaw);
    if (!normalizedLink) {
      targetImage.dataset.linkUrl = '';
      targetImage.removeAttribute('data-link-url');
      applyImageLayout(targetImage, targetImage.dataset.layout || 'free');
      handleInput();
      openImageMenu(targetImage);
      return;
    }
    targetImage.dataset.linkUrl = normalizedLink;
    applyImageLayout(targetImage, targetImage.dataset.layout || 'free');
    handleInput();
    openImageMenu(targetImage);
  };
  const handleOpenImageLink = () => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const linkUrl = String(targetImage.dataset.linkUrl || '').trim();
    if (!linkUrl) return;
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEditorClick = (event) => {
    if (docTableRangeDragRef.current.hasMoved) {
      docTableRangeDragRef.current.hasMoved = false;
      setDocLinkMenuState(null);
      return;
    }
    const linkNode = event.target.closest('a[href]');
    if (linkNode && editorRef.current?.contains(linkNode)) {
      event.preventDefault();
      if (!linkNode.dataset.noteLinkId) {
        linkNode.dataset.noteLinkId = `link-${generateId()}`;
      }
      const container = editorContainerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const linkRect = linkNode.getBoundingClientRect();
        setDocLinkMenuState({
          linkId: linkNode.dataset.noteLinkId,
          href: String(linkNode.getAttribute('href') || '').trim(),
          text: String(linkNode.textContent || '').trim(),
          x: Math.max(8, linkRect.left - containerRect.left + container.scrollLeft),
          y: Math.max(8, linkRect.bottom - containerRect.top + container.scrollTop + 8),
        });
      }
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      return;
    }
    const imageNode = event.target.closest('img[data-note-image-id]');
    if (imageNode && editorRef.current?.contains(imageNode)) {
      const clickedImageId = String(imageNode.dataset.noteImageId || '').trim();
      if (imageCropModeId && clickedImageId && clickedImageId !== imageCropModeId) {
        const cropImageNode = getImageById(imageCropModeId);
        if (cropImageNode) {
          commitCropForImage(cropImageNode, { persist: true, reopenMenu: false });
        }
      }
      try {
        editorRef.current.focus({ preventScroll: true });
      } catch {
        editorRef.current.focus();
      }
      openImageMenu(imageNode);
      setDocLinkMenuState(null);
      return;
    }
    const tableCellNode = getDocTableCellFromTarget(event.target);
    if (tableCellNode) {
      try {
        editorRef.current?.focus({ preventScroll: true });
      } catch {
        editorRef.current?.focus();
      }
      if (!docTableRangeDragRef.current.active) {
        const tableElement = tableCellNode.closest('table[data-note-inline-table="true"]');
        if (tableElement) {
          normalizeDocTableStructure(tableElement);
        }
        const tableId = String(tableElement?.dataset?.noteTableId || '').trim();
        const cellPos = getDocTableCellPosition(tableCellNode);
        const selectedBounds = getDocTableSelectionBounds(docTableSelectionState);
        const hasSameSingleSelection = Boolean(
          tableId &&
            cellPos &&
            selectedBounds &&
            String(docTableSelectionState?.tableId || '').trim() === tableId &&
            selectedBounds.minRow === cellPos.row &&
            selectedBounds.maxRow === cellPos.row &&
            selectedBounds.minCol === cellPos.col &&
            selectedBounds.maxCol === cellPos.col
        );
        if (hasSameSingleSelection) {
          scheduleDocTableCaretPlacement(docTableSelectionState);
        } else {
          beginDocTableRangeSelection(tableCellNode);
          endDocTableRangeSelection();
        }
      }
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
      setDocLinkMenuState(null);
      return;
    }
    if (activeImageFrame && docViewportRef.current) {
      const viewportRect = docViewportRef.current.getBoundingClientRect();
      const pointerX = event.clientX - viewportRect.left + docViewportRef.current.scrollLeft;
      const pointerY = event.clientY - viewportRect.top + docViewportRef.current.scrollTop;
      const framePadding = 8;
      const isInsideActiveFrame =
        pointerX >= activeImageFrame.x - framePadding &&
        pointerX <= activeImageFrame.x + activeImageFrame.width + framePadding &&
        pointerY >= activeImageFrame.y - framePadding &&
        pointerY <= activeImageFrame.y + activeImageFrame.height + framePadding;
      if (isInsideActiveFrame) {
        return;
      }
    }
    if (!event.target.closest('[data-note-image-menu]')) {
      if (imageCropModeId) {
        const cropImageNode = getImageById(imageCropModeId);
        if (cropImageNode) {
          commitCropForImage(cropImageNode, { persist: true, reopenMenu: false });
        }
      }
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
    }
    if (!event.target.closest('[data-note-link-menu]')) {
      setDocLinkMenuState(null);
    }
    clearDocTableSelection();
  };
  const handleDocEditorMouseDown = (event) => {
    if (!isActiveDocPage) return;
    const tableCellNode = getDocTableCellFromTarget(event.target);
    if (tableCellNode && event.button === 0) {
      event.preventDefault();
      try {
        editorRef.current?.focus({ preventScroll: true });
      } catch {
        editorRef.current?.focus();
      }
      beginDocTableRangeSelection(tableCellNode);
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
      setDocLinkMenuState(null);
      return;
    }
    const imageNode = event.target.closest('img[data-note-image-id]');
    if (!imageNode || !editorRef.current?.contains(imageNode)) return;
    if (event.button !== 0) return;
    const clickedImageId = String(imageNode.dataset.noteImageId || '').trim();
    if (imageCropModeId && clickedImageId && clickedImageId !== imageCropModeId) {
      const cropImageNode = getImageById(imageCropModeId);
      if (cropImageNode) {
        commitCropForImage(cropImageNode, { persist: true, reopenMenu: false });
      }
    }
    if (imageCropModeId && clickedImageId === imageCropModeId) {
      openImageMenu(imageNode);
      return;
    }
    const imageRect = imageNode.getBoundingClientRect();
    const isNearResizeCorner =
      imageRect.right - event.clientX <= 16 &&
      imageRect.bottom - event.clientY <= 16;
    if (isNearResizeCorner) {
      openImageMenu(imageNode);
      return;
    }
    event.preventDefault();
    const currentX = Number.parseFloat(String(imageNode.dataset.posX || '0'));
    const currentY = Number.parseFloat(String(imageNode.dataset.posY || '0'));
    docImagePointerDragRef.current = {
      imageId: imageNode.dataset.noteImageId || '',
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: Number.isFinite(currentX) ? currentX : 0,
      originY: Number.isFinite(currentY) ? currentY : 0,
      moved: false,
    };
    imageNode.style.cursor = 'grabbing';
    openImageMenu(imageNode);
    setDocLinkMenuState(null);
  };
  const handleImageResizeStart = (event, direction, mode = 'resize') => {
    if (!isActiveDocPage) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const imageId = String(imageMenuState?.imageId || '').trim();
    if (!imageId) return;
    const imageNode = getImageById(imageId);
    if (!imageNode) return;
    const rect = imageNode.getBoundingClientRect();
    const startPosX = Number.parseFloat(String(imageNode.dataset.posX || '0'));
    const startPosY = Number.parseFloat(String(imageNode.dataset.posY || '0'));
    const startCropRect = getNormalizedImageCropRect(
      imageNode,
      Math.max(1, rect.width || 1),
      Math.max(1, rect.height || 1)
    );
    const baseResizeState = {
      imageId,
      direction,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: Math.max(48, rect.width || 48),
      startHeight: Math.max(48, rect.height || 48),
      startPosX: Number.isFinite(startPosX) ? startPosX : 0,
      startPosY: Number.isFinite(startPosY) ? startPosY : 0,
      aspectRatio:
        Number(imageNode.naturalWidth || 0) > 0 && Number(imageNode.naturalHeight || 0) > 0
          ? Number(imageNode.naturalWidth) / Number(imageNode.naturalHeight)
          : Math.max(0.1, Math.max(48, rect.width || 48) / Math.max(48, rect.height || 48)),
      startCropLeft: startCropRect.left,
      startCropTop: startCropRect.top,
      startCropWidth: startCropRect.width,
      startCropHeight: startCropRect.height,
    };
    if (mode === 'crop') {
      imageNode.dataset.cropMode = 'on';
      docImageResizeRef.current = {
        ...baseResizeState,
        imageWidth: Math.max(1, rect.width || 1),
        imageHeight: Math.max(1, rect.height || 1),
      };
      setImageCropModeId(imageId);
    } else {
      docImageResizeRef.current = baseResizeState;
    }
    imageNode.style.cursor = mode === 'crop' ? 'crosshair' : 'nwse-resize';
    refreshActiveImageFrame(imageId);
  };

  const handleEditorDragStart = (event) => {
    const imageNode = event.target.closest('img[data-note-image-id]');
    if (!imageNode) return;
    dragImageIdRef.current = imageNode.dataset.noteImageId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragImageIdRef.current);
  };

  const handleEditorDrop = (event) => {
    if (!dragImageIdRef.current || !editorRef.current) return;
    event.preventDefault();
    const movedImage = placeImageAtPoint(dragImageIdRef.current, event.clientX, event.clientY);
    if (!movedImage) {
      dragImageIdRef.current = '';
      return;
    }
    dragImageIdRef.current = '';
    handleInput();
    openImageMenu(movedImage);
  };

  const handleEditorTouchStart = (event) => {
    const imageNode = event.target.closest('img[data-note-image-id]');
    if (!imageNode) {
      resetTouchDragState();
      return;
    }

    const touch = event.touches?.[0];
    if (!touch) return;

    clearLongPressTimer();
    touchDragStateRef.current = {
      imageId: imageNode.dataset.noteImageId || '',
      active: false,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
    };

    longPressTimerRef.current = window.setTimeout(() => {
      const current = touchDragStateRef.current;
      if (!current.imageId || current.imageId !== imageNode.dataset.noteImageId) return;
      current.active = true;
      imageNode.style.opacity = '0.6';
      imageNode.style.cursor = 'grabbing';
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
    }, 320);
  };

  const handleEditorTouchMove = (event) => {
    const current = touchDragStateRef.current;
    if (!current.imageId) return;

    const touch = event.touches?.[0];
    if (!touch) return;
    current.lastX = touch.clientX;
    current.lastY = touch.clientY;

    if (!current.active) {
      const movedDistance = Math.hypot(touch.clientX - current.startX, touch.clientY - current.startY);
      if (movedDistance > 10) {
        resetTouchDragState();
      }
      return;
    }

    event.preventDefault();
  };

  const handleEditorTouchEnd = (event) => {
    const current = touchDragStateRef.current;
    if (!current.imageId) {
      clearLongPressTimer();
      return;
    }

    const wasActive = current.active;
    const touchPoint = event.changedTouches?.[0];
    resetTouchDragState();

    if (!wasActive) return;

    const dropX = touchPoint?.clientX ?? current.lastX;
    const dropY = touchPoint?.clientY ?? current.lastY;
    const movedImage = placeImageAtPoint(current.imageId, dropX, dropY);
    if (!movedImage) return;

    handleInput();
    openImageMenu(movedImage);
  };

  React.useEffect(() => {
    const parsedDocument = parseStoredNoteDocument(initialContent);
    const isSwitchingNote = previousNoteIdRef.current !== noteId;
    previousNoteIdRef.current = noteId;
    if (!isSwitchingNote) {
      const currentSerialized = serializeStoredNoteDocument(
        normalizeNoteDocumentPayload(noteDocumentRef.current || noteDocument)
      );
      const incomingSerialized = serializeStoredNoteDocument(parsedDocument);
      if (incomingSerialized === currentSerialized) {
        return;
      }
    }
    noteDocumentRef.current = parsedDocument;
    setNoteDocument(parsedDocument);
    if (isSwitchingNote) {
      setNoteEditHistory({ past: [], future: [] });
    }
    setActivePageId((prevActivePageId) => {
      if (isSwitchingNote) return parsedDocument.activePageId;
      const hasPreviousPage = parsedDocument.pages.some((page) => page.id === prevActivePageId);
      return hasPreviousPage ? prevActivePageId : parsedDocument.activePageId;
    });
    if (isSwitchingNote) {
      setSheetSelection({ row: 0, col: 0 });
      setSheetSelectionRange({
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      });
      sheetSelectionDragRef.current.active = false;
      sheetSelectionDragRef.current.hasMoved = false;
      setSheetEditingCell(null);
      setIsPagePickerOpen(false);
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setDocLinkMenuState(null);
      setIsDocTextColorPickerOpen(false);
      setIsDocHighlightColorPickerOpen(false);
      setIsDocUnderlineMenuOpen(false);
      setIsDocFontSizeMenuOpen(false);
      setIsDocInsertTableMenuOpen(false);
      setIsDocTableFillColorPickerOpen(false);
      setIsDocTableBorderColorPickerOpen(false);
      setIsDocTableCellAlignMenuOpen(false);
      setIsDocTableResizeMenuOpen(false);
      setIsDocTableExtraToolsMenuOpen(false);
      setMobileToolbarSection('');
      setDocFontFamilyValue('');
      setDocFontSizeValue('14');
      setDocFontSizeDraft('14');
      setDocTableFillColorValue('#ffffff');
      setDocTableBorderColorValue('#cbd5e1');
      setDocTableBorderDesignValue('all');
      setDocTableBorderLineStyleValue('solid');
      setDocTableBorderLineWidthValue('1');
      setDocTableCellAlignValue({ horizontal: 'left', vertical: 'top' });
      setDocTablePageAlignValue('left');
      setDocTableContentLockEnabled(false);
      setDocTableWrapEnabled(false);
      setDocTableScaleDraft('100');
      setDocTableDraftRows('4');
      setDocTableDraftCols('4');
      setDocTableHoverRows(0);
      setDocTableHoverCols(0);
      docTableSelectionRangeRef.current = null;
      docTableRangeDragRef.current.active = false;
      docTableRangeDragRef.current.tableId = '';
      docTableRangeDragRef.current.hasMoved = false;
      docTableCornerResizeRef.current.active = false;
      docTableCornerResizeRef.current.tableId = '';
      docTableCornerResizeRef.current.hasMoved = false;
      setDocTableSelectionState(null);
      setActiveDocTableResizeFrame(null);
      setActiveFormats({
        bold: false,
        italic: false,
        underline: false,
        highlight: false,
      });
    }
  }, [noteId, initialContent]);

  React.useEffect(() => {
    if (!editorRef.current || !isActiveDocPage || !activePage) return;
    const hydrateKey = `${noteId}:${activePage.id}`;
    const editor = editorRef.current;
    const incomingContent = String(activePage.content || '');
    const isPageSwitchHydration = lastHydratedDocPageRef.current !== hydrateKey;
    const shouldHydrate =
      isPageSwitchHydration ||
      (document.activeElement !== editor && String(editor.innerHTML || '') !== incomingContent);
    if (!shouldHydrate) return;
    editor.innerHTML = incomingContent;
    normalizeEditorImages();
    if (isPageSwitchHydration) {
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      clearDocTableSelection();
    }
    lastHydratedDocPageRef.current = hydrateKey;
  }, [noteId, activePageId, activePage?.content, isActiveDocPage]);
  React.useEffect(() => {
    if (!isActiveSheetPage) return;
    setImageMenuState(null);
    setActiveImageFrame(null);
    setActiveCropFrame(null);
    setIsDocInsertTableMenuOpen(false);
    setDocTableHoverRows(0);
    setDocTableHoverCols(0);
    clearDocTableSelection();
    setSheetEditingCell(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  }, [isActiveSheetPage, activePageId]);
  React.useEffect(() => {
    const stopSheetDragSelection = () => {
      sheetSelectionDragRef.current.active = false;
      setSheetQuickMenu(null);
    };
    window.addEventListener('mouseup', stopSheetDragSelection);
    window.addEventListener('touchend', stopSheetDragSelection);
    window.addEventListener('touchcancel', stopSheetDragSelection);
    return () => {
      window.removeEventListener('mouseup', stopSheetDragSelection);
      window.removeEventListener('touchend', stopSheetDragSelection);
      window.removeEventListener('touchcancel', stopSheetDragSelection);
    };
  }, []);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleViewportChange = (event) => {
      setIsCompactSheetViewport(event.matches);
    };
    setIsCompactSheetViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }
    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event) => {
      setIsMobileNoteViewport(event.matches);
    };
    setIsMobileNoteViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }
    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);
  React.useEffect(() => {
    if (!isMobileNoteViewport && mobileToolbarSection) {
      setMobileToolbarSection('');
    }
  }, [isMobileNoteViewport, mobileToolbarSection]);
  React.useEffect(() => {
    if (!isActiveSheetPage) return;
    if (mobileToolbarSection !== 'insert' && mobileToolbarSection !== 'table') return;
    setMobileToolbarSection('format');
  }, [isActiveSheetPage, mobileToolbarSection]);
  React.useEffect(() => {
    if (isDesktopSheetViewport) {
      setSheetQuickMenu(null);
    }
  }, [isDesktopSheetViewport]);
  React.useEffect(() => {
    if (!sheetQuickMenu) return undefined;
    const closeQuickMenuIfOutside = (event) => {
      if (sheetQuickMenuRef.current?.contains(event.target)) return;
      setSheetQuickMenu(null);
    };
    document.addEventListener('pointerdown', closeQuickMenuIfOutside);
    return () => document.removeEventListener('pointerdown', closeQuickMenuIfOutside);
  }, [sheetQuickMenu]);
  React.useEffect(() => {
    const handleDocTableSelectionMove = (event) => {
      if (!isActiveDocPage || !docTableRangeDragRef.current.active) return;
      if ((event.buttons & 1) !== 1) {
        endDocTableRangeSelection();
        return;
      }
      event.preventDefault();
      const pointerTarget =
        typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(event.clientX, event.clientY)
          : event.target;
      const cellElement = getDocTableCellFromTarget(pointerTarget || event.target);
      if (!cellElement) return;
      extendDocTableRangeSelection(cellElement);
    };
    const stopDocTableSelection = () => {
      endDocTableRangeSelection();
    };
    window.addEventListener('mousemove', handleDocTableSelectionMove);
    window.addEventListener('mouseup', stopDocTableSelection);
    return () => {
      window.removeEventListener('mousemove', handleDocTableSelectionMove);
      window.removeEventListener('mouseup', stopDocTableSelection);
    };
  }, [isActiveDocPage, activePageId]);
  React.useEffect(() => {
    const hasActiveDocTableSelection = Boolean(
      isActiveDocPage &&
        docTableSelectionState?.tableId &&
        getDocTableElementById(docTableSelectionState.tableId)
    );
    if (!isDocTableResizeMenuOpen || !hasActiveDocTableSelection) {
      setActiveDocTableResizeFrame(null);
      return undefined;
    }
    const syncResizeFrame = () => {
      setActiveDocTableResizeFrame(getDocTableSelectionFrameInViewport(docTableSelectionState));
    };
    syncResizeFrame();
    const viewportNode = docViewportRef.current;
    const editorNode = editorRef.current;
    viewportNode?.addEventListener('scroll', syncResizeFrame, { passive: true });
    editorNode?.addEventListener('scroll', syncResizeFrame, { passive: true });
    window.addEventListener('resize', syncResizeFrame);
    return () => {
      viewportNode?.removeEventListener('scroll', syncResizeFrame);
      editorNode?.removeEventListener('scroll', syncResizeFrame);
      window.removeEventListener('resize', syncResizeFrame);
    };
  }, [
    isActiveDocPage,
    activePageId,
    isDocTableResizeMenuOpen,
    docTableSelectionState?.tableId,
    docTableSelectionState?.startRow,
    docTableSelectionState?.startCol,
    docTableSelectionState?.endRow,
    docTableSelectionState?.endCol,
  ]);
  React.useEffect(() => {
    const handleDocTableCornerResizeMove = (event) => {
      const resizeState = docTableCornerResizeRef.current;
      if (!isActiveDocPage || !resizeState?.active) return;
      event.preventDefault();
      const deltaX = event.clientX - resizeState.startClientX;
      const deltaY = event.clientY - resizeState.startClientY;
      const didApply = applyDocTableCornerResizeDrag(resizeState, deltaX, deltaY);
      if (!didApply) return;
      resizeState.hasMoved = true;
      setActiveDocTableResizeFrame(getDocTableSelectionFrameInViewport(docTableSelectionState));
    };
    const stopDocTableCornerResize = () => {
      const resizeState = docTableCornerResizeRef.current;
      if (!resizeState?.active) return;
      docTableCornerResizeRef.current.active = false;
      setActiveDocTableResizeFrame(getDocTableSelectionFrameInViewport(docTableSelectionState));
      if (resizeState.hasMoved) {
        handleInput();
        applyDocTableSelectionVisual(docTableSelectionState);
      }
    };
    window.addEventListener('mousemove', handleDocTableCornerResizeMove);
    window.addEventListener('mouseup', stopDocTableCornerResize);
    return () => {
      window.removeEventListener('mousemove', handleDocTableCornerResizeMove);
      window.removeEventListener('mouseup', stopDocTableCornerResize);
    };
  }, [
    isActiveDocPage,
    activePageId,
    docTableSelectionState?.tableId,
    docTableSelectionState?.startRow,
    docTableSelectionState?.startCol,
    docTableSelectionState?.endRow,
    docTableSelectionState?.endCol,
  ]);
  React.useEffect(() => {
    const handleMouseMove = (event) => {
      const resizeState = docImageResizeRef.current;
      if (resizeState?.imageId && editorRef.current) {
        event.preventDefault();
        const imageNode = getImageById(resizeState.imageId);
        if (!imageNode) return;
        const deltaX = event.clientX - resizeState.startClientX;
        const deltaY = event.clientY - resizeState.startClientY;
        const direction = String(resizeState.direction || 'se').toLowerCase();
        if (resizeState.mode === 'crop') {
          const minCropSize = 24;
          const imageWidth = Math.max(1, Number(resizeState.imageWidth) || 1);
          const imageHeight = Math.max(1, Number(resizeState.imageHeight) || 1);
          let nextLeft = resizeState.startCropLeft;
          let nextTop = resizeState.startCropTop;
          let nextCropWidth = resizeState.startCropWidth;
          let nextCropHeight = resizeState.startCropHeight;
          if (direction === 'move') {
            nextLeft = Math.max(0, Math.min(imageWidth - nextCropWidth, resizeState.startCropLeft + deltaX));
            nextTop = Math.max(0, Math.min(imageHeight - nextCropHeight, resizeState.startCropTop + deltaY));
          } else {
            if (direction.includes('w')) {
              const nextEdge = Math.max(0, Math.min(resizeState.startCropLeft + resizeState.startCropWidth - minCropSize, resizeState.startCropLeft + deltaX));
              nextCropWidth = resizeState.startCropWidth + (resizeState.startCropLeft - nextEdge);
              nextLeft = nextEdge;
            }
            if (direction.includes('e')) {
              nextCropWidth = Math.max(minCropSize, Math.min(imageWidth - nextLeft, resizeState.startCropWidth + deltaX));
            }
            if (direction.includes('n')) {
              const nextEdge = Math.max(0, Math.min(resizeState.startCropTop + resizeState.startCropHeight - minCropSize, resizeState.startCropTop + deltaY));
              nextCropHeight = resizeState.startCropHeight + (resizeState.startCropTop - nextEdge);
              nextTop = nextEdge;
            }
            if (direction.includes('s')) {
              nextCropHeight = Math.max(minCropSize, Math.min(imageHeight - nextTop, resizeState.startCropHeight + deltaY));
            }
          }
          imageNode.dataset.cropMode = 'on';
          imageNode.dataset.cropLeft = String(Math.round(nextLeft));
          imageNode.dataset.cropTop = String(Math.round(nextTop));
          imageNode.dataset.cropWidth = String(Math.round(nextCropWidth));
          imageNode.dataset.cropHeight = String(Math.round(nextCropHeight));
          applyImageLayout(imageNode, imageNode.dataset.layout || 'free');
        } else {
          let nextWidth = resizeState.startWidth;
          let nextHeight = resizeState.startHeight;
          let nextPosX = resizeState.startPosX;
          let nextPosY = resizeState.startPosY;
          const aspectRatio = Math.max(0.1, Number(resizeState.aspectRatio) || 1);
          const hasHorizontal = direction.includes('e') || direction.includes('w');
          const hasVertical = direction.includes('n') || direction.includes('s');
          if (direction.includes('e')) {
            nextWidth = resizeState.startWidth + deltaX;
          }
          if (direction.includes('s')) {
            nextHeight = resizeState.startHeight + deltaY;
          }
          if (direction.includes('w')) {
            nextWidth = resizeState.startWidth - deltaX;
            nextPosX = resizeState.startPosX + deltaX;
          }
          if (direction.includes('n')) {
            nextHeight = resizeState.startHeight - deltaY;
            nextPosY = resizeState.startPosY + deltaY;
          }
          if (hasHorizontal && hasVertical) {
            if (Math.abs(deltaX) >= Math.abs(deltaY)) {
              nextWidth = Math.max(48, Math.round(nextWidth));
              nextHeight = Math.max(48, Math.round(nextWidth / aspectRatio));
            } else {
              nextHeight = Math.max(48, Math.round(nextHeight));
              nextWidth = Math.max(48, Math.round(nextHeight * aspectRatio));
            }
          } else if (hasHorizontal) {
            nextWidth = Math.max(48, Math.round(nextWidth));
            nextHeight = Math.max(48, Math.round(nextWidth / aspectRatio));
          } else if (hasVertical) {
            nextHeight = Math.max(48, Math.round(nextHeight));
            nextWidth = Math.max(48, Math.round(nextHeight * aspectRatio));
          } else {
            nextWidth = Math.max(48, Math.round(nextWidth));
            nextHeight = Math.max(48, Math.round(nextHeight));
          }
          if (direction.includes('w')) {
            nextPosX = resizeState.startPosX + (resizeState.startWidth - nextWidth);
          }
          if (direction.includes('n')) {
            nextPosY = resizeState.startPosY + (resizeState.startHeight - nextHeight);
          }
          nextPosX = Math.max(0, Math.round(nextPosX));
          nextPosY = Math.max(0, Math.round(nextPosY));
          imageNode.dataset.posX = String(nextPosX);
          imageNode.dataset.posY = String(nextPosY);
          imageNode.style.left = `${nextPosX}px`;
          imageNode.style.top = `${nextPosY}px`;
          imageNode.style.width = `${nextWidth}px`;
          imageNode.style.height = `${nextHeight}px`;
          if (String(imageNode.dataset.cropMode || 'off') === 'on') {
            const scaleX = nextWidth / Math.max(1, Number(resizeState.startWidth) || 1);
            const scaleY = nextHeight / Math.max(1, Number(resizeState.startHeight) || 1);
            imageNode.dataset.cropLeft = String(
              Math.max(0, Math.round((Number(resizeState.startCropLeft) || 0) * scaleX))
            );
            imageNode.dataset.cropTop = String(
              Math.max(0, Math.round((Number(resizeState.startCropTop) || 0) * scaleY))
            );
            imageNode.dataset.cropWidth = String(
              Math.max(24, Math.round((Number(resizeState.startCropWidth) || nextWidth) * scaleX))
            );
            imageNode.dataset.cropHeight = String(
              Math.max(24, Math.round((Number(resizeState.startCropHeight) || nextHeight) * scaleY))
            );
            applyImageLayout(imageNode, imageNode.dataset.layout || 'free');
          }
        }
        syncEditorCanvasMetrics();
        refreshActiveImageFrame(resizeState.imageId);
        return;
      }
      const dragState = docImagePointerDragRef.current;
      if (!dragState?.imageId || !editorRef.current) return;
      const imageNode = getImageById(dragState.imageId);
      if (!imageNode) return;
      const editor = editorRef.current;
      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      const nextX = Math.max(0, dragState.originX + deltaX);
      const nextY = Math.max(0, dragState.originY + deltaY);
      const maxX = Math.max(0, editor.scrollWidth - imageNode.getBoundingClientRect().width);
      const maxY = Math.max(nextY, editor.scrollHeight + 400);
      const clampedX = Math.min(maxX, nextX);
      const clampedY = Math.min(maxY, nextY);
      const movedDistance = Math.abs(deltaX) + Math.abs(deltaY);
      if (movedDistance > 2) {
        dragState.moved = true;
      }
      imageNode.dataset.posX = String(clampedX);
      imageNode.dataset.posY = String(clampedY);
      imageNode.style.left = `${clampedX}px`;
      imageNode.style.top = `${clampedY}px`;
      imageNode.style.position = 'absolute';
      imageNode.style.zIndex = '20';
      syncEditorCanvasMetrics();
      refreshActiveImageFrame(dragState.imageId);
    };
    const handleMouseUp = () => {
      const resizeState = docImageResizeRef.current;
      if (resizeState?.imageId) {
        const imageNode = getImageById(resizeState.imageId);
        if (imageNode) {
          imageNode.style.cursor = 'grab';
          applyImageLayout(imageNode, imageNode.dataset.layout || 'free');
          openImageMenu(imageNode);
        }
        docImageResizeRef.current = null;
        handleInput();
        return;
      }
      const dragState = docImagePointerDragRef.current;
      if (!dragState?.imageId) return;
      const imageNode = getImageById(dragState.imageId);
      if (imageNode) {
        imageNode.style.cursor = 'grab';
        openImageMenu(imageNode);
      }
      docImagePointerDragRef.current = null;
      if (dragState.moved) {
        handleInput();
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isActiveDocPage, activePageId]);

  React.useEffect(() => {
    if (!isActiveDocPage) {
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
      return undefined;
    }
    const selectedImageId = String(imageMenuState?.imageId || '').trim();
    setSelectedImageVisual(selectedImageId);
    if (!selectedImageId) {
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      return undefined;
    }
    const syncFrame = () => refreshActiveImageFrame(selectedImageId);
    syncFrame();
    const viewportNode = docViewportRef.current;
    const editorNode = editorRef.current;
    viewportNode?.addEventListener('scroll', syncFrame, { passive: true });
    editorNode?.addEventListener('scroll', syncFrame, { passive: true });
    window.addEventListener('resize', syncFrame);
    return () => {
      viewportNode?.removeEventListener('scroll', syncFrame);
      editorNode?.removeEventListener('scroll', syncFrame);
      window.removeEventListener('resize', syncFrame);
    };
  }, [isActiveDocPage, activePageId, imageMenuState?.imageId]);

  React.useEffect(() => {
    if (!imageMenuState) return undefined;
    const closeMenuIfOutside = (event) => {
      const targetNode = event.target && typeof event.target === 'object' ? event.target : null;
      const isNodeTarget = typeof Node !== 'undefined' && targetNode instanceof Node;
      const isElementTarget = typeof Element !== 'undefined' && targetNode instanceof Element;
      const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const clickedInsideContainer = Boolean(
        editorContainerRef.current &&
          ((isNodeTarget && editorContainerRef.current.contains(targetNode)) ||
            eventPath.includes(editorContainerRef.current))
      );
      const clickedOnImageMenu = Boolean(
        (isElementTarget && targetNode.closest?.('[data-note-image-menu]')) ||
          (imageMenuRef.current && eventPath.includes(imageMenuRef.current))
      );
      const clickedOnImageFrame = Boolean(
        isElementTarget && targetNode.closest?.('[data-note-image-frame]')
      );
      if (clickedInsideContainer || clickedOnImageMenu || clickedOnImageFrame) return;
      if (imageCropModeId) {
        const cropImageNode = getImageById(imageCropModeId);
        if (cropImageNode) {
          commitCropForImage(cropImageNode, { persist: true, reopenMenu: false });
        }
      }
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
    };
    document.addEventListener('pointerdown', closeMenuIfOutside);
    return () => document.removeEventListener('pointerdown', closeMenuIfOutside);
  }, [imageMenuState, imageCropModeId]);
  React.useEffect(() => {
    if (!imageCropModeId) return undefined;
    const commitCropIfPointerOutsideImageTools = (event) => {
      const targetNode = event.target && typeof event.target === 'object' ? event.target : null;
      const isElementTarget = typeof Element !== 'undefined' && targetNode instanceof Element;
      if (!isElementTarget) return;
      const clickedOnImage = Boolean(targetNode.closest('img[data-note-image-id]'));
      const clickedOnImageMenu = Boolean(targetNode.closest('[data-note-image-menu]'));
      const clickedOnImageFrame = Boolean(targetNode.closest('[data-note-image-frame]'));
      if (clickedOnImage || clickedOnImageMenu || clickedOnImageFrame) return;
      const cropImageNode = getImageById(imageCropModeId);
      if (cropImageNode) {
        commitCropForImage(cropImageNode, { persist: true, reopenMenu: false });
      }
      setImageMenuState(null);
      setActiveImageFrame(null);
      setActiveCropFrame(null);
      setImageCropModeId('');
      setSelectedImageVisual('');
    };
    document.addEventListener('pointerdown', commitCropIfPointerOutsideImageTools);
    return () =>
      document.removeEventListener('pointerdown', commitCropIfPointerOutsideImageTools);
  }, [imageCropModeId]);
  React.useEffect(() => {
    const closeFloatingMenusIfOutside = (event) => {
      if (
        isDocTextColorPickerOpen &&
        !docTextColorPickerRef.current?.contains(event.target)
      ) {
        setIsDocTextColorPickerOpen(false);
      }
      if (
        isDocHighlightColorPickerOpen &&
        !docHighlightColorPickerRef.current?.contains(event.target)
      ) {
        setIsDocHighlightColorPickerOpen(false);
      }
      if (
        isDocUnderlineMenuOpen &&
        !docUnderlineMenuRef.current?.contains(event.target)
      ) {
        setIsDocUnderlineMenuOpen(false);
      }
      if (
        isDocFontSizeMenuOpen &&
        !docFontSizeMenuRef.current?.contains(event.target)
      ) {
        setIsDocFontSizeMenuOpen(false);
      }
      if (
        isDocInsertTableMenuOpen &&
        !docInsertTableMenuRef.current?.contains(event.target)
      ) {
        setIsDocInsertTableMenuOpen(false);
        setDocTableHoverRows(0);
        setDocTableHoverCols(0);
      }
      if (
        isDocTableFillColorPickerOpen &&
        !docTableFillColorPickerRef.current?.contains(event.target)
      ) {
        setIsDocTableFillColorPickerOpen(false);
      }
      if (
        isDocTableBorderColorPickerOpen &&
        !docTableBorderColorPickerRef.current?.contains(event.target)
      ) {
        setIsDocTableBorderColorPickerOpen(false);
      }
      if (
        isDocTableCellAlignMenuOpen &&
        !docTableCellAlignMenuRef.current?.contains(event.target)
      ) {
        setIsDocTableCellAlignMenuOpen(false);
      }
      if (
        isDocTableResizeMenuOpen &&
        !docTableResizeMenuRef.current?.contains(event.target) &&
        !docTableResizeOverlayRef.current?.contains(event.target)
      ) {
        setIsDocTableResizeMenuOpen(false);
      }
      if (
        isDocTableExtraToolsMenuOpen &&
        !docTableExtraToolsMenuRef.current?.contains(event.target)
      ) {
        setIsDocTableExtraToolsMenuOpen(false);
      }
      if (docLinkMenuState && !docLinkMenuRef.current?.contains(event.target)) {
        setDocLinkMenuState(null);
      }
    };
    document.addEventListener('pointerdown', closeFloatingMenusIfOutside);
    return () => document.removeEventListener('pointerdown', closeFloatingMenusIfOutside);
  }, [
    isDocTextColorPickerOpen,
    isDocHighlightColorPickerOpen,
    isDocUnderlineMenuOpen,
    isDocFontSizeMenuOpen,
    isDocInsertTableMenuOpen,
    isDocTableFillColorPickerOpen,
    isDocTableBorderColorPickerOpen,
    isDocTableCellAlignMenuOpen,
    isDocTableResizeMenuOpen,
    isDocTableExtraToolsMenuOpen,
    docLinkMenuState,
  ]);
  React.useEffect(() => {
    const hasActiveDocTableSelection = Boolean(
      isActiveDocPage &&
        docTableSelectionState?.tableId &&
        getDocTableElementById(docTableSelectionState.tableId)
    );
    if (!hasActiveDocTableSelection) return undefined;
    const clearDocTableSelectionIfOutsideEditor = (event) => {
      if (!editorContainerRef.current?.contains(event.target)) {
        clearDocTableSelection();
      }
    };
    document.addEventListener('pointerdown', clearDocTableSelectionIfOutsideEditor);
    return () => document.removeEventListener('pointerdown', clearDocTableSelectionIfOutsideEditor);
  }, [isActiveDocPage, docTableSelectionState?.tableId, activePageId]);

  React.useEffect(
    () => () => {
      clearLongPressTimer();
      if (presenceTimerRef.current) {
        window.clearTimeout(presenceTimerRef.current);
      }
    },
    []
  );
  React.useEffect(() => {
    if (!isPagePickerOpen) return undefined;
    const closePickerIfOutside = (event) => {
      if (!pagePickerRef.current?.contains(event.target)) {
        setIsPagePickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', closePickerIfOutside);
    return () => document.removeEventListener('pointerdown', closePickerIfOutside);
  }, [isPagePickerOpen]);
  React.useEffect(() => {
    const handleSelectionChange = () => {
      syncActiveFormats();
      if (isActiveDocPage) {
        schedulePresenceUpdate('');
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isActiveDocPage, activePageId]);

  const getEditorTypingPreview = () => {
    if (!editorRef.current) return '';
    const text = String(editorRef.current.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.slice(Math.max(0, text.length - NOTE_PRESENCE_TYPING_MAX));
  };
  const execCmd = (cmd) => {
    if (!isActiveDocPage) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(cmd, false, null);
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
  };
  const execValueCmd = (cmd, value) => {
    if (!isActiveDocPage) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(cmd, false, value);
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
  };
  const handleApplyHeading = (event) => {
    if (!isActiveDocPage) return;
    const value = String(event.target.value || '').trim();
    if (!value) return;
    if (value === 'p') {
      execValueCmd('formatBlock', '<p>');
      return;
    }
    execValueCmd('formatBlock', `<${value}>`);
  };
  const handleApplyFontFamily = (event) => {
    if (!isActiveDocPage) return;
    const value = String(event.target.value || '').trim();
    setDocFontFamilyValue(value);
    if (!value) return;
    execValueCmd('fontName', value);
  };
  const normalizeDocFontSize = (value) => {
    const raw = String(value || '').trim().replace(/px$/i, '');
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(8, Math.min(160, Math.round(parsed)));
  };
  const applyDocCustomFontSize = (sizeInput) => {
    if (!isActiveDocPage) return;
    const normalizedSize = normalizeDocFontSize(sizeInput);
    if (!normalizedSize) return;
    setDocFontSizeValue(String(normalizedSize));
    setDocFontSizeDraft(String(normalizedSize));
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('fontSize', false, '7');
    if (editorRef.current) {
      const legacyNodes = editorRef.current.querySelectorAll('font[size="7"]');
      legacyNodes.forEach((node) => {
        const wrapper = document.createElement('span');
        wrapper.style.fontSize = `${normalizedSize}px`;
        wrapper.innerHTML = node.innerHTML;
        node.replaceWith(wrapper);
      });
    }
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
  };
  const applyFontSizeValue = (sizeInput) => {
    const value = String(sizeInput || '').trim();
    if (!value) return false;
    const normalizedSize = normalizeDocFontSize(value);
    if (!normalizedSize) return false;
    if (isActiveSheetPage) {
      updateSelectedSheetCellStyle({ fontSize: `${normalizedSize}px` });
      setDocFontSizeDraft(String(normalizedSize));
      return true;
    }
    applyDocCustomFontSize(normalizedSize);
    return true;
  };
  const handleApplyFontSizePreset = (sizeValue) => {
    if (!applyFontSizeValue(sizeValue)) return;
    setIsDocFontSizeMenuOpen(false);
  };
  const handleDocFontSizeDraftChange = (event) => {
    const value = String(event.target.value || '');
    const sanitized = value.replace(/[^\d]/g, '').slice(0, 3);
    setDocFontSizeDraft(sanitized);
  };
  const commitDocFontSizeDraft = () => {
    if (!applyFontSizeValue(docFontSizeDraft)) {
      if (isActiveSheetPage) {
        const fallbackSheetSize = String(selectedSheetCell?.style?.fontSize || '14').replace(/px$/i, '');
        setDocFontSizeDraft(fallbackSheetSize || '14');
      } else {
        setDocFontSizeDraft(docFontSizeValue);
      }
      return;
    }
    setIsDocFontSizeMenuOpen(false);
  };
  const handleDocFontSizeDraftKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitDocFontSizeDraft();
  };
  const applyTextColorValue = (colorInput) => {
    const color = String(colorInput || '').trim();
    if (!color) return;
    setDocTextColorValue(color);
    if (isActiveSheetPage) {
      updateSelectedSheetCellStyle({ color });
      return;
    }
    execValueCmd('foreColor', color);
  };
  const handleApplyTextColor = (event) => {
    applyTextColorValue(event.target.value);
  };
  const getDocSelectionRange = () => {
    if (!isActiveDocPage || !editorRef.current) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return null;
    return range;
  };
  const hasExpandedDocSelection = () => {
    const range = getDocSelectionRange();
    return Boolean(range && !range.collapsed);
  };
  const isDocSelectionFullyHighlighted = () => {
    if (!isActiveDocPage || !editorRef.current) return false;
    const range = getDocSelectionRange();
    if (!range || range.collapsed) return false;

    const editor = editorRef.current;
    const normalizeColor = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    const isTransparentColor = (value) => {
      const normalized = normalizeColor(value);
      if (!normalized) return true;
      return (
        normalized === 'transparent' ||
        normalized === 'rgba(0,0,0,0)' ||
        normalized === 'rgb(0,0,0,0)' ||
        normalized === 'inherit' ||
        normalized === 'initial' ||
        normalized === 'unset'
      );
    };
    const editorBackground = normalizeColor(window.getComputedStyle(editor).backgroundColor || '');
    const isTextNodeHighlighted = (textNode) => {
      let element = textNode.parentElement;
      while (element && element !== editor) {
        if (String(element.tagName || '').toLowerCase() === 'mark') {
          return true;
        }
        const inlineBackground = normalizeColor(element.style?.backgroundColor || '');
        if (!isTransparentColor(inlineBackground)) {
          return true;
        }
        const computedBackground = normalizeColor(window.getComputedStyle(element).backgroundColor || '');
        if (!isTransparentColor(computedBackground) && computedBackground !== editorBackground) {
          return true;
        }
        element = element.parentElement;
      }
      return false;
    };

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = String(node.nodeValue || '').replace(/\u200B/g, '');
          if (!text.trim()) return NodeFilter.FILTER_REJECT;
          try {
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      }
    );

    let hasTextNodeInSelection = false;
    let currentNode = walker.nextNode();
    while (currentNode) {
      hasTextNodeInSelection = true;
      if (!isTextNodeHighlighted(currentNode)) {
        return false;
      }
      currentNode = walker.nextNode();
    }

    return hasTextNodeInSelection;
  };
  const applyDocHighlightCommand = (colorInput) => {
    if (!isActiveDocPage) return false;
    const color = String(colorInput || '').trim();
    if (!color) return false;
    if (editorRef.current) {
      try {
        editorRef.current.focus({ preventScroll: true });
      } catch {
        editorRef.current.focus();
      }
    }
    let success = false;
    try {
      success = document.execCommand('hiliteColor', false, color);
    } catch {
      success = false;
    }
    if (!success) {
      try {
        success = document.execCommand('backColor', false, color);
      } catch {
        success = false;
      }
    }
    return success;
  };
  const applyHighlightColorValue = (colorInput) => {
    if (!isActiveDocPage) return;
    const color = String(colorInput || '').trim();
    if (!color) return;
    setDocHighlightColorValue(color);
    if (!hasExpandedDocSelection()) return;
    applyDocHighlightCommand(color);
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
  };
  const handleToggleHighlight = () => {
    if (isActiveSheetPage) {
      const currentBg = String(selectedSheetCell?.style?.bgColor || '').trim().toLowerCase();
      const isActiveSheetHighlight = currentBg && currentBg !== '#ffffff' && currentBg !== 'rgb(255,255,255)';
      if (isActiveSheetHighlight) {
        updateSelectedSheetCellStyle({ bgColor: '#ffffff' });
      } else {
        updateSelectedSheetCellStyle({ bgColor: docHighlightColorValue || '#fef08a' });
      }
      return;
    }
    if (!isActiveDocPage) return;
    if (!hasExpandedDocSelection()) return;
    if (isDocSelectionFullyHighlighted()) {
      applyDocHighlightCommand('transparent');
    } else {
      applyDocHighlightCommand(docHighlightColorValue || '#fef08a');
    }
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
  };
  const handleApplyCellBackgroundColor = (event) => {
    if (!isActiveSheetPage) return;
    const color = String(event.target.value || '').trim();
    if (!color) return;
    updateSelectedSheetCellStyle({ bgColor: color });
  };
  const getCurrentListContext = () => {
    if (!isActiveDocPage || !editorRef.current) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return null;
    let node = selection.anchorNode;
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    if (!node || !node.closest) return null;
    const listItem = node.closest('li');
    const listNode = listItem?.parentElement;
    if (!listItem || !listNode) return null;
    const tagName = String(listNode.tagName || '').toLowerCase();
    if (tagName !== 'ul' && tagName !== 'ol') return null;
    return { listItem, listNode, tagName, range };
  };
  const isCaretAtStartOfListItem = (listItem, range) => {
    if (!listItem || !range || !range.collapsed) return false;
    const preRange = document.createRange();
    preRange.selectNodeContents(listItem);
    preRange.setEnd(range.startContainer, range.startOffset);
    const preText = String(preRange.toString() || '')
      .replace(/\u200B/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    return preText.length === 0;
  };
  const unwrapListItemToParagraph = (listItem, listNode) => {
    if (!listItem || !listNode || !editorRef.current) return false;
    const listTag = String(listNode.tagName || '').toLowerCase();
    if (listTag !== 'ul' && listTag !== 'ol') return false;
    const parent = listNode.parentNode;
    if (!parent) return false;
    const newParagraph = document.createElement('p');
    const innerHtml = String(listItem.innerHTML || '').trim();
    newParagraph.innerHTML = innerHtml || '<br>';
    const allItems = Array.from(listNode.children).filter((node) => String(node.tagName || '').toLowerCase() === 'li');
    const itemIndex = allItems.indexOf(listItem);
    if (itemIndex < 0) return false;
    if (allItems.length === 1) {
      parent.insertBefore(newParagraph, listNode);
      listNode.remove();
    } else if (itemIndex === 0) {
      parent.insertBefore(newParagraph, listNode);
      listItem.remove();
    } else if (itemIndex === allItems.length - 1) {
      parent.insertBefore(newParagraph, listNode.nextSibling);
      listItem.remove();
    } else {
      const trailingList = listNode.cloneNode(false);
      let sibling = listItem.nextSibling;
      while (sibling) {
        const nextSibling = sibling.nextSibling;
        trailingList.appendChild(sibling);
        sibling = nextSibling;
      }
      parent.insertBefore(newParagraph, listNode.nextSibling);
      parent.insertBefore(trailingList, newParagraph.nextSibling);
      listItem.remove();
    }
    const selection = window.getSelection();
    if (selection) {
      const caretRange = document.createRange();
      caretRange.selectNodeContents(newParagraph);
      caretRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caretRange);
    }
    return true;
  };
  const toggleListByType = (listType) => {
    if (!isActiveDocPage) return;
    const normalizedType = listType === 'ol' ? 'ol' : 'ul';
    const listContext = getCurrentListContext();
    if (listContext && listContext.tagName === normalizedType) {
      const didUnwrap = unwrapListItemToParagraph(listContext.listItem, listContext.listNode);
      if (didUnwrap) {
        handleInput();
        schedulePresenceUpdate(getEditorTypingPreview());
      }
      return;
    }
    if (normalizedType === 'ul') {
      execCmd('insertUnorderedList');
    } else {
      execCmd('insertOrderedList');
    }
  };
  const handleInsertBulletList = () => {
    if (!isActiveDocPage) return;
    toggleListByType('ul');
  };
  const handleInsertNumberList = () => {
    if (!isActiveDocPage) return;
    toggleListByType('ol');
  };
  const wrapSelectionWithUnderlineStyle = (style = 'solid') => {
    if (!isActiveDocPage || !editorRef.current) return;
    const editor = editorRef.current;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    if (style === 'solid') {
      execCmd('underline');
      return;
    }
    const applyStyle = (targetElement) => {
      targetElement.style.textDecorationLine = 'underline';
      targetElement.style.textDecorationStyle = 'dashed';
      targetElement.style.textDecorationColor = 'currentColor';
    };
    if (range.collapsed) {
      const span = document.createElement('span');
      applyStyle(span);
      const marker = document.createTextNode('\u200B');
      span.appendChild(marker);
      range.insertNode(span);
      const nextRange = document.createRange();
      nextRange.setStart(marker, 1);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      handleInput();
      return;
    }
    const fragment = range.extractContents();
    const span = document.createElement('span');
    applyStyle(span);
    span.appendChild(fragment);
    range.insertNode(span);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    handleInput();
  };
  const handleApplyUnderline = () => {
    if (!isActiveDocPage) return;
    const selection = window.getSelection();
    const isCollapsedSelection =
      !selection || selection.rangeCount === 0 || selection.getRangeAt(0).collapsed;
    if (isCollapsedSelection) {
      execCmd('underline');
      return;
    }
    if (docUnderlineStyle === 'dashed' && currentFormatState.underline) {
      execCmd('underline');
      return;
    }
    wrapSelectionWithUnderlineStyle(docUnderlineStyle === 'dashed' ? 'dashed' : 'solid');
  };
  const getSelectedDocText = () => {
    if (!isActiveDocPage || !editorRef.current) return '';
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return '';
    return String(selection.toString() || '').trim();
  };
  const insertOrUpdateLinkWithText = (displayText, hrefValue) => {
    if (!isActiveDocPage || !editorRef.current) return;
    const editor = editorRef.current;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const anchor = document.createElement('a');
    anchor.href = hrefValue;
    anchor.textContent = displayText || hrefValue;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.dataset.noteLinkId = `link-${generateId()}`;
    range.deleteContents();
    range.insertNode(anchor);
    const nextRange = document.createRange();
    nextRange.setStartAfter(anchor);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    handleInput();
  };
  const handleInsertLink = async () => {
    if (!isActiveDocPage) return;
    const selectedText = getSelectedDocText();
    const linkForm = await popup.promptForm({
      title: 'Insert link',
      fields: [
        {
          id: 'displayText',
          label: 'Text to display',
          placeholder: 'Link text',
          defaultValue: selectedText || '',
          type: 'text',
        },
        {
          id: 'url',
          label: 'Paste URL (https://...)',
          placeholder: 'https://example.com',
          defaultValue: '',
          type: 'url',
        },
      ],
    });
    if (linkForm === null) return;
    const textValueRaw = String(linkForm?.displayText || '').trim();
    const linkValueRaw = String(linkForm?.url || '').trim();
    const normalized = String(linkValueRaw || '').trim();
    if (!normalized) return;
    const normalizedWithProtocol =
      /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const displayText = String(textValueRaw || '').trim() || selectedText || normalizedWithProtocol;
    insertOrUpdateLinkWithText(displayText, normalizedWithProtocol);
  };
  const normalizeDocTableDimension = (value, fallback = 4, max = 40) => {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, parsed));
  };
  const captureDocTableSelectionRange = () => {
    if (!isActiveDocPage || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    docTableSelectionRangeRef.current = range.cloneRange();
  };
  const restoreDocTableSelectionRange = () => {
    if (!isActiveDocPage || !editorRef.current) return false;
    const savedRange = docTableSelectionRangeRef.current;
    if (!savedRange) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    try {
      editorRef.current.focus();
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return true;
    } catch {
      return false;
    }
  };
  const buildDocTableHtml = (rowsInput, colsInput) => {
    const rows = normalizeDocTableDimension(rowsInput, 4);
    const cols = normalizeDocTableDimension(colsInput, 4);
    const tableId = `table-${generateId()}`;
    const rowHtml = Array.from({ length: rows }, () => {
      const colHtml = Array.from({ length: cols }, () => '<td><br></td>').join('');
      return `<tr>${colHtml}</tr>`;
    }).join('');
    return `<table data-note-inline-table="true" data-note-table-id="${tableId}" data-note-table-scale="100" data-note-table-wrap="false"><tbody>${rowHtml}</tbody></table><p><br></p>`;
  };
  const insertDocTable = (rowsInput, colsInput) => {
    if (!isActiveDocPage || !editorRef.current) return false;
    const rows = normalizeDocTableDimension(rowsInput, 4);
    const cols = normalizeDocTableDimension(colsInput, 4);
    const tableHtml = buildDocTableHtml(rows, cols);
    setDocTableDraftRows(String(rows));
    setDocTableDraftCols(String(cols));
    restoreDocTableSelectionRange();
    editorRef.current.focus();
    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, tableHtml);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const fragment = range.createContextualFragment(tableHtml);
          const lastNode = fragment.lastChild;
          range.insertNode(fragment);
          if (lastNode) {
            const nextRange = document.createRange();
            nextRange.setStartAfter(lastNode);
            nextRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(nextRange);
          }
          inserted = true;
        }
      }
    }
    if (!inserted) {
      editorRef.current.insertAdjacentHTML('beforeend', tableHtml);
    }
    setIsDocInsertTableMenuOpen(false);
    setDocTableHoverRows(0);
    setDocTableHoverCols(0);
    docTableSelectionRangeRef.current = null;
    clearDocTableSelection();
    syncActiveFormats();
    handleInput();
    schedulePresenceUpdate(getEditorTypingPreview());
    return true;
  };
  const handleToggleDocInsertTableMenu = () => {
    if (!isActiveDocPage) return;
    setIsDocInsertTableMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        captureDocTableSelectionRange();
        setDocTableHoverRows(0);
        setDocTableHoverCols(0);
        setDocTableDraftRows((current) => String(normalizeDocTableDimension(current, 4)));
        setDocTableDraftCols((current) => String(normalizeDocTableDimension(current, 4)));
      } else {
        setDocTableHoverRows(0);
        setDocTableHoverCols(0);
      }
      return next;
    });
  };
  const handleDocTableDraftRowsChange = (event) => {
    const value = String(event.target.value || '').replace(/[^\d]/g, '').slice(0, 2);
    setDocTableDraftRows(value);
  };
  const handleDocTableDraftColsChange = (event) => {
    const value = String(event.target.value || '').replace(/[^\d]/g, '').slice(0, 2);
    setDocTableDraftCols(value);
  };
  const handleDocTableDraftKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void insertDocTable(docTableDraftRows, docTableDraftCols);
  };
  const applyDocTableFillColorValue = (colorValueInput) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const normalizedColor = normalizeColorHexValue(colorValueInput, '#ffffff');
    selectionSnapshot.selectedCells.forEach((cellElement) => {
      cellElement.style.backgroundColor = normalizedColor;
      const computedStyle = window.getComputedStyle(cellElement);
      const computedBorderStyle = String(computedStyle.borderTopStyle || '').trim().toLowerCase();
      const computedBorderWidth = Number.parseFloat(String(computedStyle.borderTopWidth || '0'));
      const computedBorderColor = normalizeColorHexValue(
        cellElement.style.borderTopColor || computedStyle.borderTopColor || '',
        '#cbd5e1'
      );
      if (!computedBorderStyle || computedBorderStyle === 'none') {
        cellElement.style.borderTopStyle = 'solid';
        cellElement.style.borderRightStyle = 'solid';
        cellElement.style.borderBottomStyle = 'solid';
        cellElement.style.borderLeftStyle = 'solid';
      }
      if (!Number.isFinite(computedBorderWidth) || computedBorderWidth <= 0) {
        cellElement.style.borderTopWidth = '1px';
        cellElement.style.borderRightWidth = '1px';
        cellElement.style.borderBottomWidth = '1px';
        cellElement.style.borderLeftWidth = '1px';
      }
      if (computedBorderColor === 'transparent') {
        cellElement.style.borderTopColor = '#cbd5e1';
        cellElement.style.borderRightColor = '#cbd5e1';
        cellElement.style.borderBottomColor = '#cbd5e1';
        cellElement.style.borderLeftColor = '#cbd5e1';
      }
    });
    setDocTableFillColorValue(normalizedColor);
    setIsDocTableFillColorPickerOpen(false);
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const shouldApplyDocTableBorderEdge = (design, edgeName, edgeInfo) => {
    if (design === 'all') return true;
    if (design === 'outer') return Boolean(edgeInfo?.[edgeName]);
    if (design === 'inner') return !Boolean(edgeInfo?.[edgeName]);
    if (design === 'horizontal') return edgeName === 'top' || edgeName === 'bottom';
    if (design === 'vertical') return edgeName === 'left' || edgeName === 'right';
    if (design === 'top') return edgeName === 'top' && Boolean(edgeInfo?.top);
    if (design === 'right') return edgeName === 'right' && Boolean(edgeInfo?.right);
    if (design === 'bottom') return edgeName === 'bottom' && Boolean(edgeInfo?.bottom);
    if (design === 'left') return edgeName === 'left' && Boolean(edgeInfo?.left);
    if (design === 'clear') return true;
    return true;
  };
  const applyDocTableBorderAppearance = (
    colorValueInput,
    designInput = docTableBorderDesignValue,
    lineStyleInput = docTableBorderLineStyleValue,
    lineWidthInput = docTableBorderLineWidthValue,
    closePicker = false
  ) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { bounds } = selectionSnapshot;
    const normalizedDesign = normalizeDocTableBorderDesign(designInput, 'all');
    const normalizedColor = normalizeColorHexValue(colorValueInput, '#cbd5e1');
    const normalizedLineStyle = normalizeDocTableBorderLineStyle(lineStyleInput, 'solid');
    const normalizedLineWidth = normalizeDocTableBorderLineWidth(lineWidthInput, 1);
    const borderWidthPx = `${normalizedLineWidth}px`;
    const sideMap = {
      top: 'Top',
      right: 'Right',
      bottom: 'Bottom',
      left: 'Left',
    };
    selectionSnapshot.selectedCells.forEach((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      if (!pos) return;
      const endRow = pos.row + Math.max(1, pos.rowSpan) - 1;
      const endCol = pos.col + Math.max(1, pos.colSpan) - 1;
      const edgeInfo = {
        top: pos.row <= bounds.minRow && endRow >= bounds.minRow,
        right: pos.col <= bounds.maxCol && endCol >= bounds.maxCol,
        bottom: pos.row <= bounds.maxRow && endRow >= bounds.maxRow,
        left: pos.col <= bounds.minCol && endCol >= bounds.minCol,
      };
      ['top', 'right', 'bottom', 'left'].forEach((edgeName) => {
        if (!shouldApplyDocTableBorderEdge(normalizedDesign, edgeName, edgeInfo)) return;
        const sideName = sideMap[edgeName];
        if (normalizedDesign === 'clear' || normalizedColor === 'transparent') {
          cellElement.style[`border${sideName}Style`] = 'none';
          cellElement.style[`border${sideName}Width`] = '0px';
          cellElement.style[`border${sideName}Color`] = 'transparent';
          return;
        }
        cellElement.style[`border${sideName}Style`] = normalizedLineStyle;
        cellElement.style[`border${sideName}Width`] = borderWidthPx;
        cellElement.style[`border${sideName}Color`] = normalizedColor;
      });
    });
    setDocTableBorderColorValue(normalizedColor);
    setDocTableBorderDesignValue(normalizedDesign);
    setDocTableBorderLineStyleValue(normalizedLineStyle);
    setDocTableBorderLineWidthValue(String(normalizedLineWidth));
    if (closePicker) {
      setIsDocTableBorderColorPickerOpen(false);
    }
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const applyDocTableBorderColorValue = (colorValueInput) => {
    applyDocTableBorderAppearance(
      colorValueInput,
      docTableBorderDesignValue,
      docTableBorderLineStyleValue,
      docTableBorderLineWidthValue,
      true
    );
  };
  const handleDocTableBorderDesignChange = (designInput) => {
    const nextDesign = normalizeDocTableBorderDesign(designInput, docTableBorderDesignValue);
    setDocTableBorderDesignValue(nextDesign);
    applyDocTableBorderAppearance(
      docTableBorderColorValue,
      nextDesign,
      docTableBorderLineStyleValue,
      docTableBorderLineWidthValue,
      false
    );
  };
  const handleDocTableBorderLineStyleChange = (event) => {
    const nextStyle = normalizeDocTableBorderLineStyle(event.target.value, 'solid');
    setDocTableBorderLineStyleValue(nextStyle);
    applyDocTableBorderAppearance(
      docTableBorderColorValue,
      docTableBorderDesignValue,
      nextStyle,
      docTableBorderLineWidthValue,
      false
    );
  };
  const handleDocTableBorderLineWidthChange = (event) => {
    const nextWidth = normalizeDocTableBorderLineWidth(event.target.value, 1);
    setDocTableBorderLineWidthValue(String(nextWidth));
    applyDocTableBorderAppearance(
      docTableBorderColorValue,
      docTableBorderDesignValue,
      docTableBorderLineStyleValue,
      String(nextWidth),
      false
    );
  };
  const applyDocTableCellAlign = (horizontalInput, verticalInput) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const horizontal = normalizeDocTableHorizontalAlign(
      horizontalInput,
      docTableCellAlignValue.horizontal
    );
    const vertical = normalizeDocTableVerticalAlign(verticalInput, docTableCellAlignValue.vertical);
    selectionSnapshot.selectedCells.forEach((cellElement) => {
      cellElement.style.textAlign = horizontal;
      cellElement.style.verticalAlign = vertical;
      cellElement.querySelectorAll('p, div').forEach((childElement) => {
        childElement.style.marginTop = '0';
        childElement.style.marginBottom = '0';
      });
    });
    setDocTableCellAlignValue({ horizontal, vertical });
    setIsDocTableCellAlignMenuOpen(false);
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const handleToggleDocTableCellAlignMenu = () => {
    setIsDocTableCellAlignMenuOpen((prev) => !prev);
    setIsDocTableFillColorPickerOpen(false);
    setIsDocTableBorderColorPickerOpen(false);
    setIsDocTableResizeMenuOpen(false);
    setIsDocTableExtraToolsMenuOpen(false);
  };
  const handleToggleDocTableWrap = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const nextWrapEnabled = !getDocTableWrapFromTable(tableElement);
    tableElement.dataset.noteTableWrap = String(nextWrapEnabled);
    if (nextWrapEnabled && getDocTableContentLockFromTable(tableElement)) {
      tableElement.removeAttribute('data-note-table-lock-size');
      setDocTableContentLockEnabled(false);
    }
    setDocTableWrapEnabled(nextWrapEnabled);
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const applyDocTablePageAlign = (alignInput) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const normalizedAlign = normalizeDocTablePageAlign(alignInput, 'left');
    tableElement.dataset.noteTablePageAlign = normalizedAlign;
    if (normalizedAlign === 'center') {
      tableElement.style.marginLeft = 'auto';
      tableElement.style.marginRight = 'auto';
    } else if (normalizedAlign === 'right') {
      tableElement.style.marginLeft = 'auto';
      tableElement.style.marginRight = '0';
    } else {
      tableElement.style.marginLeft = '0';
      tableElement.style.marginRight = 'auto';
    }
    setDocTablePageAlignValue(normalizedAlign);
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const handleEqualizeDocTableCellsByLargestContent = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    normalizeDocTableStructure(tableElement);
    const tableCells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    if (!tableCells.length) return;
    let maxUnitWidth = 36;
    let maxUnitHeight = 24;
    tableCells.forEach((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      const rowSpan = Math.max(1, pos?.rowSpan || Number(cellElement.rowSpan || 1));
      const colSpan = Math.max(1, pos?.colSpan || Number(cellElement.colSpan || 1));
      const computedStyle = window.getComputedStyle(cellElement);
      const scrollWidth = Math.max(0, Number(cellElement.scrollWidth || 0));
      const scrollHeight = Math.max(0, Number(cellElement.scrollHeight || 0));
      const currentMinWidth = Number.parseFloat(
        String(cellElement.style.minWidth || computedStyle.minWidth || '88')
      );
      const currentHeight = Number.parseFloat(
        String(cellElement.style.height || computedStyle.height || '34')
      );
      const widthPerUnitCandidates = [
        scrollWidth / colSpan,
        (Number.isFinite(currentMinWidth) ? currentMinWidth : 88) / colSpan,
      ].filter((value) => Number.isFinite(value) && value > 0);
      const heightPerUnitCandidates = [
        scrollHeight / rowSpan,
        (Number.isFinite(currentHeight) ? currentHeight : 34) / rowSpan,
      ].filter((value) => Number.isFinite(value) && value > 0);
      const widthPerUnit = widthPerUnitCandidates.length
        ? Math.max(...widthPerUnitCandidates)
        : 88;
      const heightPerUnit = heightPerUnitCandidates.length
        ? Math.max(...heightPerUnitCandidates)
        : 34;
      maxUnitWidth = Math.max(maxUnitWidth, widthPerUnit);
      maxUnitHeight = Math.max(maxUnitHeight, heightPerUnit);
    });
    const normalizedUnitWidth = Math.max(36, Math.round(maxUnitWidth));
    const normalizedUnitHeight = Math.max(24, Math.round(maxUnitHeight));
    tableCells.forEach((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      const rowSpan = Math.max(1, pos?.rowSpan || Number(cellElement.rowSpan || 1));
      const colSpan = Math.max(1, pos?.colSpan || Number(cellElement.colSpan || 1));
      cellElement.style.minWidth = `${Math.max(36, normalizedUnitWidth * colSpan)}px`;
      cellElement.style.height = `${Math.max(24, normalizedUnitHeight * rowSpan)}px`;
    });
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const handleToggleDocTableContentLock = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const nextEnabled = !getDocTableContentLockFromTable(tableElement);
    if (nextEnabled) {
      tableElement.dataset.noteTableLockSize = 'true';
      tableElement.dataset.noteTableWrap = 'false';
      setDocTableWrapEnabled(false);
    } else {
      tableElement.removeAttribute('data-note-table-lock-size');
    }
    setDocTableContentLockEnabled(nextEnabled);
    handleInput();
    applyDocTableSelectionVisual(docTableSelectionState);
  };
  const handleToggleDocTableExtraToolsMenu = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    setDocTablePageAlignValue(getDocTablePageAlignFromTable(tableElement));
    setDocTableContentLockEnabled(getDocTableContentLockFromTable(tableElement));
    setDocTableWrapEnabled(getDocTableWrapFromTable(tableElement));
    setIsDocTableExtraToolsMenuOpen((prev) => !prev);
    setIsDocTableFillColorPickerOpen(false);
    setIsDocTableBorderColorPickerOpen(false);
    setIsDocTableCellAlignMenuOpen(false);
    setIsDocTableResizeMenuOpen(false);
  };
  const handleDocHorizontalAlignAction = (horizontalAlign = 'left') => {
    const normalizedHorizontal = normalizeDocTableHorizontalAlign(horizontalAlign, 'left');
    if (getDocTableSelectionSnapshot()) {
      applyDocTableCellAlign(normalizedHorizontal, docTableCellAlignValue.vertical);
      return;
    }
    if (normalizedHorizontal === 'center') {
      execCmd('justifyCenter');
      return;
    }
    if (normalizedHorizontal === 'right') {
      execCmd('justifyRight');
      return;
    }
    execCmd('justifyLeft');
  };
  const handleMergeSelectedDocTableCells = async () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement, bounds, selectedCells } = selectionSnapshot;
    const rowCount = bounds.maxRow - bounds.minRow + 1;
    const colCount = bounds.maxCol - bounds.minCol + 1;
    if (rowCount <= 1 && colCount <= 1) return;
    const expectedCellCount = rowCount * colCount;
    const hasMergedCells = selectedCells.some((cellElement) => {
      const pos = getDocTableCellPosition(cellElement);
      return !pos || pos.rowSpan > 1 || pos.colSpan > 1;
    });
    if (hasMergedCells || selectedCells.length !== expectedCellCount) {
      await popup.alert({
        title: 'Merge not available',
        message: 'Please select a simple rectangle without merged cells first.',
      });
      return;
    }
    const anchorCell =
      selectedCells.find((cellElement) => {
        const pos = getDocTableCellPosition(cellElement);
        return pos && pos.row === bounds.minRow && pos.col === bounds.minCol;
      }) || selectedCells[0];
    if (!anchorCell) return;
    const selectedCellMeta = selectedCells
      .map((cellElement) => ({
        cellElement,
        pos: getDocTableCellPosition(cellElement),
      }))
      .filter((item) => Boolean(item.pos));
    const topRowCells = selectedCellMeta
      .filter((item) => item.pos.row === bounds.minRow)
      .sort((leftItem, rightItem) => leftItem.pos.col - rightItem.pos.col);
    const leftColCells = selectedCellMeta
      .filter((item) => item.pos.col === bounds.minCol)
      .sort((leftItem, rightItem) => leftItem.pos.row - rightItem.pos.row);
    const mergedRegionWidth = topRowCells.reduce((totalWidth, item) => {
      const computedStyle = window.getComputedStyle(item.cellElement);
      const measuredWidth = Number.parseFloat(
        String(item.cellElement.getBoundingClientRect().width || 0)
      );
      const fallbackWidth = Number.parseFloat(
        String(item.cellElement.style.minWidth || computedStyle.minWidth || '88')
      );
      const nextWidth = Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : Number.isFinite(fallbackWidth) && fallbackWidth > 0
        ? fallbackWidth
        : 88;
      return totalWidth + nextWidth;
    }, 0);
    const mergedRegionHeight = leftColCells.reduce((totalHeight, item) => {
      const computedStyle = window.getComputedStyle(item.cellElement);
      const measuredHeight = Number.parseFloat(
        String(item.cellElement.getBoundingClientRect().height || 0)
      );
      const fallbackHeight = Number.parseFloat(
        String(item.cellElement.style.height || computedStyle.height || '34')
      );
      const nextHeight = Number.isFinite(measuredHeight) && measuredHeight > 0
        ? measuredHeight
        : Number.isFinite(fallbackHeight) && fallbackHeight > 0
        ? fallbackHeight
        : 34;
      return totalHeight + nextHeight;
    }, 0);
    const extraHtml = selectedCells
      .filter((cellElement) => cellElement !== anchorCell)
      .map((cellElement) => String(cellElement.innerHTML || '').trim())
      .filter((htmlValue) => htmlValue && htmlValue.toLowerCase() !== '<br>')
      .join('<br>');
    const anchorHtml = String(anchorCell.innerHTML || '').trim();
    const hasAnchorContent = anchorHtml && anchorHtml.toLowerCase() !== '<br>';
    if (extraHtml) {
      anchorCell.innerHTML = hasAnchorContent ? `${anchorCell.innerHTML}<br>${extraHtml}` : extraHtml;
    }
    selectedCells.forEach((cellElement) => {
      if (cellElement === anchorCell) return;
      cellElement.remove();
    });
    anchorCell.rowSpan = rowCount;
    anchorCell.colSpan = colCount;
    anchorCell.setAttribute('rowspan', String(rowCount));
    anchorCell.setAttribute('colspan', String(colCount));
    if (mergedRegionWidth > 0) {
      anchorCell.style.minWidth = `${Math.max(36, Math.round(mergedRegionWidth))}px`;
    }
    if (mergedRegionHeight > 0) {
      anchorCell.style.height = `${Math.max(24, Math.round(mergedRegionHeight))}px`;
    }
    normalizeDocTableStructure(tableElement);
    const nextSelection = applyDocTableSelectionByRange(
      tableElement,
      bounds.minRow,
      bounds.minCol,
      bounds.minRow,
      bounds.minCol
    );
    handleInput();
    if (nextSelection) {
      applyDocTableSelectionVisual(nextSelection);
    }
  };
  const handleUnmergeSelectedDocTableCell = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement, selectedCells } = selectionSnapshot;
    if (selectedCells.length !== 1) return;
    const targetCell = selectedCells[0];
    const targetPos = getDocTableCellPosition(targetCell);
    if (!targetPos) return;
    if (targetPos.rowSpan <= 1 && targetPos.colSpan <= 1) return;
    const startRow = targetPos.row;
    const startCol = targetPos.col;
    const rowSpan = Math.max(1, targetPos.rowSpan);
    const colSpan = Math.max(1, targetPos.colSpan);
    const cellTagName =
      String(targetCell.tagName || '').toLowerCase() === 'th' ? 'th' : 'td';
    const styleText = String(targetCell.getAttribute('style') || '').trim();
    targetCell.rowSpan = 1;
    targetCell.colSpan = 1;
    targetCell.removeAttribute('rowspan');
    targetCell.removeAttribute('colspan');
    for (let row = startRow; row < startRow + rowSpan; row += 1) {
      const rowElement = tableElement.rows?.[row];
      if (!rowElement) continue;
      for (let col = startCol; col < startCol + colSpan; col += 1) {
        if (row === startRow && col === startCol) continue;
        normalizeDocTableStructure(tableElement);
        const rowAnchors = Array.from(rowElement.cells || []);
        let insertBeforeNode = null;
        for (let index = 0; index < rowAnchors.length; index += 1) {
          const candidate = rowAnchors[index];
          const candidatePos = getDocTableCellPosition(candidate);
          if (!candidatePos) continue;
          if (candidatePos.col > col) {
            insertBeforeNode = candidate;
            break;
          }
        }
        const newCell = document.createElement(cellTagName);
        if (styleText) {
          newCell.setAttribute('style', styleText);
        }
        newCell.innerHTML = '<br>';
        rowElement.insertBefore(newCell, insertBeforeNode);
      }
    }
    normalizeDocTableStructure(tableElement);
    handleInput();
    clearDocTableSelection();
  };
  const applyUniformScaleToDocTable = (tableElement, nextScaleInput) => {
    if (!tableElement) return false;
    const previousScale = normalizeDocTableScale(tableElement.dataset.noteTableScale || '100');
    const nextScale = normalizeDocTableScale(nextScaleInput, previousScale);
    setDocTableScaleDraft(String(Math.round(nextScale)));
    if (Math.abs(nextScale - previousScale) < 0.01) return false;
    const scaleRatio = nextScale / Math.max(1, previousScale);
    tableElement.style.width = `${nextScale}%`;
    tableElement.style.maxWidth = 'none';
    const tableCells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    tableCells.forEach((cellElement) => {
      const computedStyle = window.getComputedStyle(cellElement);
      const minWidth = Number.parseFloat(String(cellElement.style.minWidth || computedStyle.minWidth || '88'));
      const cellHeight = Number.parseFloat(String(cellElement.style.height || computedStyle.height || '34'));
      const fontSize = Number.parseFloat(String(cellElement.style.fontSize || computedStyle.fontSize || '14'));
      const nextWidth = Math.max(36, Math.round((Number.isFinite(minWidth) ? minWidth : 88) * scaleRatio));
      const nextHeight = Math.max(24, Math.round((Number.isFinite(cellHeight) ? cellHeight : 34) * scaleRatio));
      const nextFontSize = Math.max(
        8,
        Number(((Number.isFinite(fontSize) ? fontSize : 14) * scaleRatio).toFixed(2))
      );
      cellElement.style.minWidth = `${nextWidth}px`;
      cellElement.style.height = `${nextHeight}px`;
      cellElement.style.fontSize = `${nextFontSize}px`;
    });
    tableElement.dataset.noteTableScale = String(Math.round(nextScale));
    return true;
  };
  const applyLiveDocTableScale = (nextScaleInput) => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return false;
    const { tableElement } = selectionSnapshot;
    const dimensions = getDocTableDimensions(tableElement);
    const nextSelection = applyDocTableSelectionByRange(
      tableElement,
      0,
      0,
      Math.max(0, dimensions.rows - 1),
      Math.max(0, dimensions.cols - 1)
    );
    const didApplyScale = applyUniformScaleToDocTable(tableElement, nextScaleInput);
    if (nextSelection) {
      applyDocTableSelectionVisual(nextSelection);
    }
    if (didApplyScale) {
      handleInput();
    }
    return didApplyScale;
  };
  const applyDocTableCornerResizeDrag = (resizeState, deltaX, deltaY) => {
    if (!resizeState?.tableId) return false;
    const tableElement = getDocTableElementById(resizeState.tableId);
    if (!tableElement) return false;
    const direction = String(resizeState.direction || 'se').toLowerCase();
    const widthDelta = direction.includes('e') ? deltaX : direction.includes('w') ? -deltaX : 0;
    const heightDelta = direction.includes('s') ? deltaY : direction.includes('n') ? -deltaY : 0;
    const startFrameWidth = Math.max(1, Number(resizeState.startFrameWidth) || 1);
    const startFrameHeight = Math.max(1, Number(resizeState.startFrameHeight) || 1);
    const nextFrameWidth = Math.max(8, startFrameWidth + widthDelta);
    const nextFrameHeight = Math.max(8, startFrameHeight + heightDelta);
    const rawRatioX = nextFrameWidth / startFrameWidth;
    const rawRatioY = nextFrameHeight / startFrameHeight;
    const ratioY = Math.max(0.01, Math.min(24, rawRatioY));
    const startScale = Math.max(1, Number(resizeState.startScale) || 100);
    const nextScale = Math.max(0.5, Math.min(4000, startScale * rawRatioX));
    const ratioX = nextScale / startScale;
    tableElement.style.width = `${nextScale}%`;
    tableElement.style.maxWidth = 'none';
    tableElement.dataset.noteTableScale = String(Math.round(nextScale));
    const fontScale = Math.max(0.01, Math.min(24, (ratioX + ratioY) / 2));
    const cellMetrics = Array.isArray(resizeState.cellMetrics) ? resizeState.cellMetrics : [];
    cellMetrics.forEach((metric) => {
      if (!metric?.cellElement) return;
      const baseMinWidth = Math.max(1, Number(metric.minWidth) || 88);
      const baseHeight = Math.max(1, Number(metric.height) || 34);
      const baseFontSize = Math.max(1, Number(metric.fontSize) || 14);
      metric.cellElement.style.minWidth = `${Math.max(1, Math.round(baseMinWidth * ratioX))}px`;
      metric.cellElement.style.height = `${Math.max(1, Math.round(baseHeight * ratioY))}px`;
      metric.cellElement.style.fontSize = `${Math.max(
        1,
        Number((baseFontSize * fontScale).toFixed(2))
      )}px`;
    });
    setDocTableScaleDraft(String(Math.round(nextScale)));
    return true;
  };
  const handleDocTableCornerResizeStart = (event, direction = 'se') => {
    if (!isActiveDocPage || !isDocTableResizeMenuOpen) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const tableId = String(tableElement.dataset.noteTableId || '').trim();
    if (!tableId) return;
    const frame = getDocTableSelectionFrameInViewport(docTableSelectionState);
    if (!frame) return;
    const tableCells = Array.from(
      tableElement.querySelectorAll('td[data-note-table-cell="true"], th[data-note-table-cell="true"]')
    );
    if (!tableCells.length) return;
    const cellMetrics = tableCells.map((cellElement) => {
      const computedStyle = window.getComputedStyle(cellElement);
      const minWidth = Number.parseFloat(
        String(cellElement.style.minWidth || computedStyle.minWidth || '88')
      );
      const height = Number.parseFloat(String(cellElement.style.height || computedStyle.height || '34'));
      const fontSize = Number.parseFloat(
        String(cellElement.style.fontSize || computedStyle.fontSize || '14')
      );
      return {
        cellElement,
        minWidth: Number.isFinite(minWidth) ? minWidth : 88,
        height: Number.isFinite(height) ? height : 34,
        fontSize: Number.isFinite(fontSize) ? fontSize : 14,
      };
    });
    const startScale = normalizeDocTableScale(tableElement.dataset.noteTableScale || '100');
    docTableCornerResizeRef.current = {
      active: true,
      tableId,
      direction: ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'].includes(direction) ? direction : 'se',
      hasMoved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrameWidth: frame.width,
      startFrameHeight: frame.height,
      startScale,
      cellMetrics,
    };
  };
  const handleDocTableScaleDraftChange = (event) => {
    const value = String(event.target.value || '').replace(/[^\d]/g, '').slice(0, 3);
    setDocTableScaleDraft(value);
    if (!value) return;
    applyLiveDocTableScale(value);
  };
  const commitDocTableScaleDraft = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const dimensions = getDocTableDimensions(tableElement);
    const nextSelection = applyDocTableSelectionByRange(
      tableElement,
      0,
      0,
      Math.max(0, dimensions.rows - 1),
      Math.max(0, dimensions.cols - 1)
    );
    const didApplyScale = applyUniformScaleToDocTable(tableElement, docTableScaleDraft);
    if (nextSelection) {
      applyDocTableSelectionVisual(nextSelection);
    }
    if (didApplyScale) {
      handleInput();
    }
  };
  const handleDocTableScaleDraftKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitDocTableScaleDraft();
  };
  const handleDocTableScaleRangeChange = (event) => {
    const nextScaleValue = String(
      Math.round(normalizeDocTableScale(event.target.value, 100))
    );
    setDocTableScaleDraft(nextScaleValue);
    applyLiveDocTableScale(nextScaleValue);
  };
  const handleToggleDocTableResizeMenu = () => {
    const selectionSnapshot = getDocTableSelectionSnapshot();
    if (!selectionSnapshot) return;
    const { tableElement } = selectionSnapshot;
    const dimensions = getDocTableDimensions(tableElement);
    const nextSelection = applyDocTableSelectionByRange(
      tableElement,
      0,
      0,
      Math.max(0, dimensions.rows - 1),
      Math.max(0, dimensions.cols - 1)
    );
    if (nextSelection) {
      applyDocTableSelectionVisual(nextSelection);
    }
    setIsDocTableResizeMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setDocTableScaleDraft(
          String(Math.round(normalizeDocTableScale(tableElement.dataset.noteTableScale || '100')))
        );
        setIsDocTableFillColorPickerOpen(false);
        setIsDocTableBorderColorPickerOpen(false);
        setIsDocTableCellAlignMenuOpen(false);
        setIsDocTableExtraToolsMenuOpen(false);
      }
      return next;
    });
  };
  const handleOpenLinkMenuTarget = (target = '_blank') => {
    const href = String(docLinkMenuState?.href || '').trim();
    if (!href) return;
    window.open(href, target, 'noopener,noreferrer');
    setDocLinkMenuState(null);
  };
  const handleEditLinkFromMenu = async () => {
    const linkId = String(docLinkMenuState?.linkId || '').trim();
    if (!linkId || !editorRef.current) return;
    const linkNode = editorRef.current.querySelector(`a[data-note-link-id="${linkId}"]`);
    if (!linkNode) {
      setDocLinkMenuState(null);
      return;
    }
    const linkForm = await popup.promptForm({
      title: 'Edit link',
      fields: [
        {
          id: 'displayText',
          label: 'Text to display',
          placeholder: 'Link text',
          defaultValue: String(linkNode.textContent || '').trim(),
          type: 'text',
        },
        {
          id: 'url',
          label: 'Paste URL (https://...)',
          placeholder: 'https://example.com',
          defaultValue: String(linkNode.getAttribute('href') || '').trim(),
          type: 'url',
        },
      ],
    });
    if (linkForm === null) return;
    const textValueRaw = String(linkForm?.displayText || '').trim();
    const linkValueRaw = String(linkForm?.url || '').trim();
    const normalized = String(linkValueRaw || '').trim();
    if (!normalized) return;
    const normalizedWithProtocol =
      /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    linkNode.href = normalizedWithProtocol;
    linkNode.textContent = String(textValueRaw || '').trim() || normalizedWithProtocol;
    linkNode.target = '_blank';
    linkNode.rel = 'noopener noreferrer';
    handleInput();
    setDocLinkMenuState(null);
  };
  const handleDocEditorKeyDown = (event) => {
    if (!isActiveDocPage) return;
    const hasShortcutModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (hasShortcutModifier) {
      const lowerKey = String(event.key || '').toLowerCase();
      if (lowerKey === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedoNoteChange();
        } else {
          handleUndoNoteChange();
        }
        return;
      }
      if (lowerKey === 'y') {
        event.preventDefault();
        handleRedoNoteChange();
        return;
      }
    }
    const isTypingKey =
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;
    const activeSelectedImageId = getActiveSelectedImageId();
    const hasSelectedImage = Boolean(activeSelectedImageId && getImageById(activeSelectedImageId));
    const hasTextSelection = hasExpandedDocSelection();
    if (hasSelectedImage && !hasTextSelection) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const lowerKey = String(event.key || '').toLowerCase();
        if (lowerKey === 'c') {
          event.preventDefault();
          void handleCopyOrCutImageById(activeSelectedImageId, false);
          return;
        }
        if (lowerKey === 'x') {
          event.preventDefault();
          void handleCopyOrCutImageById(activeSelectedImageId, true);
          return;
        }
        if (lowerKey === 'v') {
          const internalClipboard = docImageClipboardRef.current;
          if (String(internalClipboard?.payload?.src || '').trim()) {
            event.preventDefault();
            insertImageAtCursor(String(internalClipboard.payload.src || '').trim(), internalClipboard.payload);
            if (internalClipboard.cut) {
              docImageClipboardRef.current = null;
            }
          }
          return;
        }
      }
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          handleDeleteImageById(activeSelectedImageId);
          return;
        }
      }
    }
    const docTableSelectionSnapshot = hasDocTableSelection ? getDocTableSelectionSnapshot() : null;
    const docTableSelectedCellCount = Number(docTableSelectionSnapshot?.selectedCells?.length || 0);
    const isMultiDocTableSelection = docTableSelectedCellCount > 1;
    const isSingleDocTableSelection = docTableSelectedCellCount === 1;
    const isDocTableFixedSizeMode = Boolean(
      docTableSelectionSnapshot?.tableElement &&
        getDocTableContentLockFromTable(docTableSelectionSnapshot.tableElement)
    );
    if (isMultiDocTableSelection) {
      if (isTypingKey) {
        event.preventDefault();
        applyTextToSelectedDocTableCells(event.key, 'append');
        return;
      }
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          applyTextToSelectedDocTableCells('', 'clear');
          return;
        }
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const lowerKey = String(event.key || '').toLowerCase();
        if (lowerKey === 'v') {
          return;
        }
      }
    }
    if (isSingleDocTableSelection && isDocTableFixedSizeMode && event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Backspace' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const listContext = getCurrentListContext();
      if (listContext?.range && isCaretAtStartOfListItem(listContext.listItem, listContext.range)) {
        event.preventDefault();
        const didUnwrap = unwrapListItemToParagraph(listContext.listItem, listContext.listNode);
        if (didUnwrap) {
          handleInput();
          schedulePresenceUpdate(getEditorTypingPreview());
        }
        return;
      }
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode || null;
      const inListItem = Boolean(anchorNode?.parentElement?.closest?.('li'));
      if (inListItem) {
        execCmd(event.shiftKey ? 'outdent' : 'indent');
      } else {
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
        handleInput();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = String(event.key || '').toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        void handleInsertLink();
      }
    }
  };
  const handleDocEditorBeforeInput = (event) => {
    if (!isActiveDocPage || !hasDocTableSelection) return;
    const inputType = String(event?.nativeEvent?.inputType || event?.inputType || '').trim();
    if (!inputType) return;
    const docTableSelectionSnapshot = getDocTableSelectionSnapshot();
    const docTableSelectedCellCount = Number(docTableSelectionSnapshot?.selectedCells?.length || 0);
    const isMultiDocTableSelection = docTableSelectedCellCount > 1;
    const isSingleDocTableSelection = docTableSelectedCellCount === 1;
    const isDocTableFixedSizeMode = Boolean(
      docTableSelectionSnapshot?.tableElement &&
        getDocTableContentLockFromTable(docTableSelectionSnapshot.tableElement)
    );
    if (isMultiDocTableSelection) {
      if (inputType.startsWith('insert')) {
        const insertedText = String(event?.nativeEvent?.data ?? event?.data ?? '');
        if (insertedText) {
          event.preventDefault();
          applyTextToSelectedDocTableCells(insertedText, 'append');
          return;
        }
        if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
          event.preventDefault();
          if (!isDocTableFixedSizeMode) {
            applyTextToSelectedDocTableCells('\n', 'append');
          }
        }
        return;
      }
      if (inputType.startsWith('deleteContent')) {
        event.preventDefault();
        applyTextToSelectedDocTableCells('', 'clear');
      }
      return;
    }
    if (isSingleDocTableSelection && isDocTableFixedSizeMode) {
      if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
        event.preventDefault();
      }
    }
  };
  const handleDocEditorPaste = (event) => {
    if (!isActiveDocPage) return;
    const clipboardData = event.clipboardData || null;
    const pastedText = String(clipboardData?.getData('text/plain') || '');
    const pastedHtml = String(clipboardData?.getData('text/html') || '');
    const clipboardItems = Array.from(clipboardData?.items || []);
    if (!hasDocTableSelection) {
      const pastedImageItem = clipboardItems.find((item) =>
        String(item?.type || '').toLowerCase().startsWith('image/')
      );
      const pastedImageFile = pastedImageItem?.getAsFile?.() || null;
      if (pastedImageFile) {
        event.preventDefault();
        void readFileAsDataUrl(pastedImageFile)
          .then((imageSrc) => {
            if (!imageSrc || !editorRef.current) return;
            insertImageAtCursor(imageSrc);
          })
          .catch(() => {
            // Ignore clipboard image read failures.
          });
        return;
      }
      const internalClipboard = docImageClipboardRef.current;
      const markerToken = pastedText.startsWith(NOTE_IMAGE_CLIPBOARD_PREFIX)
        ? pastedText.slice(NOTE_IMAGE_CLIPBOARD_PREFIX.length).trim()
        : '';
      const markerMatchesInternalClipboard = Boolean(
        markerToken &&
          internalClipboard &&
          String(internalClipboard.token || '') === markerToken &&
          String(internalClipboard.payload?.src || '').trim()
      );
      const pastedCopiedImageSrc = Boolean(
        pastedText &&
          internalClipboard &&
          String(internalClipboard.payload?.src || '').trim() &&
          pastedText.trim() === String(internalClipboard.payload.src || '').trim()
      );
      const htmlImageSrc = extractImageSrcFromHtmlClipboard(pastedHtml);
      const pastedDataUrlImage = /^data:image\/[a-z0-9.+-]+;base64,/i.test(pastedText.trim());
      let imageSrcToInsert = '';
      let payloadForInsert = null;
      if (markerMatchesInternalClipboard) {
        imageSrcToInsert = String(internalClipboard.payload.src || '').trim();
        payloadForInsert = internalClipboard.payload;
      } else if (pastedCopiedImageSrc) {
        imageSrcToInsert = String(internalClipboard.payload.src || '').trim();
        payloadForInsert = internalClipboard.payload;
      } else if (htmlImageSrc) {
        imageSrcToInsert = htmlImageSrc;
      } else if (pastedDataUrlImage) {
        imageSrcToInsert = pastedText.trim();
      }
      if (imageSrcToInsert) {
        event.preventDefault();
        insertImageAtCursor(imageSrcToInsert, payloadForInsert);
        if (
          internalClipboard?.cut &&
          (markerMatchesInternalClipboard || pastedCopiedImageSrc)
        ) {
          docImageClipboardRef.current = null;
        }
        return;
      }
      const canUseInternalClipboardFallback = Boolean(
        internalClipboard &&
          String(internalClipboard.payload?.src || '').trim() &&
          !pastedText.trim() &&
          !pastedHtml.trim() &&
          clipboardItems.length === 0
      );
      if (canUseInternalClipboardFallback) {
        event.preventDefault();
        insertImageAtCursor(
          String(internalClipboard.payload.src || '').trim(),
          internalClipboard.payload
        );
        if (internalClipboard.cut) {
          docImageClipboardRef.current = null;
        }
      }
      return;
    }
    if (!pastedText) return;
    const selectionSnapshot = getDocTableSelectionSnapshot();
    const docTableSelectedCellCount = Number(selectionSnapshot?.selectedCells?.length || 0);
    if (docTableSelectedCellCount <= 0) return;
    const isMultiDocTableSelection = docTableSelectedCellCount > 1;
    if (isMultiDocTableSelection) {
      event.preventDefault();
      pasteTextIntoDocTableSelection(pastedText);
      return;
    }
    const isDocTableFixedSizeMode = Boolean(
      selectionSnapshot?.tableElement &&
        getDocTableContentLockFromTable(selectionSnapshot.tableElement)
    );
    if (docTableSelectedCellCount === 1 && isDocTableFixedSizeMode && /[\r\n]/.test(pastedText)) {
      event.preventDefault();
      const sanitizedText = pastedText.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, sanitizedText);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(sanitizedText);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      handleInput();
    }
  };
  const getDocCursorLine = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return 1;
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) return 1;
    const range = selection.getRangeAt(0).cloneRange();
    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    const text = preRange.toString();
    const line = text.split(/\r?\n/).length;
    return Number.isFinite(line) ? Math.max(1, line) : 1;
  };
  const emitPresenceUpdate = (typingText = '') => {
    if (typeof onPresenceUpdate !== 'function') return;
    const payload = {
      pageId: activePage?.id || '',
      pageType: activePage?.type || 'doc',
      line:
        activePage?.type === 'sheet'
          ? `${toSheetColumnLabel(sheetSelection.col)}${sheetSelection.row + 1}`
          : String(getDocCursorLine()),
      typingText: String(typingText || '').trim().slice(0, NOTE_PRESENCE_TYPING_MAX),
      updatedAt: new Date().toISOString(),
    };
    onPresenceUpdate(noteId, payload);
  };
  const schedulePresenceUpdate = (typingText = '') => {
    if (presenceTimerRef.current) {
      window.clearTimeout(presenceTimerRef.current);
    }
    presenceTimerRef.current = window.setTimeout(() => {
      emitPresenceUpdate(typingText);
    }, 220);
  };
  const switchActivePage = (nextPageId) => {
    const normalizedId = String(nextPageId || '').trim();
    if (!normalizedId) return;
    const exists = noteDocument.pages.some((page) => page.id === normalizedId);
    if (!exists) return;
    if (noteDocument.activePageId !== normalizedId || activePageId !== normalizedId) {
      persistNoteDocument({
        ...noteDocument,
        activePageId: normalizedId,
      });
    }
    setActivePageId(normalizedId);
    setImageMenuState(null);
    setIsPagePickerOpen(false);
    setSheetSelection({ row: 0, col: 0 });
    setSheetSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 },
    });
    sheetSelectionDragRef.current.active = false;
    sheetSelectionDragRef.current.hasMoved = false;
    setSheetEditingCell(null);
    schedulePresenceUpdate('');
  };
  const handleToggleEditorFullScreen = () => {
    if (typeof onToggleFullScreen !== 'function') return;
    const currentPageId = String(activePage?.id || '').trim();
    if (currentPageId && noteDocument.activePageId !== currentPageId) {
      persistNoteDocument({
        ...noteDocument,
        activePageId: currentPageId,
      });
    }
    onToggleFullScreen(currentPageId);
  };
  const addPage = async (type) => {
    const normalizedType = type === 'sheet' ? 'sheet' : 'doc';
    const nextIndex =
      noteDocument.pages.filter((page) => page.type === normalizedType).length + 1;
    const defaultTitle = normalizedType === 'sheet' ? `Sheet ${nextIndex}` : `Doc ${nextIndex}`;
    const nextTitleRaw = await popup.prompt({
      title: `Create ${normalizedType === 'sheet' ? 'Sheet' : 'Doc'} page`,
      message: 'Set page name',
      placeholder: normalizedType === 'sheet' ? 'Sheet name' : 'Doc name',
      defaultValue: defaultTitle,
      confirmText: 'Add',
    });
    if (nextTitleRaw === null) return;
    const nextTitle = String(nextTitleRaw || '').trim();
    if (!nextTitle) {
      await popup.alert({
        title: 'Missing page name',
        message: 'Please enter a page name before adding.',
      });
      return;
    }
    const page =
      normalizedType === 'sheet'
        ? { ...createDefaultNoteSheetPage(), title: nextTitle }
        : { ...createDefaultNoteDocPage(''), title: nextTitle };
    const nextDocument = {
      ...noteDocument,
      pages: [...noteDocument.pages, page],
      activePageId: page.id,
    };
    persistNoteDocument(nextDocument);
    setActivePageId(page.id);
    setSheetSelection({ row: 0, col: 0 });
    setSheetSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 },
    });
    sheetSelectionDragRef.current.active = false;
    sheetSelectionDragRef.current.hasMoved = false;
    setSheetEditingCell(null);
    setIsPagePickerOpen(false);
    schedulePresenceUpdate('');
  };
  const togglePinPage = (pageId) => {
    const normalizedId = String(pageId || '').trim();
    if (!normalizedId) return;
    const targetPage = noteDocument.pages.find((page) => page.id === normalizedId);
    if (!targetPage) return;
    const nextPages = noteDocument.pages.map((page) =>
      page.id === normalizedId ? { ...page, pinned: !Boolean(page.pinned) } : page
    );
    persistNoteDocument({
      ...noteDocument,
      pages: nextPages,
      activePageId: activePageId || normalizedId,
    });
  };
  const removePage = async (pageId) => {
    if (noteDocument.pages.length <= 1) return;
    const normalizedId = String(pageId || '').trim();
    if (!normalizedId) return;
    const targetPage = noteDocument.pages.find((page) => page.id === normalizedId);
    if (!targetPage) return;
    const shouldDelete = await popup.confirm({
      title: `Delete ${targetPage.type === 'sheet' ? 'Sheet' : 'Doc'} page`,
      message: `Are you sure you want to delete "${targetPage.title || 'Untitled Page'}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    const nextPages = noteDocument.pages.filter((page) => page.id !== normalizedId);
    if (nextPages.length === noteDocument.pages.length) return;
    const fallbackPageId = nextPages[0]?.id || '';
    const nextActivePageId = activePageId === normalizedId ? fallbackPageId : activePageId;
    const nextDocument = {
      ...noteDocument,
      pages: nextPages,
      activePageId: nextActivePageId,
    };
    persistNoteDocument(nextDocument);
    setActivePageId(nextActivePageId);
    setSheetSelection({ row: 0, col: 0 });
    setSheetSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 },
    });
    sheetSelectionDragRef.current.active = false;
    sheetSelectionDragRef.current.hasMoved = false;
    setSheetEditingCell(null);
  };
  const renamePage = async (pageId) => {
    const normalizedId = String(pageId || '').trim();
    if (!normalizedId) return;
    const targetPage = noteDocument.pages.find((page) => page.id === normalizedId);
    if (!targetPage) return;
    const nextTitleRaw = await popup.prompt({
      title: `Rename ${targetPage.type === 'sheet' ? 'Sheet' : 'Doc'} page`,
      message: 'Enter new page name',
      placeholder: targetPage.type === 'sheet' ? 'Sheet name' : 'Doc name',
      defaultValue: targetPage.title || '',
      confirmText: 'Rename',
    });
    if (nextTitleRaw === null) return;
    const nextTitle = String(nextTitleRaw || '').trim();
    if (!nextTitle) return;
    const nextPages = noteDocument.pages.map((page) =>
      page.id === normalizedId ? { ...page, title: nextTitle } : page
    );
    persistNoteDocument({
      ...noteDocument,
      pages: nextPages,
      activePageId: activePageId || normalizedId,
    });
  };
  const buildExportHtmlForCurrentPage = () => {
    if (isActiveSheetPage) {
      const rows = Math.max(1, Number(activePage?.rows || 1));
      const cols = Math.max(1, Number(activePage?.cols || 1));
      const cells = activePage?.cells && typeof activePage.cells === 'object' ? activePage.cells : {};
      const tableRows = Array.from({ length: rows }, (_, rowIndex) => {
        const columns = Array.from({ length: cols }, (_, colIndex) => {
          const cellKey = getSheetCellKey(rowIndex, colIndex);
          const cell = normalizeNoteSheetCell(cells[cellKey] || {});
          const style = [
            `text-align:${cell.style.align}`,
            `font-weight:${cell.style.bold ? '700' : '400'}`,
            `font-style:${cell.style.italic ? 'italic' : 'normal'}`,
            `text-decoration:${cell.style.underline ? 'underline' : 'none'}`,
            `font-size:${cell.style.fontSize || '14px'}`,
            `color:${cell.style.color}`,
            `background:${cell.style.bgColor}`,
            'border:1px solid #cbd5e1',
            'padding:6px',
            'min-width:80px',
          ].join(';');
          return `<td style="${style}">${String(cell.text || '')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</td>`;
        }).join('');
        return `<tr>${columns}</tr>`;
      }).join('');
      return `<h2>${activePage?.title || noteTitle}</h2><table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${tableRows}</table>`;
    }
    return `<h2>${activePage?.title || noteTitle}</h2>${String(activePage?.content || '')}`;
  };
  const downloadBlobFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const handleExportPdf = () => {
    const popupWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!popupWindow) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${noteTitle}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#0f172a} table{border-collapse:collapse} td,th{border:1px solid #cbd5e1;padding:6px}</style></head><body>${buildExportHtmlForCurrentPage()}</body></html>`;
    popupWindow.document.open();
    popupWindow.document.write(html);
    popupWindow.document.close();
    popupWindow.focus();
    popupWindow.print();
  };
  const updateSheetCell = (row, col, nextText) => {
    if (!isActiveSheetPage) return;
    const cellKey = getSheetCellKey(row, col);
    const safeText = String(nextText || '').slice(0, 2000);
    updateActivePage((page) => {
      const currentCells = page.cells && typeof page.cells === 'object' ? page.cells : {};
      const nextCells = {
        ...currentCells,
        [cellKey]: {
          ...normalizeNoteSheetCell(currentCells[cellKey] || {}),
          text: safeText,
        },
      };
      return {
        ...page,
        cells: nextCells,
      };
    });
    schedulePresenceUpdate(safeText);
  };
  const updateSelectedSheetCellStyle = (patch) => {
    if (!isActiveSheetPage) return;
    const row = sheetSelection.row;
    const col = sheetSelection.col;
    const cellKey = getSheetCellKey(row, col);
    updateActivePage((page) => {
      const currentCells = page.cells && typeof page.cells === 'object' ? page.cells : {};
      const currentCell = normalizeNoteSheetCell(currentCells[cellKey] || {});
      return {
        ...page,
        cells: {
          ...currentCells,
          [cellKey]: {
            ...currentCell,
            style: {
              ...currentCell.style,
              ...patch,
            },
          },
        },
      };
    });
    schedulePresenceUpdate('');
  };
  const buildSheetSelectionClipboardText = () => {
    if (!isActiveSheetPage) return '';
    const cells = activePage?.cells && typeof activePage.cells === 'object' ? activePage.cells : {};
    const lines = [];
    for (let row = sheetSelectionBounds.minRow; row <= sheetSelectionBounds.maxRow; row += 1) {
      const lineValues = [];
      for (let col = sheetSelectionBounds.minCol; col <= sheetSelectionBounds.maxCol; col += 1) {
        const key = getSheetCellKey(row, col);
        const text = String(normalizeNoteSheetCell(cells[key] || {}).text || '');
        lineValues.push(text);
      }
      lines.push(lineValues.join('\t'));
    }
    return lines.join('\n');
  };
  const rememberSheetClipboardSelection = (mode) => {
    setSheetClipboardState({
      mode: mode === 'cut' ? 'cut' : 'copy',
      pageId: String(activePage?.id || ''),
      start: {
        row: sheetSelectionBounds.minRow,
        col: sheetSelectionBounds.minCol,
      },
      end: {
        row: sheetSelectionBounds.maxRow,
        col: sheetSelectionBounds.maxCol,
      },
    });
  };
  const writeTextToSystemClipboard = async (text) => {
    const safeText = String(text || '');
    if (!safeText) return;
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(safeText);
    } catch (error) {
      // Ignore clipboard errors in unsupported browser/security contexts.
    }
  };
  const clearSelectedSheetCells = () => {
    if (!isActiveSheetPage) return;
    updateActivePage((page) => {
      const currentCells = page.cells && typeof page.cells === 'object' ? page.cells : {};
      const nextCells = { ...currentCells };
      for (let row = sheetSelectionBounds.minRow; row <= sheetSelectionBounds.maxRow; row += 1) {
        for (let col = sheetSelectionBounds.minCol; col <= sheetSelectionBounds.maxCol; col += 1) {
          const key = getSheetCellKey(row, col);
          const currentCell = normalizeNoteSheetCell(currentCells[key] || {});
          if (!currentCell.text) continue;
          nextCells[key] = {
            ...currentCell,
            text: '',
          };
        }
      }
      return {
        ...page,
        cells: nextCells,
      };
    });
    schedulePresenceUpdate('');
  };
  const copySelectedSheetCells = async () => {
    const clipboardText = buildSheetSelectionClipboardText();
    rememberSheetClipboardSelection('copy');
    await writeTextToSystemClipboard(clipboardText);
    setSheetQuickMenu(null);
  };
  const cutSelectedSheetCells = async () => {
    const clipboardText = buildSheetSelectionClipboardText();
    rememberSheetClipboardSelection('cut');
    await writeTextToSystemClipboard(clipboardText);
    setSheetQuickMenu(null);
  };
  const pasteTextIntoSelectedSheetCells = (rawText) => {
    if (!isActiveSheetPage) return;
    const normalizedText = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalizedText) return;
    const rows = normalizedText.split('\n');
    if (rows.length > 1 && rows[rows.length - 1] === '') {
      rows.pop();
    }
    const matrix = rows.map((line) => line.split('\t'));
    if (!matrix.length) return;
    const start = normalizeSheetCellCoord(sheetSelectionBounds.minRow, sheetSelectionBounds.minCol);
    const maxRow = Math.max(0, Number(activePage?.rows || 1) - 1);
    const maxCol = Math.max(0, Number(activePage?.cols || 1) - 1);
    const targetMaxRow = Math.min(maxRow, start.row + matrix.length - 1);
    const widestCols = matrix.reduce((currentMax, line) => Math.max(currentMax, line.length), 1);
    const targetMaxCol = Math.min(maxCol, start.col + widestCols - 1);

    updateActivePage((page) => {
      const currentCells = page.cells && typeof page.cells === 'object' ? page.cells : {};
      const nextCells = { ...currentCells };
      const clipboardStart = normalizeSheetCellCoord(
        sheetClipboardState?.start?.row ?? -1,
        sheetClipboardState?.start?.col ?? -1
      );
      const clipboardEnd = normalizeSheetCellCoord(
        sheetClipboardState?.end?.row ?? -1,
        sheetClipboardState?.end?.col ?? -1
      );
      const canApplyCutMove =
        sheetClipboardState?.mode === 'cut' &&
        String(sheetClipboardState?.pageId || '') === String(page.id || '');
      if (canApplyCutMove) {
        const cutMinRow = Math.min(clipboardStart.row, clipboardEnd.row);
        const cutMaxRow = Math.max(clipboardStart.row, clipboardEnd.row);
        const cutMinCol = Math.min(clipboardStart.col, clipboardEnd.col);
        const cutMaxCol = Math.max(clipboardStart.col, clipboardEnd.col);
        for (let row = cutMinRow; row <= cutMaxRow; row += 1) {
          for (let col = cutMinCol; col <= cutMaxCol; col += 1) {
            const isOverlappingPasteArea =
              row >= start.row &&
              row <= targetMaxRow &&
              col >= start.col &&
              col <= targetMaxCol;
            if (isOverlappingPasteArea) continue;
            const key = getSheetCellKey(row, col);
            const currentCell = normalizeNoteSheetCell(currentCells[key] || {});
            if (!currentCell.text) continue;
            nextCells[key] = {
              ...currentCell,
              text: '',
            };
          }
        }
      }
      matrix.forEach((line, rowOffset) => {
        const row = start.row + rowOffset;
        if (row > maxRow) return;
        line.forEach((value, colOffset) => {
          const col = start.col + colOffset;
          if (col > maxCol) return;
          const key = getSheetCellKey(row, col);
          const currentCell = normalizeNoteSheetCell(currentCells[key] || {});
          nextCells[key] = {
            ...currentCell,
            text: String(value || ''),
          };
        });
      });
      return {
        ...page,
        cells: nextCells,
      };
    });

    const nextEnd = { row: targetMaxRow, col: targetMaxCol };
    setSheetSelectionRange({
      start,
      end: nextEnd,
    });
    setSheetSelection(nextEnd);
    setSheetEditingCell(null);
    setSheetQuickMenu(null);
    setSheetClipboardState(null);
    schedulePresenceUpdate('');
  };
  const openSheetQuickMenu = (event, row, col) => {
    if (!isCompactSheetViewport) return;
    const cellRect = event.currentTarget?.getBoundingClientRect?.();
    if (!cellRect) return;
    const menuWidth = 180;
    const menuHeight = 42;
    const margin = 8;
    const viewportWidth = window.innerWidth || menuWidth + margin * 2;
    const viewportHeight = window.innerHeight || menuHeight + margin * 2;
    const nextLeft = Math.min(
      Math.max(margin, cellRect.left),
      Math.max(margin, viewportWidth - menuWidth - margin)
    );
    const preferredTop = cellRect.bottom + margin;
    const fallbackTop = cellRect.top - menuHeight - margin;
    const nextTop =
      preferredTop + menuHeight <= viewportHeight
        ? preferredTop
        : Math.max(margin, fallbackTop);
    setSheetQuickMenu((prev) => {
      if (prev && prev.row === row && prev.col === col) return null;
      return {
        row,
        col,
        left: nextLeft,
        top: nextTop,
      };
    });
  };
  const handleSheetCellSelect = (row, col) => {
    setSheetQuickMenu(null);
    setSheetEditingCell(null);
    setSingleSheetSelection(row, col);
    window.requestAnimationFrame(() => {
      sheetPaneRef.current?.focus();
    });
    schedulePresenceUpdate('');
  };
  const handleSheetCellDoubleClick = (row, col) => {
    if (!isActiveSheetPage) return;
    setSheetQuickMenu(null);
    const coord = setSingleSheetSelection(row, col);
    sheetSelectionDragRef.current.active = false;
    sheetSelectionDragRef.current.hasMoved = false;
    setSheetEditingCell(coord);
    schedulePresenceUpdate('');
  };
  const handleSheetCellMouseDown = (event, row, col) => {
    if (event.button !== 0) return;
    setSheetQuickMenu(null);
    event.preventDefault();
    beginSheetRangeSelection(row, col);
    if (event.detail <= 1) {
      window.requestAnimationFrame(() => {
        sheetPaneRef.current?.focus();
      });
    }
  };
  const handleSheetCellMouseEnter = (event, row, col) => {
    if (!sheetSelectionDragRef.current.active) return;
    if ((event.buttons & 1) !== 1) {
      endSheetRangeSelection();
      return;
    }
    extendSheetRangeSelection(row, col);
  };
  const handleSheetCellClick = (event, row, col) => {
    if (event?.detail > 1) return;
    if (sheetSelectionDragRef.current.hasMoved) {
      sheetSelectionDragRef.current.hasMoved = false;
      return;
    }
    if (sheetSelectionDragRef.current.active) return;
    if (isMobileNoteViewport) {
      const coord = setSingleSheetSelection(row, col);
      sheetSelectionDragRef.current.active = false;
      sheetSelectionDragRef.current.hasMoved = false;
      setSheetQuickMenu(null);
      setSheetEditingCell(coord);
      schedulePresenceUpdate('');
      return;
    }
    const isSameCell = row === sheetSelection.row && col === sheetSelection.col;
    if (isCompactSheetViewport && isSameCell) {
      openSheetQuickMenu(event, row, col);
      return;
    }
    handleSheetCellSelect(row, col);
  };
  const handleSheetCellKeyDown = (event, row, col) => {
    if (!isActiveSheetPage) return;
    if (sheetEditingCell) return;
    const lowerKey = String(event.key || '').toLowerCase();
    const hasShortcutModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (hasShortcutModifier && lowerKey === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        handleRedoNoteChange();
      } else {
        handleUndoNoteChange();
      }
      return;
    }
    if (hasShortcutModifier && lowerKey === 'y') {
      event.preventDefault();
      handleRedoNoteChange();
      return;
    }
    if (hasShortcutModifier && lowerKey === 'c') {
      event.preventDefault();
      void copySelectedSheetCells();
      return;
    }
    if (hasShortcutModifier && lowerKey === 'x') {
      event.preventDefault();
      void cutSelectedSheetCells();
      return;
    }
    const isTypingKey =
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;
    if (isTypingKey) {
      event.preventDefault();
      const coord = normalizeSheetCellCoord(row, col);
      setSheetSelectionWithCollapsedRange(coord);
      updateSheetCell(coord.row, coord.col, event.key);
      sheetSelectionDragRef.current.active = false;
      sheetSelectionDragRef.current.hasMoved = false;
      setSheetQuickMenu(null);
      setSheetEditingCell(coord);
      return;
    }
    if (isDesktopSheetViewport && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      clearSelectedSheetCells();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSheetSelectionWithCollapsedRange((prev) => ({
        row: Math.max(0, prev.row - 1),
        col: prev.col,
      }));
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const maxRow = Math.max(0, Number(activePage?.rows || 1) - 1);
      setSheetSelectionWithCollapsedRange((prev) => ({
        row: Math.min(maxRow, prev.row + 1),
        col: prev.col,
      }));
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSheetSelectionWithCollapsedRange((prev) => ({
        row: prev.row,
        col: Math.max(0, prev.col - 1),
      }));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const maxCol = Math.max(0, Number(activePage?.cols || 1) - 1);
      setSheetSelectionWithCollapsedRange((prev) => ({
        row: prev.row,
        col: Math.min(maxCol, prev.col + 1),
      }));
    }
  };
  const currentFormatState = isActiveSheetPage
    ? {
        bold: Boolean(selectedSheetCell?.style?.bold),
        italic: Boolean(selectedSheetCell?.style?.italic),
        underline: Boolean(selectedSheetCell?.style?.underline),
        highlight: Boolean(
          selectedSheetCell?.style?.bgColor &&
            String(selectedSheetCell.style.bgColor).trim().toLowerCase() !== '#ffffff' &&
            String(selectedSheetCell.style.bgColor).trim().toLowerCase() !== 'rgb(255,255,255)'
        ),
      }
    : activeFormats;
  const docTableSelectionBounds = React.useMemo(
    () => getDocTableSelectionBounds(docTableSelectionState),
    [
      docTableSelectionState?.tableId,
      docTableSelectionState?.startRow,
      docTableSelectionState?.startCol,
      docTableSelectionState?.endRow,
      docTableSelectionState?.endCol,
    ]
  );
  const hasDocTableSelection = Boolean(
    isActiveDocPage &&
      docTableSelectionState?.tableId &&
      docTableSelectionBounds &&
      getDocTableElementById(docTableSelectionState.tableId)
  );
  const docTableSelectionRowCount = docTableSelectionBounds
    ? docTableSelectionBounds.maxRow - docTableSelectionBounds.minRow + 1
    : 0;
  const docTableSelectionColCount = docTableSelectionBounds
    ? docTableSelectionBounds.maxCol - docTableSelectionBounds.minCol + 1
    : 0;
  const docTableSelectionCellCount = docTableSelectionRowCount * docTableSelectionColCount;
  const canMergeDocTableSelection = hasDocTableSelection && docTableSelectionCellCount > 1;
  const canUnmergeDocTableSelection = React.useMemo(() => {
    if (!hasDocTableSelection || !docTableSelectionBounds) return false;
    if (
      docTableSelectionBounds.minRow !== docTableSelectionBounds.maxRow ||
      docTableSelectionBounds.minCol !== docTableSelectionBounds.maxCol
    ) {
      return false;
    }
    const tableElement = getDocTableElementById(docTableSelectionState?.tableId);
    if (!tableElement) return false;
    normalizeDocTableStructure(tableElement);
    const selectedCell = getDocTableCellAtCoordinate(
      tableElement,
      docTableSelectionBounds.minRow,
      docTableSelectionBounds.minCol
    );
    if (!selectedCell) return false;
    const pos = getDocTableCellPosition(selectedCell);
    return Boolean(pos && (pos.rowSpan > 1 || pos.colSpan > 1));
  }, [
    hasDocTableSelection,
    docTableSelectionState?.tableId,
    docTableSelectionBounds?.minRow,
    docTableSelectionBounds?.maxRow,
    docTableSelectionBounds?.minCol,
    docTableSelectionBounds?.maxCol,
    activePageId,
  ]);
  const handleFormatMouseDown = (event) => {
    event.preventDefault();
  };
  const closeEditorFloatingMenus = () => {
    setIsPagePickerOpen(false);
    setIsDocTextColorPickerOpen(false);
    setIsDocHighlightColorPickerOpen(false);
    setIsDocUnderlineMenuOpen(false);
    setIsDocFontSizeMenuOpen(false);
    setIsDocInsertTableMenuOpen(false);
    setIsDocTableFillColorPickerOpen(false);
    setIsDocTableBorderColorPickerOpen(false);
    setIsDocTableCellAlignMenuOpen(false);
    setIsDocTableResizeMenuOpen(false);
    setIsDocTableExtraToolsMenuOpen(false);
  };
  const toggleMobileToolbarSection = (sectionId) => {
    const normalized = String(sectionId || '').trim();
    closeEditorFloatingMenus();
    setMobileToolbarSection((prev) => (prev === normalized ? '' : normalized));
  };
  const sheetRows = Math.max(1, Number(activePage?.rows || 1));
  const sheetCols = Math.max(1, Number(activePage?.cols || 1));
  const sheetSelectionBounds = React.useMemo(() => {
    const start = normalizeSheetCellCoord(
      sheetSelectionRange?.start?.row ?? sheetSelection.row,
      sheetSelectionRange?.start?.col ?? sheetSelection.col
    );
    const end = normalizeSheetCellCoord(
      sheetSelectionRange?.end?.row ?? sheetSelection.row,
      sheetSelectionRange?.end?.col ?? sheetSelection.col
    );
    return {
      minRow: Math.min(start.row, end.row),
      maxRow: Math.max(start.row, end.row),
      minCol: Math.min(start.col, end.col),
      maxCol: Math.max(start.col, end.col),
    };
  }, [
    sheetSelectionRange?.start?.row,
    sheetSelectionRange?.start?.col,
    sheetSelectionRange?.end?.row,
    sheetSelectionRange?.end?.col,
    sheetSelection.row,
    sheetSelection.col,
    activePage?.rows,
    activePage?.cols,
  ]);
  const sheetSelectionStartLabel = `${toSheetColumnLabel(sheetSelectionBounds.minCol)}${sheetSelectionBounds.minRow + 1}`;
  const sheetSelectionEndLabel = `${toSheetColumnLabel(sheetSelectionBounds.maxCol)}${sheetSelectionBounds.maxRow + 1}`;
  const sheetSelectionRowCount = sheetSelectionBounds.maxRow - sheetSelectionBounds.minRow + 1;
  const sheetSelectionColCount = sheetSelectionBounds.maxCol - sheetSelectionBounds.minCol + 1;
  const sheetSelectionCellCount = sheetSelectionRowCount * sheetSelectionColCount;
  const isSheetRangeSelection = sheetSelectionCellCount > 1;
  const sheetSelectionSummary = isSheetRangeSelection
    ? `Range ${sheetSelectionStartLabel} to ${sheetSelectionEndLabel} • Rows ${sheetSelectionRowCount} • Cols ${sheetSelectionColCount} • Total ${sheetSelectionCellCount} cells`
    : `Selected cell: ${sheetSelectionStartLabel}`;
  const sheetClipboardBounds = React.useMemo(() => {
    if (!isActiveSheetPage || !sheetClipboardState) return null;
    if (String(sheetClipboardState.pageId || '') !== String(activePage?.id || '')) return null;
    const start = normalizeSheetCellCoord(
      sheetClipboardState?.start?.row ?? 0,
      sheetClipboardState?.start?.col ?? 0
    );
    const end = normalizeSheetCellCoord(
      sheetClipboardState?.end?.row ?? 0,
      sheetClipboardState?.end?.col ?? 0
    );
    return {
      minRow: Math.min(start.row, end.row),
      maxRow: Math.max(start.row, end.row),
      minCol: Math.min(start.col, end.col),
      maxCol: Math.max(start.col, end.col),
    };
  }, [
    isActiveSheetPage,
    activePage?.id,
    activePage?.rows,
    activePage?.cols,
    sheetClipboardState?.pageId,
    sheetClipboardState?.start?.row,
    sheetClipboardState?.start?.col,
    sheetClipboardState?.end?.row,
    sheetClipboardState?.end?.col,
  ]);
  const activePresenceItems = React.useMemo(
    () =>
      (Array.isArray(presenceItems) ? presenceItems : [])
        .map((entry) => normalizeNotePresenceEntry(entry))
        .filter((entry) => {
          if (!entry.userId) return false;
          if (entry.pageId && activePage?.id && entry.pageId !== activePage.id) return false;
          const ageMs = Date.now() - toTimestampMs(entry.updatedAt);
          return ageMs <= NOTE_PRESENCE_TTL_MS;
        })
        .sort((left, right) => toTimestampMs(right.updatedAt) - toTimestampMs(left.updatedAt))
        .slice(0, 12),
    [presenceItems, activePage?.id]
  );
  const getPresenceDisplayName = (entry) =>
    String(entry?.displayName || entry?.username || 'User').trim() || 'User';
  const docPresenceItems = React.useMemo(
    () =>
      activePresenceItems
        .filter((entry) => entry.pageType !== 'sheet')
        .map((entry) => {
          const userKey = String(entry.userId || entry.username || '').trim();
          return {
            ...entry,
            presenceKey: userKey || `${entry.pageId}-${entry.pageType}-${entry.line}`,
            label: getPresenceDisplayName(entry),
            cursorColor: getPresenceCursorColor(userKey || entry.updatedAt),
          };
        }),
    [activePresenceItems]
  );
  const sheetPresenceByCell = React.useMemo(() => {
    const nextMap = new Map();
    if (!isActiveSheetPage) return nextMap;
    activePresenceItems.forEach((entry) => {
      if (entry.pageType !== 'sheet') return;
      const coord = parseSheetCellReference(entry.line);
      if (!coord) return;
      if (coord.row < 0 || coord.col < 0 || coord.row >= sheetRows || coord.col >= sheetCols) return;
      const userKey = String(entry.userId || entry.username || '').trim();
      const key = `${coord.row}-${coord.col}`;
      const currentItems = nextMap.get(key) || [];
      currentItems.push({
        ...entry,
        presenceKey: userKey || `${key}-${entry.line}`,
        label: getPresenceDisplayName(entry),
        cursorColor: getPresenceCursorColor(userKey || key),
      });
      nextMap.set(key, currentItems);
    });
    nextMap.forEach((items, key) => {
      nextMap.set(
        key,
        [...items].sort((left, right) => toTimestampMs(right.updatedAt) - toTimestampMs(left.updatedAt))
      );
    });
    return nextMap;
  }, [isActiveSheetPage, activePresenceItems, sheetRows, sheetCols]);
  const refreshDocPresenceCursorFrames = React.useCallback(() => {
    if (!isActiveDocPage) {
      setDocPresenceCursorFrames([]);
      return;
    }
    const viewportNode = docViewportRef.current || editorContainerRef.current;
    const editorNode = editorRef.current;
    if (!viewportNode || !editorNode || !docPresenceItems.length) {
      setDocPresenceCursorFrames([]);
      return;
    }
    const viewportRect = viewportNode.getBoundingClientRect();
    const editorRect = editorNode.getBoundingClientRect();
    const viewportScrollLeft = Number(viewportNode.scrollLeft || 0);
    const viewportScrollTop = Number(viewportNode.scrollTop || 0);
    const plainText = String(editorNode.innerText || editorNode.textContent || '').replace(/\r/g, '');
    const totalLines = Math.max(1, plainText.split('\n').length);
    const contentHeight = Math.max(24, Number(editorNode.scrollHeight || editorNode.offsetHeight || 0));
    const availableTrack = Math.max(0, contentHeight - 20);
    const baseX = editorRect.left - viewportRect.left + viewportScrollLeft + 10;
    const baseY = editorRect.top - viewportRect.top + viewportScrollTop;
    const nextFrames = docPresenceItems.map((entry) => {
      const parsedLine = Number.parseInt(String(entry.line || '1'), 10);
      const lineNumber = Number.isFinite(parsedLine)
        ? Math.min(totalLines, Math.max(1, parsedLine))
        : 1;
      const ratio = totalLines <= 1 ? 0 : (lineNumber - 1) / (totalLines - 1);
      return {
        key: entry.presenceKey,
        label: entry.label,
        cursorColor: entry.cursorColor,
        x: baseX,
        y: baseY + Math.round(ratio * availableTrack) + 6,
      };
    });
    setDocPresenceCursorFrames((prev) => (isJsonEqual(prev, nextFrames) ? prev : nextFrames));
  }, [isActiveDocPage, docPresenceItems]);
  React.useEffect(() => {
    if (!isActiveDocPage || !docPresenceItems.length) {
      setDocPresenceCursorFrames([]);
      return undefined;
    }
    let rafId = 0;
    const syncFrame = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        refreshDocPresenceCursorFrames();
      });
    };
    syncFrame();
    const viewportNode = docViewportRef.current;
    const editorNode = editorRef.current;
    viewportNode?.addEventListener('scroll', syncFrame, { passive: true });
    editorNode?.addEventListener('scroll', syncFrame, { passive: true });
    window.addEventListener('resize', syncFrame);
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && editorNode) {
      resizeObserver = new ResizeObserver(() => {
        syncFrame();
      });
      resizeObserver.observe(editorNode);
    }
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      viewportNode?.removeEventListener('scroll', syncFrame);
      editorNode?.removeEventListener('scroll', syncFrame);
      window.removeEventListener('resize', syncFrame);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isActiveDocPage, activePageId, docPresenceItems, refreshDocPresenceCursorFrames]);
  const sortPagesForPicker = (pages) =>
    [...pages].sort((left, right) => {
      const leftPinned = Boolean(left?.pinned) ? 1 : 0;
      const rightPinned = Boolean(right?.pinned) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      return String(left?.title || '').localeCompare(String(right?.title || ''), undefined, {
        sensitivity: 'base',
      });
    });
  const docPages = sortPagesForPicker(noteDocument.pages.filter((page) => page.type !== 'sheet'));
  const sheetPages = sortPagesForPicker(noteDocument.pages.filter((page) => page.type === 'sheet'));

  return (
    <div
      ref={editorContainerRef}
      className={`relative flex flex-col h-full w-full min-w-0 bg-white overflow-hidden ${
        isFullScreen ? '' : 'border border-gray-200 rounded-xl shadow-sm'
      }`}
    >
      <div
        className="relative z-30 bg-gray-50 border-b border-gray-200 p-3 space-y-2"
        data-note-editor-full-header={isFullScreen ? 'true' : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isFullScreen && typeof onBackToProject === 'function' && (
            <button
              type="button"
              onClick={onBackToProject}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
              title="Back to project notes"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="mr-auto min-w-0">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2 min-w-0">
              {isActiveSheetPage ? (
                <LayoutGrid className="w-4 h-4 text-blue-500 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              )}
              <span className="truncate">{noteTitle}</span>
            </h3>
            {isFullScreen && (
              <p className="mt-0.5 pl-6 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                Full Note Editor
              </p>
            )}
          </div>

          <div ref={pagePickerRef} className="relative">
            <button
              type="button"
              onClick={() => setIsPagePickerOpen((prev) => !prev)}
              className="h-10 px-3 min-w-0 max-w-[68vw] md:max-w-none bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-gray-700 inline-flex items-center gap-1.5 transition-colors shadow-sm text-sm"
              title="Select note page"
            >
              {isActiveSheetPage ? <LayoutGrid size={15} className="text-blue-500" /> : <FileText size={15} className="text-blue-500" />}
              <span className="max-w-[36vw] md:max-w-[120px] truncate">{activePage?.title || 'Page'}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {isPagePickerOpen && (
              <div className="absolute right-0 top-11 z-40 w-72 max-w-[calc(100vw-20px)] bg-white border border-gray-200 rounded-xl shadow-xl p-2 space-y-2">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-1">
                  Pages
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  <div>
                    <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                      Doc ({docPages.length})
                    </p>
                    <div className="space-y-1">
                      {docPages.map((page) => (
                        <div key={page.id} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => switchActivePage(page.id)}
                            className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                              page.id === activePageId
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <FileText size={14} className="shrink-0" />
                              <span className="truncate">{page.title || 'Untitled Doc'}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinPage(page.id)}
                            className={`h-8 w-8 rounded-md border ${
                              page.pinned
                                ? 'text-amber-600 border-amber-200 bg-amber-50'
                                : 'text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-600'
                            }`}
                            title={page.pinned ? 'Unpin page' : 'Pin page'}
                          >
                            <Flag size={13} className={`mx-auto ${page.pinned ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void renamePage(page.id)}
                            className="h-8 w-8 rounded-md border text-gray-500 hover:bg-gray-50 hover:text-blue-600"
                            title="Rename page"
                          >
                            <Edit2 size={13} className="mx-auto" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removePage(page.id)}
                            disabled={noteDocument.pages.length <= 1}
                            className={`h-8 w-8 rounded-md border text-gray-500 ${
                              noteDocument.pages.length <= 1
                                ? 'cursor-not-allowed opacity-40'
                                : 'hover:bg-red-50 hover:text-red-600'
                            }`}
                            title="Delete page"
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                      Sheet ({sheetPages.length})
                    </p>
                    <div className="space-y-1">
                      {sheetPages.map((page) => (
                        <div key={page.id} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => switchActivePage(page.id)}
                            className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                              page.id === activePageId
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <LayoutGrid size={14} className="shrink-0" />
                              <span className="truncate">{page.title || 'Untitled Sheet'}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinPage(page.id)}
                            className={`h-8 w-8 rounded-md border ${
                              page.pinned
                                ? 'text-amber-600 border-amber-200 bg-amber-50'
                                : 'text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-600'
                            }`}
                            title={page.pinned ? 'Unpin page' : 'Pin page'}
                          >
                            <Flag size={13} className={`mx-auto ${page.pinned ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void renamePage(page.id)}
                            className="h-8 w-8 rounded-md border text-gray-500 hover:bg-gray-50 hover:text-blue-600"
                            title="Rename page"
                          >
                            <Edit2 size={13} className="mx-auto" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removePage(page.id)}
                            disabled={noteDocument.pages.length <= 1}
                            className={`h-8 w-8 rounded-md border text-gray-500 ${
                              noteDocument.pages.length <= 1
                                ? 'cursor-not-allowed opacity-40'
                                : 'hover:bg-red-50 hover:text-red-600'
                            }`}
                            title="Delete page"
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => void addPage('doc')}
                    className="flex-1 h-8 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    + Doc
                  </button>
                  <button
                    type="button"
                    onClick={() => void addPage('sheet')}
                    className="flex-1 h-8 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    + Sheet
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isFullScreen && !isMobileNoteViewport && (
            <>
              <div className="flex items-center bg-white border border-gray-200 rounded-md p-1 shadow-sm">
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => {
                    if (isActiveSheetPage) {
                      updateSelectedSheetCellStyle({ bold: !Boolean(selectedSheetCell?.style?.bold) });
                      return;
                    }
                    execCmd('bold');
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    currentFormatState.bold ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => {
                    if (isActiveSheetPage) {
                      updateSelectedSheetCellStyle({ italic: !Boolean(selectedSheetCell?.style?.italic) });
                      return;
                    }
                    execCmd('italic');
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    currentFormatState.italic ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={16} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => {
                    if (isActiveSheetPage) {
                      updateSelectedSheetCellStyle({
                        underline: !Boolean(selectedSheetCell?.style?.underline),
                      });
                      return;
                    }
                    handleApplyUnderline();
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    currentFormatState.underline
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Underline (Ctrl+U)"
                >
                  <Underline size={16} />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-1"></div>
            </>
          )}

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadImage}
            className="hidden"
          />
          {!isFullScreen && !isMobileNoteViewport && (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isActiveSheetPage}
              className={`h-10 w-10 border rounded-md flex items-center justify-center transition-colors shadow-sm ${
                isActiveSheetPage
                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title={isActiveSheetPage ? 'Image upload is available in Doc page' : 'Upload image'}
            >
              <ImageIcon size={16} className={isActiveSheetPage ? 'text-gray-300' : 'text-blue-500'} />
            </button>
          )}
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={handleToggleEditorFullScreen}
              className="h-10 w-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-gray-700 flex items-center justify-center transition-colors shadow-sm"
              title={isFullScreen ? 'Exit full editor' : 'Open full editor'}
            >
              {isFullScreen ? <Minimize2 size={16} className="text-blue-500" /> : <Maximize2 size={16} className="text-blue-500" />}
            </button>
          )}
        </div>

        {isMobileNoteViewport && (
          <div className="md:hidden rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-2 space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={handleUndoNoteChange}
                disabled={!canUndoNoteChange}
                className={`h-8 px-2.5 text-xs rounded border shrink-0 ${
                  canUndoNoteChange
                    ? 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                    : 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                }`}
              >
                Undo
              </button>
              <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={handleRedoNoteChange}
                disabled={!canRedoNoteChange}
                className={`h-8 px-2.5 text-xs rounded border shrink-0 ${
                  canRedoNoteChange
                    ? 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                    : 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                }`}
              >
                Redo
              </button>
              <span className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
                <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={() => {
                  if (isActiveSheetPage) {
                    updateSelectedSheetCellStyle({ bold: !Boolean(selectedSheetCell?.style?.bold) });
                    return;
                  }
                  execCmd('bold');
                }}
                className={`h-8 w-8 inline-flex items-center justify-center rounded border shrink-0 ${
                  currentFormatState.bold
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Bold"
              >
                <Bold size={14} />
              </button>
                <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={() => {
                  if (isActiveSheetPage) {
                    updateSelectedSheetCellStyle({ italic: !Boolean(selectedSheetCell?.style?.italic) });
                    return;
                  }
                  execCmd('italic');
                }}
                className={`h-8 w-8 inline-flex items-center justify-center rounded border shrink-0 ${
                  currentFormatState.italic
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Italic"
              >
                <Italic size={14} />
              </button>
                <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={() => {
                  if (isActiveSheetPage) {
                    updateSelectedSheetCellStyle({
                      underline: !Boolean(selectedSheetCell?.style?.underline),
                    });
                    return;
                  }
                  handleApplyUnderline();
                }}
                className={`h-8 w-8 inline-flex items-center justify-center rounded border shrink-0 ${
                  currentFormatState.underline
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Underline"
              >
                <Underline size={14} />
              </button>
              </div>
              <div className={`grid gap-1.5 ${isActiveSheetPage ? 'grid-cols-1' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => toggleMobileToolbarSection('format')}
                  className={`h-8 px-2 text-xs rounded border inline-flex items-center justify-center gap-1 ${
                    mobileToolbarSection === 'format'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Settings size={12} />
                  Format
                </button>
                {!isActiveSheetPage && (
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => toggleMobileToolbarSection('insert')}
                    className={`h-8 px-2 text-xs rounded border inline-flex items-center justify-center gap-1 ${
                      mobileToolbarSection === 'insert'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Plus size={12} />
                    Insert
                  </button>
                )}
                {!isActiveSheetPage && (
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => toggleMobileToolbarSection('table')}
                    className={`h-8 px-2 text-xs rounded border inline-flex items-center justify-center gap-1 ${
                      mobileToolbarSection === 'table'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Table2 size={12} />
                    Table
                  </button>
                )}
              </div>
            </div>
            {mobileToolbarSection === 'format' && (
              <div className="border-t border-gray-100 bg-slate-50 p-2.5 space-y-2.5">
                {!isActiveSheetPage && (
                  <label className="block text-[11px] font-medium text-gray-600">
                    <span className="mb-1 block">Font</span>
                    <select
                      value={docFontFamilyValue}
                      onChange={handleApplyFontFamily}
                      className="w-full h-9 border border-gray-200 rounded px-2 text-xs bg-white text-gray-700"
                    >
                      <option value="">Default</option>
                      {DOC_FONT_FAMILY_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((fontOption) => (
                            <option
                              key={`${group.label}-${fontOption.value}`}
                              value={fontOption.value}
                              style={{ fontFamily: fontOption.cssFamily }}
                            >
                              {fontOption.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}
                <div className="flex items-end gap-2">
                  <label className="text-[11px] font-medium text-gray-600">
                    <span className="mb-1 block">Size</span>
                    <input
                      value={docFontSizeDraft}
                      onChange={handleDocFontSizeDraftChange}
                      onKeyDown={handleDocFontSizeDraftKeyDown}
                      inputMode="numeric"
                      className="w-20 h-9 text-sm border border-gray-200 rounded px-2 bg-white text-gray-700"
                      placeholder="14"
                    />
                  </label>
                  <span className="text-xs text-gray-500 pb-2">px</span>
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={commitDocFontSizeDraft}
                    className="ml-auto h-9 px-3 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  >
                    Set size
                  </button>
                </div>
                {isActiveSheetPage ? (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateSelectedSheetCellStyle({ align: 'left' })}
                        className="h-9 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedSheetCellStyle({ align: 'center' })}
                        className="h-9 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Center
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedSheetCellStyle({ align: 'right' })}
                        className="h-9 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Right
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-medium text-gray-600">
                        <span className="mb-1 block">Text color</span>
                        <input
                          type="color"
                          onChange={handleApplyTextColor}
                          value={selectedSheetCell?.style?.color || '#111827'}
                          className="h-9 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-gray-600">
                        <span className="mb-1 block">Cell color</span>
                        <input
                          type="color"
                          onChange={handleApplyCellBackgroundColor}
                          value={selectedSheetCell?.style?.bgColor || '#ffffff'}
                          className="h-9 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-medium text-gray-600">
                        <span className="mb-1 block">Text color</span>
                        <input
                          type="color"
                          value={docTextColorValue}
                          onChange={(event) => applyTextColorValue(event.target.value)}
                          className="h-9 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-gray-600">
                        <span className="mb-1 block">Highlight</span>
                        <input
                          type="color"
                          value={docHighlightColorValue}
                          onChange={(event) => applyHighlightColorValue(event.target.value)}
                          className="h-9 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleToggleHighlight}
                        className={`h-9 px-2 text-xs rounded border ${
                          currentFormatState.highlight
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        Highlight
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleApplyUnderline}
                        className="h-9 px-2 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Underline
                      </button>
                      <select
                        value={docUnderlineStyle}
                        onChange={(event) => setDocUnderlineStyle(String(event.target.value || 'solid'))}
                        className="h-9 w-full min-w-0 border border-gray-200 rounded px-2 text-xs bg-white text-gray-700"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleInsertBulletList}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Bulleted list"
                      >
                        <List size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleInsertNumberList}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Numbered list"
                      >
                        <ListOrdered size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => handleDocHorizontalAlignAction('left')}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Align left"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => handleDocHorizontalAlignAction('center')}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Align center"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => handleDocHorizontalAlignAction('right')}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Align right"
                      >
                        <AlignRight size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => execCmd('outdent')}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Decrease indent"
                      >
                        <IndentDecrease size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => execCmd('indent')}
                        className="h-9 w-full inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Increase indent"
                      >
                        <IndentIncrease size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {mobileToolbarSection === 'insert' && (
              <div className="border-t border-gray-100 bg-slate-50 p-2.5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={handleInsertLink}
                    className="h-9 px-2.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 inline-flex items-center justify-center gap-1.5"
                  >
                    <LinkIcon size={13} />
                    Link
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => uploadInputRef.current?.click()}
                    className="h-9 px-2.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 inline-flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon size={13} />
                    Image
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-gray-600">
                    <span className="mb-1 block">Rows</span>
                    <input
                      value={docTableDraftRows}
                      onChange={handleDocTableDraftRowsChange}
                      onKeyDown={handleDocTableDraftKeyDown}
                      inputMode="numeric"
                      className="w-full h-9 text-sm border border-gray-200 rounded px-2 bg-white text-gray-700"
                      placeholder="4"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-gray-600">
                    <span className="mb-1 block">Columns</span>
                    <input
                      value={docTableDraftCols}
                      onChange={handleDocTableDraftColsChange}
                      onKeyDown={handleDocTableDraftKeyDown}
                      inputMode="numeric"
                      className="w-full h-9 text-sm border border-gray-200 rounded px-2 bg-white text-gray-700"
                      placeholder="4"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => {
                    void insertDocTable(docTableDraftRows, docTableDraftCols);
                  }}
                  className="w-full h-9 px-2.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 inline-flex items-center justify-center gap-1"
                >
                  <Table2 size={13} />
                  Insert table
                </button>
              </div>
            )}
            {mobileToolbarSection === 'table' && (
              <div className="border-t border-gray-100 bg-slate-50 p-2.5 space-y-2.5">
                {hasDocTableSelection ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-gray-600">
                        Fill
                        <input
                          type="color"
                          value={docTableFillColorValue === 'transparent' ? '#ffffff' : docTableFillColorValue}
                          onChange={(event) => applyDocTableFillColorValue(event.target.value)}
                          className="mt-1 h-8 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                      <label className="text-[11px] text-gray-600">
                        Border
                        <input
                          type="color"
                          value={docTableBorderColorValue === 'transparent' ? '#cbd5e1' : docTableBorderColorValue}
                          onChange={(event) => applyDocTableBorderColorValue(event.target.value)}
                          className="mt-1 h-8 w-full p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTableFillColorValue('transparent')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Fill transparent
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTableBorderColorValue('#cbd5e1')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Border default
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTableBorderColorValue('transparent')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Border transparent
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[11px] text-gray-600">
                        Design
                        <select
                          value={docTableBorderDesignValue}
                          onChange={(event) => handleDocTableBorderDesignChange(event.target.value)}
                          className="mt-1 h-8 w-full border border-gray-200 rounded px-2 text-xs bg-white text-gray-700"
                        >
                          {DOC_TABLE_BORDER_DESIGN_OPTIONS.map((option) => (
                            <option key={`mobile-doc-border-design-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-gray-600">
                        Style
                        <select
                          value={docTableBorderLineStyleValue}
                          onChange={handleDocTableBorderLineStyleChange}
                          className="mt-1 h-8 w-full border border-gray-200 rounded px-2 text-xs bg-white text-gray-700"
                        >
                          {DOC_TABLE_BORDER_LINE_STYLE_OPTIONS.map((option) => (
                            <option key={`mobile-doc-border-style-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-gray-600">
                        Width
                        <select
                          value={docTableBorderLineWidthValue}
                          onChange={handleDocTableBorderLineWidthChange}
                          className="mt-1 h-8 w-full border border-gray-200 rounded px-2 text-xs bg-white text-gray-700"
                        >
                          {DOC_TABLE_BORDER_WIDTH_OPTIONS.map((widthValue) => (
                            <option key={`mobile-doc-border-width-${widthValue}`} value={widthValue}>
                              {widthValue}px
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleToggleDocTableWrap}
                        className={`px-2.5 py-1.5 text-xs rounded border ${
                          docTableWrapEnabled
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        Wrap
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => {
                          if (canUnmergeDocTableSelection) {
                            handleUnmergeSelectedDocTableCell();
                            return;
                          }
                          void handleMergeSelectedDocTableCells();
                        }}
                        disabled={!canUnmergeDocTableSelection && !canMergeDocTableSelection}
                        className={`px-2.5 py-1.5 text-xs rounded border ${
                          canUnmergeDocTableSelection || canMergeDocTableSelection
                            ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                            : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canUnmergeDocTableSelection ? 'Unmerge' : 'Merge'}
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() =>
                          applyDocTableCellAlign('left', docTableCellAlignValue.vertical)
                        }
                        className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Cell align left"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() =>
                          applyDocTableCellAlign('center', docTableCellAlignValue.vertical)
                        }
                        className="h-8 w-8 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Cell align center"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() =>
                          applyDocTableCellAlign('right', docTableCellAlignValue.vertical)
                        }
                        className="h-8 w-8 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Cell align right"
                      >
                        <AlignRight size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={docTableScaleDraft}
                        onChange={handleDocTableScaleDraftChange}
                        onKeyDown={handleDocTableScaleDraftKeyDown}
                        inputMode="numeric"
                        className="w-14 h-8 text-xs border border-gray-200 rounded px-2 bg-white text-gray-700"
                        placeholder="100"
                      />
                      <span className="text-[11px] text-gray-500">%</span>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyLiveDocTableScale(docTableScaleDraft)}
                        className="ml-auto px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Resize
                      </button>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="400"
                      step="5"
                      value={Math.round(normalizeDocTableScale(docTableScaleDraft, 100))}
                      onChange={handleDocTableScaleRangeChange}
                      className="w-full"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTablePageAlign('left')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Table left
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTablePageAlign('center')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Table center
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => applyDocTablePageAlign('right')}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Table right
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleEqualizeDocTableCellsByLargestContent}
                        className="px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Equalize cells
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    Select a table cell to show table tools.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isFullScreen && !isMobileNoteViewport && (
          <div className="note-editor-toolbar-row relative z-[70] flex flex-nowrap items-center gap-1.5 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm overflow-visible [&>*]:shrink-0">
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={handleUndoNoteChange}
              disabled={!canUndoNoteChange}
              className={`px-2 py-1 text-xs rounded ${
                canUndoNoteChange
                  ? 'hover:bg-gray-100 text-gray-700'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              Undo
            </button>
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={handleRedoNoteChange}
              disabled={!canRedoNoteChange}
              className={`px-2 py-1 text-xs rounded ${
                canRedoNoteChange
                  ? 'hover:bg-gray-100 text-gray-700'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              Redo
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={() => {
                if (isActiveSheetPage) {
                  updateSelectedSheetCellStyle({ bold: !Boolean(selectedSheetCell?.style?.bold) });
                  return;
                }
                execCmd('bold');
              }}
              className={`p-1.5 rounded transition-colors ${
                currentFormatState.bold ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={() => {
                if (isActiveSheetPage) {
                  updateSelectedSheetCellStyle({ italic: !Boolean(selectedSheetCell?.style?.italic) });
                  return;
                }
                execCmd('italic');
              }}
              className={`p-1.5 rounded transition-colors ${
                currentFormatState.italic ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={() => {
                if (isActiveSheetPage) {
                  updateSelectedSheetCellStyle({
                    underline: !Boolean(selectedSheetCell?.style?.underline),
                  });
                  return;
                }
                handleApplyUnderline();
              }}
              className={`p-1.5 rounded transition-colors ${
                currentFormatState.underline
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Underline (Ctrl+U)"
            >
              <Underline size={15} />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <select
              value={isActiveSheetPage ? '' : docFontFamilyValue}
              onChange={handleApplyFontFamily}
              disabled={isActiveSheetPage}
              className="w-24 lg:w-28 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Font</option>
              {DOC_FONT_FAMILY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((fontOption) => (
                    <option
                      key={`${group.label}-${fontOption.value}`}
                      value={fontOption.value}
                      style={{ fontFamily: fontOption.cssFamily }}
                    >
                      {fontOption.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div ref={docFontSizeMenuRef} className="relative">
              <button
                type="button"
                onMouseDown={handleFormatMouseDown}
                onClick={() => setIsDocFontSizeMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700"
                title="Font size"
              >
                <span className="w-6 text-left">
                  {isActiveSheetPage
                    ? String(selectedSheetCell?.style?.fontSize || '14').replace(/px$/i, '') || '14'
                    : docFontSizeValue}
                </span>
                <ChevronDown size={12} className={`transition-transform ${isDocFontSizeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDocFontSizeMenuOpen && (
                <div className="absolute z-40 mt-1 top-full right-0 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                  <div className="grid grid-cols-4 gap-1">
                    {DOC_FONT_SIZE_OPTIONS.map((sizeValue) => {
                      const currentSize = isActiveSheetPage
                        ? String(selectedSheetCell?.style?.fontSize || '14').replace(/px$/i, '')
                        : docFontSizeValue;
                      const isActiveSize = String(currentSize || '').trim() === sizeValue;
                      return (
                        <button
                          key={`font-size-preset-${sizeValue}`}
                          type="button"
                          onMouseDown={handleFormatMouseDown}
                          onClick={() => handleApplyFontSizePreset(sizeValue)}
                          className={`px-1.5 py-1 text-[11px] rounded border transition-colors ${
                            isActiveSize
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {sizeValue}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                    <input
                      value={docFontSizeDraft}
                      onChange={handleDocFontSizeDraftChange}
                      onKeyDown={handleDocFontSizeDraftKeyDown}
                      inputMode="numeric"
                      className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700"
                      title="Custom font size"
                      placeholder="14"
                    />
                    <span className="text-[11px] text-gray-500">px</span>
                    <button
                      type="button"
                      onMouseDown={handleFormatMouseDown}
                      onClick={commitDocFontSizeDraft}
                      className="ml-auto px-2 py-1 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>
            {isActiveSheetPage ? (
              <>
                <input
                  type="color"
                  onChange={handleApplyTextColor}
                  value={selectedSheetCell?.style?.color || '#111827'}
                  className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                  title="Text color"
                />
                <input
                  type="color"
                  onChange={handleApplyCellBackgroundColor}
                  value={selectedSheetCell?.style?.bgColor || '#ffffff'}
                  className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                  title="Cell background"
                />
              </>
            ) : (
              <>
                <div ref={docTextColorPickerRef} className="relative">
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => setIsDocTextColorPickerOpen((prev) => !prev)}
                    className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1.5"
                    title="Text color"
                  >
                    <span className="inline-block w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: docTextColorValue }} />
                    Text
                  </button>
                  {isDocTextColorPickerOpen && (
                    <div className="absolute z-40 mt-1 w-64 max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                      <div className="grid grid-cols-10 gap-1">
                        {DOC_COLOR_PRESETS.map((colorValue) => (
                          <button
                            key={`doc-text-color-${colorValue}`}
                            type="button"
                            onMouseDown={handleFormatMouseDown}
                            onClick={() => applyTextColorValue(colorValue)}
                            className="w-5 h-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(148,163,184,0.4)] hover:scale-105 transition-transform"
                            style={{ backgroundColor: colorValue }}
                            title={colorValue}
                          />
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">Custom</span>
                        <input
                          type="color"
                          value={docTextColorValue}
                          onChange={(event) => applyTextColorValue(event.target.value)}
                          className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div ref={docHighlightColorPickerRef} className="relative inline-flex items-center rounded border border-gray-200 bg-white">
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={handleToggleHighlight}
                    className="px-2 py-1 text-xs rounded-l inline-flex items-center gap-1.5 transition-colors hover:bg-gray-100 text-gray-700"
                    title="Toggle highlight on selected text"
                  >
                    <span className="inline-block w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: docHighlightColorValue }} />
                    Highlight
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => setIsDocHighlightColorPickerOpen((prev) => !prev)}
                    className="px-1.5 py-1 border-l border-gray-200 rounded-r hover:bg-gray-100 text-gray-600"
                    title="Highlight color"
                  >
                    <ChevronDown size={12} />
                  </button>
                  {isDocHighlightColorPickerOpen && (
                    <div className="absolute z-40 mt-1 top-full left-0 w-64 max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                      <div className="grid grid-cols-10 gap-1">
                        {DOC_COLOR_PRESETS.map((colorValue) => (
                          <button
                            key={`doc-highlight-color-${colorValue}`}
                            type="button"
                            onMouseDown={handleFormatMouseDown}
                            onClick={() => applyHighlightColorValue(colorValue)}
                            className="w-5 h-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(148,163,184,0.4)] hover:scale-105 transition-transform"
                            style={{ backgroundColor: colorValue }}
                            title={colorValue}
                          />
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">Custom</span>
                        <input
                          type="color"
                          value={docHighlightColorValue}
                          onChange={(event) => applyHighlightColorValue(event.target.value)}
                          className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div ref={docUnderlineMenuRef} className="relative inline-flex items-center rounded border border-gray-200 bg-white">
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={handleApplyUnderline}
                    className={`px-2 py-1 text-xs rounded-l inline-flex items-center gap-1 transition-colors ${
                      currentFormatState.underline
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Underline size={13} /> Underline
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={() => setIsDocUnderlineMenuOpen((prev) => !prev)}
                    className="px-1.5 py-1 border-l border-gray-200 rounded-r hover:bg-gray-100 text-gray-600"
                    title="Underline style"
                  >
                    <ChevronDown size={12} />
                  </button>
                  {isDocUnderlineMenuOpen && (
                    <div className="absolute z-40 mt-1 top-full right-0 w-36 rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => {
                          setDocUnderlineStyle('solid');
                          setIsDocUnderlineMenuOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${
                          docUnderlineStyle === 'solid' ? 'text-blue-700 bg-blue-50' : 'text-gray-700'
                        }`}
                      >
                        Solid line
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => {
                          setDocUnderlineStyle('dashed');
                          setIsDocUnderlineMenuOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${
                          docUnderlineStyle === 'dashed' ? 'text-blue-700 bg-blue-50' : 'text-gray-700'
                        }`}
                      >
                        Dashed line
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              type="button"
              onMouseDown={handleFormatMouseDown}
              onClick={handleInsertLink}
              disabled={isActiveSheetPage}
              className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:text-gray-400 disabled:border-gray-100 disabled:bg-gray-50 disabled:hover:bg-gray-50"
              title="Insert link"
            >
              <LinkIcon size={14} />
            </button>
            {!isActiveSheetPage && (
              <>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={handleInsertBulletList}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Bulleted list"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={handleInsertNumberList}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Numbered list"
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => handleDocHorizontalAlignAction('left')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Align left"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => handleDocHorizontalAlignAction('center')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Align center"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => handleDocHorizontalAlignAction('right')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Align right"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => execCmd('outdent')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Decrease indent"
                >
                  <IndentDecrease size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => execCmd('indent')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Increase indent"
                >
                  <IndentIncrease size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button
                  type="button"
                  onMouseDown={handleFormatMouseDown}
                  onClick={() => uploadInputRef.current?.click()}
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  title="Upload image"
                >
                  <ImageIcon size={14} className="text-blue-500" />
                </button>
                <div ref={docInsertTableMenuRef} className="relative">
                  <button
                    type="button"
                    onMouseDown={handleFormatMouseDown}
                    onClick={handleToggleDocInsertTableMenu}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                    title="Insert table"
                  >
                    <Table2 size={14} className="text-blue-500" />
                  </button>
                  {isDocInsertTableMenuOpen && (
                    <div className="absolute z-40 mt-1 top-full right-0 w-60 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                      <div
                        className="grid grid-cols-10 gap-1"
                        onMouseLeave={() => {
                          setDocTableHoverRows(0);
                          setDocTableHoverCols(0);
                        }}
                      >
                        {Array.from({ length: 8 }, (_, rowIndex) =>
                          Array.from({ length: 10 }, (_, colIndex) => {
                            const previewRows = docTableHoverRows || normalizeDocTableDimension(docTableDraftRows, 4);
                            const previewCols = docTableHoverCols || normalizeDocTableDimension(docTableDraftCols, 4);
                            const isHighlighted = rowIndex < previewRows && colIndex < previewCols;
                            return (
                              <button
                                key={`table-picker-${rowIndex}-${colIndex}`}
                                type="button"
                                onMouseDown={handleFormatMouseDown}
                                onMouseEnter={() => {
                                  setDocTableHoverRows(rowIndex + 1);
                                  setDocTableHoverCols(colIndex + 1);
                                }}
                                onClick={() => insertDocTable(rowIndex + 1, colIndex + 1)}
                                className={`h-4 w-4 rounded-[2px] border transition-colors ${
                                  isHighlighted
                                    ? 'border-blue-400 bg-blue-100'
                                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }`}
                                title={`${rowIndex + 1} x ${colIndex + 1}`}
                              />
                            );
                          })
                        )}
                      </div>
                      <p className="mt-2 text-center text-xs text-gray-600">
                        {(docTableHoverRows || normalizeDocTableDimension(docTableDraftRows, 4))} x{' '}
                        {(docTableHoverCols || normalizeDocTableDimension(docTableDraftCols, 4))}
                      </p>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-end gap-1.5">
                        <label className="text-[11px] text-gray-500">
                          Row
                          <input
                            value={docTableDraftRows}
                            onChange={handleDocTableDraftRowsChange}
                            onKeyDown={handleDocTableDraftKeyDown}
                            inputMode="numeric"
                            className="mt-0.5 w-12 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700"
                            placeholder="4"
                          />
                        </label>
                        <label className="text-[11px] text-gray-500">
                          Col
                          <input
                            value={docTableDraftCols}
                            onChange={handleDocTableDraftColsChange}
                            onKeyDown={handleDocTableDraftKeyDown}
                            inputMode="numeric"
                            className="mt-0.5 w-12 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700"
                            placeholder="4"
                          />
                        </label>
                        <button
                          type="button"
                          onMouseDown={handleFormatMouseDown}
                          onClick={() => insertDocTable(docTableDraftRows, docTableDraftCols)}
                          className="ml-auto px-2 py-1 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        >
                          Insert
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {hasDocTableSelection && (
                  <>
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <div ref={docTableFillColorPickerRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => {
                          setIsDocTableFillColorPickerOpen((prev) => !prev);
                          setIsDocTableBorderColorPickerOpen(false);
                          setIsDocTableCellAlignMenuOpen(false);
                          setIsDocTableExtraToolsMenuOpen(false);
                        }}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1.5"
                        title="Table cell fill color"
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-sm border border-gray-200"
                          style={
                            docTableFillColorValue === 'transparent'
                              ? {
                                  backgroundColor: '#ffffff',
                                  backgroundImage:
                                    'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 50%,#e5e7eb 50%,#e5e7eb 75%,transparent 75%,transparent)',
                                  backgroundSize: '6px 6px',
                                }
                              : { backgroundColor: docTableFillColorValue }
                          }
                        />
                        Fill
                      </button>
                      {isDocTableFillColorPickerOpen && (
                        <div className="absolute z-[140] mt-1 top-full right-0 w-64 max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                          <button
                            type="button"
                            onMouseDown={handleFormatMouseDown}
                            onClick={() => applyDocTableFillColorValue('transparent')}
                            className="mb-2 w-full px-2 py-1 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-left"
                          >
                            Transparent
                          </button>
                          <div className="grid grid-cols-10 gap-1">
                            {DOC_COLOR_PRESETS.map((colorValue) => (
                              <button
                                key={`doc-table-fill-${colorValue}`}
                                type="button"
                                onMouseDown={handleFormatMouseDown}
                                onClick={() => applyDocTableFillColorValue(colorValue)}
                                className="w-5 h-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(148,163,184,0.4)] hover:scale-105 transition-transform"
                                style={{ backgroundColor: colorValue }}
                                title={colorValue}
                              />
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Custom</span>
                            <input
                              type="color"
                              value={
                                docTableFillColorValue === 'transparent'
                                  ? '#ffffff'
                                  : docTableFillColorValue
                              }
                              onChange={(event) => applyDocTableFillColorValue(event.target.value)}
                              className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={docTableBorderColorPickerRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={() => {
                          setIsDocTableBorderColorPickerOpen((prev) => !prev);
                          setIsDocTableFillColorPickerOpen(false);
                          setIsDocTableCellAlignMenuOpen(false);
                          setIsDocTableExtraToolsMenuOpen(false);
                        }}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1.5"
                        title="Table border color"
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-sm border-2"
                          style={
                            docTableBorderColorValue === 'transparent'
                              ? { borderStyle: 'dashed', borderColor: '#9ca3af', backgroundColor: '#f9fafb' }
                              : { borderColor: docTableBorderColorValue }
                          }
                        />
                        Border
                      </button>
                      {isDocTableBorderColorPickerOpen && (
                        <div className="absolute z-[140] mt-1 top-full right-0 w-72 max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Border Design
                          </p>
                          <div className="mt-1 grid grid-cols-5 gap-1">
                            {DOC_TABLE_BORDER_DESIGN_OPTIONS.map((option) => {
                              const isActive = docTableBorderDesignValue === option.id;
                              return (
                                <button
                                  key={`doc-table-border-design-${option.id}`}
                                  type="button"
                                  onMouseDown={handleFormatMouseDown}
                                  onClick={() => handleDocTableBorderDesignChange(option.id)}
                                  className={`h-8 rounded border inline-flex items-center justify-center ${
                                    isActive
                                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                  title={option.label}
                                  aria-label={option.label}
                                >
                                  <DocTableBorderDesignPreview design={option.id} />
                                  <span className="sr-only">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <label className="text-[10px] text-gray-500">
                              Style
                              <select
                                value={docTableBorderLineStyleValue}
                                onChange={handleDocTableBorderLineStyleChange}
                                className="mt-0.5 w-full h-7 border border-gray-200 rounded px-1.5 text-[11px] bg-white text-gray-700"
                              >
                                {DOC_TABLE_BORDER_LINE_STYLE_OPTIONS.map((option) => (
                                  <option key={`doc-border-style-${option.id}`} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-[10px] text-gray-500">
                              Width
                              <select
                                value={docTableBorderLineWidthValue}
                                onChange={handleDocTableBorderLineWidthChange}
                                className="mt-0.5 w-full h-7 border border-gray-200 rounded px-1.5 text-[11px] bg-white text-gray-700"
                              >
                                {DOC_TABLE_BORDER_WIDTH_OPTIONS.map((widthValue) => (
                                  <option key={`doc-border-width-${widthValue}`} value={widthValue}>
                                    {widthValue}px
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                            <button
                              type="button"
                              onMouseDown={handleFormatMouseDown}
                              onClick={() => applyDocTableBorderColorValue('#cbd5e1')}
                              className="px-2 py-1 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                            >
                              Default
                            </button>
                            <button
                              type="button"
                              onMouseDown={handleFormatMouseDown}
                              onClick={() => applyDocTableBorderColorValue('transparent')}
                              className="px-2 py-1 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                            >
                              Transparent
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-10 gap-1">
                            {DOC_TABLE_BORDER_ALL_COLOR_PRESETS.map((colorValue) => (
                              <button
                                key={`doc-table-border-${colorValue}`}
                                type="button"
                                onMouseDown={handleFormatMouseDown}
                                onClick={() => applyDocTableBorderColorValue(colorValue)}
                                className="w-5 h-5 rounded-full border border-white shadow-[0_0_0_1px_rgba(148,163,184,0.4)] hover:scale-105 transition-transform"
                                style={{ backgroundColor: colorValue }}
                                title={colorValue}
                              />
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Custom</span>
                            <input
                              type="color"
                              value={
                                docTableBorderColorValue === 'transparent'
                                  ? '#cbd5e1'
                                  : docTableBorderColorValue
                              }
                              onChange={(event) => applyDocTableBorderColorValue(event.target.value)}
                              className="h-7 w-8 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={docTableCellAlignMenuRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleToggleDocTableCellAlignMenu}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1.5"
                        title="Table cell content alignment"
                      >
                        <DocTableCellAlignPreview
                          horizontal={docTableCellAlignValue.horizontal}
                          vertical={docTableCellAlignValue.vertical}
                        />
                        Cell
                      </button>
                      {isDocTableCellAlignMenuOpen && (
                        <div className="absolute z-[140] mt-1 top-full right-0 w-[132px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                          <div className="grid grid-cols-3 gap-1">
                            {DOC_TABLE_CELL_ALIGN_OPTIONS.map((alignOption) => {
                              const isActive =
                                docTableCellAlignValue.horizontal === alignOption.horizontal &&
                                docTableCellAlignValue.vertical === alignOption.vertical;
                              return (
                                <button
                                  key={alignOption.id}
                                  type="button"
                                  onMouseDown={handleFormatMouseDown}
                                  onClick={() =>
                                    applyDocTableCellAlign(alignOption.horizontal, alignOption.vertical)
                                  }
                                  className={`h-8 rounded border flex items-center justify-center ${
                                    isActive
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                  title={alignOption.label}
                                >
                                  <DocTableCellAlignPreview
                                    horizontal={alignOption.horizontal}
                                    vertical={alignOption.vertical}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onMouseDown={handleFormatMouseDown}
                      onClick={handleToggleDocTableWrap}
                      className={`px-2 py-1 text-xs rounded border ${
                        docTableWrapEnabled
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-700'
                      }`}
                      title={docTableWrapEnabled ? 'Disable text wrap in table cells' : 'Enable text wrap in table cells'}
                    >
                      Wrap
                    </button>
                    <button
                      type="button"
                      onMouseDown={handleFormatMouseDown}
                      onClick={() => {
                        if (canUnmergeDocTableSelection) {
                          handleUnmergeSelectedDocTableCell();
                          return;
                        }
                        void handleMergeSelectedDocTableCells();
                      }}
                      disabled={!canUnmergeDocTableSelection && !canMergeDocTableSelection}
                      className={`px-2 py-1 text-xs rounded border ${
                        canUnmergeDocTableSelection || canMergeDocTableSelection
                          ? 'border-gray-200 bg-white hover:bg-gray-100 text-gray-700'
                          : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                      title={
                        canUnmergeDocTableSelection
                          ? 'Unmerge selected cell'
                          : 'Merge selected cells'
                      }
                    >
                      {canUnmergeDocTableSelection ? 'Unmerge' : 'Merge'}
                    </button>
                    <div ref={docTableResizeMenuRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleToggleDocTableResizeMenu}
                        className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700"
                        title="Resize selected table"
                      >
                        Resize
                      </button>
                      {isDocTableResizeMenuOpen && (
                        <div className="absolute z-[140] mt-1 top-full right-0 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                          <p className="text-[11px] text-gray-500">
                            Resize whole table (all cells selected)
                          </p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              value={docTableScaleDraft}
                              onChange={handleDocTableScaleDraftChange}
                              onKeyDown={handleDocTableScaleDraftKeyDown}
                              inputMode="numeric"
                              className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700"
                              placeholder="100"
                            />
                            <span className="text-[11px] text-gray-500">%</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="400"
                            step="5"
                            value={Math.round(normalizeDocTableScale(docTableScaleDraft, 100))}
                            onChange={handleDocTableScaleRangeChange}
                            className="mt-2 w-full"
                          />
                          <div className="mt-1 text-[10px] text-gray-400 flex items-center justify-between">
                            <span>1%</span>
                            <span>400%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={docTableExtraToolsMenuRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={handleFormatMouseDown}
                        onClick={handleToggleDocTableExtraToolsMenu}
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-700"
                        title="More table tools"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {isDocTableExtraToolsMenuOpen && (
                        <div className="absolute z-[140] mt-1 top-full right-0 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                          <p className="text-[11px] text-gray-500">Align table to page</p>
                          <div className="mt-1 grid grid-cols-3 gap-1">
                            {DOC_TABLE_PAGE_ALIGN_OPTIONS.map((alignOption) => {
                              const isActive = docTablePageAlignValue === alignOption.id;
                              return (
                                <button
                                  key={`doc-table-page-align-${alignOption.id}`}
                                  type="button"
                                  onMouseDown={handleFormatMouseDown}
                                  onClick={() => applyDocTablePageAlign(alignOption.id)}
                                  className={`h-8 rounded border inline-flex items-center justify-center gap-1 text-[11px] ${
                                    isActive
                                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                  title={`Align table ${alignOption.label.toLowerCase()}`}
                                >
                                  {alignOption.id === 'center' ? (
                                    <AlignCenter size={12} />
                                  ) : alignOption.id === 'right' ? (
                                    <AlignRight size={12} />
                                  ) : (
                                    <AlignLeft size={12} />
                                  )}
                                  {alignOption.label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onMouseDown={handleFormatMouseDown}
                            onClick={handleEqualizeDocTableCellsByLargestContent}
                            className="mt-2 w-full px-2 py-1.5 text-[11px] rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-left"
                          >
                            Equalize all cells by largest content
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
            {isActiveSheetPage && (
              <>
                <button type="button" onClick={() => updateSelectedSheetCellStyle({ align: 'left' })} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-700">
                  Left
                </button>
                <button type="button" onClick={() => updateSelectedSheetCellStyle({ align: 'center' })} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-700">
                  Center
                </button>
                <button type="button" onClick={() => updateSelectedSheetCellStyle({ align: 'right' })} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-700">
                  Right
                </button>
              </>
            )}
            {isActiveSheetPage && (
              <>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button type="button" onClick={handleExportPdf} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-700">
                  PDF
                </button>
              </>
            )}
          </div>
        )}
        {isActiveSheetPage && (
          <div className="rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1.5 min-w-0">
            <input
              value={selectedSheetCell.text || ''}
              onFocus={() => setSheetEditingCell(null)}
              onKeyDown={(event) => {
                const lowerKey = String(event.key || '').toLowerCase();
                const hasShortcutModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
                if (hasShortcutModifier && lowerKey === 'z') {
                  event.preventDefault();
                  if (event.shiftKey) {
                    handleRedoNoteChange();
                  } else {
                    handleUndoNoteChange();
                  }
                  return;
                }
                if (hasShortcutModifier && lowerKey === 'y') {
                  event.preventDefault();
                  handleRedoNoteChange();
                }
              }}
              onChange={(event) => updateSheetCell(sheetSelection.row, sheetSelection.col, event.target.value)}
              className="w-full min-w-0 h-8 rounded-md border border-blue-200 px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Cell value..."
            />
            <p className="mt-1 text-[11px] leading-4 text-blue-700">
              {sheetSelectionSummary}
            </p>
          </div>
        )}
        </div>

      <div
        ref={docViewportRef}
        className={`note-doc-viewport flex-1 min-h-0 relative ${isActiveDocPage ? 'overflow-auto' : 'overflow-hidden'}`}
        style={isActiveDocPage ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
      >
        {isActiveSheetPage ? (
          <div
            key={`sheet-pane-${activePage?.id || 'default'}`}
            ref={sheetPaneRef}
            tabIndex={0}
            onKeyDown={(event) => {
              if (sheetEditingCell) return;
              handleSheetCellKeyDown(event, sheetSelection.row, sheetSelection.col);
            }}
            onPaste={(event) => {
              if (!isActiveSheetPage || sheetEditingCell) return;
              const pastedText = event.clipboardData?.getData('text/plain') || '';
              if (!pastedText) return;
              event.preventDefault();
              pasteTextIntoSelectedSheetCells(pastedText);
            }}
            className="h-full w-full min-w-0 overflow-auto bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <table className="min-w-full border-collapse text-xs">
              <thead
                className="sticky top-0 z-10"
                data-note-sheet-column-header={isFullScreen ? 'true' : undefined}
              >
                <tr>
                  <th className="w-12 bg-slate-100 border border-slate-200 text-slate-500 font-semibold">#</th>
                  {Array.from({ length: sheetCols }, (_, colIndex) => (
                    <th key={`sheet-header-${colIndex}`} className="min-w-[120px] bg-slate-100 border border-slate-200 text-slate-600 font-semibold h-8">
                      {toSheetColumnLabel(colIndex)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: sheetRows }, (_, rowIndex) => (
                  <tr key={`sheet-row-${rowIndex}`}>
                    <th className="bg-slate-100 border border-slate-200 text-slate-500 font-medium h-9">
                      {rowIndex + 1}
                    </th>
                    {Array.from({ length: sheetCols }, (_, colIndex) => {
                      const cellKey = getSheetCellKey(rowIndex, colIndex);
                      const cell = normalizeNoteSheetCell(activePage?.cells?.[cellKey] || {});
                      const isSelected = rowIndex === sheetSelection.row && colIndex === sheetSelection.col;
                      const isEditing =
                        sheetEditingCell &&
                        rowIndex === sheetEditingCell.row &&
                        colIndex === sheetEditingCell.col;
                      const isInSelectionRange =
                        rowIndex >= sheetSelectionBounds.minRow &&
                        rowIndex <= sheetSelectionBounds.maxRow &&
                        colIndex >= sheetSelectionBounds.minCol &&
                        colIndex <= sheetSelectionBounds.maxCol;
                      const isRangeTop = isInSelectionRange && rowIndex === sheetSelectionBounds.minRow;
                      const isRangeBottom = isInSelectionRange && rowIndex === sheetSelectionBounds.maxRow;
                      const isRangeLeft = isInSelectionRange && colIndex === sheetSelectionBounds.minCol;
                      const isRangeRight = isInSelectionRange && colIndex === sheetSelectionBounds.maxCol;
                      const isRangeBottomRightCorner =
                        isInSelectionRange &&
                        rowIndex === sheetSelectionBounds.maxRow &&
                        colIndex === sheetSelectionBounds.maxCol;
                      const isInClipboardRange =
                        Boolean(sheetClipboardBounds) &&
                        rowIndex >= sheetClipboardBounds.minRow &&
                        rowIndex <= sheetClipboardBounds.maxRow &&
                        colIndex >= sheetClipboardBounds.minCol &&
                        colIndex <= sheetClipboardBounds.maxCol;
                      const isClipboardTop = isInClipboardRange && rowIndex === sheetClipboardBounds.minRow;
                      const isClipboardBottom =
                        isInClipboardRange && rowIndex === sheetClipboardBounds.maxRow;
                      const isClipboardLeft = isInClipboardRange && colIndex === sheetClipboardBounds.minCol;
                      const isClipboardRight = isInClipboardRange && colIndex === sheetClipboardBounds.maxCol;
                      const clipboardBorderStyle = {};
                      if (isClipboardTop) clipboardBorderStyle.borderTop = '2px dashed #2563eb';
                      if (isClipboardBottom) clipboardBorderStyle.borderBottom = '2px dashed #2563eb';
                      if (isClipboardLeft) clipboardBorderStyle.borderLeft = '2px dashed #2563eb';
                      if (isClipboardRight) clipboardBorderStyle.borderRight = '2px dashed #2563eb';
                      const presenceCellEntries = sheetPresenceByCell.get(`${rowIndex}-${colIndex}`) || [];
                      const selectionShadows = [];
                      if (isRangeTop) selectionShadows.push('inset 0 2px 0 #2563eb');
                      if (isRangeBottom) selectionShadows.push('inset 0 -2px 0 #2563eb');
                      if (isRangeLeft) selectionShadows.push('inset 2px 0 0 #2563eb');
                      if (isRangeRight) selectionShadows.push('inset -2px 0 0 #2563eb');
                      if (isSelected) selectionShadows.push('inset 0 0 0 2px #2563eb');
                      return (
                        <td
                          key={`sheet-cell-${rowIndex}-${colIndex}`}
                          onMouseDown={(event) => handleSheetCellMouseDown(event, rowIndex, colIndex)}
                          onMouseEnter={(event) => handleSheetCellMouseEnter(event, rowIndex, colIndex)}
                          onMouseUp={endSheetRangeSelection}
                          onClick={(event) => handleSheetCellClick(event, rowIndex, colIndex)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            handleSheetCellDoubleClick(rowIndex, colIndex);
                          }}
                          className={`relative border p-0 overflow-hidden ${
                            isInSelectionRange ? 'bg-blue-100/70 border-blue-200' : 'border-slate-200'
                          } ${isSelected ? 'z-[1]' : ''}`}
                          style={{
                            boxShadow: selectionShadows.length ? selectionShadows.join(', ') : undefined,
                            ...clipboardBorderStyle,
                          }}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={cell.text || ''}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              onBlur={() => setSheetEditingCell(null)}
                              onKeyDown={(event) => {
                                const lowerKey = String(event.key || '').toLowerCase();
                                const hasShortcutModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
                                if (hasShortcutModifier && lowerKey === 'z') {
                                  event.preventDefault();
                                  if (event.shiftKey) {
                                    handleRedoNoteChange();
                                  } else {
                                    handleUndoNoteChange();
                                  }
                                  return;
                                }
                                if (hasShortcutModifier && lowerKey === 'y') {
                                  event.preventDefault();
                                  handleRedoNoteChange();
                                  return;
                                }
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  setSheetEditingCell(null);
                                  return;
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setSheetEditingCell(null);
                                  return;
                                }
                                event.stopPropagation();
                              }}
                              onChange={(event) => updateSheetCell(rowIndex, colIndex, event.target.value)}
                              className="w-full h-9 px-2 bg-transparent outline-none text-slate-700"
                              style={{
                                fontWeight: cell.style.bold ? 700 : 400,
                                fontStyle: cell.style.italic ? 'italic' : 'normal',
                                textDecoration: cell.style.underline ? 'underline' : 'none',
                                textAlign: cell.style.align,
                                fontSize: cell.style.fontSize || '14px',
                                color: cell.style.color,
                                backgroundColor: isInSelectionRange ? 'transparent' : cell.style.bgColor,
                              }}
                            />
                          ) : (
                            <div
                              className="w-full h-9 px-2 flex items-center overflow-hidden whitespace-nowrap text-ellipsis text-slate-700 select-none cursor-cell"
                              style={{
                                fontWeight: cell.style.bold ? 700 : 400,
                                fontStyle: cell.style.italic ? 'italic' : 'normal',
                                textDecoration: cell.style.underline ? 'underline' : 'none',
                                justifyContent:
                                  cell.style.align === 'right'
                                    ? 'flex-end'
                                    : cell.style.align === 'center'
                                    ? 'center'
                                    : 'flex-start',
                                fontSize: cell.style.fontSize || '14px',
                                color: cell.style.color,
                                backgroundColor: isInSelectionRange ? 'transparent' : cell.style.bgColor,
                              }}
                              title={cell.text || ''}
                            >
                              {cell.text || '\u00A0'}
                            </div>
                          )}
                          {presenceCellEntries.map((presenceEntry, presenceIndex) => (
                            <span
                              key={`${presenceEntry.presenceKey}-${presenceIndex}`}
                              className="pointer-events-none absolute z-[12] note-sheet-collab-cursor"
                              style={{
                                top: `${3 + presenceIndex * 16}px`,
                                left: `${4 + presenceIndex * 6}px`,
                                '--presence-cursor-color': presenceEntry.cursorColor,
                              }}
                            >
                              <span className="note-sheet-collab-cursor-line" />
                              <span className="note-sheet-collab-cursor-label">{presenceEntry.label}</span>
                            </span>
                          ))}
                          {isRangeBottomRightCorner && (
                            <span className="pointer-events-none absolute z-20 right-0.5 bottom-0.5 w-2 h-2 rounded-full bg-blue-600 border border-white" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            key={`doc-pane-${activePage?.id || 'default'}`}
            ref={editorRef}
            contentEditable
            dir="ltr"
            onInput={handleInput}
            onClick={handleEditorClick}
            onMouseDown={handleDocEditorMouseDown}
            onKeyDown={handleDocEditorKeyDown}
            onBeforeInput={handleDocEditorBeforeInput}
            onPaste={handleDocEditorPaste}
            onMouseUp={(event) => {
              syncActiveFormats();
              schedulePresenceUpdate('');
            }}
            onKeyUp={() => {
              syncActiveFormats();
              schedulePresenceUpdate(getEditorTypingPreview());
            }}
            onFocus={() => {
              syncActiveFormats();
              schedulePresenceUpdate('');
            }}
            onDragStart={handleEditorDragStart}
            onDragOver={(event) => {
              if (dragImageIdRef.current) {
                event.preventDefault();
              }
            }}
            onDrop={handleEditorDrop}
            onDragEnd={() => {
              dragImageIdRef.current = '';
            }}
            onTouchStart={handleEditorTouchStart}
            onTouchMove={handleEditorTouchMove}
            onTouchEnd={handleEditorTouchEnd}
            onTouchCancel={handleEditorTouchEnd}
            data-placeholder="Type your note... and upload images with the image button"
            className={`rich-editor flex-1 min-w-0 ${
              isMobileNoteViewport ? 'p-3 text-sm' : 'p-6 text-sm md:text-base'
            } outline-none overflow-visible text-gray-800 leading-relaxed bg-white prose max-w-none`}
            style={{ minHeight: '300px', textAlign: 'left' }}
          ></div>
        )}
        {isActiveDocPage &&
          docPresenceCursorFrames.map((frame) => (
            <span
              key={frame.key}
              className="pointer-events-none absolute z-[25] note-doc-collab-cursor"
              style={{
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                '--presence-cursor-color': frame.cursorColor,
              }}
            >
              <span className="note-doc-collab-cursor-line" />
              <span className="note-doc-collab-cursor-label">{frame.label}</span>
            </span>
          ))}
        {isActiveDocPage && isDocTableResizeMenuOpen && activeDocTableResizeFrame && (
          <div
            ref={docTableResizeOverlayRef}
            data-note-table-resize-overlay
            className="pointer-events-none absolute z-[27] rounded-[2px] border-2 border-blue-600"
            style={{
              left: `${activeDocTableResizeFrame.x}px`,
              top: `${activeDocTableResizeFrame.y}px`,
              width: `${activeDocTableResizeFrame.width}px`,
              height: `${activeDocTableResizeFrame.height}px`,
            }}
          >
            {[
              { key: 'n', className: 'left-1/2 -translate-x-1/2 -top-1.5 cursor-ns-resize' },
              { key: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
              { key: 's', className: 'left-1/2 -translate-x-1/2 -bottom-1.5 cursor-ns-resize' },
              { key: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
              { key: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
              { key: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
              { key: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
              { key: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
            ].map((handleItem) => (
              <button
                key={`doc-table-resize-handle-${handleItem.key}`}
                type="button"
                className={`pointer-events-auto absolute w-3 h-3 rounded-full border border-blue-600 bg-white shadow-sm ${handleItem.className}`}
                onMouseDown={(event) => handleDocTableCornerResizeStart(event, handleItem.key)}
                title="Drag to resize selected table"
              />
            ))}
          </div>
        )}
        {isActiveDocPage && activeImageFrame && (
          <div
            data-note-image-frame
            className="pointer-events-none absolute z-[28] border-2 border-blue-600 rounded-[10px] bg-blue-100/10"
            style={{
              left: `${activeImageFrame.x}px`,
              top: `${activeImageFrame.y}px`,
              width: `${activeImageFrame.width}px`,
              height: `${activeImageFrame.height}px`,
            }}
          >
            {[
              { key: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
              { key: 'n', className: 'left-1/2 -translate-x-1/2 -top-1.5 cursor-ns-resize' },
              { key: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
              { key: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
              { key: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
              { key: 's', className: 'left-1/2 -translate-x-1/2 -bottom-1.5 cursor-ns-resize' },
              { key: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
              { key: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
            ].map((handleItem) => (
              <button
                key={`image-frame-handle-${handleItem.key}`}
                type="button"
                className={`pointer-events-auto absolute w-3 h-3 rounded-[2px] border border-blue-600 bg-white ${handleItem.className}`}
                onMouseDown={(event) =>
                  handleImageResizeStart(event, handleItem.key, 'resize')
                }
                title="Drag to resize image"
              />
            ))}
            {imageCropModeId === activeImageFrame.imageId && (
              <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Crop mode
              </span>
            )}
          </div>
        )}
        {isActiveDocPage && imageCropModeId && activeCropFrame && (
          <div
            data-note-image-frame
            className="pointer-events-none absolute z-[29] border-2 border-dashed border-slate-800 rounded-[8px] bg-slate-700/20"
            style={{
              left: `${activeCropFrame.x}px`,
              top: `${activeCropFrame.y}px`,
              width: `${activeCropFrame.width}px`,
              height: `${activeCropFrame.height}px`,
            }}
          >
            <button
              type="button"
              className="pointer-events-auto absolute inset-0 cursor-move"
              onMouseDown={(event) => handleImageResizeStart(event, 'move', 'crop')}
              title="Drag to move crop frame"
            />
            {[
              { key: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
              { key: 'n', className: 'left-1/2 -translate-x-1/2 -top-1.5 cursor-ns-resize' },
              { key: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
              { key: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
              { key: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
              { key: 's', className: 'left-1/2 -translate-x-1/2 -bottom-1.5 cursor-ns-resize' },
              { key: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
              { key: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
            ].map((handleItem) => (
              <button
                key={`image-crop-handle-${handleItem.key}`}
                type="button"
                className={`pointer-events-auto absolute w-3 h-3 rounded-[2px] border border-slate-800 bg-white ${handleItem.className}`}
                onMouseDown={(event) => handleImageResizeStart(event, handleItem.key, 'crop')}
                title="Drag to adjust crop frame"
              />
            ))}
          </div>
        )}
        {isActiveSheetPage && isCompactSheetViewport && sheetQuickMenu && (
          <div
            ref={sheetQuickMenuRef}
            className="fixed z-[80] rounded-lg border border-slate-200 bg-white shadow-lg px-1.5 py-1 flex items-center gap-1"
            style={{
              left: `${sheetQuickMenu.left}px`,
              top: `${sheetQuickMenu.top}px`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                void copySelectedSheetCells();
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 rounded-md hover:bg-slate-100"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                void cutSelectedSheetCells();
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 rounded-md hover:bg-slate-100"
            >
              Cut
            </button>
            <button
              type="button"
              onClick={() => {
                clearSelectedSheetCells();
                setSheetQuickMenu(null);
              }}
              className="px-2.5 py-1 text-xs font-medium text-red-600 rounded-md hover:bg-red-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {isActiveDocPage && imageMenuState && (
        <div
          ref={imageMenuRef}
          data-note-image-menu
          className="absolute z-30 bg-white border border-gray-200 rounded-xl shadow-xl px-2 py-1.5 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-16px)]"
          style={{
            left: `${Math.max(8, imageMenuState.x)}px`,
            top: `${Math.max(8, imageMenuState.y)}px`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleCropImage}
            className={`px-2 py-1 text-xs rounded-md ${
              imageCropModeId === imageMenuState.imageId
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            Crop
          </button>
          <button
            type="button"
            onClick={() => void handleSetImageLink()}
            className="px-2 py-1 text-xs rounded-md hover:bg-gray-100 text-gray-700"
          >
            {imageMenuState.isLinked ? 'Edit link' : 'Add link'}
          </button>
          {imageMenuState.isLinked && (
            <button
              type="button"
              onClick={handleOpenImageLink}
              className="px-2 py-1 text-xs rounded-md hover:bg-blue-50 text-blue-700"
            >
              Open link
            </button>
          )}
          <button type="button" onClick={() => void handleCopyOrCutImage(true)} className="px-2 py-1 text-xs rounded-md hover:bg-red-50 text-red-600">Cut</button>
          <button type="button" onClick={() => void handleCopyOrCutImage(false)} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Copy</button>
          <button type="button" onClick={handleDeleteImage} className="px-2 py-1 text-xs rounded-md hover:bg-red-50 text-red-600">Delete</button>
        </div>
      )}
      {isActiveDocPage && docLinkMenuState && (
        <div
          ref={docLinkMenuRef}
          data-note-link-menu
          className="absolute z-30 bg-white border border-gray-200 rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1.5 max-w-[calc(100%-16px)]"
          style={{
            left: `${Math.max(8, docLinkMenuState.x)}px`,
            top: `${Math.max(8, docLinkMenuState.y)}px`,
          }}
        >
          <button
            type="button"
            onClick={() => handleOpenLinkMenuTarget('_blank')}
            className="px-2 py-1 text-xs rounded-md hover:bg-blue-50 text-blue-700"
          >
            Open link
          </button>
          <button
            type="button"
            onClick={() => void handleEditLinkFromMenu()}
            className="px-2 py-1 text-xs rounded-md hover:bg-gray-100 text-gray-700"
          >
            Edit link
          </button>
        </div>
      )}

      <div className="p-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
        <span>{isActiveSheetPage ? `Sheet ${sheetRows}x${sheetCols}` : 'Doc editor'}</span>
        <span>Auto-saved · Live collaboration</span>
      </div>
      <style>{`
        .note-editor-toolbar-row {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .note-editor-toolbar-row::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .note-doc-viewport::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
          background: transparent !important;
        }
        .rich-editor table[data-note-inline-table="true"] {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin: 0.65rem 0;
        }
        .rich-editor table[data-note-inline-table="true"] td,
        .rich-editor table[data-note-inline-table="true"] th {
          border: 1px solid #cbd5e1;
          min-width: 88px;
          height: 34px;
          padding: 6px;
          vertical-align: top;
        }
        .rich-editor table[data-note-inline-table="true"][data-note-table-wrap="false"] td,
        .rich-editor table[data-note-inline-table="true"][data-note-table-wrap="false"] th {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
          overflow-wrap: normal;
          word-break: normal;
        }
        .rich-editor table[data-note-inline-table="true"][data-note-table-wrap="true"] td,
        .rich-editor table[data-note-inline-table="true"][data-note-table-wrap="true"] th {
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .rich-editor table[data-note-inline-table="true"][data-note-table-lock-size="true"] td,
        .rich-editor table[data-note-inline-table="true"][data-note-table-lock-size="true"] th {
          overflow: hidden;
          text-overflow: clip;
          white-space: nowrap !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
        }
        .rich-editor table[data-note-inline-table="true"] td > :first-child,
        .rich-editor table[data-note-inline-table="true"] th > :first-child {
          margin-top: 0 !important;
        }
        .rich-editor table[data-note-inline-table="true"] td > :last-child,
        .rich-editor table[data-note-inline-table="true"] th > :last-child {
          margin-bottom: 0 !important;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-selected="true"] {
          position: relative;
          caret-color: #2563eb;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-selected="true"]::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(37, 99, 235, 0.08);
          pointer-events: none;
        }
        .rich-editor table[data-note-inline-table="true"][data-note-table-single-selection="true"] [data-note-table-selected="true"]::after {
          display: none;
        }
        .rich-editor table[data-note-inline-table="true"][data-note-table-single-selection="true"] [data-note-table-selected="true"] {
          box-shadow: inset 0 0 0 2px #2563eb;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-range-top="true"] {
          border-top: 2px solid #2563eb !important;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-range-right="true"] {
          border-right: 2px solid #2563eb !important;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-range-bottom="true"] {
          border-bottom: 2px solid #2563eb !important;
        }
        .rich-editor table[data-note-inline-table="true"] [data-note-table-range-left="true"] {
          border-left: 2px solid #2563eb !important;
        }
        .note-doc-collab-cursor,
        .note-sheet-collab-cursor {
          position: absolute;
          display: block;
          --presence-cursor-color: #2563eb;
        }
        .note-doc-collab-cursor-line,
        .note-sheet-collab-cursor-line {
          display: block;
          width: 2px;
          height: 16px;
          border-radius: 999px;
          background: var(--presence-cursor-color);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
        }
        .note-sheet-collab-cursor-line {
          height: 14px;
        }
        .note-doc-collab-cursor-label,
        .note-sheet-collab-cursor-label {
          position: absolute;
          left: 6px;
          top: -12px;
          max-width: 108px;
          padding: 1px 5px;
          border-radius: 999px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 10px;
          line-height: 1.3;
          font-weight: 500;
          color: rgba(30, 41, 59, 0.7);
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
        }
        .note-sheet-collab-cursor-label {
          top: -11px;
          max-width: 84px;
        }
        @media (max-width: 767px) {
          .rich-editor {
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .rich-editor table[data-note-inline-table="true"] td,
          .rich-editor table[data-note-inline-table="true"] th {
            min-width: 72px;
            padding: 4px;
          }
        }
      `}</style>
    </div>
  );
}
function MonthGrid({
  year,
  month,
  projects,
  allProjects = [],
  events,
  showEventTime = false,
  onDayClick,
  onEventClick,
  hidePastWeeks,
  currentWeekStart,
}) {
  const toDateStr = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  const TIME_PATTERN = /^\d{2}:\d{2}$/;
  const shouldShowEventTime = (event) => {
    if (!event) return false;
    if (event.showTime === false) return false;

    const startTime = String(event.startTime || '').trim();
    const endTime = String(event.endTime || '').trim();
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return false;

    if (
      String(event.source || '').trim() === 'google' &&
      startTime === '00:00' &&
      (endTime === '23:59' || endTime === '00:00')
    ) {
      return false;
    }

    return true;
  };

  // Date calculations
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const weekRows = [];
  let currentWeek = [];
  
  // Empty cells before the 1st day
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month, i - firstDay + 1);
    currentWeek.push({ empty: true, key: `empty-start-${i}`, date: d, dateStr: toDateStr(d) });
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    currentWeek.push({ empty: false, key: dateStr, dateStr, day, dateObj: d });

    if (currentWeek.length === 7) {
      weekRows.push(currentWeek);
      currentWeek = [];
    }
  }

  // Add suffix empty cells to complete the last week
  if (currentWeek.length > 0) {
    let i = 0;
    while (currentWeek.length < 7) {
      const d = new Date(year, month + 1, i + 1);
      currentWeek.push({ empty: true, key: `empty-end-${i}`, date: d, dateStr: toDateStr(d) });
      i++;
    }
    weekRows.push(currentWeek);
  }

  // Filter out past weeks
  const visibleWeeks = weekRows.filter(week => {
    if (!hidePastWeeks) return true;
    // The last day of the week is Saturday
    const weekEndDate = week[6].dateObj || week[6].date;
    return weekEndDate >= currentWeekStart;
  });

  if (visibleWeeks.length === 0) return null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full">
      {/* Days Header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar Grid */}
      <div className="flex-1">
        {visibleWeeks.map((week, weekIdx) => {
          const hasEventByDay = week.map((dayData) =>
            !dayData.empty &&
            events.some((event) => dayData.dateStr >= event.startDate && dayData.dateStr <= event.endDate)
          );

          const segmentsForWeek = events
            .map((event) => {
              const coveredIndices = week
                .map((dayData, idx) =>
                  !dayData.empty && dayData.dateStr >= event.startDate && dayData.dateStr <= event.endDate
                    ? idx
                    : -1
                )
                .filter((idx) => idx >= 0);

              if (coveredIndices.length === 0) return null;

              const startIdx = coveredIndices[0];
              const endIdx = coveredIndices[coveredIndices.length - 1];
	              const project =
	                projects.find((p) => p.id === event.projectId) ||
	                allProjects.find((p) => p.id === event.projectId) ||
	                projects[0] ||
	                allProjects[0];
	              const color = PROJECT_COLORS[project?.colorIndex ?? 0] || PROJECT_COLORS[0];
                const isTaskEvent = String(event?.recordType || '').trim().toLowerCase() === 'task';
                const departmentColorHex = isTaskEvent
                  ? resolveDepartmentColorHex(
                      project?.departmentColors,
                      event?.department,
                      getProjectColorHexByIndex(project?.colorIndex)
                    )
                  : '';

	              return {
	                event,
	                startIdx,
	                endIdx,
	                startDate: week[startIdx].dateStr,
	                color,
	                isTaskEvent,
	                departmentColorHex,
	                hasDisplayTime: shouldShowEventTime(event),
	              };
	            })
            .filter(Boolean);

          const sortSegmentsByPosition = (a, b) =>
            a.startIdx - b.startIdx || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx);

          let weekSegments = [];
          if (showEventTime) {
            const timedSegments = segmentsForWeek
              .filter((segment) => segment.hasDisplayTime)
              .sort(sortSegmentsByPosition);
            const untimedSegments = segmentsForWeek
              .filter((segment) => !segment.hasDisplayTime)
              .sort(sortSegmentsByPosition);

            const timedLaneEnds = [];
            timedSegments.forEach((segment) => {
              let lane = 0;
              while (timedLaneEnds[lane] !== undefined && timedLaneEnds[lane] >= segment.startIdx) {
                lane += 1;
              }
              timedLaneEnds[lane] = segment.endIdx;
              segment.lane = lane;
            });
            const timedLaneCount = timedLaneEnds.length;

            const untimedLaneEnds = [];
            untimedSegments.forEach((segment) => {
              let lane = 0;
              while (untimedLaneEnds[lane] !== undefined && untimedLaneEnds[lane] >= segment.startIdx) {
                lane += 1;
              }
              untimedLaneEnds[lane] = segment.endIdx;
              segment.lane = timedLaneCount + lane;
            });

            weekSegments = [...timedSegments, ...untimedSegments].sort(
              (a, b) => a.lane - b.lane || sortSegmentsByPosition(a, b)
            );
          } else {
            weekSegments = segmentsForWeek.sort(sortSegmentsByPosition);
            const laneEnds = [];
            weekSegments.forEach((segment) => {
              let lane = 0;
              while (laneEnds[lane] !== undefined && laneEnds[lane] >= segment.startIdx) {
                lane += 1;
              }
              laneEnds[lane] = segment.endIdx;
              segment.lane = lane;
            });
          }

          const laneHeight = 22;
          const rowMinHeight = 96;
          const maxVisibleLanes = Math.max(1, Math.floor((rowMinHeight - 8) / laneHeight));
          const visibleWeekSegments = weekSegments.filter((segment) => segment.lane < maxVisibleLanes);

          return (
            <div key={`week-${weekIdx}`} className="relative">
              <div className="grid grid-cols-7">
                {week.map((dayData, dayIndex) => {
                  const isToday = todayStr === dayData.dateStr;
                  const hasEvents = hasEventByDay[dayIndex];
                  const hasPrevEvent = dayIndex > 0 && hasEventByDay[dayIndex - 1];
                  const hasNextEvent = dayIndex < 6 && hasEventByDay[dayIndex + 1];

                  const mergedBorderStyle = hasEvents
                    ? {
                        borderTopColor: '#fca5a5',
                        borderBottomColor: '#fca5a5',
                        borderLeftColor: hasPrevEvent ? 'transparent' : '#fca5a5',
                        borderRightColor: hasNextEvent ? 'transparent' : '#fca5a5',
                      }
                    : undefined;

                  return (
                    <div
                      key={dayData.key}
                      className={`border p-1 group flex flex-col transition-colors ${
                        dayData.empty
                          ? 'bg-gray-50/60 border-gray-100'
                          : `cursor-pointer hover:bg-blue-50 ${hasEvents ? 'bg-red-50/20 border-red-300' : 'border-gray-100'}`
                      }`}
                      style={{ minHeight: `${rowMinHeight}px`, ...mergedBorderStyle }}
                      onClick={dayData.empty ? undefined : () => onDayClick(dayData.dateStr)}
                    >
                      {!dayData.empty && (
                        <div className={`text-right text-xs mb-1 font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                          <span className={isToday ? 'bg-blue-100 px-1.5 py-0.5 rounded-full' : ''}>{dayData.day}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {visibleWeekSegments.length > 0 && (
                <div className="pointer-events-none absolute left-0 right-0 top-6 px-[2px]">
                  {visibleWeekSegments.map((segment, segmentIndex) => {
                    const leftPercent = (segment.startIdx / 7) * 100;
                    const widthPercent = ((segment.endIdx - segment.startIdx + 1) / 7) * 100;
                    const showTimePrefix =
                      showEventTime && segment.hasDisplayTime && segment.event.startDate === segment.startDate;
                    const title = showTimePrefix
                      ? `${segment.event.startTime} ${segment.event.title}`
                      : segment.event.title;
                    const eventTooltip = segment.hasDisplayTime
                      ? `${segment.event.title} (${segment.event.startTime} - ${segment.event.endTime})`
                      : segment.event.title;

	                    return (
	                      <button
	                        key={`${segment.event.id}-${weekIdx}-${segmentIndex}`}
	                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(segment.event, e);
                        }}
	                        className={`pointer-events-auto absolute text-[10px] md:text-xs truncate px-2 h-5 rounded-md border shadow-sm flex items-center hover:opacity-80 transition-opacity ${
                            segment.isTaskEvent
                              ? 'bg-white border-dashed'
                              : `${segment.color.lightBg} ${segment.color.text} ${segment.color.border}`
                          }`}
	                        style={{
	                          left: `calc(${leftPercent}% + 2px)`,
	                          width: `calc(${widthPercent}% - 4px)`,
	                          top: `${segment.lane * laneHeight}px`,
                          ...(segment.isTaskEvent
                            ? {
                                borderColor: segment.departmentColorHex,
                                color: segment.departmentColorHex,
                                backgroundColor: toRgba(segment.departmentColorHex, 0.08),
                              }
                            : {}),
	                        }}
	                        title={eventTooltip}
	                      >
	                        {title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectUpdatesToast({ notice, isVisible, onClose, onOpenDetails }) {
  if (!notice) return null;
  const color = PROJECT_COLORS[notice.colorIndex] || PROJECT_COLORS[0];
  const isPriorityStatusUpdate = Boolean(notice.isStatusUpdate);
  const toneStyles = isPriorityStatusUpdate
    ? getProjectStatusToneStyles(notice.statusTone)
    : getProjectStatusToneStyles('neutral');
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[75] pointer-events-none px-3 w-full max-w-xl">
      <div
        className={`pointer-events-auto rounded-xl border bg-white shadow-xl transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        } ${isPriorityStatusUpdate ? `${toneStyles.unseenCard} shadow-2xl` : `${color.border} bg-white shadow-xl`}`}
      >
        <div className="px-3.5 py-3 flex items-start gap-3">
          <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${color.bg}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex items-center gap-2 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{notice.projectName}</p>
                {notice.newCount > 1 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 shrink-0">
                    +{notice.newCount - 1} more
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenDetails}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 shrink-0"
              >
                View details
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="min-w-0 flex items-center gap-1.5 flex-1">
                <p
                  className={`text-xs font-semibold truncate ${
                    isPriorityStatusUpdate ? toneStyles.unseenTitle : 'text-slate-700'
                  }`}
                >
                  {notice.title}
                </p>
                {isPriorityStatusUpdate && notice.statusPriorityLabel && (
                  <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${toneStyles.badge}`}>
                    {notice.statusPriorityLabel}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">
                {formatProjectActivityTimestamp(notice.createdAt)}
              </span>
            </div>
            {isPriorityStatusUpdate && notice.statusPrompt && (
              <p className={`text-[11px] mt-0.5 ${toneStyles.unseenSubtitle}`}>{notice.statusPrompt}</p>
            )}
            {notice.subtitle && (
              <p className={`text-[11px] mt-0.5 truncate ${isPriorityStatusUpdate ? toneStyles.unseenSubtitle : 'text-slate-500'}`}>
                {notice.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close project update notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectUpdatesPopup({ groups, popupMode, onPopupModeChange, onClose }) {
  const [expandedSeenProjects, setExpandedSeenProjects] = useState({});
  const entryFilterOrder = useMemo(
    () => [
      PROJECT_ACTIVITY_TYPES.EVENT_CREATED,
      PROJECT_ACTIVITY_TYPES.TASK_CREATED,
      PROJECT_ACTIVITY_TYPES.MEMBER_JOINED,
      PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED,
      PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT,
    ],
    []
  );
  const [activeEntryFilters, setActiveEntryFilters] = useState(entryFilterOrder);
  const activeEntryFilterSet = useMemo(() => new Set(activeEntryFilters), [activeEntryFilters]);

  const toggleEntryFilter = (entryType) => {
    setActiveEntryFilters((prev) => {
      const normalizedPrev = Array.isArray(prev) ? prev : entryFilterOrder;
      const totalFilters = entryFilterOrder.length;
      const hasFilter = normalizedPrev.includes(entryType);

      // Default state = all filters selected. First click focuses only selected type.
      if (normalizedPrev.length === totalFilters) {
        return [entryType];
      }

      const nextSet = new Set(normalizedPrev);
      if (hasFilter) {
        nextSet.delete(entryType);
      } else {
        nextSet.add(entryType);
      }

      // If all or none selected, return to default (all selected).
      if (nextSet.size === 0 || nextSet.size === totalFilters) {
        return entryFilterOrder;
      }

      return entryFilterOrder.filter((type) => nextSet.has(type));
    });
  };

  useEffect(() => {
    setExpandedSeenProjects({});
  }, [groups]);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">Project Updates (Today)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              New event, new task, new member, and project status updates are shown here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose({ markAsSeen: true })}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No updates for today.
            </div>
          ) : (
            groups.map((group) => {
              const color = PROJECT_COLORS[group.colorIndex] || PROJECT_COLORS[0];
              const isSeenExpanded = Boolean(expandedSeenProjects[group.projectId]);
              const unreadCounts = group.unseenEntries.reduce(
                (acc, entry) => {
                  if (entry.type === PROJECT_ACTIVITY_TYPES.EVENT_CREATED) acc.events += 1;
                  if (entry.type === PROJECT_ACTIVITY_TYPES.TASK_CREATED) acc.tasks += 1;
                  if (entry.type === PROJECT_ACTIVITY_TYPES.MEMBER_JOINED) acc.members += 1;
                  if (entry.type === PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED) acc.statuses += 1;
                  if (entry.type === PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT) acc.announcements += 1;
                  return acc;
                },
                { events: 0, tasks: 0, members: 0, statuses: 0, announcements: 0 }
              );
              const filteredUnseenEntries = group.unseenEntries.filter((entry) =>
                activeEntryFilterSet.has(entry.type)
              );
              const filteredSeenEntries = group.seenEntries.filter((entry) =>
                activeEntryFilterSet.has(entry.type)
              );

              return (
                <div key={group.projectId} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
                    <div className="min-w-0 flex items-center gap-2.5 flex-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                      <p className="text-sm font-semibold text-slate-800 truncate">{group.projectName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 min-w-0">
                      <div
                        className="flex items-center gap-1.5 text-[11px] overflow-x-auto [&::-webkit-scrollbar]:hidden"
                        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleEntryFilter(PROJECT_ACTIVITY_TYPES.EVENT_CREATED)}
                          className={`px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                            activeEntryFilterSet.has(PROJECT_ACTIVITY_TYPES.EVENT_CREATED)
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Events {unreadCounts.events}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEntryFilter(PROJECT_ACTIVITY_TYPES.TASK_CREATED)}
                          className={`px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                            activeEntryFilterSet.has(PROJECT_ACTIVITY_TYPES.TASK_CREATED)
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Tasks {unreadCounts.tasks}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEntryFilter(PROJECT_ACTIVITY_TYPES.MEMBER_JOINED)}
                          className={`px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                            activeEntryFilterSet.has(PROJECT_ACTIVITY_TYPES.MEMBER_JOINED)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Members {unreadCounts.members}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEntryFilter(PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED)}
                          className={`px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                            activeEntryFilterSet.has(PROJECT_ACTIVITY_TYPES.PROJECT_STATUS_CHANGED)
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Status {unreadCounts.statuses}
                        </button>
                        {group.counts.announcements > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleEntryFilter(PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT)}
                            className={`px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                              activeEntryFilterSet.has(PROJECT_ACTIVITY_TYPES.ANNOUNCEMENT)
                                ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Announcements {unreadCounts.announcements}
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                        Latest {formatProjectActivityTimestamp(group.latestAt)}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-2.5 space-y-2">
                    {filteredUnseenEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">New updates</p>
	                        {filteredUnseenEntries.map((entry) => {
	                          const description = describeProjectActivityEntry(entry);
	                          const toneStyles = description.isStatusUpdate
	                            ? getProjectStatusToneStyles(description.statusTone)
	                            : getProjectStatusToneStyles('neutral');
	                          return (
	                            <div key={entry.id} className={`rounded-lg border px-2.5 py-2 ${toneStyles.unseenCard}`}>
	                              <div className="flex items-start justify-between gap-2">
	                                <div className="min-w-0 flex-1">
	                                  <div className="flex flex-wrap items-center gap-1.5">
	                                    <p className={`text-xs font-semibold ${toneStyles.unseenTitle}`}>{description.title}</p>
	                                    {description.isStatusUpdate && description.statusPriorityLabel && (
	                                      <span
	                                        className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${toneStyles.badge}`}
	                                      >
	                                        {description.statusPriorityLabel}
	                                      </span>
	                                    )}
	                                  </div>
	                                  {description.isStatusUpdate && description.statusPrompt && (
	                                    <p className={`text-[11px] mt-0.5 ${toneStyles.unseenSubtitle}`}>
	                                      {description.statusPrompt}
	                                    </p>
	                                  )}
	                                </div>
	                                <span className={`text-[10px] shrink-0 ${toneStyles.unseenTime}`}>
	                                  {formatProjectActivityTimestamp(entry.createdAt)}
	                                </span>
	                              </div>
	                              {description.subtitle && (
	                                <p className={`text-[11px] mt-0.5 ${toneStyles.unseenSubtitle}`}>
	                                  {description.subtitle}
	                                </p>
	                              )}
	                            </div>
	                          );
	                        })}
                      </div>
                    )}

                    {filteredSeenEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSeenProjects((prev) => ({
                              ...prev,
                              [group.projectId]: !prev[group.projectId],
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-600 flex items-center justify-between"
                        >
                          <span>Seen updates ({filteredSeenEntries.length})</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${isSeenExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isSeenExpanded && (
                          <div className="space-y-1.5">
	                            {filteredSeenEntries.map((entry) => {
	                              const description = describeProjectActivityEntry(entry);
	                              const toneStyles = description.isStatusUpdate
	                                ? getProjectStatusToneStyles(description.statusTone)
	                                : getProjectStatusToneStyles('neutral');
	                              return (
	                                <div key={entry.id} className={`rounded-lg border px-2.5 py-2 ${toneStyles.seenCard}`}>
	                                  <div className="flex items-start justify-between gap-2">
	                                    <div className="min-w-0 flex-1">
	                                      <div className="flex flex-wrap items-center gap-1.5">
	                                        <p className={`text-xs font-medium ${toneStyles.seenTitle}`}>{description.title}</p>
	                                        {description.isStatusUpdate && description.statusPriorityLabel && (
	                                          <span
	                                            className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${toneStyles.badge}`}
	                                          >
	                                            {description.statusPriorityLabel}
	                                          </span>
	                                        )}
	                                      </div>
	                                      {description.isStatusUpdate && description.statusPrompt && (
	                                        <p className={`text-[11px] mt-0.5 ${toneStyles.seenSubtitle}`}>
	                                          {description.statusPrompt}
	                                        </p>
	                                      )}
	                                    </div>
	                                    <span className={`text-[10px] shrink-0 ${toneStyles.seenTime}`}>
	                                      {formatProjectActivityTimestamp(entry.createdAt)}
	                                    </span>
	                                  </div>
	                                  {description.subtitle && (
	                                    <p className={`text-[11px] mt-0.5 ${toneStyles.seenSubtitle}`}>
	                                      {description.subtitle}
	                                    </p>
	                                  )}
	                                </div>
	                              );
	                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {filteredUnseenEntries.length === 0 && filteredSeenEntries.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-400">
                        No updates match the selected filters.
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-slate-700 whitespace-nowrap">
              <input
                type="checkbox"
                checked={popupMode === PROJECT_UPDATE_POPUP_MODES.NEW_ONLY}
                onChange={() => onPopupModeChange(PROJECT_UPDATE_POPUP_MODES.NEW_ONLY)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show only when there is new update
            </label>
            <label className="inline-flex items-center gap-2 text-slate-700 whitespace-nowrap">
              <input
                type="checkbox"
                checked={popupMode === PROJECT_UPDATE_POPUP_MODES.ALWAYS}
                onChange={() => onPopupModeChange(PROJECT_UPDATE_POPUP_MODES.ALWAYS)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show every refresh
            </label>
          </div>
          <button
            type="button"
            onClick={() => onClose({ markAsSeen: true })}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shrink-0"
          >
            Mark as read
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Project Manager Modal ---
function ProjectManagerModal({
  projects,
  currentUser,
  onClose,
  onToggleVisibility,
  onSaveProject,
  onDeleteProject,
  onLeaveProject,
  onInviteMember,
  onJoinProjectByCode,
  onRegenerateProjectCode,
  displayRange,
  setDisplayRange,
  hidePastWeeks,
  setHidePastWeeks,
  startupView,
  setStartupView,
  googleCalendarStatus,
  googleCalendarCalendars,
  googleCalendarSelectedCalendarIds,
  onLinkGoogleCalendar,
  onUnlinkGoogleCalendar,
  onSaveGoogleCalendarSelection,
  isGoogleCalendarBusy,
  isGoogleCalendarCalendarsLoading,
  isGoogleCalendarSelectionSaving,
}) {
  const popup = usePopup();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColorIndex, setEditColorIndex] = useState(0);
  const [inviteInputs, setInviteInputs] = useState({});
  const [openInvitePanels, setOpenInvitePanels] = useState({});
  const [copiedCodeProjectId, setCopiedCodeProjectId] = useState('');
  const [isAddProjectPopupOpen, setIsAddProjectPopupOpen] = useState(false);
  const [addProjectPopupMode, setAddProjectPopupMode] = useState('select');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColorIndex, setNewProjectColorIndex] = useState(0);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [googleCalendarDraftSelection, setGoogleCalendarDraftSelection] = useState([]);
  const [isGoogleCalendarPickerOpen, setIsGoogleCalendarPickerOpen] = useState(false);

  useEffect(() => {
    if (!googleCalendarStatus?.linked) {
      setGoogleCalendarDraftSelection([]);
      setIsGoogleCalendarPickerOpen(false);
      return;
    }

    const availableIds = normalizeGoogleCalendarSelection(
      (Array.isArray(googleCalendarCalendars) ? googleCalendarCalendars : []).map((calendar) => calendar.id)
    );
    const selectedIds = normalizeGoogleCalendarSelection(googleCalendarSelectedCalendarIds).filter((calendarId) =>
      availableIds.includes(calendarId)
    );

    setGoogleCalendarDraftSelection(selectedIds.length > 0 ? selectedIds : availableIds);
  }, [googleCalendarStatus?.linked, googleCalendarCalendars, googleCalendarSelectedCalendarIds]);

  const startEdit = (project) => {
    if (project.ownerId !== currentUser.id) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only the project creator can edit this project.',
      });
      return;
    }

    setEditingId(project.id);
    setEditName(project.name);
    setEditColorIndex(project.colorIndex);
  };

  const handleSave = () => {
    if (!editName.trim()) return;

    const payload = {
      name: editName,
      colorIndex: editColorIndex,
    };

    if (editingId && editingId !== 'new') {
      payload.id = editingId;
    }

    onSaveProject(payload);

    setEditingId(null);
    setEditName('');
  };

  const handleInvite = async (projectId) => {
    const inputValue = inviteInputs[projectId] || '';
    const result = await Promise.resolve(onInviteMember(projectId, inputValue));

    if (result?.message) {
      void popup.alert({
        title: result.ok ? 'Invite result' : 'Invite failed',
        message: result.message,
      });
    }

    if (result?.ok) {
      setInviteInputs((prev) => ({ ...prev, [projectId]: '' }));
    }
  };

  const handleLeave = async (projectId) => {
    if (!onLeaveProject) return;
    const result = await onLeaveProject(projectId);
    if (result?.cancelled) return;
    if (result?.message) {
      void popup.alert({
        title: result.ok ? 'Project update' : 'Action blocked',
        message: result.message,
      });
    }
  };

  const toggleGoogleCalendarSelection = (calendarId) => {
    const normalizedCalendarId = String(calendarId || '').trim();
    if (!normalizedCalendarId) return;
    setGoogleCalendarDraftSelection((prev) => {
      const hasCalendar = prev.includes(normalizedCalendarId);
      return hasCalendar
        ? prev.filter((id) => id !== normalizedCalendarId)
        : [...prev, normalizedCalendarId];
    });
  };

  const handleSaveGoogleCalendarSelectionDraft = async () => {
    const selectedIds = normalizeGoogleCalendarSelection(googleCalendarDraftSelection);
    if (selectedIds.length === 0) {
      await popup.alert({
        title: 'Selection required',
        message: 'Please select at least 1 Google Calendar.',
      });
      return;
    }

    const result = await Promise.resolve(onSaveGoogleCalendarSelection?.(selectedIds));
    if (result?.message) {
      await popup.alert({
        title: result.ok ? 'Saved' : 'Unable to save',
        message: result.message,
      });
    }
  };

  const toggleInvitePanel = (projectId) => {
    setOpenInvitePanels((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleCopyProjectCode = async (project) => {
    const code = buildProjectJoinCode(project);
    if (!code) {
      await popup.alert({
        title: 'Project code unavailable',
        message: 'Unable to generate project code for this project.',
      });
      return;
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable.');
      }
      await navigator.clipboard.writeText(code);
      setCopiedCodeProjectId(project.id);
      window.setTimeout(() => {
        setCopiedCodeProjectId((prev) => (prev === project.id ? '' : prev));
      }, 1400);
    } catch {
      await popup.alert({
        title: 'Copy failed',
        message: `Please copy manually:\n${code}`,
      });
    }
  };

  const handleRegenerateProjectCode = async (project) => {
    const shouldRegenerate = await popup.confirm({
      title: 'Refresh project code',
      message:
        'Refreshing will invalidate the old code immediately. Continue?',
      confirmText: 'Refresh code',
      tone: 'danger',
    });
    if (!shouldRegenerate) return;

    const result = await Promise.resolve(onRegenerateProjectCode?.(project.id));
    if (result?.message) {
      await popup.alert({
        title: result.ok ? 'Project code updated' : 'Unable to refresh code',
        message: result.message,
      });
    }
  };

  const openAddProjectPopup = () => {
    setIsAddProjectPopupOpen(true);
    setAddProjectPopupMode('select');
    setNewProjectName('');
    setNewProjectColorIndex(Math.floor(Math.random() * PROJECT_COLORS.length));
    setJoinCodeInput('');
  };

  const closeAddProjectPopup = () => {
    setIsAddProjectPopupOpen(false);
    setAddProjectPopupMode('select');
    setNewProjectName('');
    setJoinCodeInput('');
  };

  const handleCreateProjectFromPopup = () => {
    const projectName = String(newProjectName || '').trim();
    if (!projectName) {
      void popup.alert({
        title: 'Project name required',
        message: 'Please enter project name before creating.',
      });
      return;
    }
    onSaveProject({
      name: projectName,
      colorIndex: newProjectColorIndex,
    });
    closeAddProjectPopup();
  };

  const handleJoinProjectByCode = async () => {
    const code = String(joinCodeInput || '').trim();
    if (!code) {
      await popup.alert({
        title: 'Project code required',
        message: 'Please enter project invitation code.',
      });
      return;
    }
    const result = await Promise.resolve(onJoinProjectByCode?.(code));
    if (result?.message) {
      await popup.alert({
        title: result.ok ? 'Join project result' : 'Unable to join project',
        message: result.message,
      });
    }
    if (result?.ok) {
      closeAddProjectPopup();
    }
  };

  const visibleCount = projects.filter((project) => project.isVisible).length;
  const googleLinked = Boolean(googleCalendarStatus?.linked);
  const googleConfigured = Boolean(googleCalendarStatus?.configured);
  const googleCalendarTotalCount = Array.isArray(googleCalendarCalendars)
    ? googleCalendarCalendars.length
    : 0;
  const googleCalendarSelectedCount = googleCalendarDraftSelection.length;
  const startupViewOptions = [
    {
      id: STARTUP_VIEW_MODES.CALENDAR,
      title: 'Calendar Board',
      description: 'Open the calendar timeline every time you sign in.',
      icon: CalendarDays,
    },
    {
      id: STARTUP_VIEW_MODES.PROJECT,
      title: 'Project Dashboard',
      description: 'Open a project dashboard first (latest project or first available).',
      icon: FolderTree,
    },
    {
      id: STARTUP_VIEW_MODES.LAST,
      title: 'Last Opened Page',
      description: 'Return to the page you used before you left.',
      icon: Clock,
    },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" /> Manage Projects
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 mb-4">
            Choose projects to show on main board (max 4). Current:
            <span className={`font-bold ${visibleCount === 4 ? 'text-orange-500' : 'text-blue-600'}`}> {visibleCount}/4</span>
          </p>

          <div className="space-y-3">
            {projects.map((project) => {
              const isOwner = project.ownerId === currentUser.id;
              const members = Array.isArray(project.members) ? project.members : [];
              const canInviteMembers = isProjectAccessibleByUser(project, currentUser);
              const isInvitePanelOpen = Boolean(openInvitePanels[project.id]);
              const projectJoinCode = buildProjectJoinCode(project);

              return (
                <div key={project.id} className="p-3 border rounded-lg hover:border-blue-300 transition-colors space-y-2">
                  {editingId === project.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border rounded px-2 py-1 w-full text-sm focus:outline-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {PROJECT_COLORS.map((color, index) => (
                          <button
                            key={index}
                            onClick={() => setEditColorIndex(index)}
                            className={`w-6 h-6 rounded-full ${color.bg} flex items-center justify-center ${editColorIndex === index ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                          >
                            {editColorIndex === index && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs bg-gray-200 px-3 py-1 rounded">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => onToggleVisibility(project.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${project.isVisible ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}
                          >
                            {project.isVisible && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                          <div className={`w-3 h-3 rounded-full ${PROJECT_COLORS[project.colorIndex].bg}`}></div>
                          <span className="font-medium truncate">{project.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {canInviteMembers && (
                            <button
                              type="button"
                              onClick={() => toggleInvitePanel(project.id)}
                              className={`p-1.5 rounded-md transition-colors ${
                                isInvitePanelOpen
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Invite member / Project code"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => startEdit(project)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                              title="Edit project"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const shouldDelete = await popup.confirm({
                                title: 'Delete project',
                                message: `Delete project "${project.name}" and all related events?`,
                                confirmText: 'Delete',
                                tone: 'danger',
                              });
                              if (shouldDelete) onDeleteProject(project.id);
                            }}
                            disabled={!isOwner}
                            title={isOwner ? 'Delete project' : 'Only creator can delete'}
                            className={`p-1.5 rounded-md ${isOwner ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Owner: <span className="font-semibold text-gray-700">{project.ownerUsername || '-'}</span>
                        <span className="mx-2">|</span>
                        Members: <span className="font-semibold text-gray-700">{members.length}</span>
                      </div>

                      {isInvitePanelOpen && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-2.5 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={inviteInputs[project.id] || ''}
                              onChange={(e) =>
                                setInviteInputs((prev) => ({
                                  ...prev,
                                  [project.id]: e.target.value,
                                }))
                              }
                              placeholder="Invite by username or email"
                              className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-blue-500 bg-white"
                            />
                            <button
                              onClick={() => handleInvite(project.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded"
                            >
                              Invite
                            </button>
                          </div>

                          <div className="rounded-md border border-gray-200 bg-white p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                              Project Code
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                readOnly
                                value={projectJoinCode}
                                className="flex-1 border border-gray-200 rounded px-2 py-1 text-[11px] font-mono text-gray-700 bg-gray-50"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  void handleCopyProjectCode(project);
                                }}
                                className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                                title="Copy project code"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleRegenerateProjectCode(project);
                                }}
                                disabled={!isOwner}
                                className={`h-7 w-7 inline-flex items-center justify-center rounded border transition-colors ${
                                  isOwner
                                    ? 'border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50'
                                    : 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                                }`}
                                title={
                                  isOwner
                                    ? 'Refresh project code (old code will stop working)'
                                    : 'Only creator can refresh project code'
                                }
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {copiedCodeProjectId === project.id
                                ? 'Code copied.'
                                : 'Rotate code to invalidate old shared code.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {!isOwner && (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-400">Project members can edit shared project settings.</p>
                          <button
                            type="button"
                            onClick={() => {
                              void handleLeave(project.id);
                            }}
                            className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Leave project
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openAddProjectPopup}
            className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>

          <div className="mt-6 pt-5 border-t border-gray-200 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-gray-500" /> Google Calendar (Merge View)
            </h3>
            <p className="text-xs text-gray-500">
              Link this account to show Google Calendar events inside Merge view on desktop and mobile.
            </p>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50/70 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {googleLinked ? 'Linked' : 'Not linked'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {googleLinked
                      ? `Account: ${googleCalendarStatus.linkedEmail || currentUser.email}`
                      : googleConfigured
                      ? 'Link your registered Google account to sync events.'
                      : 'Server OAuth config is incomplete.'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                    googleLinked
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                >
                  {googleLinked ? 'Linked' : 'Unlinked'}
                </span>
              </div>

              {!googleConfigured && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  Configure `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALENDAR_REDIRECT_URI` on auth server first.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!googleLinked ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onLinkGoogleCalendar();
                    }}
                    disabled={isGoogleCalendarBusy || !googleConfigured}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      isGoogleCalendarBusy || !googleConfigured
                        ? 'bg-blue-200 text-white cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isGoogleCalendarBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    Link Google Calendar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void onUnlinkGoogleCalendar();
                    }}
                    disabled={isGoogleCalendarBusy}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      isGoogleCalendarBusy
                        ? 'bg-red-200 text-white cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isGoogleCalendarBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Unlink
                  </button>
                )}
              </div>

              {googleLinked && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsGoogleCalendarPickerOpen((prev) => !prev)}
                    className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-gray-800">
                        Calendar visibility in Merge view
                      </span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {googleCalendarTotalCount > 0
                          ? `${googleCalendarSelectedCount}/${googleCalendarTotalCount} selected`
                          : 'No calendars found'}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        isGoogleCalendarPickerOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isGoogleCalendarPickerOpen && (
                    <div className="border-t border-gray-200 px-3 pt-2.5 pb-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-gray-700">Choose calendars shown in Merge view</p>
                        <span className="text-[11px] text-gray-500">
                          {googleCalendarTotalCount > 0
                            ? `${googleCalendarSelectedCount}/${googleCalendarTotalCount}`
                            : '0/0'}
                        </span>
                      </div>

                      {isGoogleCalendarCalendarsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading calendar list...
                        </div>
                      ) : googleCalendarTotalCount === 0 ? (
                        <p className="text-xs text-gray-500">
                          No calendars found for this Google account.
                        </p>
                      ) : (
                        <>
                          <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                            {googleCalendarCalendars.map((calendar) => {
                              const isChecked = googleCalendarDraftSelection.includes(calendar.id);
                              return (
                                <label
                                  key={calendar.id}
                                  className="flex items-start gap-2 px-2 py-1.5 rounded-md border border-gray-200 hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleGoogleCalendarSelection(calendar.id)}
                                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-medium text-gray-800 truncate">
                                      {calendar.summary}
                                      {calendar.primary ? ' (Primary)' : ''}
                                    </span>
                                    <span className="block text-[11px] text-gray-500 truncate">
                                      {calendar.id}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setGoogleCalendarDraftSelection(
                                  normalizeGoogleCalendarSelection(
                                    googleCalendarCalendars.map((calendar) => calendar.id)
                                  )
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSaveGoogleCalendarSelectionDraft();
                              }}
                              disabled={isGoogleCalendarSelectionSaving || isGoogleCalendarBusy}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                                isGoogleCalendarSelectionSaving || isGoogleCalendarBusy
                                  ? 'bg-blue-200 text-white cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {isGoogleCalendarSelectionSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Save selection
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-500" /> Startup Page
            </h3>
            <p className="text-xs text-gray-500">
              Choose which page should be shown first after you sign in.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              {startupViewOptions.map((option) => {
                const isActive = startupView === option.id;
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStartupView(option.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span
                        className={`w-3 h-3 rounded-full border mt-0.5 ${
                          isActive ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      />
                    </div>
                    <p className={`mt-2 text-sm font-semibold ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>
                      {option.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{option.description}</p>
                  </button>
                );
              })}
            </div>

          </div>

          <div className="mt-6 pt-5 border-t border-gray-200 flex flex-col gap-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-500" /> Display Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
              <input
                type="month"
                value={displayRange.start}
                onChange={(e) => setDisplayRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full min-w-0 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50"
              />
              <span className="text-gray-500 font-medium text-center">to</span>
              <input
                type="month"
                value={displayRange.end}
                onChange={(e) => setDisplayRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full min-w-0 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer mt-2 p-2 rounded-md hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={hidePastWeeks}
                onChange={(e) => setHidePastWeeks(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
              />
              <span>
                <span className="font-medium text-gray-800">Hide past weeks/months</span>
                <br />
                <span className="text-xs text-gray-500">Show only current and future timeline.</span>
              </span>
            </label>
          </div>
        </div>

        {isAddProjectPopupOpen && (
          <div className="absolute inset-0 z-20 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Add Project</h3>
                <button
                  type="button"
                  onClick={closeAddProjectPopup}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addProjectPopupMode === 'select' && (
                <div className="p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setAddProjectPopupMode('join')}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-800">Join with Project Code</p>
                    <p className="text-xs text-gray-500 mt-1">Use invite code from project owner/member.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddProjectPopupMode('create')}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-800">Create Your Own Project</p>
                    <p className="text-xs text-gray-500 mt-1">Start a new project and invite your team later.</p>
                  </button>
                </div>
              )}

              {addProjectPopupMode === 'join' && (
                <div className="p-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Project code</span>
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(event) => setJoinCodeInput(event.target.value)}
                      placeholder="PJC.ownerId.projectId.secret"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-blue-500"
                      autoFocus
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddProjectPopupMode('select')}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleJoinProjectByCode();
                      }}
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      Join Project
                    </button>
                  </div>
                </div>
              )}

              {addProjectPopupMode === 'create' && (
                <div className="p-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Project name</span>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      placeholder="Project name..."
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-blue-500"
                      autoFocus
                    />
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PROJECT_COLORS.map((color, index) => (
                      <button
                        key={`new-project-color-${index}`}
                        type="button"
                        onClick={() => setNewProjectColorIndex(index)}
                        className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center ${
                          newProjectColorIndex === index ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                        }`}
                      >
                        {newProjectColorIndex === index && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddProjectPopupMode('select')}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateProjectFromPopup}
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      Create Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// --- Event Form Modal ---
function EventModal({
  event,
  projects,
  defaultDate,
  defaultProjectId,
  googleCalendarStatus,
  googleCalendarCalendars,
  googleCalendarSelectedCalendarIds,
  isGoogleCalendarCalendarsLoading,
  onClose,
  onSave,
  onDelete,
}) {
  const popup = usePopup();
  const [title, setTitle] = useState(event?.title || '');
  const [projectId, setProjectId] = useState(event?.projectId || defaultProjectId || (projects[0]?.id || ''));
  const [startDate, setStartDate] = useState(event?.startDate || defaultDate || '');
  const [endDate, setEndDate] = useState(event?.endDate || '');
  const [hasEndDate, setHasEndDate] = useState(() => {
    const initialStartDate = String(event?.startDate || defaultDate || '').trim();
    const initialEndDate = String(event?.endDate || '').trim();
    return Boolean(initialEndDate && initialEndDate !== initialStartDate);
  });
  const [startTime, setStartTime] = useState(event?.startTime || '09:00');
  const [endTime, setEndTime] = useState(event?.endTime || '10:00');
  const [hasTime, setHasTime] = useState(() => {
    if (!event) return false; // New event: time is off by default
    if (typeof event.showTime === 'boolean') return event.showTime;
    const start = String(event.startTime || '').trim();
    const end = String(event.endTime || '').trim();
    return Boolean(start || end);
  });
  const [description, setDescription] = useState(event?.description || '');
  const selectedProject = projects.find((project) => project.id === projectId) || projects[0] || null;
  const selectedProjectColor = PROJECT_COLORS[selectedProject?.colorIndex ?? 0] || PROJECT_COLORS[0];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleLinked = Boolean(googleCalendarStatus?.linked);
  const availableGoogleCalendars = Array.isArray(googleCalendarCalendars)
    ? googleCalendarCalendars
    : [];
  const writableGoogleCalendars = availableGoogleCalendars.filter((calendar) =>
    canWriteGoogleCalendar(calendar)
  );
  const hasWritableGoogleCalendars = writableGoogleCalendars.length > 0;
  const preferredGoogleCalendarId =
    normalizeGoogleCalendarSelection(googleCalendarSelectedCalendarIds).find((calendarId) =>
      writableGoogleCalendars.some((calendar) => calendar.id === calendarId)
    ) ||
    writableGoogleCalendars[0]?.id ||
    '';
  const [addToGoogleCalendar, setAddToGoogleCalendar] = useState(false);
  const [googleCalendarId, setGoogleCalendarId] = useState(preferredGoogleCalendarId);
  const [googleEventColorId, setGoogleEventColorId] = useState('');

  useEffect(() => {
    if (!hasEndDate) return;
    if (startDate && (!endDate || startDate > endDate)) {
      setEndDate(startDate);
    }
  }, [startDate, endDate, hasEndDate]);

  useEffect(() => {
    if (!addToGoogleCalendar) return;
    const hasCurrent = writableGoogleCalendars.some((calendar) => calendar.id === googleCalendarId);
    if (hasCurrent) return;
    setGoogleCalendarId(preferredGoogleCalendarId);
  }, [addToGoogleCalendar, writableGoogleCalendars, googleCalendarId, preferredGoogleCalendarId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!title || !startDate || (hasEndDate && !endDate)) {
      void popup.alert({
        title: 'Incomplete form',
        message: 'Please provide event title and start date.',
      });
      return;
    }
    if (addToGoogleCalendar && !googleLinked) {
      await popup.alert({
        title: 'Google Calendar not linked',
        message: 'Please link Google Calendar first in Manage Projects.',
      });
      return;
    }
    if (addToGoogleCalendar && !hasWritableGoogleCalendars) {
      await popup.alert({
        title: 'No writable calendar',
        message:
          'No calendar with writer access found. Please grant "Make changes to events" permission in Google Calendar.',
      });
      return;
    }

    const effectiveGoogleCalendarId = String(googleCalendarId || preferredGoogleCalendarId || '').trim();
    if (addToGoogleCalendar && !effectiveGoogleCalendarId) {
      await popup.alert({
        title: 'Missing Google Calendar',
        message: 'Please choose a Google Calendar.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.resolve(
        onSave({
          title,
          projectId,
          startDate,
          endDate: hasEndDate ? endDate : startDate,
          startTime: hasTime ? startTime : '00:00',
          endTime: hasTime ? endTime : '23:59',
          description,
          showTime: hasTime,
          googleCalendarOptions: addToGoogleCalendar
            ? {
                enabled: true,
                calendarId: effectiveGoogleCalendarId,
                colorId: String(googleEventColorId || '').trim(),
              }
            : null,
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4 overflow-y-auto">
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-medium border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none w-full pb-1 transition-colors"
            autoFocus
          />

          <div className="flex items-center gap-3 text-gray-600">
            <Layers className="w-5 h-5" />
            <div className="relative flex-1">
              <span
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${selectedProjectColor.bg}`}
              ></span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full border-gray-300 rounded-md p-2 pl-8 bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" disabled>
                  Select Project
                </option>
                {projects.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    style={{ color: getProjectColorHexByIndex(p.colorIndex) }}
                  >
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <Clock className="w-5 h-5 mt-2 shrink-0" />
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1 min-w-0"
                />
                <span className="text-gray-400">-</span>
                {hasEndDate ? (
                  <>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setHasEndDate(false);
                        setEndDate('');
                      }}
                      className="px-2 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHasEndDate(true);
                      setEndDate(startDate || defaultDate || '');
                    }}
                    className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm text-left flex-1 min-w-0 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-medium">No end date</span>
                    <span className="text-xs text-blue-600 ml-1">Set end date</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={hasTime}
                    onChange={(e) => setHasTime(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">Has time</span>
                </label>
                {hasTime && (
                  <>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm w-28"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm w-28"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-gray-600 mt-1">
            <LinkIcon className="w-5 h-5 mt-2 shrink-0" />
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2.5 space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToGoogleCalendar}
                  onChange={(e) => setAddToGoogleCalendar(e.target.checked)}
                  disabled={!googleLinked || !hasWritableGoogleCalendars}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="font-medium">Add this event to Google Calendar</span>
              </label>
              {!googleLinked && (
                <p className="text-xs text-gray-500">
                  Link Google Calendar in Manage Projects to enable this option.
                </p>
              )}
              {googleLinked && !hasWritableGoogleCalendars && (
                <p className="text-xs text-amber-700">
                  This Google account has no writable calendar. Grant "Make changes to events" permission first.
                </p>
              )}
              {googleLinked && addToGoogleCalendar && (
                <div className="pt-2 border-t border-gray-200 space-y-2.5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Google Calendar
                    </p>
                    {isGoogleCalendarCalendarsLoading ? (
                      <div className="text-xs text-gray-500">Loading calendars...</div>
                    ) : (
                      <select
                        value={googleCalendarId}
                        onChange={(e) => setGoogleCalendarId(e.target.value)}
                        className="w-full border-gray-300 rounded-md p-2 bg-white text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        {writableGoogleCalendars.map((calendar) => (
                          <option key={`google-calendar-target-${calendar.id}`} value={calendar.id}>
                            {calendar.summary || calendar.id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Google Color
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGoogleEventColorId('')}
                        className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                          googleEventColorId
                            ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}
                      >
                        Default
                      </button>
                      {GOOGLE_CALENDAR_EVENT_COLOR_PRESETS.map((color) => (
                        <button
                          key={`google-event-color-${color.id}`}
                          type="button"
                          onClick={() => setGoogleEventColorId(color.id)}
                          title={color.label}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-105 ${
                            googleEventColorId === color.id
                              ? 'border-gray-700'
                              : 'border-white shadow-sm ring-1 ring-gray-300'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <AlignLeft className="w-5 h-5 mt-2" />
            <textarea
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 border-gray-300 rounded-md p-2 bg-gray-50 min-h-[100px] resize-y focus:ring-blue-500 focus:border-blue-500 text-sm"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            {event && (
              <button
                type="button"
                onClick={async () => {
                  const shouldDelete = await popup.confirm({
                    title: 'Delete event',
                    message: 'Are you sure you want to delete this event?',
                    confirmText: 'Delete',
                    tone: 'danger',
                  });
                  if (shouldDelete) onDelete(event.id);
                }}
                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors mr-auto"
              >
                Delete Event
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
