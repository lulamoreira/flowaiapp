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

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, board_id, assignee, planned_end")
    .not("assignee", "is", null)
    .not("planned_end", "is", null)
    .lte("planned_end", tomorrow.toISOString())
    .neq("status", "done");

  if (tasksError) {
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

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("message")
    .gte("created_at", todayStart)
    .eq("title", "Prazo se aproximando");

  const alreadyNotified = new Set(
    (existingNotifs || []).map((n) => {
      const match = n.message.match(/"(.+?)"/);
      return match ? match[1] : "";
    })
  );

  const notifications = tasks
    .filter((t) => !alreadyNotified.has(t.title))
    .map((t) => ({
      user_id: t.assignee,
      title: "Prazo se aproximando",
      message: `A tarefa "${t.title}" vence em ${new Date(t.planned_end).toLocaleDateString("pt-BR")}.`,
      link: `/board/${t.board_id}`,
    }));

  if (notifications.length > 0) {
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
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
