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
 * @returns {Promise<{syncedCount: number, totalFound: number, message?: string}>}
 */
export async function syncGoogleClassroomTasks(userId, providerToken) {
  if (!userId) {
    throw new Error('User ID is required to sync tasks.');
  }

  if (!providerToken) {
    throw new Error('Google OAuth token not found. Please reconnect Google Classroom.');
  }

  console.log('[ClassroomSync] Starting Google Classroom sync for userID:', userId);

  // 1. Fetch courses using multiple endpoints (studentId=me is required for students)
  const courseMap = new Map();
  const endpoints = [
    'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    'https://classroom.googleapis.com/v1/courses?studentId=me',
    'https://classroom.googleapis.com/v1/courses',
  ];

  let anyEndpointSucceeded = false;
  let lastError = null;

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
          if (!courseMap.has(c.id)) {
            courseMap.set(c.id, c);
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson.error?.message || `HTTP ${res.status}`;
        console.warn(`[ClassroomSync] Course fetch (${url}) returned ${res.status}:`, errJson);
        if (res.status === 401) {
          throw new Error('Google OAuth session expired. Please reconnect Google Classroom.');
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('expired')) throw e;
      console.warn(`[ClassroomSync] Course fetch attempt failed:`, e.message);
    }
  }

  if (!anyEndpointSucceeded && lastError) {
    throw new Error(`Google Classroom access error: ${lastError}. Please reconnect.`);
  }

  const allCourses = Array.from(courseMap.values());
  const activeCourses = allCourses.filter(
    (c) => !c.courseState || c.courseState === 'ACTIVE'
  );
  const coursesToScan = activeCourses.length > 0 ? activeCourses : allCourses;

  console.log(`[ClassroomSync] Found ${coursesToScan.length} course(s) to scan:`, coursesToScan.map(c => c.name));

  if (coursesToScan.length === 0) {
    return {
      syncedCount: 0,
      totalFound: 0,
      message: 'No active Google Classroom courses found for this Google account.',
    };
  }

  // 2. Fetch existing tasks for this user to avoid duplicate entries
  const { data: existingTasks, error: fetchErr } = await supabase
    .from('Tasks')
    .select('TaskName')
    .eq('userID', userId);

  if (fetchErr) {
    console.error('[ClassroomSync] Error fetching existing tasks for deduplication:', fetchErr.message);
  }

  const existingTitles = new Set(
    (existingTasks || []).map((t) => (t.TaskName || '').trim().toLowerCase())
  );

  let totalFound = 0;
  const newTasksToInsert = [];

  // 3. For each active course, fetch assigned coursework
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
        console.warn(`[ClassroomSync] Could not fetch coursework for "${course.name}" (${course.id}): ${cwRes.status}`);
        continue;
      }

      const cwData = await cwRes.json();
      const courseWorkList = cwData.courseWork || [];
      console.log(`[ClassroomSync] Course "${course.name}" has ${courseWorkList.length} coursework item(s).`);

      for (const cw of courseWorkList) {
        totalFound++;
        const title = (cw.title || '').trim();
        const normalizedTitle = title.toLowerCase();

        // Skip if a task with this title already exists in the tracker
        if (existingTitles.has(normalizedTitle)) {
          continue;
        }

        // Format due date in YYYY-MM-DD format (matches standard AddTask date format)
        let deadlineStr = null;
        if (cw.dueDate) {
          const yyyy = String(cw.dueDate.year);
          const mm = String(cw.dueDate.month).padStart(2, '0');
          const dd = String(cw.dueDate.day).padStart(2, '0');
          deadlineStr = `${yyyy}-${mm}-${dd}`;
        }

        // Format description with course name and direct classroom link
        let description = `[Google Classroom] ${course.name}`;
        if (cw.description) {
          description += `\n\n${cw.description}`;
        }
        if (cw.alternateLink) {
          description += `\n\nClassroom Link: ${cw.alternateLink}`;
        }

        newTasksToInsert.push({
          userID: userId,
          TaskName: title || 'Untitled Classroom Assignment',
          Description: description.trim(),
          Deadline: deadlineStr,
          Type1: false,
          Type2: false,
          Type3: false,
          Type4: true, // Automatically categorized as 'Academics'
          Type5: false,
          Type6: false,
          finished: false,
        });

        // Add to set to prevent duplicate titles in the same batch
        existingTitles.add(normalizedTitle);
      }
    } catch (err) {
      console.warn(`[ClassroomSync] Could not fetch coursework for course ${course.id}:`, err);
    }
  }

  // 4. Insert new tasks into Supabase Tasks table
  let syncedCount = 0;
  if (newTasksToInsert.length > 0) {
    console.log(`[ClassroomSync] Inserting ${newTasksToInsert.length} new tasks into Supabase Tasks table...`);
    const { data: inserted, error: insertErr } = await supabase
      .from('Tasks')
      .insert(newTasksToInsert)
      .select();

    if (insertErr) {
      console.error('[ClassroomSync] Error inserting Classroom tasks into database:', insertErr.message);
      throw new Error('Database insert failed: ' + insertErr.message);
    }

    syncedCount = inserted ? inserted.length : newTasksToInsert.length;
    console.log(`[ClassroomSync] Successfully inserted ${syncedCount} tasks.`);
  } else {
    console.log(`[ClassroomSync] No new tasks to insert (all ${totalFound} coursework items were already synced).`);
  }

  return { syncedCount, totalFound };
}
