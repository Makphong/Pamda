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

const buildMemberFromUsername = (username, index, ownerUsername, existingMember = null) => {
  const normalizedUsername = String(username || existingMember?.username || existingMember?.name || '')
    .trim()
    .toLowerCase();
  const safeUsername = normalizedUsername || `member-${index + 1}`;
  const displayName = String(existingMember?.name || safeUsername).trim() || safeUsername;
  const isOwner = safeUsername === ownerUsername;
  const position = String(existingMember?.position || existingMember?.role || (isOwner ? 'Project Owner' : '')).trim();
  const department = String(existingMember?.department || 'Unassigned').trim() || 'Unassigned';
  const reportsToId = existingMember?.reportsToId || null;

  return {
    id: existingMember?.id || `member-${safeUsername.replace(/\s+/g, '-')}`,
    username: safeUsername,
    name: displayName,
    position,
    role: position, // Backward compatibility for old UI paths
    department,
    reportsToId,
    initials: existingMember?.initials || getInitials(displayName),
    color: existingMember?.color || MEMBER_COLORS[index % MEMBER_COLORS.length],
    level: existingMember?.level || getRoleLevel(position, isOwner),
  };
};

const normalizeProjectTeamMembers = (project) => {
  const ownerUsername = String(project.ownerUsername || '').trim().toLowerCase();
  const storedMembers = Array.isArray(project.teamMembers) ? project.teamMembers : [];
  const projectMembers = Array.isArray(project.members) ? project.members : [];

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

  return allUsernames.map((username, index) =>
    buildMemberFromUsername(username, index, ownerUsername, membersByUsername.get(username))
  );
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

function ProfileSettingsView({ currentUser, onBack, onSaveProfile, onChangePassword }) {
  const [username, setUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isPasswordPopupOpen, setIsPasswordPopupOpen] = useState(false);
  const [profileResult, setProfileResult] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordResult, setPasswordResult] = useState(null);

  useEffect(() => {
    setUsername(currentUser.username || '');
    setEmail(currentUser.email || '');
    setAvatarUrl(currentUser.avatarUrl || '');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to calendar
          </button>
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

              <label className="space-y-1 block">
                <span className="text-sm font-medium text-gray-600">Avatar image URL</span>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/avatar.jpg"
                />
              </label>

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

              <div className="flex flex-wrap items-center gap-3">
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
                <button
                  type="button"
                  onClick={() => {
                    setPasswordResult(null);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setIsPasswordPopupOpen(true);
                  }}
                  className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
                >
                  <Lock className="w-4 h-4" /> Change password
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
                >
                  <Check className="w-4 h-4" /> Save profile
                </button>
              </div>
            </form>
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

  const accountDbKey = useMemo(() => getAccountDbKey(currentUser.id), [currentUser.id]);
  const [isAccountDataHydrated, setIsAccountDataHydrated] = useState(false);

  const [isMergeView, setIsMergeView] = useState(false);
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

  useEffect(() => {
    setIsAccountDataHydrated(false);

    try {
      const rawData = localStorage.getItem(accountDbKey);
      if (!rawData) {
        setProjects([]);
        setEvents([]);
        setIsAccountDataHydrated(true);
        return;
      }

      const parsed = JSON.parse(rawData);

      if (Array.isArray(parsed.projects)) {
        setProjects(parsed.projects.map((project) => ensureProjectOwnership(project, currentUser)));
      } else {
        setProjects([]);
      }

      if (Array.isArray(parsed.events)) {
        setEvents(parsed.events);
      } else {
        setEvents([]);
      }

      if (parsed.displayRange?.start && parsed.displayRange?.end) {
        setDisplayRange(parsed.displayRange);
      }

      if (typeof parsed.hidePastWeeks === 'boolean') {
        setHidePastWeeks(parsed.hidePastWeeks);
      }
    } catch {
      setProjects([]);
      setEvents([]);
    } finally {
      setIsAccountDataHydrated(true);
    }
  }, [accountDbKey, currentUser]);

  useEffect(() => {
    if (!isAccountDataHydrated) return;

    const dbPayload = {
      projects,
      events,
      displayRange,
      hidePastWeeks,
    };

    localStorage.setItem(accountDbKey, JSON.stringify(dbPayload));
  }, [isAccountDataHydrated, accountDbKey, projects, events, displayRange, hidePastWeeks]);

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

  // Derived state
  const visibleProjects = projects.filter(p => p.isVisible);

  // --- Handlers ---
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
    setPreSelectedProjectId(visibleProjects.length > 0 ? visibleProjects[0].id : (projects.length > 0 ? projects[0].id : ''));
    setShowEventModal(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation(); // Prevent triggering day click
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const saveEvent = (eventData) => {
    if (editingEvent) {
      setEvents(events.map(ev => ev.id === editingEvent.id ? { ...ev, ...eventData } : ev));
    } else {
      setEvents([...events, { 
        ...eventData, 
        id: generateId(),
        status: 'To Do',
        department: 'Unassigned',
        assigneeId: 'u' + (Math.floor(Math.random() * 5) + 1) // สุ่ม Assign คนรับผิดชอบ (Mock)
      }]);
    }
    setShowEventModal(false);
  };

  const updateEvent = (eventId, updates) => {
    setEvents(events.map(ev => ev.id === eventId ? { ...ev, ...updates } : ev));
  };

  const deleteEvent = (eventId) => {
    setEvents(events.filter(ev => ev.id !== eventId));
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

    setProjects(projects.filter(p => p.id !== projectId));
    setEvents(events.filter(ev => ev.projectId !== projectId)); // Cascade delete
    if (activeDashboardProjectId === projectId) setActiveDashboardProjectId(null);
  };

  const inviteMemberToProject = (projectId, identifier) => {
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    if (!normalizedIdentifier) {
      return { ok: false, message: 'Please enter username or email to invite.' };
    }

    const allUsers = getLocalUsers();
    const invitedUser = allUsers.find(
      (user) => user.email === normalizedIdentifier || user.username === normalizedIdentifier
    );

    if (!invitedUser) {
      return { ok: false, message: 'This user does not exist.' };
    }

    let response = { ok: false, message: 'Project not found.' };

    setProjects((prevProjects) =>
      prevProjects.map((project) => {
        if (project.id !== projectId) return project;

        if (project.ownerId !== currentUser.id) {
          response = { ok: false, message: 'Only the project creator can invite members.' };
          return project;
        }

        const nextProject = ensureProjectOwnership(project, currentUser);
        if (nextProject.members.includes(invitedUser.username)) {
          response = { ok: false, message: 'This user is already in the project.' };
          return nextProject;
        }

        response = {
          ok: true,
          message: `Invited ${invitedUser.username} to ${project.name}.`,
        };

        return {
          ...nextProject,
          members: [...nextProject.members, invitedUser.username],
        };
      })
    );

    return response;
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

    localStorage.setItem(
      accountDbKey,
      JSON.stringify({
        projects: nextProjects,
        events,
        displayRange,
        hidePastWeeks,
      })
    );

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
        onSaveProfile={handleSaveProfile}
        onChangePassword={handleChangePassword}
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
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-sm md:text-base">
      
      {/* --- Top Navigation Bar --- */}
      <header className="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800 hidden md:block">Multi-Project Calendar</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg border">
            <button
              onClick={() => setIsMergeView(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${!isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Split View</span>
            </button>
            <button
              onClick={() => setIsMergeView(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Merge View</span>
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-2"></div>

          {/* Add Event Button */}
          <button
            onClick={handleNewEventClick}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">เพิ่ม Event</span>
          </button>

          {/* Project Management Button */}
          <button
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>จัดการ Project</span>
          </button>

          <div className="w-px h-6 bg-gray-300"></div>

          <button
            type="button"
            onClick={() => setIsProfileViewOpen(true)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-100 transition-colors"
            title="Open profile settings"
          >
            <UserAvatar user={currentUser} sizeClass="w-8 h-8" textClass="text-[11px]" />
            <div className="hidden md:flex flex-col leading-tight text-left">
              <span className="text-[11px] text-gray-400">Signed in as</span>
              <span className="text-sm font-semibold text-gray-700 truncate max-w-[180px]">
                {currentUser.username || currentUser.email}
              </span>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-3 py-2 rounded-lg font-medium transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* --- Main Calendar Board --- */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        {visibleProjects.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-gray-400 gap-4">
            <LayoutGrid className="w-16 h-16 opacity-50" />
            <p className="text-lg">กรุณาเลือกหรือเพิ่มโปรเจกต์จากเมนู "จัดการ Project"</p>
          </div>
        ) : (
          <div className="min-w-[800px]"> {/* Ensure it doesn't squish too much on small screens */}
            
            {/* Sticky Project Headers (Only in Split View) */}
            {!isMergeView && (
              <div className="sticky top-0 z-10 flex bg-white shadow-sm border-b">
                {visibleProjects.map((project) => (
                  <div 
                    key={project.id} 
                    onClick={() => setActiveDashboardProjectId(project.id)}
                    className="flex-1 text-center py-3 border-r last:border-r-0 relative overflow-hidden cursor-pointer hover:bg-blue-50 transition-colors group flex flex-col items-center justify-center h-16"
                  >
                    <div className={`absolute top-0 left-0 w-full h-1 ${PROJECT_COLORS[project.colorIndex].bg}`}></div>
                    <span className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors text-base">{project.name}</span>
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1">
                      คลิกเพื่อเปิดหน้าบริหารจัดการ
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Merge View Sticky Header */}
            {isMergeView && (
              <div className="sticky top-0 z-10 bg-white shadow-sm border-b py-3 text-center h-16 flex items-center justify-center">
                <span className="font-bold text-gray-700 text-lg">รวมทุก Project ({visibleProjects.length})</span>
              </div>
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
                    <div className="bg-gray-100 py-2 px-4 sticky top-16 z-[5] shadow-sm border-b border-gray-200">
                      <h2 className="text-lg font-bold text-gray-800 whitespace-nowrap">
                        {THAI_MONTHS[month]} {year}
                      </h2>
                    </div>

                    <div className="flex">
                      {isMergeView ? (
                        // Merge View: 1 Full Width Calendar
                        <div className="flex-1 bg-white p-2">
                          <MonthGrid 
                            year={year} 
                            month={month} 
                            projects={visibleProjects} 
                            events={events}
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

      {/* --- Modals --- */}
      {showProjectModal && (
        <ProjectManagerModal 
          projects={projects}
          currentUser={currentUser}
          onClose={() => setShowProjectModal(false)}
          onToggleVisibility={toggleProjectVisibility}
          onSaveProject={saveProject}
          onDeleteProject={deleteProject}
          onInviteMember={inviteMemberToProject}
          displayRange={displayRange}
          setDisplayRange={setDisplayRange}
          hidePastWeeks={hidePastWeeks}
          setHidePastWeeks={setHidePastWeeks}
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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
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

// --- Project Dashboard View (Like Asana) ---
function ProjectDashboard({ project, currentUser, events, onBack, onUpdateEvent, onSaveTask, onDeleteTask, onUpdateProject }) {
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
  const [noteSection, setNoteSection] = useState('department'); // 'department' | 'member'
  const [activeNoteId, setActiveNoteId] = useState('Unassigned');
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

    (Array.isArray(membersInput) ? membersInput : []).forEach((member) => {
      const username = String(member?.username || member?.name || '').trim().toLowerCase();
      if (!username || membersByUsername.has(username)) return;
      membersByUsername.set(username, member);
    });

    const usernames = Array.from(new Set([ownerUsername, ...membersByUsername.keys()].filter(Boolean)));
    const normalizedMembers = usernames.map((username, index) =>
      buildMemberFromUsername(username, index, ownerUsername, membersByUsername.get(username))
    );
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

    const users = getLocalUsers();
    const foundUser = users.find(
      (user) => user.username === normalizedIdentifier || user.email === normalizedIdentifier
    );

    if (!foundUser) {
      void popup.alert({
        title: 'User not found',
        message: 'User not found.',
      });
      return;
    }

    if (teamMembers.some((member) => member.username === foundUser.username)) {
      void popup.alert({
        title: 'Duplicate member',
        message: 'This member is already in the project.',
      });
      return;
    }

    const nextMembers = [
      ...teamMembers,
      buildMemberFromUsername(
        foundUser.username,
        teamMembers.length,
        project.ownerUsername,
        { username: foundUser.username, name: foundUser.username }
      ),
    ];

    persistTeamManagement(nextMembers, projectPositions, projectDepartments);
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

  const renderOrgTree = (member, depth = 0) => {
    const children = orgTree.childrenMap[member.id] || [];
    return (
      <div key={member.id} className="w-full">
        <div className="flex items-start gap-3">
          <div style={{ width: `${depth * 24}px` }} />
          <OrgNode member={member} />
        </div>
        {children.length > 0 && (
          <div className="mt-3 space-y-3">
            {children.map((child) => renderOrgTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans relative">
      {/* Dashboard Header */}
      <header className={`px-6 py-4 flex items-center gap-4 border-b shrink-0 ${projectColor.lightBg}`}>
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-4 h-4 rounded-full ${projectColor.bg}`}></div>
        <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
      </header>

      {/* Dashboard Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-gray-50 border-r flex flex-col shrink-0 overflow-y-auto">
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-6xl mx-auto">
            
            <div className="mb-6 pb-4 border-b flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              {activeTab === 'notes' && (
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
                  <button
                    onClick={() => {
                      setNoteSection('department');
                      setActiveNoteId(DEPARTMENTS[0]);
                    }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
                      setActiveNoteId(teamMembers.length > 0 ? teamMembers[0].id : '');
                    }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Content (Left) */}
                <div className="flex-1 space-y-6">
                  
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
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
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
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Target className="w-5 h-5 text-gray-500" />
                        เป้าหมายหลัก & จุดวิกฤต (Milestones)
                      </h3>
                      {!isAddingMilestone && (
                        <button 
                          onClick={() => setIsAddingMilestone(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
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
                          <div className="flex items-center gap-4">
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
                        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 flex flex-col gap-3 mt-4">
                          <input 
                            type="text" 
                            placeholder="ชื่อเป้าหมาย / Milestone..." 
                            value={newMilestoneName}
                            onChange={e => setNewMilestoneName(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="flex items-center gap-3">
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
                <div className="w-full lg:w-[340px] flex flex-col gap-6 shrink-0">
                  
                  {/* Status Dropdown */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="relative">
                    <button 
                      onClick={() => setShowFilterPopup(!showFilterPopup)}
                      className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors shadow-sm"
                    >
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span>ฟิลเตอร์</span>
                      {(statusFilter.length > 0 || deptFilter.length > 0) && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                      )}
                    </button>
                    
                    {/* Filter Popup */}
                    {showFilterPopup && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-xl p-4 z-20">
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
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm shrink-0">
                      <button 
                        onClick={() => setTaskView('table')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${taskView === 'table' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <AlignLeft className="w-4 h-4" /> Table
                      </button>
                      <button 
                        onClick={() => setTaskView('gallery')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${taskView === 'gallery' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <LayoutGrid className="w-4 h-4" /> Gallery
                      </button>
                    </div>
                    
                    {/* Production Ready "Add Task" Button */}
                    <button 
                      onClick={openAddTask}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> <span className="hidden sm:inline">เพิ่ม Task</span>
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
                          <table className="w-full text-left text-sm whitespace-nowrap">
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
              <div className="space-y-8">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Project Members</h3>
                      <p className="text-sm text-gray-500 mt-1">Manage member, position and department from one place.</p>
                    </div>
                    <button
                      onClick={handleAddMember}
                      disabled={!canManageMembers}
                      title={canManageMembers ? 'Invite member' : 'Only owner can invite members'}
                      className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm ${canManageMembers ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
                    >
                      <Plus className="w-4 h-4" /> Add member
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
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
                              <div className={`w-10 h-10 rounded-full ${member.color} text-white flex items-center justify-center font-bold shadow-sm`}>
                                {member.initials}
                              </div>
                              <span className="font-medium text-gray-800">{member.name}</span>
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

                <div className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-8 overflow-hidden relative">
                  <div className="flex justify-between items-center mb-8">
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
                    <div className="mb-8 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
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
                      orgTree.roots.map((rootMember) => renderOrgTree(rootMember))
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'notes' && (
              <div className="flex flex-col h-[calc(100vh-180px)]">
                 {/* Content Area */}
                 <div className="flex gap-6 flex-1 min-h-0">
                    {/* Sidebar List */}
                    <div className="w-64 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col shrink-0">
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                         {noteSection === 'department' ? (
                           DEPARTMENTS.map(dept => (
                             <button
                               key={dept}
                               onClick={() => setActiveNoteId(dept)}
                               className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNoteId === dept ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                             >
                               {dept}
                             </button>
                           ))
                         ) : (
                           teamMembers.map(member => (
                             <button
                               key={member.id}
                               onClick={() => setActiveNoteId(member.id)}
                               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNoteId === member.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                             >
                               <div className={`w-7 h-7 rounded-full ${member.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                                 {member.initials}
                               </div>
                               <div className="flex-1 overflow-hidden text-left">
                                 <span className="truncate block leading-tight">{member.name}</span>
                                 <span className="text-[10px] opacity-70 truncate block">{member.position || 'No position'}</span>
                               </div>
                             </button>
                           ))
                         )}
                      </div>
                    </div>

                    {/* Note Editor Area */}
                    <div className="flex-1 h-full">
                      {activeNoteId ? (
                        <NoteEditor 
                          noteId={activeNoteId} 
                          noteTitle={noteSection === 'department' ? `บันทึกของฝ่าย: ${activeNoteId}` : `บันทึกของ: ${teamMembers.find(m => m.id === activeNoteId)?.name || 'Unknown'}`}
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
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-48 flex flex-col items-center text-center z-10 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
      <div className={`w-12 h-12 rounded-full ${member.color} text-white flex items-center justify-center font-bold text-lg shadow-inner mb-2`}>
        {member.initials}
      </div>
      <p className="font-bold text-gray-800 text-sm truncate w-full">{member.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate w-full">{member.position || member.role || '-'}</p>
    </div>
  );
}

// --- Note Editor Component for Team Notes ---
function NoteEditor({ noteId, noteTitle, initialContent, onSave }) {
  const popup = usePopup();
  const editorRef = React.useRef(null);
  
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || '';
    }
  }, [noteId]);

  const handleInput = () => {
     if (editorRef.current) {
       onSave(noteId, editorRef.current.innerHTML);
     }
  };

  const insertImage = async () => {
     const url = await popup.prompt({
       title: 'Insert image',
       message: 'ใส่ URL รูปภาพ (หรือคุณสามารถกด Ctrl+V เพื่อวางรูปภาพในพื้นที่พิมพ์ได้เลย):',
       defaultValue: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80',
       placeholder: 'https://...',
       confirmText: 'Insert',
     });
     if (url) {
        document.execCommand('insertImage', false, url);
        handleInput();
     }
  };

  const execCmd = (cmd) => {
     document.execCommand(cmd, false, null);
     handleInput();
  };

  return (
     <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Editor Toolbar */}
        <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center gap-2">
           <h3 className="font-semibold text-gray-700 mr-auto flex items-center gap-2">
             <FileText className="w-4 h-4 text-blue-500" /> {noteTitle}
           </h3>
           
           <div className="flex items-center bg-white border border-gray-200 rounded-md p-1 shadow-sm">
             <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ตัวหนา (Ctrl+B)"><Bold size={16}/></button>
             <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ตัวเอียง (Ctrl+I)"><Italic size={16}/></button>
             <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ขีดเส้นใต้ (Ctrl+U)"><Underline size={16}/></button>
           </div>
           
           <div className="w-px h-6 bg-gray-300 mx-1"></div>
           
           <button 
             onClick={insertImage} 
             className="p-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-gray-700 flex items-center gap-1.5 text-sm font-medium transition-colors shadow-sm"
           >
             <ImageIcon size={16} className="text-blue-500"/> แทรกรูป
           </button>
        </div>

        {/* Editable Content Area */}
        <div 
           ref={editorRef}
           contentEditable
           onInput={handleInput}
           data-placeholder="พิมพ์ข้อความ... หรือกด Ctrl+V เพื่อแปะรูปภาพได้ทันที"
           className="rich-editor flex-1 p-6 outline-none overflow-y-auto text-gray-800 text-sm md:text-base leading-relaxed bg-white prose max-w-none"
           style={{ minHeight: '300px' }}
        ></div>
        
        <div className="p-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 text-right">
          ข้อมูลจะถูกบันทึกอัตโนมัติ (Auto-saved)
        </div>
     </div>
  )
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
          const rowMinHeight = 96 + laneEnds.length * laneHeight;

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

              {weekSegments.length > 0 && (
                <div className="pointer-events-none absolute left-0 right-0 top-6 px-[2px]">
                  {weekSegments.map((segment, segmentIndex) => {
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
  onInviteMember,
  displayRange,
  setDisplayRange,
  hidePastWeeks,
  setHidePastWeeks,
}) {
  const popup = usePopup();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColorIndex, setEditColorIndex] = useState(0);
  const [inviteInputs, setInviteInputs] = useState({});

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

  const handleInvite = (projectId) => {
    const inputValue = inviteInputs[projectId] || '';
    const result = onInviteMember(projectId, inputValue);

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

  const visibleCount = projects.filter((project) => project.isVisible).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
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
                        <p className="text-xs text-gray-400">Only creator can invite project members.</p>
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

          <div className="mt-6 pt-5 border-t border-gray-200 flex flex-col gap-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-500" /> Display Settings
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="month"
                value={displayRange.start}
                onChange={(e) => setDisplayRange((prev) => ({ ...prev, start: e.target.value }))}
                className="border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1 bg-gray-50"
              />
              <span className="text-gray-500 font-medium">to</span>
              <input
                type="month"
                value={displayRange.end}
                onChange={(e) => setDisplayRange((prev) => ({ ...prev, end: e.target.value }))}
                className="border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1 bg-gray-50"
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













