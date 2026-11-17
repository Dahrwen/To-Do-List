/**
 * ============================================================================
 * FILE: src/App.jsx
 * ============================================================================
 * PURPOSE:
 *   Central application controller, state manager, authentication bridge, and
 *   view router for the Productivity Tracker SPA.
 *
 * CORE RESPONSIBILITIES:
 *   1. Session & Account Synchronization Bridge (`syncAccountRecord`):
 *      Links Supabase Auth / Google OAuth UUID sessions to integer `userID`
 *      records in the public `Accounts` table, extracting only the user's
 *      capitalized first name and Google avatar URL.
 *   2. Google Classroom OAuth & Sync Orchestration (`handleConnectClassroom`):
 *      Requests incremental Google Classroom read-only OAuth scopes
 *      (`classroom.courses.readonly`, `classroom.coursework.me.readonly`),
 *      invokes `syncGoogleClassroomTasks`, and manages course visibility filters.
 *   3. Task Querying, Filtering & Nearest-Deadline Sorting (`loadTasks`):
 *      Fetches tasks from Supabase `Tasks`, filters out hidden Classroom courses,
 *      sorts tasks chronologically so the nearest deadline appears first (with
 *      "No due date" items at the end), and formats `timestamptz` deadlines into
 *      human-readable date + 12-hour time strings (`"Nov 06 2026 • 11:59 PM"`).
 *   4. View & Modal State Management:
 *      Coordinates switching between To-Do List, Archive, MiniCalendar, and
 *      BigCalendar views, as well as Add, Details, Edit, and Filter Classes modals.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`, `useCallback`, `useRef`
 *   - './config/supabase': `supabase`, `getGoogleProviderToken`
 *   - './services/classroomSync': `syncGoogleClassroomTasks`, `getHiddenClassroomCourses`
 *   - './components/*': `AuthModal`, `Header`, `MiniCalendar`, `ActionButtons`,
 *     `TaskList`, `BigCalendar`, `AddTaskModal`, `TaskDetailsModal`, `EditTaskModal`
 *
 * EXPORTS TO:
 *   - `src/main.jsx`: Default export `App`, named export `formatCapitalizedFirstName`
 * ============================================================================
 */

// Import React hooks:
// - useState: stores dynamic data that causes component re-renders when updated
// - useEffect: runs side effects (like data fetching and auth listeners)
// - useCallback: memoizes functions so they aren't unnecessarily recreated on each render
// - useRef: stores mutable values across renders without triggering a re-render
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// Import the configured Supabase client instance and token/persistence helpers
import {
  supabase,
  getGoogleProviderToken,
  KEEP_SIGNED_IN_KEY,
} from './config/supabase';

// Import application UI components
import AuthModal from './components/AuthModal';
import Header from './components/Header';
import ActionButtons from './components/ActionButtons';
import TaskList from './components/TaskList';
import Calendar, { MiniCalendar, BigCalendar } from './components/Calendar';
import TaskModal, {
  TaskDetailsModal,
  EditTaskModal,
  AddTaskModal,
} from './components/TaskModal';
import ChatbotButton from './components/ChatbotButton';
import {
  syncGoogleClassroomTasks,
  getHiddenClassroomCourses,
} from './services/classroomSync';

// Immediately capture Google OAuth provider_token from URL hash on module load
if (typeof window !== 'undefined' && window.location.hash) {
  try {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const tokenFromHash = params.get('provider_token');
    if (tokenFromHash) {
      sessionStorage.setItem('google_provider_token', tokenFromHash);
      localStorage.setItem('google_provider_token', tokenFromHash);
    }
  } catch (e) {
    console.warn('Error extracting provider_token from hash:', e);
  }
}

// Array mapping task category indices (Type1 to Type6) to their readable names
const taskTypes = [
  'Personal',
  'Urgent',
  'Growth',
  'Academics',
  'Interactive',
  'Social',
];

// Helper to format a user's display name so only the first letter is capitalized (e.g. 'Dharwin')
export const formatCapitalizedFirstName = (name) => {
  if (!name || name === 'Guest') return 'Guest';
  let target = String(name).trim();

  // If format is "LastName, FirstName" (contains comma), extract the FirstName
  if (target.includes(',')) {
    const parts = target.split(',');
    target = parts[1] && parts[1].trim() ? parts[1].trim() : parts[0].trim();
  }

  // Get the first word and remove any trailing/leading punctuation
  const cleanWord = target.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
  if (!cleanWord) return 'Guest';
  return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
};

