/**
 * ============================================================================
 * FILE: supabase/functions/sync-classroom/index.ts
 * ============================================================================
 * PURPOSE:
 *   Optional Deno Server-Side Supabase Edge Function for backend Google
 *   Classroom synchronization and offline OAuth token refresh.
 *
 * CORE RESPONSIBILITIES:
 *   1. Server-Only Secret Isolation:
 *      Reads `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, and
 *      `GOOGLE_CLIENT_SECRET` strictly from Deno server environment variables
 *      (`Deno.env.get(...)`) so confidential keys never exist in browser code.
 *   2. JWT User Authentication:
 *      Verifies the caller's `Authorization: Bearer <supabase_jwt>` token
 *      against Supabase Auth before performing any work.
 *   3. Automatic OAuth 2.0 Refresh Token Exchange:
 *      If the user's stored `access_token` has expired, exchanges their
 *      server-side `refresh_token` with `https://oauth2.googleapis.com/token`
 *      for a fresh access token.
 *   4. Read-Only Classroom Fetch & Database Upsert:
 *      Fetches active courses (`courseStates=ACTIVE`) and coursework via HTTP
 *      `GET`, formats UTC deadlines into ISO `timestamptz` strings, and upserts
 *      into the Supabase `Tasks` table.
 *
 * IMPORTS FROM:
 *   - 'https://deno.land/std@0.168.0/http/server.ts': Deno HTTP server (`serve`)
 *   - 'https://esm.sh/@supabase/supabase-js@2': Supabase JS client for Deno
 *
 * EXPORTS TO:
 *   - Deployed as a Supabase Edge Function endpoint (`/functions/v1/sync-classroom`)
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Standard CORS headers allowing the frontend browser app to invoke this Edge Function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TypeScript interface representing a Google Classroom Course resource
interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
}

// TypeScript interface representing a Google Classroom CourseWork assignment resource
interface ClassroomCourseWork {
  id: string;
  title: string;
  description?: string;
  state?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number; seconds?: number };
  alternateLink?: string;
}

/**
 * Main Deno HTTP request handler for the `sync-classroom` Edge Function.
 *
 * @param {Request} req - Incoming HTTP request from the client application
 * @returns {Promise<Response>} JSON response with `{ success: true, syncedCount }` or `{ error }`
 */
serve(async (req: Request) => {
  // Handle browser CORS preflight (OPTIONS) requests immediately
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate that the request includes a Bearer JWT header from the logged-in user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load server-only environment variables from Supabase Edge Function Secrets
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify the caller's identity using their Supabase Auth JWT
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the integer `userID` (foreign key to `Accounts.userID`) from the request payload
    const { userID } = await req.json();
    if (!userID) {
      return new Response(JSON.stringify({ error: "Missing userID in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Retrieve the user's Google OAuth tokens from the restricted `user_oauth_tokens` table
    const { data: tokenData, error: tokenErr } = await supabaseAdmin
      .from("user_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenErr || !tokenData?.access_token) {
      return new Response(
        JSON.stringify({ error: "Google Classroom tokens not found. Please connect Google Classroom." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenData.access_token;

    // 4. If the Google access token has expired, exchange the refresh_token on the server
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshJson = await refreshRes.json();
      if (!refreshRes.ok) {
        throw new Error(
          "Could not refresh Google token: " + (refreshJson.error_description || refreshJson.error)
        );
      }

      accessToken = refreshJson.access_token;
      const newExpiry = new Date(Date.now() + refreshJson.expires_in * 1000).toISOString();

      // Save the refreshed access token and new expiration timestamp back to the database
      await supabaseAdmin
        .from("user_oauth_tokens")
        .update({ access_token: accessToken, expires_at: newExpiry })
        .eq("user_id", user.id);
    }

    // 5. Fetch strictly ACTIVE courses from Google Classroom REST API (read-only GET)
    const coursesRes = await fetch(
      "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const coursesJson = await coursesRes.json();
    if (!coursesRes.ok) {
      throw new Error(coursesJson.error?.message || "Failed to fetch courses from Classroom");
    }

    const courses: ClassroomCourse[] = (coursesJson.courses || []).filter(
      (c: ClassroomCourse) => !c.courseState || c.courseState === "ACTIVE"
    );
    let syncedCount = 0;

    // 6. For each active course, fetch published coursework and upsert into `Tasks`
    for (const course of courses) {
      const cwRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?courseWorkStates=PUBLISHED`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const cwJson = await cwRes.json();
      if (!cwRes.ok) continue;

      const courseWorks: ClassroomCourseWork[] = cwJson.courseWork || [];

      for (const cw of courseWorks) {
        if (cw.state && cw.state !== "PUBLISHED") continue;

        // Convert Google Classroom's UTC dueDate + dueTime into an ISO-8601 timestamptz string
        let deadlineIso: string | null = null;
        if (cw.dueDate) {
          const { year, month, day } = cw.dueDate;
          const hours = cw.dueTime?.hours ?? 23;
          const minutes = cw.dueTime?.minutes ?? 59;
          const seconds = cw.dueTime?.seconds ?? 0;
          const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
          deadlineIso = d.toISOString();
        }

        // Format description with the `[Google Classroom] <Course Name>` header and direct link
        const courseHeader = `[Google Classroom] ${course.name}`;
        const descriptionText = cw.alternateLink
          ? `${courseHeader}\n\n${cw.description || ""}\n\nClassroom Link: ${cw.alternateLink}`
          : `${courseHeader}\n\n${cw.description || ""}`;

        // Upsert into `Tasks` table
        const { error: upsertErr } = await supabaseAdmin.from("Tasks").upsert(
          {
            userID: userID,
            TaskName: cw.title,
            Type1: false,
            Type2: false,
            Type3: false,
            Type4: true, // Academics category
            Type5: false,
            Type6: false,
            Deadline: deadlineIso,
            Description: descriptionText.trim(),
            finished: false,
          },
          { onConflict: "classroom_id,userID" }
        );

        if (!upsertErr) {
          syncedCount++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, syncedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
