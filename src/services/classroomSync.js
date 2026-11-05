import { supabase } from '../config/supabase';

/**
 * Safely fetches active courses and coursework from the Google Classroom REST API
 * using the user's temporary Google OAuth provider token.
 * 
 * Security & Privacy:
 * - NO server keys, NO API keys, and NO client secrets are used or needed.
 * - Only performs GET requests (100% read-only).
 * - Never modifies, deletes, or creates anything in Google Classroom.
 * - Completely safe for public GitHub repositories.
 * 
 * @param {number} userId - The user's integer userID in the public Accounts table
 * @param {string} providerToken - The Google OAuth access token from the active session
 * @returns {Promise<{syncedCount: number, totalFound: number}>}
 */
export async function syncGoogleClassroomTasks(userId, providerToken) {
  if (!userId) {
    throw new Error('User ID is required to sync tasks.');
  }

  if (!providerToken) {
    throw new Error('Google OAuth token not found. Please reconnect Google Classroom.');
  }

  // 1. Fetch active courses from Google Classroom
  const coursesRes = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    {
      headers: {
        Authorization: `Bearer ${providerToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!coursesRes.ok) {
    const errorBody = await coursesRes.json().catch(() => ({}));
    const errorMsg = errorBody.error?.message || `Google Classroom API error (${coursesRes.status})`;
    throw new Error(errorMsg);
  }

  const coursesData = await coursesRes.json();
  const courses = coursesData.courses || [];

  if (courses.length === 0) {
    return { syncedCount: 0, totalFound: 0, message: 'No active Google Classroom courses found.' };
  }

  // 2. Fetch existing tasks for this user to avoid duplicates
  const { data: existingTasks, error: fetchErr } = await supabase
    .from('Tasks')
    .select('TaskName')
    .eq('userID', userId);

  if (fetchErr) {
    console.error('Error fetching existing tasks for deduplication:', fetchErr.message);
  }

  const existingTitles = new Set(
    (existingTasks || []).map((t) => (t.TaskName || '').trim().toLowerCase())
  );

  let totalFound = 0;
  const newTasksToInsert = [];

  // 3. For each active course, fetch assigned coursework
  for (const course of courses) {
    try {
      const cwRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!cwRes.ok) continue;

      const cwData = await cwRes.json();
      const courseWorkList = cwData.courseWork || [];

      for (const cw of courseWorkList) {
        totalFound++;
        const normalizedTitle = (cw.title || '').trim().toLowerCase();

        // Skip if a task with this title already exists in the user's tracker
        if (existingTitles.has(normalizedTitle)) {
          continue;
        }

        // Parse due date if provided by Google Classroom
        let deadlineIso = null;
        if (cw.dueDate) {
          const { year, month, day } = cw.dueDate;
          const hours = cw.dueTime?.hours !== undefined ? cw.dueTime.hours : 23;
          const minutes = cw.dueTime?.minutes !== undefined ? cw.dueTime.minutes : 59;
          const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes));
          deadlineIso = dateObj.toISOString();
        }

        // Format description with course name and direct classroom link
        let description = `[Google Classroom] Course: ${course.name}`;
        if (cw.description) {
          description += `\n\n${cw.description}`;
        }
        if (cw.alternateLink) {
          description += `\n\nClassroom Link: ${cw.alternateLink}`;
        }

        newTasksToInsert.push({
          userID: userId,
          TaskName: cw.title || 'Untitled Classroom Assignment',
          Description: description.trim(),
          Deadline: deadlineIso,
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
      console.warn(`Could not fetch coursework for course ${course.id}:`, err);
    }
  }

  // 4. Insert new tasks into Supabase Tasks table
  let syncedCount = 0;
  if (newTasksToInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('Tasks')
      .insert(newTasksToInsert)
      .select();

    if (insertErr) {
      console.error('Error inserting Classroom tasks into database:', insertErr.message);
      throw new Error('Database insert failed: ' + insertErr.message);
    }

    syncedCount = inserted ? inserted.length : newTasksToInsert.length;
  }

  return { syncedCount, totalFound };
}