export default function App() {
  // Concurrency locks: prevent multiple account-sync or classroom-sync requests from running simultaneously
  const isSyncingRef = useRef(false);
  const isClassroomSyncingRef = useRef(false);
  const currentUserRef = useRef(null);

  // Authentication & active session state
  const [currentUser, setCurrentUser] = useState(null);       // Holds the currently logged-in user object
  const [isAuthChecking, setIsAuthChecking] = useState(true);   // Blocks UI render until initial session check completes
  const [isAuthOpen, setIsAuthOpen] = useState(false);          // Whether the login/register modal is open

  // View state: controls which main views are active or visible
  const [currentViewMode, setCurrentViewMode] = useState('todo'); // 'todo' for active tasks, 'archive' for completed tasks
  const [showBigCalendar, setShowBigCalendar] = useState(false);  // True when the full month BigCalendar is displayed
  const [showMiniCalendar, setShowMiniCalendar] = useState(true); // Toggles the 14-day horizontal mini calendar (false = 3-row expanded view)
  const [showTasks, setShowTasks] = useState(true);               // Toggles visibility of the task card list

  // Filter & Pagination state
  const [activeFilter, setActiveFilter] = useState('all');        // 'all' | 'this_week' | 'next_week' | 'later' | 'no_due_date' | 'late'
  const [currentPage, setCurrentPage] = useState(0);              // Zero-based active pagination slide index
  const [searchQuery, setSearchQuery] = useState('');             // Current search bar query string

  // Tasks state: data stored from Supabase
  const [displayedTasks, setDisplayedTasks] = useState([]);       // Tasks currently visible in the list (filtered by mode & search)
  const [allUnfinishedTasks, setAllUnfinishedTasks] = useState([]); // All pending tasks for the user (used to show dots/deadlines on calendars)

  // Modals state: controls popup visibility and task selection
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);      // Popup for adding a new task
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);      // Popup for viewing task details
  const [isEditOpen, setIsEditOpen] = useState(false);            // Popup for editing an existing task
  const [selectedTask, setSelectedTask] = useState(null);         // The specific task currently opened in details or edit popup

  // Google Classroom integration state
  const [isClassroomConnected, setIsClassroomConnected] = useState(() => {
    return localStorage.getItem('classroom_connected') === 'true';
  });
  const [isSyncingClassroom, setIsSyncingClassroom] = useState(false);
  const [isManageCoursesOpen, setIsManageCoursesOpen] = useState(false);
  const [classroomCourses, setClassroomCourses] = useState(() => {
    try {
      const saved = localStorage.getItem('classroom_courses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [hiddenCourseList, setHiddenCourseList] = useState(() => {
    try {
      const saved = localStorage.getItem('hidden_classroom_courses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  /**
   * Checks whether a task belongs to a hidden Google Classroom course.
   */
  const isTaskFromHiddenCourse = (task) => {
    const desc = task?.Description || '';
    if (!desc.startsWith('[Google Classroom]')) return false;
    const courseName = desc
      .split('\n')[0]
      .replace('[Google Classroom]', '')
      .trim()
      .toLowerCase();
    return getHiddenClassroomCourses().has(courseName);
  };

  /**
   * Filters a sorted array of tasks by the selected deadline bucket:
   * - 'all':         All tasks
   * - 'this_week':   Due from now through the end of the current week (Sunday 11:59:59 PM)
   * - 'next_week':   Due during the following calendar week
   * - 'later':       Due after the end of next week
   * - 'no_due_date': Tasks with no deadline (`!task.Deadline`)
   * - 'late':        Overdue tasks (`deadline < now`)
   */
  const filterTasksByDeadlineBucket = useCallback((tasks, filterKey) => {
    if (!filterKey || filterKey === 'all') return tasks;

    const now = new Date();
    const nowMs = now.getTime();

    // End of current week (Sunday 23:59:59.999 in local time)
    const dayOfWeek = now.getDay(); // 0 (Sun) .. 6 (Sat)
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfThisWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysUntilSunday,
      23,
      59,
      59,
      999
    ).getTime();

    // End of next week (7 days after endOfThisWeek)
    const endOfNextWeek = endOfThisWeek + 7 * 24 * 60 * 60 * 1000;

    return tasks.filter((task) => {
      if (!task.Deadline) {
        return filterKey === 'no_due_date';
      }

      const deadlineMs = new Date(task.Deadline).getTime();
      if (isNaN(deadlineMs)) {
        return filterKey === 'no_due_date';
      }

      switch (filterKey) {
        case 'no_due_date':
          return false;
        case 'late':
          return deadlineMs < nowMs;
        case 'this_week':
          return deadlineMs >= nowMs && deadlineMs <= endOfThisWeek;
        case 'next_week':
          return deadlineMs > endOfThisWeek && deadlineMs <= endOfNextWeek;
        case 'later':
          return deadlineMs > endOfNextWeek;
        default:
          return true;
      }
    });
  }, []);
  /**
   * Sorts tasks so that activities with the nearest deadline are displayed first,
   * and tasks with "No due date" (null Deadline) are placed at the end.
   */
  const sortTasksByNearestDeadline = (tasks) => {
    return [...tasks].sort((a, b) => {
      const timeA = a.Deadline ? new Date(a.Deadline).getTime() : NaN;
      const timeB = b.Deadline ? new Date(b.Deadline).getTime() : NaN;
      const hasA = !isNaN(timeA);
      const hasB = !isNaN(timeB);

      if (hasA && hasB) {
        return timeA - timeB;
      }
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      return (a.id || 0) - (b.id || 0);
    });
  };

  /**
   * Transforms raw Supabase Task database rows into convenient frontend objects.
   * - Maps boolean flags (Type1..Type6) to an array of category name strings
   * - Formats the deadline date and time string for display (e.g. "Nov 06 2026 • 11:59 PM")
   */
  const formatTask = (task) => {
    const selectedTypes = [];
    if (task.Type1) selectedTypes.push(taskTypes[0]);
    if (task.Type2) selectedTypes.push(taskTypes[1]);
    if (task.Type3) selectedTypes.push(taskTypes[2]);
    if (task.Type4) selectedTypes.push(taskTypes[3]);
    if (task.Type5) selectedTypes.push(taskTypes[4]);
    if (task.Type6) selectedTypes.push(taskTypes[5]);

    let dateString = 'No due date';
    if (task.Deadline) {
      const dateObj = new Date(task.Deadline);
      if (!isNaN(dateObj.getTime())) {
        const datePart = dateObj.toDateString().split(' ').slice(1).join(' ');
        const timePart = dateObj.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        dateString = `${datePart} • ${timePart}`;
      }
    }

    const isGoogleClassroom =
      task.source === 'google_classroom' ||
      Boolean(task.Description && task.Description.includes('[Google Classroom]'));

    return {
      ...task,
      name: task.TaskName,
      categories: selectedTypes,
      deadLine: dateString,
      source: isGoogleClassroom ? 'google_classroom' : 'manual',
    };
  };

  /**
   * Fetches all unfinished tasks for the current user from Supabase.
   * Excludes tasks from hidden classes and sorts by nearest deadline first.
   */
  const loadAllUnfinishedTasks = useCallback(async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('Tasks')
      .select('*')
      .eq('userID', userId)
      .eq('finished', false);

    if (!error && data) {
      const visible = data.filter((t) => !isTaskFromHiddenCourse(t));
      const sorted = sortTasksByNearestDeadline(visible);
      setAllUnfinishedTasks(sorted);
    }
  }, []);

  /**
   * Fetches tasks for the main list, applying filters:
   * - mode: 'todo' fetches unfinished tasks (finished = false)
   * - mode: 'archive' fetches completed tasks (finished = true)
   * - searchTerm: filters TaskName using case-insensitive ILIKE match
   * - Excludes hidden Google Classroom classes
   * - Sorts so activities with the nearest deadline appear first
   */
  const loadTasks = useCallback(
    async (searchTerm = '', mode = 'todo', userId = currentUser?.userID) => {
      if (!userId) return;

      setCurrentViewMode(mode);
      const isArchive = mode === 'archive';

      let query = supabase
        .from('Tasks')
        .select('*')
        .eq('userID', userId)
        .eq('finished', isArchive);

      const searchStr = typeof searchTerm === 'string' ? searchTerm.trim() : '';
      if (searchStr !== '') {
        query = query.ilike('TaskName', `%${searchStr}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks from Supabase:', error.message);
        return;
      }

      const visible = (data || []).filter((t) => !isTaskFromHiddenCourse(t));
      const sorted = sortTasksByNearestDeadline(visible);
      const formatted = sorted.map(formatTask);
      setDisplayedTasks(formatted);
    },
    [currentUser?.userID]
  );

  /**
   * Refreshes both the task list and calendar data for the active user.
   * Called whenever a task is added, edited, finished, or deleted.
   */
  const refreshAllData = useCallback(
    (userId = currentUser?.userID, mode = currentViewMode) => {
      if (!userId) return;
      loadTasks('', mode, userId);
      loadAllUnfinishedTasks(userId);
    },
    [currentUser?.userID, currentViewMode, loadTasks, loadAllUnfinishedTasks]
  );

  /**
   * Synchronizes authenticated users (including Google OAuth users) with the public `Accounts` table:
   * - Extracts the user's first name only (from Google given_name, or the first word of full_name)
   * - Extracts the Google avatar URL safely without leaking any private Gmail data
   * - Looks up the public Accounts table by email
   * - If found, links the integer userID
   * - If new user, creates a record in Accounts table to obtain a database integer userID
   */
  const syncAccountRecord = useCallback(async (rawUser) => {
    if (!rawUser) return null;

    const email = rawUser.email || rawUser.eMail;
    if (!email) return null;

    // 1. Extract first name only (prioritize Google's given_name, then first word of full_name / userName)
    // This ensures no middle names, last names, or email addresses appear in the top-right greeting
    const rawFullName =
      rawUser.user_metadata?.given_name ||
      rawUser.user_metadata?.full_name ||
      rawUser.user_metadata?.name ||
      rawUser.user_metadata?.userName ||
      rawUser.userName ||
      email.split('@')[0] ||
      'User';

    const firstName = formatCapitalizedFirstName(rawFullName);

    // 2. Extract Google profile picture if present (from avatar_url or picture)
    const avatarUrl =
      rawUser.user_metadata?.avatar_url ||
      rawUser.user_metadata?.picture ||
      null;

    // If it's already an Accounts table object with an integer userID and firstName already set
    if (rawUser.userID && typeof rawUser.userID === 'number' && rawUser.firstName) {
      return rawUser;
    }

    try {
      // 1. Check if an account already exists (using limit(1) to avoid multi-row errors)
      const { data: existingAccounts, error: fetchErr } = await supabase
        .from('Accounts')
        .select('*')
        .ilike('eMail', email.trim())
        .order('userID', { ascending: true })
        .limit(1);

      if (fetchErr) {
        console.error('Error fetching account from Accounts table:', fetchErr.message);
      }

      // If existing account found in Accounts table, reuse its integer userID
      if (existingAccounts && existingAccounts.length > 0) {
        const existingAccount = existingAccounts[0];
        const resolvedFirstName = formatCapitalizedFirstName(
          rawUser.user_metadata?.given_name ||
          firstName ||
          existingAccount.userName
        );

        return {
          ...rawUser,
          userID: existingAccount.userID,
          userName: resolvedFirstName,
          firstName: resolvedFirstName,
          avatarUrl: avatarUrl,
          eMail: existingAccount.eMail,
        };
      }

      // 2. If it does not exist yet (e.g. brand new Google OAuth user), insert a single record
      const { data: newAccounts, error: insertErr } = await supabase
        .from('Accounts')
        .insert([
          {
            userName: firstName,
            eMail: email.trim(),
            password: '', // OAuth accounts authenticate securely via Supabase Auth
          },
        ])
        .select();

      if (insertErr) {
        console.error('Error storing account in Accounts table:', insertErr.message);
        return null;
      }

      const created = newAccounts && newAccounts[0];
      return {
        ...rawUser,
        userID: created?.userID,
        userName: firstName,
        firstName: firstName,
        avatarUrl: avatarUrl,
        eMail: created?.eMail || email,
      };
    } catch (err) {
      console.error('Error syncing account record:', err);
      return null;
    }
  }, []);

  /**
   * Invoked after successful login or OAuth authentication:
   * - Uses synchronization lock to avoid duplicate runs
   * - Syncs user with the Accounts table to obtain their integer userID
   * - Updates state, unlocks UI, and loads tasks
   */
  const handleLoginSuccess = useCallback(
    async (rawUser, token = null) => {
      const activeToken = token || getGoogleProviderToken();

      if (activeToken) {
        sessionStorage.setItem('google_provider_token', activeToken);
        localStorage.setItem('google_provider_token', activeToken);
      }

      let user = currentUserRef.current;

      // Only run syncAccountRecord if not currently locked and user is not yet resolved
      if (!isSyncingRef.current && (!user || !user.userID)) {
        isSyncingRef.current = true;
        try {
          user = await syncAccountRecord(rawUser);
          if (user && user.userID) {
            currentUserRef.current = user;
            setCurrentUser(user);
            setIsAuthOpen(false); // Close auth modal and unblur main UI
            refreshAllData(user.userID, 'todo'); // Load user's active tasks
          }
        } finally {
          isSyncingRef.current = false;
        }
      }

      // If user is resolved and Classroom is connected, trigger sync
      const resolvedUserId = user?.userID || currentUserRef.current?.userID;
      const wasOAuthPending = sessionStorage.getItem('classroom_oauth_pending') === 'true';

      if (
        resolvedUserId &&
        activeToken &&
        !isClassroomSyncingRef.current &&
        (localStorage.getItem('classroom_connected') === 'true' || wasOAuthPending)
      ) {
        isClassroomSyncingRef.current = true;
        setIsSyncingClassroom(true);

        syncGoogleClassroomTasks(resolvedUserId, activeToken)
          .then(
            ({
              syncedCount,
              updatedCount,
              autoFinishedCount,
              removedCount,
              activeSyncedCount,
              archivedSyncedCount,
              totalFound,
              courses,
              message,
            }) => {
              localStorage.setItem('classroom_connected', 'true');
              sessionStorage.removeItem('classroom_auto_reauth_done');
              setIsClassroomConnected(true);
              if (courses && courses.length > 0) {
                setClassroomCourses(courses);
              }
              refreshAllData(resolvedUserId, 'todo');

              if (wasOAuthPending) {
                sessionStorage.removeItem('classroom_oauth_pending');
                if (syncedCount > 0) {
                  let alertMsg = '';
                  if (archivedSyncedCount > 0 && activeSyncedCount > 0) {
                    alertMsg = `Successfully imported ${activeSyncedCount} active assignment(s) to To-Do List and ${archivedSyncedCount} completed assignment(s) to Archive!`;
                  } else if (archivedSyncedCount > 0) {
                    alertMsg = `Imported ${archivedSyncedCount} completed Google Classroom assignment(s) into Archive!`;
                  } else {
                    alertMsg = `Successfully imported ${syncedCount} new activities from Google Classroom!`;
                  }
                  if (autoFinishedCount > 0) {
                    alertMsg += ` Also automatically finished ${autoFinishedCount} turned-in task(s) and moved to Archive!`;
                  }
                  alert(alertMsg);
                } else if (autoFinishedCount > 0) {
                  alert(
                    `Synced ✓ Automatically finished ${autoFinishedCount} task(s) turned in on Google Classroom and moved to Archive!`
                  );
                } else if (updatedCount > 0 || removedCount > 0) {
                  alert(
                    `Synced ✓ Updated ${updatedCount} task(s) and cleaned up ${removedCount} hidden/archived course task(s).`
                  );
                } else if (totalFound > 0) {
                  alert(
                    `Synced ✓ All ${totalFound} Google Classroom activities are already up to date!`
                  );
                } else if (message) {
                  alert(message);
                }
              }
            }
          )
          .catch((e) => {
            console.warn('Classroom sync error:', e.message);
            if (e.needsReauth) {
              // Clear expired/invalid Google token quietly; never auto-redirect to Google OAuth
              sessionStorage.removeItem('google_provider_token');
              localStorage.removeItem('google_provider_token');
            }
            if (wasOAuthPending) {
              sessionStorage.removeItem('classroom_oauth_pending');
              alert('Google Classroom Sync Notice:\n\n' + e.message);
            }
          })
          .finally(() => {
            isClassroomSyncingRef.current = false;
            setIsSyncingClassroom(false);
          });
      }
    },
    [syncAccountRecord, refreshAllData]
  );

  /**
   * Signs the user out of Supabase Auth and resets all UI & data states
   */
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
    sessionStorage.removeItem('google_provider_token');
    localStorage.removeItem('google_provider_token');
    localStorage.removeItem(KEEP_SIGNED_IN_KEY);
    sessionStorage.removeItem('classroom_oauth_pending');
    sessionStorage.removeItem('classroom_auto_reauth_done');
    currentUserRef.current = null;
    setCurrentUser(null);
    setIsAuthOpen(true);
    setDisplayedTasks([]);
    setAllUnfinishedTasks([]);
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
    setSelectedTask(null);
  };

  /**
   * Runs once when the component mounts:
   * 1. Checks URL hash immediately for provider_token
   * 2. Checks if a valid Supabase session exists
   * 3. Registers a listener for auth events (e.g., Google OAuth redirects, sign out)
   */
  useEffect(() => {
    // 1. Check URL hash immediately on mount
    if (typeof window !== 'undefined' && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const hashToken = params.get('provider_token');
      if (hashToken) {
        sessionStorage.setItem('google_provider_token', hashToken);
        localStorage.setItem('google_provider_token', hashToken);
      }
    }

    // 2. Execute initial authentication check before rendering the UI
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const activeToken = getGoogleProviderToken(session);
        if (session?.user) {
          handleLoginSuccess(session.user, activeToken);
        } else {
          setIsAuthOpen(true);
        }
      })
      .catch(() => {
        setIsAuthOpen(true);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });

    // 3. Listen for auth state changes (e.g. Google OAuth redirect callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const activeToken = getGoogleProviderToken(session);
      if (
        (event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED') &&
        session?.user
      ) {
        handleLoginSuccess(session.user, activeToken);
        setIsAuthChecking(false);
      } else if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('google_provider_token');
        localStorage.removeItem('google_provider_token');
        localStorage.removeItem(KEEP_SIGNED_IN_KEY);
        currentUserRef.current = null;
        setCurrentUser(null);
        setIsAuthOpen(true);
        setIsAuthChecking(false);
        setDisplayedTasks([]);
        setAllUnfinishedTasks([]);
      }
    });

    // Unsubscribe from listener when component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, [handleLoginSuccess]);

  /**
   * Automatic background Classroom sync:
   * Periodically and whenever the user refocuses the app tab (e.g. after turning in
   * an assignment on Google Classroom in another tab or window), quietly checks for updates.
   * If any assignment has been turned in, it is automatically marked finished and moved to Archive!
   */
  useEffect(() => {
    let lastAutoSync = 0;

    const runBackgroundClassroomSync = async () => {
      const activeUserId = currentUserRef.current?.userID || currentUser?.userID;
      const activeToken = getGoogleProviderToken();
      const isConnected = localStorage.getItem('classroom_connected') === 'true';

      if (!activeUserId || !activeToken || !isConnected || isClassroomSyncingRef.current) {
        return;
      }

      const now = Date.now();
      // Throttle background sync checks to at most once every 20 seconds
      if (now - lastAutoSync < 20000) {
        return;
      }
      lastAutoSync = now;
      isClassroomSyncingRef.current = true;

      try {
        const { autoFinishedCount, syncedCount, removedCount } =
          await syncGoogleClassroomTasks(activeUserId, activeToken);

        if (autoFinishedCount > 0 || syncedCount > 0 || removedCount > 0) {
          console.log(
            `[AutoSync] Google Classroom update: ${autoFinishedCount} task(s) auto-finished, ${syncedCount} new, ${removedCount} cleaned up.`
          );
          refreshAllData(activeUserId, currentViewMode);
        }
      } catch (err) {
        // Silent in background: log without disturbing user
        console.debug('[AutoSync] Background Classroom check skipped:', err.message);
      } finally {
        isClassroomSyncingRef.current = false;
      }
    };

    // Refocus listener: automatically checks when returning from Google Classroom tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundClassroomSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Periodic check every 2 minutes while tab remains open
    const intervalId = setInterval(runBackgroundClassroomSync, 120000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, [currentUser?.userID, currentViewMode, refreshAllData]);

  // Helper to dismiss all active popup modals
  const closeAllPopups = () => {
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
    setIsManageCoursesOpen(false);
  };

  // ============================================================================
  // NAVIGATION & VIEW SWITCHING HANDLERS
  // ============================================================================

  // Single-click on "To-Do List": switches back to To-Do List view in default 2-row mode
  const handleTodoClick = () => {
    closeAllPopups();
    if (showBigCalendar || currentViewMode === 'archive') {
      setShowBigCalendar(false);
      setShowMiniCalendar(true);
      setShowTasks(true);
      setCurrentViewMode('todo');
      setCurrentPage(0);
      loadTasks(searchQuery, 'todo');
    }
  };

  // Double-click on "To-Do List": toggles between default (2-row, 10 cards) and expanded (3-row, 15 cards) view
  const handleTodoDoubleClick = () => {
    closeAllPopups();
    setShowBigCalendar(false);
    setShowTasks(true);
    setCurrentViewMode('todo');
    setShowMiniCalendar((prev) => !prev);
    setCurrentPage(0);
    loadTasks(searchQuery, 'todo');
  };

  // Opens or closes the full Big Calendar view
  const handleCalendarClick = () => {
    closeAllPopups();
    if (!showBigCalendar) {
      // Open Big Calendar view and hide regular task list
      setShowBigCalendar(true);
      setShowMiniCalendar(false);
      setShowTasks(false);
    } else {
      // Toggle Big Calendar off -> return to active task view
      setShowBigCalendar(false);
      setShowMiniCalendar(true);
      setShowTasks(true);
      loadTasks(searchQuery, currentViewMode);
    }
  };

  // Single-click on "Archive": switches to the Archive view in default 2-row mode
  const handleArchiveClick = () => {
    closeAllPopups();
    if (showBigCalendar || currentViewMode !== 'archive') {
      setShowBigCalendar(false);
      setShowMiniCalendar(true);
      setShowTasks(true);
      setCurrentViewMode('archive');
      setCurrentPage(0);
      loadTasks(searchQuery, 'archive');
    }
  };

  // Double-click on "Archive": toggles between default (2-row, 10 cards) and expanded (3-row, 15 cards) view
  const handleArchiveDoubleClick = () => {
    closeAllPopups();
    setShowBigCalendar(false);
    setShowTasks(true);
    setCurrentViewMode('archive');
    setShowMiniCalendar((prev) => !prev);
    setCurrentPage(0);
    loadTasks(searchQuery, 'archive');
  };

  // Handles deadline filter dropdown selection ('all', 'this_week', 'next_week', 'later', 'no_due_date', 'late')
  const handleFilterChange = (filterKey) => {
    setActiveFilter(filterKey);
    setCurrentPage(0);
  };

  // Opens the Add Task modal
  const handleAddTaskClick = () => {
    setIsAddTaskOpen(true);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
  };

  // ============================================================================
  // TASK CRUD (CREATE, READ, UPDATE, DELETE) HANDLERS
  // ============================================================================

  // Opens the Task Details modal when a task card is clicked
  const handleTaskClick = async (task) => {
    if (!currentUser?.userID) return;
    closeAllPopups();

    // Fetch fresh task data from Supabase
    const { data: tasks, error } = await supabase
      .from('Tasks')
      .select('*')
      .eq('id', task.id)
      .eq('userID', currentUser.userID);

    if (error || !tasks || tasks.length === 0) return;

    const fullTask = formatTask(tasks[0]);
    setSelectedTask(fullTask);
    setIsDetailsOpen(true);
  };

  // Adds a new task row to Supabase
  const handleAddTask = async (taskData) => {
    if (!currentUser?.userID) {
      alert('Please log in first before creating tasks!');
      return;
    }

    const { error } = await supabase.from('Tasks').insert([
      {
        userID: currentUser.userID,
        ...taskData,
      },
    ]);

    if (error) {
      console.error('Error inserting task into Supabase:', error.message);
      return;
    }

    // Refresh UI with the updated task list
    refreshAllData();
  };

  // Toggles a task between finished (completed) and active (unfinished)
  const handleFinishTask = async (taskId) => {
    if (!currentUser?.userID) return;

    // Check current finished state
    const { data: currentTask } = await supabase
      .from('Tasks')
      .select('finished')
      .eq('id', taskId)
      .eq('userID', currentUser.userID)
      .maybeSingle();

    const newStatus = !(currentTask?.finished);

    // Update finished boolean in Supabase
    await supabase
      .from('Tasks')
      .update({ finished: newStatus })
      .eq('id', taskId)
      .eq('userID', currentUser.userID);

    setIsDetailsOpen(false);
    refreshAllData();
  };

  // Deletes a task from Supabase
  const handleDeleteTask = async (taskId) => {
    if (!currentUser?.userID) return;

    await supabase
      .from('Tasks')
      .delete()
      .eq('id', taskId)
      .eq('userID', currentUser.userID);

    setIsDetailsOpen(false);
    refreshAllData();
  };

  // Switches from Details modal to Edit modal
  const handleEditClick = (task) => {
    setIsDetailsOpen(false);
    setSelectedTask(task);
    setIsEditOpen(true);
  };

  // Updates an existing task's fields in Supabase (enforcing ownership and Classroom deadline immutability)
  const handleUpdateTask = async (taskId, updatedData) => {
    if (!currentUser?.userID) return;

    // 1. Verify ownership and inspect origin before mutating
    const { data: existingTask, error: fetchError } = await supabase
      .from('Tasks')
      .select('id, userID, Deadline, Description')
      .eq('id', taskId)
      .eq('userID', currentUser.userID)
      .maybeSingle();

    if (fetchError || !existingTask) {
      console.error('Unauthorized or missing task for update:', fetchError?.message);
      return;
    }

    const isClassroomOrigin =
      selectedTask?.source === 'google_classroom' ||
      Boolean(
        existingTask.Description &&
          existingTask.Description.includes('[Google Classroom]')
      );

    // 2. Backend/Service Mutation Guard: reject any attempt to alter a Google Classroom deadline
    const sanitizedPayload = { ...updatedData };
    if (isClassroomOrigin && 'Deadline' in sanitizedPayload) {
      delete sanitizedPayload.Deadline;
    }

    const { error } = await supabase
      .from('Tasks')
      .update(sanitizedPayload)
      .eq('id', taskId)
      .eq('userID', currentUser.userID);

    if (error) {
      console.error('Error updating task in Supabase:', error.message);
      return;
    }

    setIsEditOpen(false);
    refreshAllData();
  };

  // Handles search filtering from the Header search bar
  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(0);
    loadTasks(query, currentViewMode);
  };

  // ============================================================================
  // GOOGLE CLASSROOM INTEGRATION HANDLERS
  // ============================================================================

  // Connects or syncs Google Classroom coursework
  const handleConnectClassroom = async () => {
    if (isSyncingClassroom || isClassroomSyncingRef.current) return;
    const activeUserId = currentUser?.userID || currentUserRef.current?.userID;
    if (!activeUserId) {
      alert('Please log in first to connect Google Classroom.');
      return;
    }

    setIsSyncingClassroom(true);
    try {
      const storedToken = getGoogleProviderToken();

      // If we have an active Google OAuth provider token in session/storage, sync immediately!
      if (storedToken) {
        try {
          const {
            syncedCount,
            updatedCount,
            autoFinishedCount,
            removedCount,
            activeSyncedCount,
            archivedSyncedCount,
            totalFound,
            coursesCount,
            courses,
            message,
          } = await syncGoogleClassroomTasks(activeUserId, storedToken);

          localStorage.setItem('classroom_connected', 'true');
          setIsClassroomConnected(true);
          if (courses && courses.length > 0) {
            setClassroomCourses(courses);
          }
          refreshAllData(activeUserId, currentViewMode);

          if (syncedCount > 0) {
            let alertMsg = '';
            if (archivedSyncedCount > 0 && activeSyncedCount > 0) {
              alertMsg = `Successfully imported ${activeSyncedCount} active assignment(s) to To-Do List and ${archivedSyncedCount} completed assignment(s) to Archive!`;
            } else if (archivedSyncedCount > 0) {
              alertMsg = `Imported ${archivedSyncedCount} completed Google Classroom assignment(s) into Archive!`;
            } else {
              alertMsg = `Successfully imported ${syncedCount} new activities from Google Classroom!`;
            }
            if (autoFinishedCount > 0) {
              alertMsg += ` Also automatically finished ${autoFinishedCount} turned-in task(s) and moved to Archive!`;
            }
            alert(alertMsg);
            return;
          } else if (autoFinishedCount > 0) {
            alert(
              `Synced ✓ Automatically finished ${autoFinishedCount} task(s) turned in on Google Classroom and moved to Archive!`
            );
            return;
          } else if (updatedCount > 0 || removedCount > 0) {
            alert(
              `Synced ✓ Updated ${updatedCount} task(s) and cleaned up ${removedCount} hidden/archived course task(s).`
            );
            return;
          } else if (totalFound > 0) {
            alert(
              `Synced ✓ All ${totalFound} Google Classroom activities across ${coursesCount} course(s) are already up to date!`
            );
            return;
          } else if (message) {
            alert(message);
            return;
          } else {
            alert(
              `Synced ✓ Scanned ${coursesCount || 0} active course(s), no published coursework found.`
            );
            return;
          }
        } catch (syncErr) {
          console.warn('Classroom sync attempt error:', syncErr);
          // Only re-authenticate if the token expired (401) or lacks scopes
          if (syncErr.needsReauth === false) {
            alert(syncErr.message);
            return;
          }
          // Token expired or lacks scopes -> clear cached token and re-authorize
          sessionStorage.removeItem('google_provider_token');
          localStorage.removeItem('google_provider_token');
        }
      }

      // Request Google OAuth authorization to obtain a fresh provider_token with Classroom scopes
      const wasAlreadyConnected = localStorage.getItem('classroom_connected') === 'true';
      localStorage.setItem('classroom_connected', 'true');
      sessionStorage.setItem('classroom_oauth_pending', 'true');
      setIsClassroomConnected(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes:
            'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly',
          queryParams: wasAlreadyConnected
            ? { access_type: 'offline' }
            : { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error('Google Classroom sync error:', err);
      alert(
        'Could not sync with Google Classroom: ' +
          (err.message || 'Please grant permissions to sync tasks.')
      );
    } finally {
      setIsSyncingClassroom(false);
    }
  };

  // Opens the Filter / Hide Google Classroom Classes modal
  const handleOpenManageCourses = async () => {
    closeAllPopups();

    // Combine cached active courses with any courses already present in user's tasks
    const courseNamesMap = new Map();
    try {
      const saved = localStorage.getItem('classroom_courses');
      const parsed = saved ? JSON.parse(saved) : [];
      for (const c of parsed) {
        if (c && c.name) {
          courseNamesMap.set(c.name.trim().toLowerCase(), {
            id: c.id || c.name,
            name: c.name.trim(),
          });
        }
      }
    } catch {
      // ignore
    }

    const activeUserId = currentUser?.userID || currentUserRef.current?.userID;
    if (activeUserId) {
      const { data } = await supabase
        .from('Tasks')
        .select('Description')
        .eq('userID', activeUserId);
      for (const row of data || []) {
        const desc = row.Description || '';
        if (desc.startsWith('[Google Classroom]')) {
          const courseName = desc
            .split('\n')[0]
            .replace('[Google Classroom]', '')
            .trim();
          if (courseName && !courseNamesMap.has(courseName.toLowerCase())) {
            courseNamesMap.set(courseName.toLowerCase(), {
              id: courseName,
              name: courseName,
            });
          }
        }
      }
    }

    const mergedCourses = Array.from(courseNamesMap.values());
    setClassroomCourses(mergedCourses);
    try {
      localStorage.setItem('classroom_courses', JSON.stringify(mergedCourses));
    } catch {
      // ignore
    }

    try {
      const savedHidden = localStorage.getItem('hidden_classroom_courses');
      setHiddenCourseList(savedHidden ? JSON.parse(savedHidden) : []);
    } catch {
      setHiddenCourseList([]);
    }

    setIsManageCoursesOpen(true);
  };

  // Toggles whether a specific Google Classroom course is hidden or visible
  const handleToggleCourseVisibility = async (courseName) => {
    const norm = courseName.trim().toLowerCase();
    const currentSet = new Set(
      hiddenCourseList.map((n) => String(n).trim().toLowerCase())
    );

    if (currentSet.has(norm)) {
      currentSet.delete(norm);
    } else {
      currentSet.add(norm);
    }

    const updatedHidden = Array.from(currentSet);
    setHiddenCourseList(updatedHidden);
    localStorage.setItem('hidden_classroom_courses', JSON.stringify(updatedHidden));

    const activeUserId = currentUser?.userID || currentUserRef.current?.userID;
    if (activeUserId) {
      // If newly hidden, also remove its imported tasks from Supabase so they don't clutter the DB
      if (currentSet.has(norm)) {
        const { data: userTasks } = await supabase
          .from('Tasks')
          .select('id, Description')
          .eq('userID', activeUserId);
        const idsToDelete = (userTasks || [])
          .filter((t) => {
            const d = t.Description || '';
            if (!d.startsWith('[Google Classroom]')) return false;
            const cName = d
              .split('\n')[0]
              .replace('[Google Classroom]', '')
              .trim()
              .toLowerCase();
            return cName === norm;
          })
          .map((t) => t.id);

        if (idsToDelete.length > 0) {
          await supabase
            .from('Tasks')
            .delete()
            .in('id', idsToDelete)
            .eq('userID', activeUserId);
        }
      } else {
        // Course was un-hidden: if we have a token, re-sync in background to pull its tasks
        const storedToken = getGoogleProviderToken();
        if (storedToken) {
          syncGoogleClassroomTasks(activeUserId, storedToken).then(() => {
            refreshAllData(activeUserId, currentViewMode);
          }).catch(() => {});
        }
      }
      refreshAllData(activeUserId, currentViewMode);
    }
  };

  // Disconnects Google Classroom integration
  const handleDisconnectClassroom = () => {
    localStorage.removeItem('classroom_connected');
    sessionStorage.removeItem('google_provider_token');
    localStorage.removeItem('google_provider_token');
    sessionStorage.removeItem('classroom_oauth_pending');
    sessionStorage.removeItem('classroom_auto_reauth_done');
    setIsClassroomConnected(false);
    alert('Google Classroom disconnected.');
  };

  // Placeholder handler for future Microsoft Teams sync integration
  const handleConnectTeams = () => {
    alert('Microsoft Teams sync is currently disabled and coming soon.');
  };

  // ============================================================================
  // DERIVED FILTERING & PAGINATION STATE (2x5 = 10 Default / 3x5 = 15 Expanded)
  // ============================================================================
  const isExpandedView = !showMiniCalendar && !showBigCalendar;
  const cardsPerPage = isExpandedView ? 15 : 10;
  const filteredTasks = filterTasksByDeadlineBucket(displayedTasks, activeFilter);
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / cardsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const paginatedTasks = filteredTasks.slice(
    safeCurrentPage * cardsPerPage,
    (safeCurrentPage + 1) * cardsPerPage
  );

  // Prevent flashing the login modal or dashboard until the initial auth check resolves
  if (isAuthChecking) {
    return null;
  }

  return (
    <>
      {/* Authentication Modal (Sign In / Sign Up / Google OAuth) */}
      <AuthModal
        isOpen={isAuthOpen}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Main website container (blurred / locked behind AuthModal when logged out) */}
      <div
        id="websiteCont"
        className={isAuthOpen ? 'locked-content' : ''}
      >
        {/* Top navigation header: search bar, first-name display, avatar & Classroom sync */}
        <Header
          userName={
            currentUser
              ? formatCapitalizedFirstName(currentUser.firstName || currentUser.userName)
              : 'Guest'
          }
          userAvatar={currentUser?.avatarUrl || null}
          isClassroomConnected={isClassroomConnected}
          isSyncingClassroom={isSyncingClassroom}
          onConnectClassroom={handleConnectClassroom}
          onManageCourses={handleOpenManageCourses}
          onDisconnectClassroom={handleDisconnectClassroom}
          onConnectTeams={handleConnectTeams}
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        {/* 14-day horizontal mini calendar carousel */}
        <MiniCalendar
          tasks={allUnfinishedTasks}
          isHidden={!showMiniCalendar}
        />

        {/* View switching action buttons (To-Do, Calendar, Archive, Filter dropdown, + Add task) */}
        <ActionButtons
          currentViewMode={currentViewMode}
          showBigCalendar={showBigCalendar}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onTodoClick={handleTodoClick}
          onTodoDoubleClick={handleTodoDoubleClick}
          onCalendarClick={handleCalendarClick}
          onArchiveClick={handleArchiveClick}
          onArchiveDoubleClick={handleArchiveDoubleClick}
          onAddTaskClick={handleAddTaskClick}
        />

        {/* Modal popup to create a new task */}
        <AddTaskModal
          isOpen={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onAddTask={handleAddTask}
        />

        {/* Main task cards list (5x2 = 10 default, 5x3 = 15 expanded) + bottom pagination dock */}
        <TaskList
          tasks={paginatedTasks}
          currentViewMode={currentViewMode}
          isHidden={!showTasks}
          isExpanded={isExpandedView}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onTaskClick={handleTaskClick}
        />

        {/* Full month grid Big Calendar view */}
        <BigCalendar
          tasks={allUnfinishedTasks}
          isHidden={!showBigCalendar}
        />

        {/* Modal popup to inspect full task details */}
        <TaskDetailsModal
          isOpen={isDetailsOpen}
          task={selectedTask}
          onClose={() => setIsDetailsOpen(false)}
          onFinish={handleFinishTask}
          onEdit={handleEditClick}
          onDelete={handleDeleteTask}
        />

        {/* Modal popup to edit an existing task */}
        <EditTaskModal
          isOpen={isEditOpen}
          task={selectedTask}
          onClose={() => setIsEditOpen(false)}
          onUpdateTask={handleUpdateTask}
        />

        {/* Modal popup to filter / hide specific Google Classroom classes (Rendered via Top-Layer Portal) */}
        {isManageCoursesOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="modal-portal-backdrop"
              onClick={() => setIsManageCoursesOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <section
                className="popUp active modal-medium-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setIsManageCoursesOpen(false)}
                  aria-label="Close filter classes modal"
                >
                  &times;
                </button>
                <header className="modal-header-block">
                  <span className="modal-eyebrow-label">Google Classroom</span>
                  <h2 className="modal-adaptive-title modal-title-lg">
                    Filter Classroom Classes
                  </h2>
                </header>
                <p
                  style={{
                    fontSize: '12.5px',
                    color: '#555',
                    marginBottom: '12px',
                    lineHeight: '1.45',
                  }}
                >
                  Archived classes are automatically excluded. Uncheck any active
                  class below to hide its activities from your tracker:
                </p>

                {classroomCourses.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#777', margin: '16px 0' }}>
                    No classes loaded yet. Click &ldquo;Synced ✓ (Resync)&rdquo; in the
                    profile menu first.
                  </p>
                ) : (
                  <div
                    style={{
                      maxHeight: '280px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    {classroomCourses.map((course) => {
                      const isHiddenCourse = hiddenCourseList
                        .map((n) => String(n).trim().toLowerCase())
                        .includes(course.name.trim().toLowerCase());
                      return (
                        <label
                          key={course.id || course.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1.5px solid #000',
                            backgroundColor: isHiddenCourse ? '#f5f5f5' : '#fff',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isHiddenCourse ? '#888' : '#222',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!isHiddenCourse}
                            onChange={() => handleToggleCourseVisibility(course.name)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{course.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <footer className="modal-footer-bar">
                  <button
                    type="button"
                    onClick={() => setIsManageCoursesOpen(false)}
                    className="btn modal-submit-btn full-width-btn"
                  >
                    Done
                  </button>
                </footer>
              </section>
            </div>,
            document.body
          )}

        {/* Floating bottom-left AI chatbot placeholder button */}
        <ChatbotButton />
      </div>
    </>
  );
}
