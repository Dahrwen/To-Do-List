import { supabase } from '../config/supabase';

/**
 * Safely fetches active courses and assigned coursework from the Google Classroom REST API
 * using the user's temporary Google OAuth provider token.
 *
 * Security & Central Repository Architecture:
 * - NO server keys, NO API keys, and NO client secrets are used, needed, or stored.
 * - Only performs GET requests (100% read-only).
 * - Never modifies, deletes, submits, or creates anything in Google Classroom.
 * - Acts purely as a central local aggregator.
 * - Safe for public GitHub repositories.
 *
 * @param {number} userId - The user's integer userID in the public Accounts table
 * @param {string} providerToken - The Google OAuth access token from the active session
 * @returns {Promise<{syncedCount: number, activeSyncedCount: number, archivedSyncedCount: number, totalFound: number, coursesCount: number, message?: string}>}
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

  // 1. Fetch courses where user is enrolled as a student or teacher
  const courseMap = new Map();
  const endpoints = [
    'https://classroom.googleapis.com/v1/courses?studentId=me&pageSize=100',
    'https://classroom.googleapis.com/v1/courses?teacherId=me&pageSize=100',
    'https://classroom.googleapis.com/v1/courses?pageSize=100',
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
          if (c && c.id && !courseMap.has(c.id)) {
            courseMap.set(c.id, c);
          }
        }
        // If studentId=me already found courses, no need to hit fallback unless empty
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

        // Check if Google Classroom API is disabled in the Google Cloud project
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

        // Check if token is missing the required OAuth scopes
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

  const allCourses = Array.from(courseMap.values());
  const activeCourses = allCourses.filter(
    (c) => !c.courseState || c.courseState === 'ACTIVE'
  );
  const coursesToScan = activeCourses.length > 0 ? activeCourses : allCourses;

  console.log(
    `[ClassroomSync] Found ${coursesToScan.length} course(s):`,
    coursesToScan.map((c) => c.name)
  );

  if (coursesToScan.length === 0) {
    return {
      syncedCount: 0,
      activeSyncedCount: 0,
      archivedSyncedCount: 0,
      totalFound: 0,
      coursesCount: 0,
      message: 'No active Google Classroom courses were found for this Google account.',
    };
  }

  // 2. Fetch existing tasks for this user to avoid duplicate entries
  const { data: existingTasks, error: fetchErr } = await supabase
    .from('Tasks')
    .select('TaskName, Description')
    .eq('userID', userId);

  if (fetchErr) {
    console.error('[ClassroomSync] Error fetching existing tasks:', fetchErr.message);
  }

  const existingKeys = new Set();
  for (const t of existingTasks || []) {
    const titleNorm = (t.TaskName || '').trim().toLowerCase();
    const desc = t.Description || '';
    // Match by unique Classroom link if present, or by title + course description line
    const linkMatch = desc.match(/Classroom Link:\s*(\S+)/i);
    if (linkMatch && linkMatch[1]) {
      existingKeys.add(`link::${linkMatch[1].trim()}`);
    }
    const firstLine = desc.split('\n')[0].trim().toLowerCase();
    existingKeys.add(`title_course::${titleNorm}::${firstLine}`);
  }

  let totalFound = 0;
  let courseWorkErrorMsg = null;
  let courseWorkErrorStatus = null;
  const candidateTasks = [];

  // 3. For each active course, fetch assigned coursework (and student submission status)
  for (const course of coursesToScan) {
    try {
      const cwRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=100`,
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
      console.log(
        `[ClassroomSync] Course "${course.name}" returned ${courseWorkList.length} coursework item(s).`
      );

      if (courseWorkList.length === 0) continue;

      // Optionally fetch student submissions (read-only) to check if work is already turned in
      const completedCourseWorkIds = new Set();
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
          const subData = await subRes.json();
          const submissions = subData.studentSubmissions || [];
          for (const sub of submissions) {
            if (
              sub.courseWorkId &&
              (sub.state === 'TURNED_IN' || sub.state === 'RETURNED')
            ) {
              completedCourseWorkIds.add(sub.courseWorkId);
            }
          }
        }
      } catch (subErr) {
        // Non-fatal: if submissions endpoint is unavailable, treat all coursework as active
      }

      for (const cw of courseWorkList) {
        totalFound++;
        const title = (cw.title || 'Untitled Classroom Assignment').trim();
        const titleNorm = title.toLowerCase();
        const courseHeader = `[Google Classroom] ${course.name}`;
        const courseHeaderNorm = courseHeader.trim().toLowerCase();
        const linkKey = cw.alternateLink ? `link::${cw.alternateLink.trim()}` : null;
        const titleCourseKey = `title_course::${titleNorm}::${courseHeaderNorm}`;

        // Skip if this exact coursework is already in the user's tracker
        if ((linkKey && existingKeys.has(linkKey)) || existingKeys.has(titleCourseKey)) {
          continue;
        }

        // Format due date in YYYY-MM-DD format (matches standard AddTask date format)
        let deadlineStr = null;
        if (cw.dueDate && cw.dueDate.year && cw.dueDate.month && cw.dueDate.day) {
          const yyyy = String(cw.dueDate.year);
          const mm = String(cw.dueDate.month).padStart(2, '0');
          const dd = String(cw.dueDate.day).padStart(2, '0');
          deadlineStr = `${yyyy}-${mm}-${dd}`;
        }

        // Format description with course name and direct classroom link
        let description = courseHeader;
        if (cw.description) {
          description += `\n\n${cw.description}`;
        }
        if (cw.alternateLink) {
          description += `\n\nClassroom Link: ${cw.alternateLink}`;
        }

        const isCompleted = Boolean(cw.id && completedCourseWorkIds.has(cw.id));

        candidateTasks.push({
          userID: userId,
          TaskName: title,
          Description: description.trim(),
          Deadline: deadlineStr,
          Type1: false,
          Type2: false,
          Type3: false,
          Type4: true, // Automatically categorized as 'Academics'
          Type5: false,
          Type6: false,
          finished: isCompleted,
        });

        if (linkKey) existingKeys.add(linkKey);
        existingKeys.add(titleCourseKey);
      }
    } catch (err) {
      console.warn(`[ClassroomSync] Error scanning course ${course.id}:`, err);
    }
  }

  // If 0 coursework was found because every courseWork request returned 401/403, surface that error!
  if (totalFound === 0 && courseWorkErrorMsg) {
    const err = new Error(
      `Found ${coursesToScan.length} course(s), but could not read coursework (${courseWorkErrorStatus}): ${courseWorkErrorMsg}`
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
    console.log(
      `[ClassroomSync] Successfully inserted ${syncedCount} task(s) (${activeSyncedCount} active, ${archivedSyncedCount} archived).`
    );
  } else {
    console.log(
      `[ClassroomSync] No new tasks to insert (all ${totalFound} coursework items across ${coursesToScan.length} courses were already synced).`
    );
  }

  return {
    syncedCount,
    activeSyncedCount,
    archivedSyncedCount,
    totalFound,
    coursesCount: coursesToScan.length,
  };
}
