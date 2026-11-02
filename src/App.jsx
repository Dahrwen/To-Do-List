import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './config/supabase';
import AuthModal from './components/AuthModal';
import Header from './components/Header';
import MiniCalendar from './components/MiniCalendar';
import ActionButtons from './components/ActionButtons';
import TaskList from './components/TaskList';
import BigCalendar from './components/BigCalendar';
import AddTaskModal from './components/AddTaskModal';
import TaskDetailsModal from './components/TaskDetailsModal';
import EditTaskModal from './components/EditTaskModal';

const taskTypes = [
  'Personal',
  'Urgent',
  'Growth',
  'Academics',
  'Interactive',
  'Social',
];

export default function App() {
  const isSyncingRef = useRef(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(true);

  // View state
  const [currentViewMode, setCurrentViewMode] = useState('todo'); // 'todo' | 'archive'
  const [showBigCalendar, setShowBigCalendar] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  
  // Tasks state
  const [displayedTasks, setDisplayedTasks] = useState([]);
  const [allUnfinishedTasks, setAllUnfinishedTasks] = useState([]);

  // Modals state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

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
      dateString = dateObj.toDateString().split(' ').slice(1).join(' ');
    }

    return {
      ...task,
      name: task.TaskName,
      categories: selectedTypes,
      deadLine: dateString,
    };
  };

  const loadAllUnfinishedTasks = useCallback(async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('Tasks')
      .select('*')
      .eq('userID', userId)
      .eq('finished', false);

    if (!error && data) {
      setAllUnfinishedTasks(data);
    }
  }, []);

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

      const formatted = (data || []).map(formatTask);
      setDisplayedTasks(formatted);
    },
    [currentUser?.userID]
  );

  const refreshAllData = useCallback(
    (userId = currentUser?.userID, mode = currentViewMode) => {
      if (!userId) return;
      loadTasks('', mode, userId);
      loadAllUnfinishedTasks(userId);
    },
    [currentUser?.userID, currentViewMode, loadTasks, loadAllUnfinishedTasks]
  );

  const syncAccountRecord = useCallback(async (rawUser) => {
    if (!rawUser) return null;

    // If it's already an Accounts table object with an integer userID
    if (rawUser.userID && typeof rawUser.userID === 'number') {
      return rawUser;
    }

    const email = rawUser.email || rawUser.eMail;
    if (!email) return null;

    const displayName =
      rawUser.user_metadata?.userName ||
      rawUser.user_metadata?.full_name ||
      rawUser.user_metadata?.name ||
      rawUser.userName ||
      email.split('@')[0] ||
      'User';

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

      if (existingAccounts && existingAccounts.length > 0) {
        const existingAccount = existingAccounts[0];
        return {
          ...rawUser,
          userID: existingAccount.userID,
          userName: existingAccount.userName || displayName,
          eMail: existingAccount.eMail,
        };
      }

      // 2. If it truly does not exist yet, insert a single record
      const { data: newAccounts, error: insertErr } = await supabase
        .from('Accounts')
        .insert([
          {
            userName: displayName,
            eMail: email.trim(),
            password: '', // OAuth accounts authenticate via Supabase Auth
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
        userName: created?.userName || displayName,
        eMail: created?.eMail || email,
      };
    } catch (err) {
      console.error('Error syncing account record:', err);
      return null;
    }
  }, []);

  const handleLoginSuccess = useCallback(
    async (rawUser) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const user = await syncAccountRecord(rawUser);
        if (!user || !user.userID) {
          console.error('Could not sync user with Accounts table.');
          return;
        }
        setCurrentUser(user);
        setIsAuthOpen(false);
        refreshAllData(user.userID, 'todo');
      } finally {
        isSyncingRef.current = false;
      }
    },
    [syncAccountRecord, refreshAllData]
  );

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
    setCurrentUser(null);
    setIsAuthOpen(true);
    setDisplayedTasks([]);
    setAllUnfinishedTasks([]);
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
    setSelectedTask(null);
  };

  useEffect(() => {
    // Check initial active session ONCE on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleLoginSuccess(session.user);
      }
    });

    // Listen for auth state changes (e.g. Google OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleLoginSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthOpen(true);
        setDisplayedTasks([]);
        setAllUnfinishedTasks([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const closeAllPopups = () => {
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
  };

  // Action buttons handlers: robust, independent view routing
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
      // Toggle mini-calendar while staying on To-Do List
      setShowBigCalendar(false);
      setShowTasks(true);
      setShowMiniCalendar((prev) => !prev);
      loadTasks('', 'todo');
    }
  };

  const handleCalendarClick = () => {
    closeAllPopups();
    if (!showBigCalendar) {
      // Open Big Calendar view
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

  const handleArchiveClick = () => {
    closeAllPopups();
    setShowBigCalendar(false);
    setShowMiniCalendar(true);
    setShowTasks(true);
    setCurrentViewMode('archive');
    loadTasks('', 'archive');
  };

  const handleAddTaskClick = () => {
    setIsAddTaskOpen(true);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
  };

  // Task click -> details modal
  const handleTaskClick = async (task) => {
    if (!currentUser?.userID) return;
    closeAllPopups();

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

  // Task actions
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

    refreshAllData();
  };

  const handleFinishTask = async (taskId) => {
    if (!currentUser?.userID) return;

    const { data: currentTask } = await supabase
      .from('Tasks')
      .select('finished')
      .eq('id', taskId)
      .eq('userID', currentUser.userID)
      .maybeSingle();

    const newStatus = !(currentTask?.finished);

    await supabase
      .from('Tasks')
      .update({ finished: newStatus })
      .eq('id', taskId)
      .eq('userID', currentUser.userID);

    setIsDetailsOpen(false);
    refreshAllData();
  };

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

  const handleEditClick = (task) => {
    setIsDetailsOpen(false);
    setSelectedTask(task);
    setIsEditOpen(true);
  };

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

  const handleSearch = (query) => {
    loadTasks(query, currentViewMode);
  };

  return (
    <>
      <AuthModal
        isOpen={isAuthOpen}
        onLoginSuccess={handleLoginSuccess}
      />

      <div
        id="websiteCont"
        className={isAuthOpen ? 'locked-content' : ''}
      >
        <Header
          userName={currentUser ? currentUser.userName.toUpperCase() : 'Guest'}
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        <MiniCalendar
          tasks={allUnfinishedTasks}
          isHidden={!showMiniCalendar}
        />

        <ActionButtons
          onTodoClick={handleTodoClick}
          onCalendarClick={handleCalendarClick}
          onArchiveClick={handleArchiveClick}
          onAddTaskClick={handleAddTaskClick}
        />

        <AddTaskModal
          isOpen={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onAddTask={handleAddTask}
        />

        <TaskList
          tasks={displayedTasks}
          currentViewMode={currentViewMode}
          isHidden={!showTasks}
          onTaskClick={handleTaskClick}
        />

        <BigCalendar
          tasks={allUnfinishedTasks}
          isHidden={!showBigCalendar}
        />

        <TaskDetailsModal
          isOpen={isDetailsOpen}
          task={selectedTask}
          onClose={() => setIsDetailsOpen(false)}
          onFinish={handleFinishTask}
          onEdit={handleEditClick}
          onDelete={handleDeleteTask}
        />

        <EditTaskModal
          isOpen={isEditOpen}
          task={selectedTask}
          onClose={() => setIsEditOpen(false)}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </>
  );
}
