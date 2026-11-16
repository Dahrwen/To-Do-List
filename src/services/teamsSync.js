/**
 * ============================================================================
 * FILE: src/services/teamsSync.js
 * ============================================================================
 * PURPOSE:
 *   Service module responsible for synchronizing a user's Microsoft Teams
 *   (Microsoft Graph Education API) classes and assignments into the Supabase
 *   `Tasks` table — mirroring `src/services/classroomSync.js`.
 *
 * ARCHITECTURAL & SECURITY INVARIANTS:
 *   1. Strictly Read-Only Transport (`graphReadOnlyGet`):
 *      Executes ONLY HTTP `GET` requests against `https://graph.microsoft.com`.
 *      Explicitly blocks `:submit`, `:return`, `:publish`, or any write/mutation
 *      endpoints.
 *   2. Current-User-Only Privacy Boundary (`/me/`):
 *      Queries exclusively under the authenticated user's `/me/education/...`
 *      context (`GET /me/education/classes` and `GET /me/education/me/assignments`).
 *      Never queries class-wide rosters or other students' submissions.
 *   3. Multi-Tenant & Cross-Source Isolation:
 *      All Supabase queries, inserts, updates, and cleanups are strictly bound
 *      to `.eq('userID', userId)` and scoped to `[Microsoft Teams]` records,
 *      guaranteeing zero interference with `[Google Classroom]` or personal tasks.
 *   4. Zero-Secret Client Execution:
 *      Uses the short-lived OAuth 2.0 `Bearer ${providerToken}` header. No
 *      client secrets, tenant keys, or tokens are hardcoded.
 * ============================================================================
 */

import { supabase } from '../config/supabase';

const GRAPH_BASE_V1 = 'https://graph.microsoft.com/v1.0';

/**
 * Reads the list of user-hidden Microsoft Teams class names from `localStorage`.
 *
 * @returns {Set<string>} Set of lowercase, trimmed class names hidden by the user
 */
export function getHiddenTeamsCourses() {
  try {
    const raw = localStorage.getItem('hidden_teams_courses');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.map((name) => String(name).trim().toLowerCase())
        : []
    );
  } catch {
    return new Set();
  }
}

/**
 * Enforces the strict read-only Microsoft Graph invariant at the transport layer.
 * Only permits HTTP GET requests to `https://graph.microsoft.com/` and blocks
 * any submission or mutation action URLs.
 *
 * @param {string} url - Microsoft Graph API URL
 * @param {string} providerToken - User's short-lived Microsoft OAuth access token
 * @param {number} [retryCount=0] - Bounded retry counter for 429 rate limits
 * @returns {Promise<Response>}
 */
