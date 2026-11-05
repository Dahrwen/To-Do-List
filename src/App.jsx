// Import React hooks:
// - useState: stores dynamic data that causes component re-renders when updated
// - useEffect: runs side effects (like data fetching and auth listeners)
// - useCallback: memoizes functions so they aren't unnecessarily recreated on each render
// - useRef: stores mutable values across renders without triggering a re-render
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Import the configured Supabase client instance and token helper
import { supabase, getGoogleProviderToken } from './config/supabase';

// Import application UI components
import AuthModal from './components/AuthModal';
import Header from './components/Header';
import MiniCalendar from './components/MiniCalendar';
import ActionButtons from './components/ActionButtons';
import TaskList from './components/TaskList';
import BigCalendar from './components/BigCalendar';
import AddTaskModal from './components/AddTaskModal';
import TaskDetailsModal from './components/TaskDetailsModal';
import EditTaskModal from './components/EditTaskModal';
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
  const [currentUser, setCurrentUser] = useState(null); // Holds the currently logged-in user object
  const [isAuthOpen, setIsAuthOpen] = useState(true);     // Whether the login/register modal is open

  // View state: controls which main views are active or visible
  const [currentViewMode, setCurrentViewMode] = useState('todo'); // 'todo' for active tasks, 'archive' for completed tasks
  const [showBigCalendar, setShowBigCalendar] = useState(false);  // True when the full month BigCalendar is displayed
  const [showMiniCalendar, setShowMiniCalendar] = useState(true); // Toggles the 14-day horizontal mini calendar
  const [showTasks, setShowTasks] = useState(true);               // Toggles visibility of the task card list
  
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
    const hiddenSet = getHiddenClassroomCourses();
    return hiddenSet.has(courseName);
  };

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
              removedCount,
              activeSyncedCount,
              archivedSyncedCount,
              totalFound,
              courses,
              message,
            }) => {
              localStorage.setItem('classroom_connected', 'true');
              setIsClassroomConnected(true);
              if (courses && courses.length > 0) {
                setClassroomCourses(courses);
              }
              refreshAllData(resolvedUserId, 'todo');

              if (wasOAuthPending) {
                sessionStorage.removeItem('classroom_oauth_pending');
                if (syncedCount > 0) {
                  if (archivedSyncedCount > 0 && activeSyncedCount > 0) {
                    alert(
                      `Successfully imported ${activeSyncedCount} active assignment(s) to To-Do List and ${archivedSyncedCount} completed assignment(s) to Archive!`
                    );
                  } else if (archivedSyncedCount > 0) {
                    alert(
                      `Imported ${archivedSyncedCount} completed Google Classroom assignment(s) into Archive!`
                    );
                  } else {
                    alert(
                      `Successfully imported ${syncedCount} new activities from Google Classroom!`
                    );
                  }
                } else if (updatedCount > 0 || removedCount > 0) {
                  alert(
                    `Synced ✓ Updated ${updatedCount} deadline timestamp(s) and cleaned up ${removedCount} hidden/archived course task(s).`
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
            if (wasOAuthPending || e.needsReauth === false) {
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
    sessionStorage.removeItem('classroom_oauth_pending');
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

    // 2. Check initial active session ONCE on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeToken = getGoogleProviderToken(session);
      if (session?.user) {
        handleLoginSuccess(session.user, activeToken);
      }
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
      } else if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('google_provider_token');
        localStorage.removeItem('google_provider_token');
        currentUserRef.current = null;
        setCurrentUser(null);
        setIsAuthOpen(true);
        setDisplayedTasks([]);
        setAllUnfinishedTasks([]);
      }
    });

    // Unsubscribe from listener when component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, [handleLoginSuccess]);

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

  // Switches back to To-Do List view, or toggles the mini calendar
  const handleTodoClick = () => {
    closeAllPopups();
    if (showBigCalendar || currentViewMode === 'archive') {
      // Return to To-Do List view
      setShowBigCalendar(false);
      setShowMiniCalendar(true);
      setShowTasks(true);
      setCurrentViewMode('todo');
      loadTasks('', 'todo');
    } else {
      // Toggle mini-calendar visibility while staying on To-Do List
      setShowBigCalendar(false);
      setShowTasks(true);
      setShowMiniCalendar((prev) => !prev);
      loadTasks('', 'todo');
    }
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
      loadTasks('', currentViewMode);
    }
  };

  // Switches to the Archive view showing finished tasks
  const handleArchiveClick = () => {
    closeAllPopups();
    setShowBigCalendar(false);
    setShowMiniCalendar(true);
    setShowTasks(true);
    setCurrentViewMode('archive');
    loadTasks('', 'archive');
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

  // Updates an existing task's fields in Supabase
  const handleUpdateTask = async (taskId, updatedData) => {
    if (!currentUser?.userID) return;

    const { error } = await supabase
      .from('Tasks')
      .update(updatedData)
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
    loadTasks(query, currentViewMode);
  };

  // ============================================================================
  // GOOGLE CLASSROOM INTEGRATION HANDLERS
  // ============================================================================

  // Connects or syncs Google Classroom coursework
  const handleConnectClassroom = async () => {
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
            if (archivedSyncedCount > 0 && activeSyncedCount > 0) {
              alert(
                `Successfully imported ${activeSyncedCount} active assignment(s) to To-Do List and ${archivedSyncedCount} completed assignment(s) to Archive!`
              );
            } else if (archivedSyncedCount > 0) {
              alert(
                `Imported ${archivedSyncedCount} completed Google Classroom assignment(s) into Archive!`
              );
            } else {
              alert(
                `Successfully imported ${syncedCount} new activities from Google Classroom!`
              );
            }
            return;
          } else if (updatedCount > 0 || removedCount > 0) {
            alert(
              `Synced ✓ Updated ${updatedCount} deadline timestamp(s) and cleaned up ${removedCount} hidden/archived course task(s).`
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
      localStorage.setItem('classroom_connected', 'true');
      sessionStorage.setItem('classroom_oauth_pending', 'true');
      setIsClassroomConnected(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes:
            'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.coursework.me.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
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
    setIsClassroomConnected(false);
    alert('Google Classroom disconnected.');
  };


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
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        {/* 14-day horizontal mini calendar carousel */}
        <MiniCalendar
          tasks={allUnfinishedTasks}
          isHidden={!showMiniCalendar}
        />

        {/* View switching action buttons (To-Do, Calendar, Archive, Add Task) */}
        <ActionButtons
          onTodoClick={handleTodoClick}
          onCalendarClick={handleCalendarClick}
          onArchiveClick={handleArchiveClick}
          onAddTaskClick={handleAddTaskClick}
        />

        {/* Modal popup to create a new task */}
        <AddTaskModal
          isOpen={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onAddTask={handleAddTask}
        />

        {/* Main task cards list (shows To-Do tasks or Archived tasks) */}
        <TaskList
          tasks={displayedTasks}
          currentViewMode={currentViewMode}
          isHidden={!showTasks}
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

        {/* Modal popup to filter / hide specific Google Classroom classes */}
        {isManageCoursesOpen && (
          <div className="popup" style={{ display: 'flex' }}>
            <div
              className="popup-content"
              style={{ maxWidth: '420px', width: '90%' }}
            >
              <span
                className="close-btn"
                onClick={() => setIsManageCoursesOpen(false)}
              >
                &times;
              </span>
              <h2 style={{ marginBottom: '6px' }}>Filter Classroom Classes</h2>
              <p
                style={{
                  fontSize: '12px',
                  color: '#555',
                  marginBottom: '14px',
                  lineHeight: '1.4',
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
                    maxHeight: '260px',
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
                          border: '1px solid #ddd',
                          backgroundColor: isHiddenCourse ? '#f5f5f5' : '#fff',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 500,
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

              <button
                type="button"
                onClick={() => setIsManageCoursesOpen(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #000',
                  backgroundColor: '#72a1ff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
