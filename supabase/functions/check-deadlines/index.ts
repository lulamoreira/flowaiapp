import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find tasks with due_date within the next 24 hours that haven't been completed
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, board_id, assignee, due_date")
    .not("assignee", "is", null)
    .not("due_date", "is", null)
    .gte("due_date", now.toISOString().split("T")[0])
    .lte("due_date", tomorrow.toISOString().split("T")[0])
    .neq("status", "done");

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    return new Response(JSON.stringify({ error: tasksError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!tasks || tasks.length === 0) {
    return new Response(JSON.stringify({ message: "No upcoming deadlines" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check which notifications were already sent today to avoid duplicates
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const taskIds = tasks.map((t) => t.id);

  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("message")
    .gte("created_at", todayStart)
    .eq("title", "Prazo se aproximando");

  const alreadyNotified = new Set(
    (existingNotifs || []).map((n) => {
      // Extract task title from message to deduplicate
      const match = n.message.match(/"(.+?)"/);
      return match ? match[1] : "";
    })
  );

  const notifications = tasks
    .filter((t) => !alreadyNotified.has(t.title))
    .map((t) => ({
      user_id: t.assignee,
      title: "Prazo se aproximando",
      message: `A tarefa "${t.title}" vence em ${t.due_date}.`,
      link: `/board/${t.board_id}`,
    }));

  if (notifications.length > 0) {
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ sent: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
