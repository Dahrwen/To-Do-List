// Supabase Edge Function: sync-classroom
// Handles secure server-side Google Classroom sync without exposing tokens or secrets to client

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
}

interface ClassroomCourseWork {
  id: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  alternateLink?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify authenticated user from JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userID } = await req.json();
    if (!userID) {
      return new Response(JSON.stringify({ error: "Missing userID in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Retrieve the Google OAuth access token for this user from the secure server-only table
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

    // 3. Refresh token if expired
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
        throw new Error("Could not refresh Google token: " + (refreshJson.error_description || refreshJson.error));
      }

      accessToken = refreshJson.access_token;
      const newExpiry = new Date(Date.now() + refreshJson.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from("user_oauth_tokens")
        .update({ access_token: accessToken, expires_at: newExpiry })
        .eq("user_id", user.id);
    }

    // 4. Fetch Active Courses from Google Classroom
    const coursesRes = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const coursesJson = await coursesRes.json();
    if (!coursesRes.ok) {
      throw new Error(coursesJson.error?.message || "Failed to fetch courses from Classroom");
    }

    const courses: ClassroomCourse[] = coursesJson.courses || [];
    let syncedCount = 0;

    // 5. Fetch coursework for each active course and map into Tasks
    for (const course of courses) {
      const cwRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const cwJson = await cwRes.json();
      if (!cwRes.ok) continue;

      const courseWorks: ClassroomCourseWork[] = cwJson.courseWork || [];

      for (const cw of courseWorks) {
        // Format due date timestamp (ISO string)
        let deadlineIso: string | null = null;
        if (cw.dueDate) {
          const { year, month, day } = cw.dueDate;
          const hours = cw.dueTime?.hours || 23;
          const minutes = cw.dueTime?.minutes || 59;
          const d = new Date(Date.UTC(year, month - 1, day, hours, minutes));
          deadlineIso = d.toISOString();
        }

        // Map description with link back to Classroom assignment
        const descriptionText = cw.alternateLink
          ? `Class: ${course.name}\n\n${cw.description || ''}\n\nClassroom Link: ${cw.alternateLink}`
          : `Class: ${course.name}\n\n${cw.description || ''}`;

        // Upsert into Tasks table: match existing by classroom_id to avoid duplication
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
            source: "google_classroom",
            classroom_id: cw.id,
          },
          { onConflict: "classroom_id,userID" }
        );

        if (!upsertErr) {
          syncedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, syncedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
