/**
 * ============================================================================
 * FILE: src/services/geminiTaskService.js
 * ============================================================================
 * PURPOSE:
 *   Client-side orchestrator for sending pasted school announcements to our
 *   server-side Gemini endpoint (`POST /api/gemini-announcement`) and batch-
 *   inserting extracted tasks into Supabase under strict `userID` scoping.
 *
 * SECURITY & DATA INVARIANTS:
 *   - Never accesses or handles `GEMINI_API_KEY` on the client.
 *   - All Supabase writes strictly scope to `.insert([{ userID: userId, ... }])`.
 *   - Never touches or mutates existing `google_classroom` tasks.
 * ============================================================================
 */

import { supabase } from '../config/supabase';

/**
 * Formats a `YYYY-MM-DD` local date and optional `HH:mm` time string into a
 * valid ISO-8601 UTC timestamp string matching `Tasks.Deadline` (`timestamptz`).
 *
 * @param {string|null} dateStr - Local date (`YYYY-MM-DD`) or null
 * @param {string|null} timeStr - Local 24h time (`HH:mm`), defaults to `23:59`
 * @returns {string|null} ISO timestamp or `null`
 */
function buildDeadlineIso(dateStr, timeStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 23;
  let minutes = 59;
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':');
    hours = parseInt(hh, 10);
    minutes = parseInt(mm, 10);
  }

  const localDate = new Date(year, month, day, hours, minutes, 0);
  return isNaN(localDate.getTime()) ? null : localDate.toISOString();
}

/**
 * Formats an ISO timestamp for confirmation badges inside the chat bubble.
 */
function formatDisplayDeadline(isoStr) {
  if (!isoStr) return 'No due date';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'No due date';
  const datePart = d.toDateString().split(' ').slice(1).join(' ');
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} • ${timePart}`;
}

/**
 * Maps an array of string category tags into Supabase boolean flags (`Type1`..`Type6`).
 */
function mapCategoryFlags(categories = []) {
  const normalized = new Set(
    (Array.isArray(categories) ? categories : []).map((c) =>
      String(c || '').trim().toLowerCase()
    )
  );

  const flags = {
    Type1: normalized.has('personal'),
    Type2: normalized.has('urgent'),
    Type3: normalized.has('growth'),
    Type4: normalized.has('academics'),
    Type5: normalized.has('interactive'),
    Type6: normalized.has('social'),
  };

  // Default to Academics (Type4) if no standard flag was matched
  if (
    !flags.Type1 &&
    !flags.Type2 &&
    !flags.Type3 &&
    !flags.Type4 &&
    !flags.Type5 &&
    !flags.Type6
  ) {
    flags.Type4 = true;
  }

  return flags;
}

/**
 * Sends user input to `/api/gemini-announcement`, parses any extracted tasks,
 * and batch-inserts them into Supabase for the authenticated user.
 *
 * @param {Object} params
 * @param {string} params.message - Raw text typed/pasted by the user
 * @param {number} params.userId - Authenticated user's integer `userID`
 * @returns {Promise<{ isAnnouncement: boolean, reply: string, insertedTasks: Array<Object> }>}
 */
export async function parseAndInsertAnnouncementTasks({ message, userId }) {
  if (!userId) {
    throw new Error('Please log in first before adding tasks.');
  }

  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    throw new Error('Please enter a message or school announcement.');
  }

  const now = new Date();
  const currentLocalDateString = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }

  let response;
  try {
    response = await fetch('/api/gemini-announcement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: trimmed,
        currentDateIso: now.toISOString(),
        currentLocalDateString,
        timezone,
      }),
    });
  } catch {
    throw new Error(
      'Network error while contacting the AI assistant. Please check your connection and try again.'
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        (response.status === 429
          ? 'Gemini free-tier rate limit reached. Please wait a moment and try again.'
          : `Assistant request failed (${response.status}).`)
    );
  }

  const extractedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const insertedTasks = [];

  if (extractedTasks.length > 0) {
    const rowsToInsert = extractedTasks.map((t) => {
      const categoryLabel = t.category || 'Academics';
      const deadlineIso = buildDeadlineIso(t.deadline, t.deadlineTime);
      const flags = mapCategoryFlags(t.categories);
      const header = `[Gemini Announcement] ${categoryLabel}`;
      const description = t.description
        ? `${header}\n\n${t.description}`
        : header;

      return {
        userID: userId,
        TaskName: t.title,
        Description: description.trim(),
        Deadline: deadlineIso,
        ...flags,
        finished: false,
      };
    });

    const { data: insertedRows, error: insertError } = await supabase
      .from('Tasks')
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      throw new Error(
        `Parsed tasks, but failed to save to Supabase: ${insertError.message}`
      );
    }

    const resultRows = insertedRows || rowsToInsert;
    resultRows.forEach((row, index) => {
      const sourceMeta = extractedTasks[index] || {};
      insertedTasks.push({
        id: row.id || `temp-${index}`,
        title: row.TaskName,
        category: sourceMeta.category || 'Academics',
        deadlineDisplay: formatDisplayDeadline(row.Deadline),
        deadlineIso: row.Deadline,
        source: 'gemini_announcement',
      });
    });
  }

  return {
    isAnnouncement: Boolean(payload.isAnnouncement),
    reply:
      typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : insertedTasks.length > 0
        ? `Added ${insertedTasks.length} task(s) to your To-Do List.`
        : 'Done!',
    insertedTasks,
  };
}
