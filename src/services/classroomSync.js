import { supabase } from '../config/supabase';

/**
 * Helper to read the list of user-hidden Google Classroom course names from localStorage.
 * @returns {Set<string>} Set of lowercase course names that are hidden
 */
export function getHiddenClassroomCourses() {
  try {
    const raw = localStorage.getItem('hidden_classroom_courses');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr.map((name) => String(name).trim().toLowerCase()));
  } catch (e) {
    return new Set();
  }
}

/**
 * Safely fetches active courses and assigned coursework from the Google Classroom REST API
 * using the user's temporary Google OAuth provider token.
 *
 * Security & Central Repository Architecture:
 * - NO server keys, NO API keys, and NO client secrets are used, needed, or stored.
 * - Only performs GET requests to Google Classroom (100% read-only).
 * - Never modifies, deletes, submits, or creates anything in Google Classroom.
 * - Excludes archived and hidden classes so they never affect tracker activities.
 * - Maps both due date and due time into a full ISO timestamptz value.
 *
 * @param {number} userId - The user's integer userID in the public Accounts table
 * @param {string} providerToken - The Google OAuth access token from the active session
 * @returns {Promise<{syncedCount: number, updatedCount: number, removedCount: number, activeSyncedCount: number, archivedSyncedCount: number, totalFound: number, coursesCount: number, courses: Array<{id: string, name: string}>, message?: string}>}
 */
