import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Flag,
  LogOut,
  Loader2
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
const DEFAULT_LAST_VISITED_VIEW = {
  type: STARTUP_VIEW_MODES.CALENDAR,
  projectId: null,
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

const normalizeLastVisitedView = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_LAST_VISITED_VIEW };
  }

  const type =
    value.type === STARTUP_VIEW_MODES.PROJECT
      ? STARTUP_VIEW_MODES.PROJECT
      : STARTUP_VIEW_MODES.CALENDAR;
  const projectId = type === STARTUP_VIEW_MODES.PROJECT ? String(value.projectId || '').trim() || null : null;

  return { type, projectId };
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
  const resolverRef = useRef(null);

  const closePopup = (result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPopupState(null);
    setPromptValue('');
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

  const value = useMemo(
    () => ({
      alert: showAlert,
      confirm: showConfirm,
      prompt: showPrompt,
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
                onClick={() => closePopup(popupState.type === 'confirm' ? true : popupState.type === 'prompt' ? promptValue : true)}
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

  return {
    ...project,
    ownerId: project.ownerId || owner.id,
    ownerUsername,
    members: Array.from(new Set(mergedMembers)),
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
  projectInvitations = [],
  onRespondToProjectInvite,
}) {
  const [username, setUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isPasswordPopupOpen, setIsPasswordPopupOpen] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordResult, setPasswordResult] = useState(null);

  useEffect(() => {
    setUsername(currentUser.username || '');
    setEmail(currentUser.email || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setInviteResult(null);
  }, [currentUser.id, currentUser.username, currentUser.email, currentUser.avatarUrl]);

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

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    const result = onSaveProfile({ username, email, avatarUrl });
    setProfileResult(result);
  };

  const handlePasswordSubmit = () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordResult({ ok: false, message: 'Please fill in all password fields.' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordResult({ ok: false, message: 'New password and confirm password do not match.' });
      return;
    }

    const result = onChangePassword({ currentPassword, newPassword });
    setPasswordResult(result);

    if (result?.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsPasswordPopupOpen(false);
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
                user={{ ...currentUser, username, email, avatarUrl }}
                sizeClass="w-24 h-24"
                textClass="text-2xl"
                ringClass="ring-4 ring-white shadow-sm"
              />
              <h2 className="mt-4 text-lg font-semibold text-gray-800 break-all">{username || 'username'}</h2>
              <p className="text-sm text-gray-500 break-all">{email || 'email@example.com'}</p>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                Manage your profile information and account security in one place.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <form
              onSubmit={handleProfileSubmit}
              noValidate
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Profile</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="username"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="name@company.com"
                  />
                </label>
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

              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <label
                  htmlFor="profile-avatar-upload"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 px-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <ImageIcon className="w-4 h-4" /> Upload image
                </label>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" /> Remove image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordResult(null);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setIsPasswordPopupOpen(true);
                  }}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white rounded-lg px-4 font-medium transition-colors"
                >
                  <Lock className="w-4 h-4" /> Change password
                </button>
                <button
                  type="submit"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 font-medium transition-colors"
                >
                  <Check className="w-4 h-4" /> Save profile
                </button>
              </div>
            </form>

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

      {isPasswordPopupOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Change password</h3>
              <button
                type="button"
                onClick={() => setIsPasswordPopupOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="space-y-1 block">
                <span className="text-sm font-medium text-gray-600">Current password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
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
                onClick={() => setIsPasswordPopupOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
              >
                Save password
              </button>
            </div>
          </div>
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
  const [startupView, setStartupView] = useState(STARTUP_VIEW_MODES.CALENDAR);
  const [lastVisitedView, setLastVisitedView] = useState(() => ({ ...DEFAULT_LAST_VISITED_VIEW }));
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
          setStartupView(STARTUP_VIEW_MODES.CALENDAR);
        }

        setLastVisitedView(normalizeLastVisitedView(accountPayload.lastVisitedView));
      } catch {
        if (isCancelled) return;
        setProjects([]);
        setEvents([]);
        setStartupView(STARTUP_VIEW_MODES.CALENDAR);
        setLastVisitedView({ ...DEFAULT_LAST_VISITED_VIEW });
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
    if (!showProjectModal || !googleCalendarStatus.linked || !AUTH_API_BASE_URL) {
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
  }, [showProjectModal, googleCalendarStatus.linked, currentUser.id]);

  useEffect(() => {
    if (!isAccountDataHydrated) return;

    const dbPayload = {
      projects,
      events,
      displayRange,
      hidePastWeeks,
      startupView,
      lastVisitedView,
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

    if (startupView === STARTUP_VIEW_MODES.PROJECT) {
      nextProjectId = getProjectForProjectStartup();
    } else if (
      startupView === STARTUP_VIEW_MODES.LAST &&
      lastVisitedView?.type === STARTUP_VIEW_MODES.PROJECT
    ) {
      const savedProjectId = String(lastVisitedView.projectId || '').trim();
      nextProjectId = projects.some((project) => project.id === savedProjectId) ? savedProjectId : null;
    }

    setActiveDashboardProjectId(nextProjectId);
    setHasAppliedStartupView(true);
  }, [isAccountDataHydrated, hasAppliedStartupView, startupView, lastVisitedView, projects]);

  useEffect(() => {
    if (!isAccountDataHydrated || !hasAppliedStartupView) return;

    setLastVisitedView((prev) => {
      if (activeDashboardProjectId) {
        if (prev.type === STARTUP_VIEW_MODES.PROJECT && prev.projectId === activeDashboardProjectId) {
          return prev;
        }
        return { type: STARTUP_VIEW_MODES.PROJECT, projectId: activeDashboardProjectId };
      }

      if (prev.type === STARTUP_VIEW_MODES.CALENDAR && prev.projectId === null) {
        return prev;
      }
      return { type: STARTUP_VIEW_MODES.CALENDAR, projectId: null };
    });
  }, [isAccountDataHydrated, hasAppliedStartupView, activeDashboardProjectId]);

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
    return [...events, ...googleCalendarEvents];
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
        const latestPayload = await loadAccountDbPayload(currentUser.id);
        if (isCancelled) return;

        const baseProjects = Array.isArray(latestPayload.projects)
          ? latestPayload.projects.map((project) => ensureProjectOwnership(project, currentUser))
          : [];
        const baseEvents = Array.isArray(latestPayload.events) ? latestPayload.events : [];
        const ownerIds = Array.from(
          new Set(
            baseProjects
              .map((project) => String(project.ownerId || '').trim())
              .filter((ownerId) => ownerId && ownerId !== currentUser.id)
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

        const localVisibilityByProjectId = new Map(
          projects.map((project) => [project.id, Boolean(project.isVisible)])
        );

        const nextProjects = baseProjects.map((project) => {
          if (project.ownerId === currentUser.id) return project;

          const ownerProject = ownerProjectById.get(project.id);
          if (!ownerProject) return project;

          const preservedVisibility = localVisibilityByProjectId.get(project.id);
          return ensureProjectOwnership(
            {
              ...ownerProject,
              isVisible:
                typeof preservedVisibility === 'boolean'
                  ? preservedVisibility
                  : Boolean(ownerProject.isVisible),
            },
            currentUser
          );
        });

        const ownedProjectIds = new Set(
          nextProjects
            .filter((project) => project.ownerId === currentUser.id)
            .map((project) => project.id)
        );

        const mergedEvents = [
          ...baseEvents.filter((event) => ownedProjectIds.has(event.projectId)),
        ];

        nextProjects.forEach((project) => {
          if (project.ownerId === currentUser.id) return;
          const sharedEvents = ownerEventsByProjectId.get(project.id);
          if (!Array.isArray(sharedEvents) || sharedEvents.length === 0) return;
          mergedEvents.push(...sharedEvents);
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

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    }, 15000);

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
  }, [isAccountDataHydrated, currentUser, projects]);

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
        const shouldOpen = await popup.confirm({
          title: 'Google Calendar event',
          message:
            `This event is synced from Google Calendar and is read-only here.\n\n` +
            `${event.title || '(Untitled)'}\n${event.startDate} ${event.startTime} - ${event.endDate} ${event.endTime}\n\n` +
            `${event.htmlLink ? 'Open this event in Google Calendar?' : 'Edit it directly in Google Calendar.'}`,
          confirmText: event.htmlLink ? 'Open Google Calendar' : 'OK',
          cancelText: event.htmlLink ? 'Close' : 'Cancel',
        });
        if (shouldOpen && event.htmlLink) {
          window.open(event.htmlLink, '_blank', 'noopener,noreferrer');
        }
      })();
      return;
    }
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const saveEvent = (eventData) => {
    if (editingEvent) {
      const nextEvents = events.map((event) =>
        event.id === editingEvent.id ? { ...event, ...eventData } : event
      );
      setEvents(nextEvents);
      syncSharedEventsForProjects([editingEvent.projectId, eventData.projectId], nextEvents);
    } else {
      const createdEvent = {
        ...eventData,
        id: generateId(),
        status: 'To Do',
        department: 'Unassigned',
        assigneeId: 'u' + (Math.floor(Math.random() * 5) + 1),
      };
      const nextEvents = [...events, createdEvent];
      setEvents(nextEvents);
      syncSharedEventsForProjects([createdEvent.projectId], nextEvents);
    }
    setShowEventModal(false);
  };

  const updateEvent = (eventId, updates) => {
    const existingEvent = events.find((event) => event.id === eventId) || null;
    const nextEvents = events.map((event) => (event.id === eventId ? { ...event, ...updates } : event));
    setEvents(nextEvents);
    const updatedEvent = nextEvents.find((event) => event.id === eventId) || null;
    syncSharedEventsForProjects([existingEvent?.projectId, updatedEvent?.projectId], nextEvents);
  };

  const deleteEvent = (eventId) => {
    const targetEvent = events.find((event) => event.id === eventId) || null;
    const nextEvents = events.filter((event) => event.id !== eventId);
    setEvents(nextEvents);
    syncSharedEventsForProjects([targetEvent?.projectId], nextEvents);
    setShowEventModal(false);
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
        members: [currentUser.username]
      };
      setProjects([...projects, newProject]);
    }
  };

  const updateProjectDetails = (projectId, updates) => {
    setProjects(
      projects.map((project) => {
        if (project.id !== projectId) return project;
        return ensureProjectOwnership({ ...project, ...updates }, currentUser);
      })
    );
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

    if (targetProject.ownerId !== currentUser.id) {
      return { ok: false, message: 'Only the project creator can invite members.' };
    }

    const normalizedProject = ensureProjectOwnership(targetProject, currentUser);
    if (normalizedProject.members.includes(invitedUser.username)) {
      return { ok: false, message: 'This user is already in the project.' };
    }

    const allInvites = await loadProjectInvitesStore();
    const duplicatedPendingInvite = allInvites.some(
      (invite) =>
        invite.status === PROJECT_INVITE_STATUSES.PENDING &&
        invite.projectId === projectId &&
        invite.ownerId === currentUser.id &&
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
        ownerId: currentUser.id,
        ownerUsername: currentUser.username,
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
        const updatedProject = addProjectMemberRecord(project, currentUser);
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
        if (existing) {
          return prevProjects.map((project) =>
            project.id === normalizedAcceptedProject.id
              ? { ...normalizedAcceptedProject, isVisible: existing.isVisible }
              : project
          );
        }

        const visibleCount = prevProjects.filter((project) => project.isVisible).length;
        return [...prevProjects, { ...normalizedAcceptedProject, isVisible: visibleCount < 4 }];
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

  const handleSaveProfile = ({ username, email, avatarUrl }) => {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedEmail = String(email || '').trim().toLowerCase();
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
    });

    return { ok: true, message: 'Profile updated successfully.' };
  };

  const handleChangePassword = ({ currentPassword, newPassword }) => {
    const normalizedCurrentPassword = String(currentPassword || '');
    const normalizedNewPassword = String(newPassword || '');

    if (!normalizedCurrentPassword || !normalizedNewPassword) {
      return { ok: false, message: 'Please fill in current and new password.' };
    }

    if (normalizedNewPassword.length < 6) {
      return { ok: false, message: 'New password must be at least 6 characters.' };
    }

    const users = getLocalUsers();
    const existingUser = users.find((user) => user.id === currentUser.id);
    if (!existingUser) {
      return { ok: false, message: 'Current user record not found.' };
    }

    if (existingUser.password !== normalizedCurrentPassword) {
      return { ok: false, message: 'Current password is incorrect.' };
    }

    const nextUsers = users.map((user) =>
      user.id === currentUser.id ? { ...user, password: normalizedNewPassword } : user
    );
    saveLocalUsers(nextUsers);

    return { ok: true, message: 'Password changed successfully.' };
  };

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
        <ProjectDashboard 
          project={activeProject} 
          currentUser={currentUser}
          events={events.filter(e => e.projectId === activeProject.id)}
          onBack={() => setActiveDashboardProjectId(null)} 
          onUpdateEvent={updateEvent}
          onSaveTask={(taskData) => {
            if (taskData.id) {
              updateEvent(taskData.id, taskData);
            } else {
              setEvents([...events, { ...taskData, id: generateId(), projectId: activeProject.id }]);
            }
          }}
          onDeleteTask={deleteEvent}
          onUpdateProject={updateProjectDetails}
          onInviteMember={inviteMemberToProject}
        />
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
                        onClick={() => setActiveDashboardProjectId(project.id)}
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
                            events={mobileCalendarEvents}
                            showEventTime={!selectedMobileProject}
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
}) {
  const popup = usePopup();
  // เปลี่ยนค่าเริ่มต้นให้เปิดหน้า Project Organization เป็นอันดับแรก
  const [activeTab, setActiveTab] = useState('organization'); 
  const projectColor = PROJECT_COLORS[project.colorIndex] || PROJECT_COLORS[0];

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  // States for Production-ready Project Organization
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState('');
  
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  
  // Local state for Team Notes
  const initialNotesPreferences = project.notesPreferences || {};
  const [noteSection, setNoteSection] = useState(
    initialNotesPreferences.section === 'member' ? 'member' : 'department'
  ); // 'department' | 'member'
  const [selectedDepartmentNoteId, setSelectedDepartmentNoteId] = useState(
    initialNotesPreferences.selectedDepartment || 'Unassigned'
  );
  const [selectedMemberNoteId, setSelectedMemberNoteId] = useState(
    initialNotesPreferences.selectedMemberId || ''
  );
  const [notesContent, setNotesContent] = useState(project.notesContent || {});
  const [teamMembers, setTeamMembers] = useState(() => normalizeProjectTeamMembers(project));
  const [projectPositions, setProjectPositions] = useState(() => normalizeRoles(project.positions || project.roles));
  const [projectDepartments, setProjectDepartments] = useState(() => normalizeDepartments(project.departments));
  const [isOrgEditMode, setIsOrgEditMode] = useState(false);
  const [optionsPopupType, setOptionsPopupType] = useState(null); // 'position' | 'department' | null
  const [newOptionValue, setNewOptionValue] = useState('');
  const [editingOptionOriginal, setEditingOptionOriginal] = useState('');
  const [editingOptionValue, setEditingOptionValue] = useState('');

  useEffect(() => {
    setTeamMembers(normalizeProjectTeamMembers(project));
    setProjectPositions(normalizeRoles(project.positions || project.roles));
    setProjectDepartments(normalizeDepartments(project.departments));
    setNotesContent(project.notesContent || {});
    const nextNotesPreferences = project.notesPreferences || {};
    setNoteSection(nextNotesPreferences.section === 'member' ? 'member' : 'department');
    setSelectedDepartmentNoteId(nextNotesPreferences.selectedDepartment || 'Unassigned');
    setSelectedMemberNoteId(nextNotesPreferences.selectedMemberId || '');
  }, [project.id, project.teamMembers, project.positions, project.roles, project.departments, project.notesContent, project.members, project.ownerUsername]);
  
  const statusConfig = {
    on_track: { label: 'On Track (ตามแผน)', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
    at_risk: { label: 'At Risk (มีความเสี่ยง)', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
    off_track: { label: 'Off Track (ล่าช้า)', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  };

  const TABS = [
    { id: 'organization', icon: FolderTree, label: 'Project Organization' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Management' },
    { id: 'team', icon: Users, label: 'Team Management' },
    { id: 'notes', icon: FileText, label: 'Team Notes' }
  ];
  const canManageMembers = currentUser?.username === project.ownerUsername;

  const persistTeamManagement = (
    membersInput,
    positionsInput = projectPositions,
    departmentsInput = projectDepartments
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
    const memberUsernames = normalizedMembers.map((member) => member.username);

    setTeamMembers(normalizedMembers);
    setProjectPositions(normalizedPositions);
    setProjectDepartments(normalizedDepartments);

    onUpdateProject(project.id, {
      members: memberUsernames,
      teamMembers: normalizedMembers,
      positions: normalizedPositions,
      roles: normalizedPositions, // Backward compatibility for old records
      departments: normalizedDepartments,
    });
  };

  const CREATE_POSITION_OPTION = '__create_position__';
  const CREATE_DEPARTMENT_OPTION = '__create_department__';

  const handleCreatePosition = async (memberId = null, optionName = '') => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project owner can manage positions.',
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

  const handleCreateDepartment = async (memberId = null, optionName = '') => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project owner can manage departments.',
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
    const nextMembers = memberId
      ? teamMembers.map((member) =>
          member.id === memberId ? { ...member, department: trimmedDepartment } : member
        )
      : teamMembers;

    persistTeamManagement(nextMembers, projectPositions, nextDepartments);
    return trimmedDepartment;
  };

  const handleAssignPosition = async (memberId, selectedPosition) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project owner can manage positions.',
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
        message: 'Only project owner can manage departments.',
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
        message: 'Only project owner can manage positions.',
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
        message: 'Only project owner can manage departments.',
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
    const nextMembers = teamMembers.map((member) =>
      String(member.department || '').trim().toLowerCase() === normalizedTarget
        ? { ...member, department: 'Unassigned' }
        : member
    );

    persistTeamManagement(nextMembers, projectPositions, nextDepartments);
  };

  const handleRenamePositionOption = (currentName, nextName) => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project owner can manage positions.',
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
        message: 'Only project owner can manage departments.',
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
    const nextMembers = teamMembers.map((member) =>
      String(member.department || '').trim().toLowerCase() === currentTrimmed.toLowerCase()
        ? { ...member, department: nextTrimmed }
        : member
    );

    persistTeamManagement(nextMembers, projectPositions, nextDepartments);
    return true;
  };

  const openOptionsPopup = (type) => {
    if (!canManageMembers) return;
    setOptionsPopupType(type);
    setNewOptionValue('');
    setEditingOptionOriginal('');
    setEditingOptionValue('');
  };

  const closeOptionsPopup = () => {
    setOptionsPopupType(null);
    setNewOptionValue('');
    setEditingOptionOriginal('');
    setEditingOptionValue('');
  };

  const handleAddMember = async () => {
    if (!canManageMembers) {
      void popup.alert({
        title: 'Permission denied',
        message: 'Only project owner can invite members.',
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
        message: 'Only project owner can remove members.',
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
  const optionsPopupItems =
    optionsPopupType === 'position'
      ? projectPositions
      : optionsPopupType === 'department'
      ? projectDepartments
      : [];
  const activeNoteId = noteSection === 'department' ? selectedDepartmentNoteId : selectedMemberNoteId;
  const departmentNoteOptions = useMemo(
    () => DEPARTMENTS.map((department) => ({ value: department, label: department })),
    [DEPARTMENTS]
  );
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
  const selectedNoteMember = useMemo(
    () => teamMembers.find((member) => member.id === activeNoteId) || null,
    [teamMembers, activeNoteId]
  );

  useEffect(() => {
    const nextDepartment = DEPARTMENTS.includes(selectedDepartmentNoteId)
      ? selectedDepartmentNoteId
      : DEPARTMENTS[0] || 'Unassigned';

    if (nextDepartment !== selectedDepartmentNoteId) {
      setSelectedDepartmentNoteId(nextDepartment);
      return;
    }

    const memberExists = teamMembers.some((member) => member.id === selectedMemberNoteId);
    const nextMemberId = memberExists ? selectedMemberNoteId : teamMembers[0]?.id || '';
    if (nextMemberId !== selectedMemberNoteId) {
      setSelectedMemberNoteId(nextMemberId);
    }
  }, [DEPARTMENTS, selectedDepartmentNoteId, teamMembers, selectedMemberNoteId]);

  useEffect(() => {
    onUpdateProject(project.id, {
      notesPreferences: {
        section: noteSection,
        selectedDepartment: selectedDepartmentNoteId,
        selectedMemberId: selectedMemberNoteId,
      },
    });
  }, [noteSection, selectedDepartmentNoteId, selectedMemberNoteId, project.id]);

  const [taskView, setTaskView] = useState('table');
  const [statusFilter, setStatusFilter] = useState([]);
  const [deptFilter, setDeptFilter] = useState([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  
  // Slide-over Pane State
  const [paneTask, setPaneTask] = useState(null);
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  
  const filteredTasks = events.filter(ev => {
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(ev.status || 'To Do');
    const matchDept = deptFilter.length === 0 || deptFilter.includes(ev.department || 'Unassigned');
    return matchStatus && matchDept;
  });

  const handleStatusChange = (eventId, newStatus) => {
    if (onUpdateEvent) {
      onUpdateEvent(eventId, { status: newStatus });
    }
  };

  const getAssignee = (id) =>
    teamMembers.find((member) => member.id === id) || {
      name: 'Unassigned',
      initials: '?',
      color: 'bg-gray-400',
      position: '',
      role: '',
    };

  const openTaskDetail = (task) => {
    setPaneTask(task);
    setIsPaneOpen(true);
  };

  const openAddTask = () => {
    setPaneTask(null);
    setIsPaneOpen(true);
  };

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
        message: 'Only project owner can edit organization structure.',
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
                        setSelectedDepartmentNoteId(DEPARTMENTS[0] || 'Unassigned');
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
                                    message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
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
                      {(statusFilter.length > 0 || deptFilter.length > 0) && (
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
                          
                          <div className="pt-3 border-t border-gray-100 flex justify-end">
                            <button 
                              onClick={() => { setStatusFilter([]); setDeptFilter([]); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={statusFilter.length === 0 && deptFilter.length === 0}
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
                        onClick={() => setTaskView('table')}
                        className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md flex items-center gap-1.5 md:gap-2 transition-colors ${taskView === 'table' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <AlignLeft className="w-4 h-4" /> Table
                      </button>
                      <button 
                        onClick={() => setTaskView('gallery')}
                        className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md flex items-center gap-1.5 md:gap-2 transition-colors ${taskView === 'gallery' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <LayoutGrid className="w-4 h-4" /> Gallery
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
                                const assignee = getAssignee(task.assigneeId);
                                return (
                                  <tr key={task.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTaskDetail(task)}>
                                    <td className="px-5 py-4 font-medium text-gray-800">{task.title}</td>
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-full ${assignee.color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>{assignee.initials}</div>
                                        <span className="text-gray-700 font-medium">{assignee.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{task.department || 'Unassigned'}</span>
                                    </td>
                                    <td className="px-5 py-4 text-gray-600">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{task.endDate}</span>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{task.endTime}</span>
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
                          const assignee = getAssignee(task.assigneeId);
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
                                <Clock className="w-3.5 h-3.5" /> {task.endDate} <span className="bg-gray-100 px-1.5 rounded">{task.endTime}</span>
                              </p>
                              <div className="flex items-center gap-2.5 mt-auto pt-4 border-t border-gray-100">
                                <div className={`w-7 h-7 rounded-full ${assignee.color} text-white flex items-center justify-center text-[10px] font-bold shadow-sm`}>{assignee.initials}</div>
                                <div className="flex-1 overflow-hidden">
                                  <span className="text-sm text-gray-700 font-medium block truncate">{assignee.name}</span>
                                  <span className="text-[10px] text-gray-400 block truncate">{assignee.position || assignee.role || 'Team Member'}</span>
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
                      title={canManageMembers ? 'Invite member' : 'Only owner can invite members'}
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
                                title={canManageMembers ? 'Manage position options' : 'Only owner can manage'}
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
                                title={canManageMembers ? 'Manage department options' : 'Only owner can manage'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </th>
                          <th className="px-6 py-4 font-medium text-right w-[16%]"></th>
                        </tr>
                      </thead>
	                      <tbody className="divide-y divide-gray-100">
	                        {teamMembers.map((member) => (
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
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
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
                              {projectDepartments.length === 0 ? (
                                <button
                                  onClick={() => {
                                    void handleCreateDepartment();
                                  }}
                                  disabled={!canManageMembers}
                                  className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${canManageMembers ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                                >
                                  Add department
                                </button>
                              ) : (
                                <select
                                  value={member.department || 'Unassigned'}
                                  onChange={(e) => {
                                    void handleAssignDepartment(member.id, e.target.value);
                                  }}
                                  disabled={!canManageMembers}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {DEPARTMENTS.map((department) => (
                                    <option key={department} value={department}>
                                      {department}
                                    </option>
                                  ))}
                                  <option value={CREATE_DEPARTMENT_OPTION}>+ Create new department</option>
                                </select>
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
                        ))}
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
            {activeTab === 'notes' && (
              <div className="flex flex-col min-h-[65vh] md:h-[calc(100vh-180px)]">
                 {/* Content Area */}
                 <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
                    {/* Selector */}
                    <div className="w-full md:w-72 bg-white border border-gray-200 rounded-xl shadow-sm p-3 shrink-0 space-y-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {noteSection === 'department' ? 'Select department' : 'Select member'}
                      </p>
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

                    {/* Note Editor Area */}
                    <div className="flex-1 h-full min-h-[380px] md:min-h-0">
                      {activeNoteId ? (
                        <NoteEditor 
                          noteId={activeNoteId} 
                          noteTitle={noteSection === 'department' ? `บันทึกของฝ่าย: ${activeNoteId}` : `บันทึกของ: ${selectedNoteMember?.name || 'Unknown'}`}
                          initialContent={notesContent[activeNoteId] || ''}
                          onSave={(id, content) => {
                            const nextNotes = { ...notesContent, [id]: content };
                            setNotesContent(nextNotes);
                            onUpdateProject(project.id, { notesContent: nextNotes });
                          }}
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
                 `}</style>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Slide-over Task Detail/Edit Pane */}
      <TaskDetailPane 
        isOpen={isPaneOpen} 
        onClose={() => setIsPaneOpen(false)} 
        task={paneTask} 
        onSave={(data) => { onSaveTask(data); setIsPaneOpen(false); }}
        onDelete={(id) => { onDeleteTask(id); setIsPaneOpen(false); }}
        teamMembers={teamMembers}
        TASK_STATUSES={TASK_STATUSES}
        DEPARTMENTS={DEPARTMENTS}
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
                      const created = await handleCreateDepartment(null, newOptionValue);
                      if (created) setNewOptionValue('');
                    }
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Add
                </button>
              </div>

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
                              {optionValue}
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
function TaskDetailPane({ isOpen, onClose, task, onSave, onDelete, teamMembers, TASK_STATUSES, DEPARTMENTS }) {
  const popup = usePopup();
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('To Do');
  const [department, setDepartment] = useState('Unassigned');
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [description, setDescription] = useState('');

  // Update form when task changes or panel opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setIsEditing(false); // Default to view mode if opening existing task
        setTitle(task.title || '');
        setStatus(task.status || 'To Do');
        setDepartment(task.department || 'Unassigned');
        setAssigneeId(task.assigneeId || '');
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
        setStartTime(task.startTime || '09:00');
        setEndTime(task.endTime || '18:00');
        setDescription(task.description || '');
      } else {
        setIsEditing(true); // Force edit mode for new task
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setTitle('');
        setStatus('To Do');
        setDepartment('Unassigned');
        setAssigneeId(teamMembers.length > 0 ? teamMembers[0].id : '');
        setStartDate(todayStr);
        setEndDate(todayStr);
        setStartTime('09:00');
        setEndTime('18:00');
        setDescription('');
      }
    }
  }, [task, isOpen, teamMembers]);

  // Handle Save
  const handleSave = (e) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      void popup.alert({
        title: 'Incomplete form',
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
      });
      return;
    }
    
    onSave({
      id: task?.id,
      title, status, department, assigneeId, startDate, endDate, startTime, endTime, description
    });
  };

  if (!isOpen) return null;

  const currentAssignee = teamMembers.find(m => m.id === assigneeId) || { name: 'Unassigned', initials: '?', color: 'bg-gray-400' };

  return (
    <>
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-gray-900/40 z-40 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-l">
        
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
                <div>
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    <option value="" disabled>เลือกผู้รับผิดชอบ...</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> วันที่เริ่มต้น</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> วันที่สิ้นสุด</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
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
                  <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
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
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${currentAssignee.color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>{currentAssignee.initials}</div>
                  <span className="font-medium text-gray-800">{currentAssignee.name}</span>
                </div>

                <div className="text-gray-500">วันที่เริ่มต้น</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {startDate} <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{startTime}</span>
                </div>

                <div className="text-gray-500">กำหนดส่ง</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {endDate} <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{endTime}</span>
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
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{department}</span>
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
function NoteEditor({ noteId, noteTitle, initialContent, onSave }) {
  const popup = usePopup();
  const editorContainerRef = React.useRef(null);
  const editorRef = React.useRef(null);
  const uploadInputRef = React.useRef(null);
  const dragImageIdRef = React.useRef('');
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

  const applyImageLayout = (imgElement, layout) => {
    if (!imgElement) return;
    const nextLayout = layout || 'below';
    imgElement.dataset.layout = nextLayout;
    imgElement.style.maxWidth = '100%';
    imgElement.style.borderRadius = '10px';
    imgElement.style.cursor = 'grab';
    imgElement.style.float = 'none';
    imgElement.style.position = 'static';
    imgElement.style.left = 'auto';
    imgElement.style.top = 'auto';
    imgElement.style.touchAction = 'manipulation';

    if (nextLayout === 'inline') {
      imgElement.style.display = 'inline-block';
      imgElement.style.margin = '0 0.4rem 0.2rem 0';
      imgElement.style.width = 'min(280px, 100%)';
      imgElement.style.height = 'auto';
      imgElement.style.objectFit = 'contain';
      return;
    }

    if (nextLayout === 'wrap') {
      imgElement.style.display = 'block';
      imgElement.style.float = 'left';
      imgElement.style.margin = '0.3rem 0.8rem 0.6rem 0';
      imgElement.style.width = 'min(240px, 100%)';
      imgElement.style.height = 'auto';
      imgElement.style.objectFit = 'cover';
      return;
    }

    imgElement.style.display = 'block';
    imgElement.style.margin = '0.75rem auto';
    imgElement.style.width = 'min(420px, 100%)';
    imgElement.style.height = 'auto';
    imgElement.style.objectFit = 'contain';
  };

  const normalizeEditorImages = () => {
    if (!editorRef.current) return;
    const images = editorRef.current.querySelectorAll('img');
    images.forEach((imgElement) => {
      if (!imgElement.dataset.noteImageId) {
        imgElement.dataset.noteImageId = `img-${generateId()}`;
      }
      imgElement.setAttribute('draggable', 'true');
      applyImageLayout(imgElement, imgElement.dataset.layout || 'below');
    });
  };

  const handleInput = () => {
    normalizeEditorImages();
    if (editorRef.current) {
      onSave(noteId, editorRef.current.innerHTML);
    }
  };

  const openImageMenu = (imgElement) => {
    if (!imgElement || !editorContainerRef.current) return;
    const container = editorContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imageRect = imgElement.getBoundingClientRect();
    const rawX = imageRect.left - containerRect.left + editorContainerRef.current.scrollLeft;
    const rawY = imageRect.bottom - containerRect.top + editorContainerRef.current.scrollTop + 8;
    const maxX = Math.max(8, container.clientWidth - 248);
    setImageMenuState({
      imageId: imgElement.dataset.noteImageId,
      x: Math.min(Math.max(8, rawX), maxX),
      y: Math.max(8, rawY),
    });
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

    const range = getCaretRangeFromPoint(clientX, clientY);
    if (range && editor.contains(range.startContainer)) {
      range.insertNode(movingImage);
    } else {
      editor.appendChild(movingImage);
    }

    const selection = window.getSelection();
    if (selection) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(movingImage);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }

    return movingImage;
  };

  const insertImageAtCursor = (imageSrc) => {
    if (!editorRef.current || !imageSrc) return;
    const editor = editorRef.current;
    editor.focus();

    const imageNode = document.createElement('img');
    imageNode.src = imageSrc;
    imageNode.alt = 'uploaded-note-image';
    imageNode.dataset.noteImageId = `img-${generateId()}`;
    imageNode.setAttribute('draggable', 'true');
    applyImageLayout(imageNode, 'below');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.collapse(false);
      range.insertNode(imageNode);

      const spacer = document.createElement('p');
      spacer.innerHTML = '<br />';
      imageNode.after(spacer);

      const nextRange = document.createRange();
      nextRange.setStartAfter(spacer);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    } else {
      editor.appendChild(imageNode);
      const spacer = document.createElement('p');
      spacer.innerHTML = '<br />';
      editor.appendChild(spacer);
    }

    openImageMenu(imageNode);
    handleInput();
  };

  const handleUploadImage = (event) => {
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

  const handleImageLayoutChange = (layout) => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    applyImageLayout(targetImage, layout);
    handleInput();
    openImageMenu(targetImage);
  };

  const handleCropImage = async () => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const cropSize = await popup.prompt({
      title: 'Crop image',
      message: 'Enter crop size in px',
      placeholder: '220',
      defaultValue: '220',
      confirmText: 'Apply',
    });
    if (!cropSize) return;
    const nextSize = Number(cropSize);
    if (!Number.isFinite(nextSize) || nextSize <= 20) return;
    targetImage.style.width = `${nextSize}px`;
    targetImage.style.height = `${nextSize}px`;
    targetImage.style.objectFit = 'cover';
    targetImage.style.maxWidth = '100%';
    handleInput();
    openImageMenu(targetImage);
  };

  const handleCopyOrCutImage = async (isCut) => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const imageSrc = targetImage.src;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(imageSrc);
      }
    } catch {
      // Ignore clipboard permission errors.
    }
    if (isCut) {
      targetImage.remove();
      setImageMenuState(null);
      handleInput();
    }
  };

  const handleDuplicateImage = () => {
    const targetImage = getImageById(imageMenuState?.imageId);
    if (!targetImage) return;
    const cloned = targetImage.cloneNode(true);
    cloned.dataset.noteImageId = `img-${generateId()}`;
    targetImage.after(cloned);
    applyImageLayout(cloned, cloned.dataset.layout || 'below');
    handleInput();
    openImageMenu(cloned);
  };

  const handleEditorClick = (event) => {
    const imageNode = event.target.closest('img[data-note-image-id]');
    if (imageNode && editorRef.current?.contains(imageNode)) {
      openImageMenu(imageNode);
      return;
    }
    if (!event.target.closest('[data-note-image-menu]')) {
      setImageMenuState(null);
    }
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
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || '';
      normalizeEditorImages();
      setImageMenuState(null);
    }
  }, [noteId, initialContent]);

  React.useEffect(() => {
    if (!imageMenuState) return undefined;
    const closeMenuIfOutside = (event) => {
      if (!editorContainerRef.current?.contains(event.target)) {
        setImageMenuState(null);
      }
    };
    document.addEventListener('pointerdown', closeMenuIfOutside);
    return () => document.removeEventListener('pointerdown', closeMenuIfOutside);
  }, [imageMenuState]);

  React.useEffect(
    () => () => {
      clearLongPressTimer();
    },
    []
  );

  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
    handleInput();
  };

  return (
    <div ref={editorContainerRef} className="relative flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center gap-2">
        <h3 className="font-semibold text-gray-700 mr-auto flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> {noteTitle}
        </h3>

        <div className="flex items-center bg-white border border-gray-200 rounded-md p-1 shadow-sm">
          <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Bold (Ctrl+B)"><Bold size={16} /></button>
          <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Italic (Ctrl+I)"><Italic size={16} /></button>
          <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Underline (Ctrl+U)"><Underline size={16} /></button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadImage}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="h-10 w-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-gray-700 flex items-center justify-center transition-colors shadow-sm"
          title="Upload image"
        >
          <ImageIcon size={16} className="text-blue-500" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onClick={handleEditorClick}
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
        className="rich-editor flex-1 p-6 outline-none overflow-y-auto text-gray-800 text-sm md:text-base leading-relaxed bg-white prose max-w-none"
        style={{ minHeight: '300px' }}
      ></div>

      {imageMenuState && (
        <div
          data-note-image-menu
          className="absolute z-30 bg-white border border-gray-200 rounded-xl shadow-xl px-2 py-1.5 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-16px)]"
          style={{
            left: `${Math.max(8, imageMenuState.x)}px`,
            top: `${Math.max(8, imageMenuState.y)}px`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => handleImageLayoutChange('inline')} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Inline</button>
          <button type="button" onClick={() => handleImageLayoutChange('below')} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Below text</button>
          <button type="button" onClick={() => handleImageLayoutChange('wrap')} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Wrap text</button>
          <button type="button" onClick={handleCropImage} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Crop</button>
          <button type="button" onClick={() => void handleCopyOrCutImage(true)} className="px-2 py-1 text-xs rounded-md hover:bg-red-50 text-red-600">Cut</button>
          <button type="button" onClick={() => void handleCopyOrCutImage(false)} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Copy</button>
          <button type="button" onClick={handleDuplicateImage} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">Duplicate</button>
        </div>
      )}

      <div className="p-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 text-right">
        Auto-saved
      </div>
    </div>
  );
}
function MonthGrid({
  year,
  month,
  projects,
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

          const weekSegments = events
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
              const project = projects.find((p) => p.id === event.projectId) || projects[0];
              const color = PROJECT_COLORS[project?.colorIndex ?? 0] || PROJECT_COLORS[0];

              return {
                event,
                startIdx,
                endIdx,
                startDate: week[startIdx].dateStr,
                color,
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.startIdx - b.startIdx || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx));

          const laneEnds = [];
          weekSegments.forEach((segment) => {
            let lane = 0;
            while (laneEnds[lane] !== undefined && laneEnds[lane] >= segment.startIdx) {
              lane += 1;
            }
            laneEnds[lane] = segment.endIdx;
            segment.lane = lane;
          });

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
                    const showTimePrefix = showEventTime && segment.event.startDate === segment.startDate;
                    const title = showTimePrefix
                      ? `${segment.event.startTime} ${segment.event.title}`
                      : segment.event.title;

                    return (
                      <button
                        key={`${segment.event.id}-${weekIdx}-${segmentIndex}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(segment.event, e);
                        }}
                        className={`pointer-events-auto absolute text-[10px] md:text-xs truncate px-2 h-5 rounded-md border shadow-sm flex items-center ${segment.color.lightBg} ${segment.color.text} ${segment.color.border} hover:opacity-80 transition-opacity`}
                        style={{
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          top: `${segment.lane * laneHeight}px`,
                        }}
                        title={`${segment.event.title} (${segment.event.startTime} - ${segment.event.endTime})`}
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
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

                      {isOwner ? (
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
                            className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-blue-500"
                          />
                          <button
                            onClick={() => handleInvite(project.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded"
                          >
                            Invite
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-400">Only creator can manage members and invitations.</p>
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

          {editingId !== 'new' && (
            <button
              onClick={() => {
                setEditingId('new');
                setEditName('');
                setEditColorIndex(Math.floor(Math.random() * PROJECT_COLORS.length));
              }}
              className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}

          {editingId === 'new' && (
            <div className="mt-4 p-3 border rounded-lg bg-blue-50/50 flex flex-col gap-3">
              <h3 className="font-semibold text-sm">Create New Project</h3>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name..."
                className="border rounded px-3 py-2 w-full text-sm focus:outline-blue-500"
                autoFocus
              />
              <div className="flex gap-1.5">
                {PROJECT_COLORS.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setEditColorIndex(index)}
                    className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center ${editColorIndex === index ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  >
                    {editColorIndex === index && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">
                  Add Project
                </button>
                <button onClick={() => setEditingId(null)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded font-medium">
                  Cancel
                </button>
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}
// --- Event Form Modal ---
function EventModal({ event, projects, defaultDate, defaultProjectId, onClose, onSave, onDelete }) {
  const popup = usePopup();
  const [title, setTitle] = useState(event?.title || '');
  const [projectId, setProjectId] = useState(event?.projectId || defaultProjectId || (projects[0]?.id || ''));
  const [startDate, setStartDate] = useState(event?.startDate || defaultDate || '');
  const [endDate, setEndDate] = useState(event?.endDate || defaultDate || '');
  const [startTime, setStartTime] = useState(event?.startTime || '09:00');
  const [endTime, setEndTime] = useState(event?.endTime || '10:00');
  const [description, setDescription] = useState(event?.description || '');

  // Keep End Date >= Start Date
  useEffect(() => {
    if (startDate && (!endDate || startDate > endDate)) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      void popup.alert({
        title: 'Incomplete form',
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      });
      return;
    }
    
    onSave({
      title, projectId, startDate, endDate, startTime, endTime, description
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {event ? 'แก้ไข Event' : 'เพิ่ม Event ใหม่'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Title Input */}
          <input 
            type="text" 
            placeholder="เพิ่มชื่อ Event"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-medium border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none w-full pb-1 transition-colors"
            autoFocus
          />

          {/* Project Selector */}
          <div className="flex items-center gap-3 text-gray-600">
            <Layers className="w-5 h-5" />
            <select 
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex-1 border-gray-300 rounded-md p-2 bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" disabled>เลือก Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <Clock className="w-5 h-5 mt-2" />
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1"
                />
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
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16">ถึงวันที่:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <AlignLeft className="w-5 h-5 mt-2" />
            <textarea 
              placeholder="เพิ่มคำอธิบาย..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 border-gray-300 rounded-md p-2 bg-gray-50 min-h-[100px] resize-y focus:ring-blue-500 focus:border-blue-500 text-sm"
            ></textarea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            {event && (
              <button 
                type="button" 
                onClick={async () => {
                  const shouldDelete = await popup.confirm({
                    title: 'Delete event',
                    message: 'คุณแน่ใจหรือไม่ที่จะลบ Event นี้?',
                    confirmText: 'Delete',
                    tone: 'danger',
                  });
                  if (shouldDelete) onDelete(event.id);
                }}
                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors mr-auto"
              >
                ลบ Event
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}















