import React, { useState, useEffect, useCallback } from 'react';
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(true);

  // View state
  const [currentViewMode, setCurrentViewMode] = useState('todo'); // 'todo' | 'archive'
  const [showBigCalendar, setShowBigCalendar] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [repeatToggle, setRepeatToggle] = useState(false);

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
    async (searchTerm = '', mode = currentViewMode, userId = currentUser?.userID) => {
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
    [currentUser?.userID, currentViewMode]
  );

  const refreshAllData = useCallback(
    (userId = currentUser?.userID, mode = currentViewMode) => {
      if (!userId) return;
      loadTasks('', mode, userId);
      loadAllUnfinishedTasks(userId);
    },
    [currentUser?.userID, currentViewMode, loadTasks, loadAllUnfinishedTasks]
  );

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthOpen(false);
    refreshAllData(user.userID, 'todo');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthOpen(true);
    setDisplayedTasks([]);
    setAllUnfinishedTasks([]);
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
    setSelectedTask(null);
  };

  const closeAllPopups = () => {
    setIsAddTaskOpen(false);
    setIsDetailsOpen(false);
    setIsEditOpen(false);
  };

  // Action buttons handlers replicating original behavior
  const handleTodoClick = () => {
    closeAllPopups();
    if (!repeatToggle) {
      setShowMiniCalendar(false);
      setShowBigCalendar(false);
      setShowTasks(true);
      setRepeatToggle(true);
    } else {
      setShowMiniCalendar(true);
      setShowBigCalendar(false);
      setShowTasks(true);
      setRepeatToggle(false);
    }
    loadTasks('', 'todo');
  };

  const handleCalendarClick = () => {
    closeAllPopups();
    if (!repeatToggle) {
      setShowMiniCalendar(false);
      setShowTasks(false);
      setShowBigCalendar(true);
      setRepeatToggle(true);
    } else {
      setShowMiniCalendar(true);
      setShowBigCalendar(false);
      setShowTasks(true);
      setRepeatToggle(false);
    }
  };

  const handleArchiveClick = () => {
    closeAllPopups();
    setShowMiniCalendar(true);
    setShowBigCalendar(false);
    setShowTasks(true);
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