export async function syncGoogleClassroomTasks(userId, providerToken) {
  if (!userId) {
    throw new Error('User ID is required to sync tasks.');
  }

  if (!providerToken) {
    const err = new Error('Google OAuth token not found. Please reconnect Google Classroom.');
    err.needsReauth = true;
    throw err;
  }

  console.log('[ClassroomSync] Starting read-only Google Classroom sync for userID:', userId);

  // 1. Fetch strictly ACTIVE courses where user is enrolled
  const courseMap = new Map();
  const endpoints = [
    'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=100',
    'https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&pageSize=100',
  ];

  let anyEndpointSucceeded = false;
  let lastErrorMsg = null;
  let lastStatus = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        anyEndpointSucceeded = true;
        const data = await res.json();
        const list = data.courses || [];
        for (const c of list) {
          // Strictly allow only ACTIVE courses (ignore ARCHIVED, PROVISIONED, DECLINED, SUSPENDED)
          if (c && c.id && c.courseState === 'ACTIVE' && !courseMap.has(c.id)) {
            courseMap.set(c.id, c);
          }
        }
        if (courseMap.size > 0 && url.includes('studentId=me')) {
          break;
        }
      } else {
        lastStatus = res.status;
        const errJson = await res.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `HTTP ${res.status}`;
        console.warn(`[ClassroomSync] Course fetch (${url}) returned ${res.status}:`, errJson);

        if (res.status === 401) {
          const err = new Error('Your Google Classroom session token has expired. Reconnecting...');
          err.needsReauth = true;
          throw err;
        }

        if (
          res.status === 403 &&
          lastErrorMsg &&
          (lastErrorMsg.includes('has not been used in project') ||
            lastErrorMsg.includes('is disabled'))
        ) {
          const err = new Error(
            `Google Classroom API is not enabled in your Google Cloud project yet.\n\n` +
              `How to fix in 1 click:\n` +
              `1. Go to Google Cloud Console -> APIs & Services -> Library\n` +
              `2. Search for "Google Classroom API" and click "Enable"\n` +
              `3. Wait 1 minute and click Sync again.\n\n` +
              `Details: ${lastErrorMsg}`
          );
          err.needsReauth = false;
          throw err;
        }

        if (
          res.status === 403 &&
          lastErrorMsg &&
          (lastErrorMsg.toLowerCase().includes('insufficient authentication scopes') ||
            lastErrorMsg.toLowerCase().includes('insufficient permission'))
        ) {
          const err = new Error('Additional Google Classroom permissions are required. Reconnecting...');
          err.needsReauth = true;
          throw err;
        }
      }
    } catch (e) {
      if (e.needsReauth !== undefined) throw e;
      console.warn(`[ClassroomSync] Course fetch attempt failed:`, e.message);
    }
  }

  if (!anyEndpointSucceeded && lastErrorMsg) {
    const err = new Error(`Google Classroom API error (${lastStatus}): ${lastErrorMsg}`);
    err.needsReauth = lastStatus === 401;
    throw err;
  }

  // Strictly active courses from Google Classroom
  const activeCourses = Array.from(courseMap.values()).filter(
    (c) => c.courseState === 'ACTIVE'
  );

  // Persist the list of active courses so the user can also toggle/hide specific classes in the UI
  const courseListForStorage = activeCourses.map((c) => ({
    id: String(c.id),
    name: (c.name || 'Unnamed Course').trim(),
  }));
  try {
    localStorage.setItem('classroom_courses', JSON.stringify(courseListForStorage));
  } catch (e) {
    // Ignore storage quota errors
  }

  // Filter out any courses the user has marked as hidden
  const hiddenCourseNames = getHiddenClassroomCourses();
  const visibleActiveCourses = activeCourses.filter(
    (c) => !hiddenCourseNames.has((c.name || '').trim().toLowerCase())
  );

  const allowedCourseHeaders = new Set(
    visibleActiveCourses.map((c) => `[google classroom] ${(c.name || '').trim().toLowerCase()}`)
  );

  // 2. Fetch existing tasks for this user to deduplicate, update timestamps, and remove hidden/archived class tasks
  const { data: existingTasks, error: fetchErr } = await supabase
    .from('Tasks')
    .select('id, TaskName, Description, Deadline, finished')
    .eq('userID', userId);

  if (fetchErr) {
    console.error('[ClassroomSync] Error fetching existing tasks:', fetchErr.message);
  }

  // Remove any previously synced Google Classroom tasks that belong to hidden or archived classes
  const taskIdsToRemove = [];
  const remainingExistingTasks = [];

  for (const t of existingTasks || []) {
    const desc = t.Description || '';
    if (desc.startsWith('[Google Classroom]')) {
      const firstLine = desc.split('\n')[0].trim().toLowerCase();
      if (!allowedCourseHeaders.has(firstLine)) {
        taskIdsToRemove.push(t.id);
        continue;
      }
    }
    remainingExistingTasks.push(t);
  }

  let removedCount = 0;
  if (taskIdsToRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('Tasks')
      .delete()
      .in('id', taskIdsToRemove)
      .eq('userID', userId);
    if (!delErr) {
      removedCount = taskIdsToRemove.length;
      console.log(`[ClassroomSync] Removed ${removedCount} task(s) from hidden or archived classes.`);
    }
  }

  if (visibleActiveCourses.length === 0) {
    return {
      syncedCount: 0,
      updatedCount: 0,
      removedCount,
      activeSyncedCount: 0,
      archivedSyncedCount: 0,
      totalFound: 0,
      coursesCount: 0,
      courses: courseListForStorage,
      message:
        activeCourses.length > 0
          ? 'All active Google Classroom courses are currently hidden in your class filter.'
          : 'No active Google Classroom courses were found for this Google account.',
    };
  }

  // Index remaining existing tasks by Classroom Link or Title+Course
  const existingTaskMap = new Map();
  for (const t of remainingExistingTasks) {
    const titleNorm = (t.TaskName || '').trim().toLowerCase();
    const desc = t.Description || '';
    const linkMatch = desc.match(/Classroom Link:\s*(\S+)/i);
    if (linkMatch && linkMatch[1]) {
      existingTaskMap.set(`link::${linkMatch[1].trim()}`, t);
    }
    const firstLine = desc.split('\n')[0].trim().toLowerCase();
    existingTaskMap.set(`title_course::${titleNorm}::${firstLine}`, t);
  }

  let totalFound = 0;
  let updatedCount = 0;
  let courseWorkErrorMsg = null;
  let courseWorkErrorStatus = null;
  const candidateTasks = [];
  const tasksToUpdate = [];

  // 3. For each visible active course, fetch published coursework and student submission status
  for (const course of visibleActiveCourses) {
    try {
      const cwRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?courseWorkStates=PUBLISHED&pageSize=100`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!cwRes.ok) {
        const cwErrJson = await cwRes.json().catch(() => ({}));
        const cwMsg = cwErrJson.error?.message || `HTTP ${cwRes.status}`;
        console.warn(
          `[ClassroomSync] Could not fetch coursework for "${course.name}" (${course.id}): ${cwRes.status}`,
          cwErrJson
        );
        courseWorkErrorStatus = cwRes.status;
        courseWorkErrorMsg = cwMsg;
        continue;
      }

      const cwData = await cwRes.json();
      const courseWorkList = cwData.courseWork || [];

      if (courseWorkList.length === 0) continue;

      // Fetch student submissions (read-only) to verify assignment belongs to student and check completion
      const completedCourseWorkIds = new Set();
      const assignedCourseWorkIds = new Set();
      let submissionsChecked = false;

      try {
        const subRes = await fetch(
          `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`,
          {
            headers: {
              Authorization: `Bearer ${providerToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (subRes.ok) {
          submissionsChecked = true;
          const subData = await subRes.json();
          const submissions = subData.studentSubmissions || [];
          for (const sub of submissions) {
            if (sub.courseWorkId) {
              assignedCourseWorkIds.add(sub.courseWorkId);
              if (sub.state === 'TURNED_IN' || sub.state === 'RETURNED') {
                completedCourseWorkIds.add(sub.courseWorkId);
              }
            }
          }
        }
      } catch (subErr) {
        // Non-fatal: if submissions endpoint is unavailable, fall back to courseWork list
      }

      for (const cw of courseWorkList) {
        // Ignore non-published coursework
        if (cw.state && cw.state !== 'PUBLISHED') continue;

        // If coursework is assigned only to specific individual students and not assigned to this user, skip it
        if (
          submissionsChecked &&
          assignedCourseWorkIds.size > 0 &&
          cw.assigneeMode === 'INDIVIDUAL_STUDENTS' &&
          !assignedCourseWorkIds.has(cw.id)
        ) {
          continue;
        }

        totalFound++;
        const title = (cw.title || 'Untitled Classroom Assignment').trim();
        const titleNorm = title.toLowerCase();
        const courseHeader = `[Google Classroom] ${(course.name || '').trim()}`;
        const courseHeaderNorm = courseHeader.toLowerCase();
        const linkKey = cw.alternateLink ? `link::${cw.alternateLink.trim()}` : null;
        const titleCourseKey = `title_course::${titleNorm}::${courseHeaderNorm}`;

        // Build accurate ISO timestamptz string from Google Classroom's UTC dueDate & dueTime
        let deadlineIso = null;
        if (cw.dueDate && cw.dueDate.year && cw.dueDate.month && cw.dueDate.day) {
          const { year, month, day } = cw.dueDate;
          if (
            cw.dueTime &&
            (cw.dueTime.hours !== undefined || cw.dueTime.minutes !== undefined)
          ) {
            const hours = cw.dueTime.hours ?? 0;
            const minutes = cw.dueTime.minutes ?? 0;
            const seconds = cw.dueTime.seconds ?? 0;
            deadlineIso = new Date(
              Date.UTC(year, month - 1, day, hours, minutes, seconds)
            ).toISOString();
          } else {
            // Default to 11:59 PM in the user's local timezone if no specific time is set
            deadlineIso = new Date(year, month - 1, day, 23, 59, 0).toISOString();
          }
        }

        const isCompleted = Boolean(cw.id && completedCourseWorkIds.has(cw.id));

        // Check if this coursework already exists in the user's tracker
        const existingMatch =
          (linkKey && existingTaskMap.get(linkKey)) ||
          existingTaskMap.get(titleCourseKey);

        if (existingMatch) {
          // If the deadline timestamp changed (e.g. upgrading from date-only to timestamptz with time), update it
          const existingTime = existingMatch.Deadline
            ? new Date(existingMatch.Deadline).getTime()
            : null;
          const newTime = deadlineIso ? new Date(deadlineIso).getTime() : null;

          if (existingTime !== newTime) {
            tasksToUpdate.push({
              id: existingMatch.id,
              Deadline: deadlineIso,
            });
          }
          continue;
        }

        // Format description with course name and direct classroom link
        let description = courseHeader;
        if (cw.description) {
          description += `\n\n${cw.description}`;
        }
        if (cw.alternateLink) {
          description += `\n\nClassroom Link: ${cw.alternateLink}`;
        }

        const newTaskObj = {
          userID: userId,
          TaskName: title,
          Description: description.trim(),
          Deadline: deadlineIso,
          Type1: false,
          Type2: false,
          Type3: false,
          Type4: true, // Automatically categorized as 'Academics'
          Type5: false,
          Type6: false,
          finished: isCompleted,
        };

        candidateTasks.push(newTaskObj);

        if (linkKey) existingTaskMap.set(linkKey, newTaskObj);
        existingTaskMap.set(titleCourseKey, newTaskObj);
      }
    } catch (err) {
      console.warn(`[ClassroomSync] Error scanning course ${course.id}:`, err);
    }
  }

  // Update existing tasks whose Deadline needed upgrading to accurate timestamptz
  for (const item of tasksToUpdate) {
    const { error: upErr } = await supabase
      .from('Tasks')
      .update({ Deadline: item.Deadline })
      .eq('id', item.id)
      .eq('userID', userId);
    if (!upErr) {
      updatedCount++;
    }
  }

  // If 0 coursework was found because every courseWork request returned 401/403, surface that error
  if (totalFound === 0 && courseWorkErrorMsg) {
    const err = new Error(
      `Found ${visibleActiveCourses.length} course(s), but could not read coursework (${courseWorkErrorStatus}): ${courseWorkErrorMsg}`
    );
    err.needsReauth =
      courseWorkErrorStatus === 401 ||
      (courseWorkErrorStatus === 403 &&
        courseWorkErrorMsg.toLowerCase().includes('insufficient'));
    throw err;
  }

  // 4. Insert new tasks into Supabase Tasks table
  let syncedCount = 0;
  let activeSyncedCount = 0;
  let archivedSyncedCount = 0;

  if (candidateTasks.length > 0) {
    console.log(
      `[ClassroomSync] Inserting ${candidateTasks.length} new task(s) into Supabase Tasks table...`
    );
    const { data: inserted, error: insertErr } = await supabase
      .from('Tasks')
      .insert(candidateTasks)
      .select();

    if (insertErr) {
      console.error('[ClassroomSync] Error inserting Classroom tasks into database:', insertErr.message);
      const err = new Error('Database insert failed: ' + insertErr.message);
      err.needsReauth = false;
      throw err;
    }

    const rows = inserted || candidateTasks;
    syncedCount = rows.length;
    activeSyncedCount = rows.filter((r) => !r.finished).length;
    archivedSyncedCount = rows.filter((r) => r.finished).length;
  }

  return {
    syncedCount,
    updatedCount,
    removedCount,
    activeSyncedCount,
    archivedSyncedCount,
    totalFound,
    coursesCount: visibleActiveCourses.length,
    courses: courseListForStorage,
  };
}
