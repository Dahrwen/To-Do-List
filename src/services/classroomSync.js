/**
 * ============================================================================
 * FILE: src/services/classroomSync.js
 * ============================================================================
 * PURPOSE:
 *   Service module responsible for synchronizing a user's Google Classroom
 *   courses and coursework into the Supabase `Tasks` table.
 *
 * CORE RESPONSIBILITIES:
 *   1. Strictly Read-Only Central Repository Architecture:
 *      Executes ONLY HTTP `GET` requests against the Google Classroom REST API
 *      (`classroom.googleapis.com/v1/*`). Never creates, edits, turns in, or
 *      deletes anything inside Google Classroom.
 *   2. Zero-Secret Client Execution:
 *      Authenticates directly with Google's REST API using the logged-in user's
 *      short-lived OAuth 2.0 `Bearer ${providerToken}` header. No API keys or
 *      client secrets are stored or transmitted.
 *   3. Hidden & Archived Class Exclusion:
 *      - Queries only `courseStates=ACTIVE` and verifies `c.courseState === 'ACTIVE'`.
 *      - Respects the user's manual class filter (`hidden_classroom_courses` in `localStorage`).
 *      - Automatically deletes any previously imported tasks in Supabase `Tasks`
 *        that belong to archived or newly hidden classes.
 *   4. Student Submission Verification & Auto-Archiving:
 *      - Checks `studentSubmissions?userId=me` to verify individual assignments
 *        (`assigneeMode === 'INDIVIDUAL_STUDENTS'`) are actually assigned to the user.
 *      - Marks assignments whose submission state is `TURNED_IN` or `RETURNED`
 *        as `finished: true` (placed automatically in Archive).
 *   5. Accurate `timestamptz` Deadline Mapping & Upgrading:
 *      - Converts Google Classroom's UTC `dueDate` + `dueTime` into full ISO-8601
 *        `timestamptz` strings (or `23:59` local time when `dueTime` is omitted).
 *      - Automatically upgrades existing imported tasks in Supabase if their
 *        stored `Deadline` timestamp differs from Google Classroom's timestamp.
 *
 * IMPORTS FROM:
 *   - '../config/supabase': Shared `supabase` database client
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: `syncGoogleClassroomTasks`, `getHiddenClassroomCourses`
 * ============================================================================
 */

import { supabase } from '../config/supabase';

/**
 * Reads the list of user-hidden Google Classroom course names from `localStorage`.
 *
 * @returns {Set<string>} A Set of lowercase, trimmed course names that the user chose to hide
 * @sideEffects Reads `'hidden_classroom_courses'` from `window.localStorage`
 */
export function getHiddenClassroomCourses() {
  try {
    const raw = localStorage.getItem('hidden_classroom_courses');
    const arr = raw ? JSON.parse(raw) : [];
    // Normalize every course name to lowercase and trimmed so comparisons are case-insensitive
    return new Set(arr.map((name) => String(name).trim().toLowerCase()));
  } catch (e) {
    // Return an empty Set if localStorage is unavailable or contains malformed JSON
    return new Set();
  }
}

/**
 * Fetches active courses and published coursework from the Google Classroom REST API
 * using the user's temporary Google OAuth `providerToken` and synchronizes them into
 * the Supabase `Tasks` table.
 *
 * @param {number} userId - The user's integer primary key (`userID`) from the public `Accounts` table
 * @param {string} providerToken - The Google OAuth 2.0 access token carrying Classroom read-only scopes
 * @returns {Promise<{
 *   syncedCount: number,
 *   updatedCount: number,
 *   removedCount: number,
 *   activeSyncedCount: number,
 *   archivedSyncedCount: number,
 *   totalFound: number,
 *   coursesCount: number,
 *   courses: Array<{id: string, name: string}>,
 *   message?: string
 * }>} Detailed summary of newly inserted, updated, and cleaned-up tasks
 * @throws {Error} Throws an Error with `.needsReauth = true` on HTTP 401 / insufficient scopes,
 *                 or `.needsReauth = false` on configuration/database errors
 * @sideEffects
 *   - Performs read-only `GET` requests to `https://classroom.googleapis.com/v1/courses/*`
 *   - Writes course metadata to `localStorage.getItem('classroom_courses')`
 *   - Inserts new tasks, updates changed deadlines, and deletes hidden/archived course tasks in Supabase `Tasks`
 */