export async function graphReadOnlyGet(url, providerToken, retryCount = 0) {
  if (
    typeof url !== 'string' ||
    !url.startsWith('https://graph.microsoft.com/')
  ) {
    throw new Error('Blocked non-Microsoft Graph API request.');
  }
  if (/\/(submit|return|publish|reassign|setUpFeedbackResourcesFolder)\b/i.test(url)) {
    throw new Error(
      'Blocked write/turn-in action: Microsoft Teams integration is strictly read-only.'
    );
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${providerToken}`,
      Accept: 'application/json',
    },
  });

  // Handle HTTP 429 Too Many Requests with bounded Retry-After backoff
  if (res.status === 429 && retryCount < 2) {
    const retryAfterSec = parseInt(res.headers.get('Retry-After') || '2', 10);
    const delayMs = Math.min(Math.max(retryAfterSec, 1) * 1000, 5000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return graphReadOnlyGet(url, providerToken, retryCount + 1);
  }

  return res;
}

/**
 * Follows `@odata.nextLink` pagination across Microsoft Graph GET responses.
 *
 * @param {string} initialUrl - Starting Graph endpoint URL
 * @param {string} providerToken - OAuth Bearer token
 * @param {number} [maxPages=10] - Safety cap on pagination depth
 * @returns {Promise<{ items: Array<Object>, status: number, errorMsg: string|null }>}
 */
export async function fetchGraphPaginated(initialUrl, providerToken, maxPages = 10) {
  const items = [];
  let nextUrl = initialUrl;
  let pageCount = 0;
  let lastStatus = 200;
  let errorMsg = null;

  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    const res = await graphReadOnlyGet(nextUrl, providerToken);
    lastStatus = res.status;

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      errorMsg =
        errJson.error?.message ||
        `Microsoft Graph HTTP ${res.status}`;
      break;
    }

    const data = await res.json();
    if (Array.isArray(data.value)) {
      items.push(...data.value);
    }
    nextUrl = data['@odata.nextLink'] || null;
  }

  return { items, status: lastStatus, errorMsg };
}

/**
 * Strips HTML markup from Graph `educationItemBody` content when `contentType === 'html'`.
 *
 * @param {Object|null} instructions - Graph `instructions` object `{ content, contentType }`
 * @returns {string} Plain-text instructions
 */
export function extractPlainInstructions(instructions) {
  if (!instructions || !instructions.content) return '';
  const raw = String(instructions.content).trim();
  if (!raw) return '';
  if (String(instructions.contentType).toLowerCase() === 'html') {
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return raw;
}

/**
 * Normalizes a Microsoft Graph `educationAssignment` object into our Supabase
 * `Tasks` table schema — mirroring Google Classroom's task structure.
 *
 * @param {Object} assignment - Raw assignment object from `/me/education/me/assignments`
 * @param {string} className - Resolved class display name
 * @param {number} userId - Authenticated user's integer `userID` in `Accounts`
 * @param {boolean} [isCompleted=false] - Whether the user's submission is submitted/returned
 * @returns {Object} Normalized task payload + deduplication keys
 */
export function normalizeTeamsAssignment(
  assignment,
  className,
  userId,
  isCompleted = false
) {
  const externalId = String(assignment.id || '').trim();
  const title = String(
    assignment.displayName || 'Untitled Teams Assignment'
  ).trim();
  const safeClassName = String(className || 'Microsoft Teams Class').trim();
  const courseHeader = `[Microsoft Teams] ${safeClassName}`;

  // Convert dueDateTime (UTC ISO string) to valid ISO timestamptz or null
  let deadlineIso = null;
  if (assignment.dueDateTime) {
    const parsedDue = new Date(assignment.dueDateTime);
    if (!isNaN(parsedDue.getTime())) {
      deadlineIso = parsedDue.toISOString();
    }
  }

  const plainInstructions = extractPlainInstructions(assignment.instructions);
  const webUrl = assignment.webUrl ? String(assignment.webUrl).trim() : '';

  let description = courseHeader;
  if (plainInstructions) {
    description += `\n\n${plainInstructions}`;
  }
  if (externalId) {
    description += `\n\nTeams Assignment ID: ${externalId}`;
  }
  if (webUrl) {
    description += `\n\nTeams Link: ${webUrl}`;
  }

  return {
    externalId,
    webUrl,
    titleNorm: title.toLowerCase(),
    courseHeaderNorm: courseHeader.toLowerCase(),
    deadlineIso,
    isCompleted,
    taskRecord: {
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
      finished: Boolean(isCompleted),
    },
  };
}

/**
 * Synchronizes the current user's Microsoft Teams assignments into Supabase `Tasks`.
 *
 * @param {number} userId - Integer `userID` from `Accounts` table
 * @param {string} providerToken - Microsoft Graph OAuth 2.0 access token
 * @returns {Promise<Object>} Sync summary statistics
 */
export async function syncMicrosoftTeamsTasks(userId, providerToken) {
  if (!userId || !providerToken) {
    throw new Error('Missing user ID or Microsoft OAuth access token.');
  }

  // ==========================================================================
  // PHASE 1: FETCH ENROLLED CLASSES (`/me/education/classes`)
  // ==========================================================================
  const classEndpoints = [
    `${GRAPH_BASE_V1}/me/education/classes?$top=100`,
    `${GRAPH_BASE_V1}/education/me/classes?$top=100`,
  ];

  let rawClasses = [];
  let classStatus = 200;
  let classErrorMsg = null;

  for (const endpoint of classEndpoints) {
    const res = await fetchGraphPaginated(endpoint, providerToken);
    classStatus = res.status;
    classErrorMsg = res.errorMsg;
    if (res.items.length > 0 || res.status === 200) {
      rawClasses = res.items;
      break;
    }
  }

  const classMap = new Map();
  for (const cls of rawClasses) {
    if (cls && cls.id) {
      classMap.set(
        String(cls.id),
        String(cls.displayName || cls.mailNickname || 'Microsoft Teams').trim()
      );
    }
  }

  // Persist discovered class names in localStorage for class filter management
  const allDiscoveredClasses = Array.from(classMap.entries()).map(
    ([id, name]) => ({ id, name })
  );
  if (allDiscoveredClasses.length > 0) {
    localStorage.setItem(
      'teams_courses',
      JSON.stringify(allDiscoveredClasses)
    );
  }

  const hiddenCourses = getHiddenTeamsCourses();

  // ==========================================================================
  // PHASE 2: LOAD EXISTING USER TASKS & CLEAN UP HIDDEN TEAMS CLASSES
  // ==========================================================================
  const { data: existingTasks, error: fetchError } = await supabase
    .from('Tasks')
    .select('id, TaskName, Description, Deadline, finished')
    .eq('userID', userId);

  if (fetchError) {
    throw new Error('Failed to check existing tasks: ' + fetchError.message);
  }

  let removedCount = 0;
  const tasksToDelete = [];
  const remainingExistingTasks = [];

  for (const t of existingTasks || []) {
    const desc = t.Description || '';
    // Strictly touch ONLY `[Microsoft Teams]` tasks; never touch `[Google Classroom]` or personal tasks
    if (desc.startsWith('[Microsoft Teams]')) {
      const firstLine = desc.split('\n')[0];
      const courseName = firstLine
        .replace('[Microsoft Teams]', '')
        .trim()
        .toLowerCase();

      if (courseName && hiddenCourses.has(courseName)) {
        tasksToDelete.push(t.id);
        continue;
      }
    }
    remainingExistingTasks.push(t);
  }

  if (tasksToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('Tasks')
      .delete()
      .in('id', tasksToDelete)
      .eq('userID', userId);

    if (!delErr) {
      removedCount = tasksToDelete.length;
    }
  }

  // Build O(1) lookup index for idempotent deduplication (`external_id`, link, title+class)
  const existingTaskMap = new Map();
  const addToExistingMap = (key, taskObj) => {
    if (!key) return;
    if (!existingTaskMap.has(key)) {
      existingTaskMap.set(key, []);
    }
    existingTaskMap.get(key).push(taskObj);
  };

  for (const t of remainingExistingTasks) {
    const desc = t.Description || '';
    if (!desc.startsWith('[Microsoft Teams]')) continue;

    const idMatch = desc.match(/Teams Assignment ID:\s*(\S+)/i);
    if (idMatch && idMatch[1]) {
      addToExistingMap(`ext_id::${idMatch[1].trim()}`, t);
    }

    const linkMatch = desc.match(/Teams Link:\s*(\S+)/i);
    if (linkMatch && linkMatch[1]) {
      addToExistingMap(`link::${linkMatch[1].trim()}`, t);
    }

    const firstLine = desc.split('\n')[0].trim().toLowerCase();
    const nameKey = (t.TaskName || '').trim().toLowerCase();
    if (nameKey && firstLine) {
      addToExistingMap(`title_course::${nameKey}::${firstLine}`, t);
    }
  }

  // ==========================================================================
  // PHASE 3: FETCH CURRENT USER'S ASSIGNMENTS (`/me/education/me/assignments`)
  // ==========================================================================
  const assignmentEndpoints = [
    `${GRAPH_BASE_V1}/me/education/me/assignments?$top=100`,
    `${GRAPH_BASE_V1}/education/me/assignments?$top=100`,
  ];

  let rawAssignments = [];
  let assignStatus = 200;
  let assignErrorMsg = null;
  let endpointSucceeded = false;

  for (const endpoint of assignmentEndpoints) {
    const res = await fetchGraphPaginated(endpoint, providerToken);
    assignStatus = res.status;
    assignErrorMsg = res.errorMsg;
    if (res.status >= 200 && res.status < 300) {
      endpointSucceeded = true;
      rawAssignments = res.items;
      break;
    }
  }

  if (!endpointSucceeded) {
    const isAuthOrScopeError =
      assignStatus === 401 ||
      assignStatus === 403 ||
      classStatus === 401 ||
      classStatus === 403;
    const err = new Error(
      `Microsoft Graph API error (${assignStatus}): ${
        assignErrorMsg ||
        'Ensure your Microsoft account is a school/education account with EduAssignments.ReadBasic permission.'
      }`
    );
    err.needsReauth = isAuthOrScopeError;
    throw err;
  }

  const candidateTasks = [];
  const tasksToUpdate = [];
  let totalFound = 0;

  for (const rawAssign of rawAssignments) {
    if (!rawAssign || !rawAssign.id) continue;

    // Skip draft assignments not yet published to students
    const statusLower = String(rawAssign.status || '').toLowerCase();
    if (statusLower === 'draft' || statusLower === 'inactive') continue;

    const classId = rawAssign.classId ? String(rawAssign.classId) : '';
    const resolvedClassName =
      classMap.get(classId) ||
      rawAssign.classDisplayName ||
      'Microsoft Teams Class';

    // Respect user's hidden class filter
    if (hiddenCourses.has(resolvedClassName.trim().toLowerCase())) {
      continue;
    }

    totalFound++;

    // Check if the assignment is already completed/submitted by the current user
    const isCompleted =
      statusLower === 'completed' ||
      statusLower === 'submitted' ||
      statusLower === 'returned';

    const normalized = normalizeTeamsAssignment(
      rawAssign,
      resolvedClassName,
      userId,
      isCompleted
    );

    const extIdKey = normalized.externalId
      ? `ext_id::${normalized.externalId}`
      : null;
    const linkKey = normalized.webUrl ? `link::${normalized.webUrl}` : null;
    const titleCourseKey = `title_course::${normalized.titleNorm}::${normalized.courseHeaderNorm}`;

    const matchedRowsMap = new Map();
    const candidatesFromMap = [
      ...(extIdKey ? existingTaskMap.get(extIdKey) || [] : []),
      ...(linkKey ? existingTaskMap.get(linkKey) || [] : []),
      ...(existingTaskMap.get(titleCourseKey) || []),
    ];

    for (const row of candidatesFromMap) {
      if (row && row.id) {
        matchedRowsMap.set(row.id, row);
      }
    }

    const existingMatches = Array.from(matchedRowsMap.values());

    if (existingMatches.length > 0) {
      for (const existingMatch of existingMatches) {
        const existingTime = existingMatch.Deadline
          ? new Date(existingMatch.Deadline).getTime()
          : null;
        const newTime = normalized.deadlineIso
          ? new Date(normalized.deadlineIso).getTime()
          : null;

        const updatePayload = {};
        if (existingTime !== newTime) {
          updatePayload.Deadline = normalized.deadlineIso;
        }
        if (normalized.isCompleted && !existingMatch.finished) {
          updatePayload.finished = true;
        }

        if (Object.keys(updatePayload).length > 0) {
          tasksToUpdate.push({
            id: existingMatch.id,
            ...updatePayload,
            autoFinished: Boolean(updatePayload.finished),
          });
        }
      }
      continue;
    }

    candidateTasks.push(normalized.taskRecord);

    if (extIdKey) addToExistingMap(extIdKey, normalized.taskRecord);
    if (linkKey) addToExistingMap(linkKey, normalized.taskRecord);
    addToExistingMap(titleCourseKey, normalized.taskRecord);
  }

  // ==========================================================================
  // PHASE 4: APPLY UPDATES & INSERT NEW TEAMS TASKS INTO SUPABASE (USER-SCOPED)
  // ==========================================================================
  let updatedCount = 0;
  let autoFinishedCount = 0;

  for (const item of tasksToUpdate) {
    const updateObj = {};
    if (item.Deadline !== undefined) updateObj.Deadline = item.Deadline;
    if (item.finished !== undefined) updateObj.finished = item.finished;

    const { error: upErr } = await supabase
      .from('Tasks')
      .update(updateObj)
      .eq('id', item.id)
      .eq('userID', userId);

    if (!upErr) {
      updatedCount++;
      if (item.autoFinished) {
        autoFinishedCount++;
      }
    }
  }

  let syncedCount = 0;
  let activeSyncedCount = 0;
  let archivedSyncedCount = 0;

  if (candidateTasks.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('Tasks')
      .insert(candidateTasks)
      .select();

    if (insertErr) {
      const err = new Error('Database insert failed: ' + insertErr.message);
      err.needsReauth = false;
      throw err;
    }

    const insertedList = inserted || candidateTasks;
    syncedCount = insertedList.length;
    activeSyncedCount = insertedList.filter((t) => !t.finished).length;
    archivedSyncedCount = insertedList.filter((t) => t.finished).length;
  }

  return {
    syncedCount,
    activeSyncedCount,
    archivedSyncedCount,
    updatedCount,
    autoFinishedCount,
    removedCount,
    totalFound,
    coursesCount: allDiscoveredClasses.length,
    courses: allDiscoveredClasses,
  };
}