export async function syncGoogleClassroomTasks(userId, providerToken) {
  // Validate that the caller provided a valid integer database userId
  if (!userId) {
    throw new Error('User ID is required to sync tasks.');
  }

  // Validate that an OAuth access token is present; if missing, signal App.jsx to trigger OAuth redirect
  if (!providerToken) {
    const err = new Error('Google OAuth token not found. Please reconnect Google Classroom.');
    err.needsReauth = true;
    throw err;
  }

  console.log('[ClassroomSync] Starting read-only Google Classroom sync for userID:', userId);

  // ==========================================================================
  // PHASE 1: FETCH STRICTLY ACTIVE COURSES FROM GOOGLE CLASSROOM API
  // ==========================================================================
  // Use a Map keyed by course.id to deduplicate courses across endpoints
  const courseMap = new Map();

  // Query courses where the user is enrolled as a student (`studentId=me`) first,
  // and fall back to courses where the user is a teacher (`teacherId=me`).
  // `courseStates=ACTIVE` instructs Google to exclude ARCHIVED, PROVISIONED, or DECLINED courses.
  const endpoints = [
    'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=100',
    'https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&pageSize=100',
  ];

  let anyEndpointSucceeded = false;
  let lastErrorMsg = null;
  let lastStatus = null;

  for (const url of endpoints) {
    try {
      // Send a read-only GET request with the user's OAuth Bearer token
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
          // Double-verify that courseState is strictly 'ACTIVE' before storing
          if (c && c.id && c.courseState === 'ACTIVE' && !courseMap.has(c.id)) {
            courseMap.set(c.id, c);
          }
        }

        // If student courses were found, no need to query teacher courses
        if (courseMap.size > 0 && url.includes('studentId=me')) {
          break;
        }
      } else {
        // Parse error payload from Google Classroom API for accurate diagnostics
        lastStatus = res.status;
        const errJson = await res.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `HTTP ${res.status}`;
        console.warn(`[ClassroomSync] Course fetch (${url}) returned ${res.status}:`, errJson);

        // HTTP 401 Unauthorized -> OAuth access token has expired (tokens last ~1 hour)
        if (res.status === 401) {
          const err = new Error('Your Google Classroom session token has expired. Reconnecting...');
          err.needsReauth = true;
          throw err;
        }

        // HTTP 403 Forbidden (API disabled in Google Cloud Console) -> Needs 1-click enable, not re-auth
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

        // HTTP 403 Forbidden (Missing OAuth scopes) -> User didn't check the consent boxes; trigger re-auth
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
      // Re-throw structured errors immediately; log network/fetch glitches
      if (e.needsReauth !== undefined) throw e;
      console.warn(`[ClassroomSync] Course fetch attempt failed:`, e.message);
    }
  }

  // If neither endpoint succeeded and Google returned an error, surface it to the caller
  if (!anyEndpointSucceeded && lastErrorMsg) {
    const err = new Error(`Google Classroom API error (${lastStatus}): ${lastErrorMsg}`);
    err.needsReauth = lastStatus === 401;
    throw err;
  }

  // ==========================================================================
  // PHASE 2: FILTER HIDDEN COURSES & CLEAN UP STALE TASKS IN SUPABASE
  // ==========================================================================
  // Retain only strictly ACTIVE courses from Google Classroom
  const activeCourses = Array.from(courseMap.values()).filter(
    (c) => c.courseState === 'ACTIVE'
  );

  // Cache the active course names in localStorage so the "Filter Classes" modal can list them
  const courseListForStorage = activeCourses.map((c) => ({
    id: String(c.id),
    name: (c.name || 'Unnamed Course').trim(),
  }));
  try {
    localStorage.setItem('classroom_courses', JSON.stringify(courseListForStorage));
  } catch (e) {
    // Ignore storage quota errors
  }

  // Exclude any course that the user manually unchecked in the "Filter Classes" modal
  const hiddenCourseNames = getHiddenClassroomCourses();
  const visibleActiveCourses = activeCourses.filter(
    (c) => !hiddenCourseNames.has((c.name || '').trim().toLowerCase())
  );

  // Build a Set of allowed first-line course headers (e.g., "[google classroom] software engineering")
  const allowedCourseHeaders = new Set(
    visibleActiveCourses.map((c) => `[google classroom] ${(c.name || '').trim().toLowerCase()}`)
  );

  // Query all existing tasks for this user from Supabase to deduplicate and clean up hidden/archived courses
  const { data: existingTasks, error: fetchErr } = await supabase
    .from('Tasks')
    .select('id, TaskName, Description, Deadline, finished')
    .eq('userID', userId);

  if (fetchErr) {
    console.error('[ClassroomSync] Error fetching existing tasks:', fetchErr.message);
  }

  // Partition existing tasks into tasks to delete (from archived/hidden courses) vs tasks to keep
  const taskIdsToRemove = [];
  const remainingExistingTasks = [];

  for (const t of existingTasks || []) {
    const desc = t.Description || '';
    if (desc.startsWith('[Google Classroom]')) {
      const firstLine = desc.split('\n')[0].trim().toLowerCase();
      // If a Classroom task's course is no longer in visibleActiveCourses, queue it for deletion
      if (!allowedCourseHeaders.has(firstLine)) {
        taskIdsToRemove.push(t.id);
        continue;
      }
    }
    remainingExistingTasks.push(t);
  }

  // Delete any tasks belonging to hidden or archived classes from Supabase
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

  // Early exit if there are no visible active courses to scan
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

  // Build an in-memory lookup Map of remaining existing tasks for O(1) duplicate detection
  // Tasks are indexed by both their unique Google Classroom URL (`link::...`) and (`title_course::...`)
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

  // ==========================================================================
  // PHASE 3: FETCH COURSEWORK & SUBMISSIONS FOR EACH VISIBLE ACTIVE COURSE
  // ==========================================================================
  let totalFound = 0;
  let updatedCount = 0;
  let courseWorkErrorMsg = null;
  let courseWorkErrorStatus = null;
  const candidateTasks = [];
  const tasksToUpdate = [];

  for (const course of visibleActiveCourses) {
    try {
      // Fetch published coursework items for this course (read-only GET)
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

      // Fetch the current student's submissions (`userId=me`) for this course to:
      // 1. Know which assignments have already been turned in or returned (`TURNED_IN` / `RETURNED`)
      // 2. Know whether an `INDIVIDUAL_STUDENTS` assignment is actually assigned to this user
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
        // Non-fatal: if studentSubmissions fails, we still import published courseWork
      }

      // Iterate through each published assignment in the course
      for (const cw of courseWorkList) {
        // Skip draft or deleted coursework
        if (cw.state && cw.state !== 'PUBLISHED') continue;

        // If an assignment is targeted only to specific students and not assigned to this user, skip it
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

        // --------------------------------------------------------------------
        // UTC DUE DATE & TIME -> ISO TIMESTAMPTZ CONVERSION
        // --------------------------------------------------------------------
        // Google Classroom stores dueDate and dueTime in UTC.
        // Using `Date.UTC(year, month - 1, day, hours, minutes, seconds)` produces the exact
        // UTC instant so that when the browser renders `new Date(task.Deadline)`, JavaScript
        // automatically converts it into the user's local timezone (e.g. Nov 06 2026 • 11:59 PM).
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
            // If a due date has no specific time, default to 11:59 PM in the user's local timezone
            deadlineIso = new Date(year, month - 1, day, 23, 59, 0).toISOString();
          }
        }

        const isCompleted = Boolean(cw.id && completedCourseWorkIds.has(cw.id));

        // Check if this assignment was already imported into Supabase
        const existingMatch =
          (linkKey && existingTaskMap.get(linkKey)) ||
          existingTaskMap.get(titleCourseKey);

        if (existingMatch) {
          // If the task already exists but its stored Deadline differs (e.g., upgrading from
          // date-only to full timestamptz with time, or teacher changed the due date), queue an update
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

        // Build the rich task description containing the course badge header, instructions, and link
        let description = courseHeader;
        if (cw.description) {
          description += `\n\n${cw.description}`;
        }
        if (cw.alternateLink) {
          description += `\n\nClassroom Link: ${cw.alternateLink}`;
        }

        // Map the Google Classroom assignment to the Supabase `Tasks` table schema
        const newTaskObj = {
          userID: userId,
          TaskName: title,
          Description: description.trim(),
          Deadline: deadlineIso,
          Type1: false, // Personal
          Type2: false, // Urgent
          Type3: false, // Growth
          Type4: true,  // Automatically tagged as 'Academics'
          Type5: false, // Interactive
          Type6: false, // Social
          finished: isCompleted,
        };

        candidateTasks.push(newTaskObj);

        // Register in existingTaskMap to prevent duplicate inserts within the same sync batch
        if (linkKey) existingTaskMap.set(linkKey, newTaskObj);
        existingTaskMap.set(titleCourseKey, newTaskObj);
      }
    } catch (err) {
      console.warn(`[ClassroomSync] Error scanning course ${course.id}:`, err);
    }
  }

  // ==========================================================================
  // PHASE 4: APPLY DEADLINE UPDATES & INSERT NEW TASKS INTO SUPABASE
  // ==========================================================================
  // Update existing tasks whose `Deadline` needed upgrading to accurate `timestamptz`
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

  // Batch-insert all newly discovered Google Classroom assignments into Supabase `Tasks`
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
