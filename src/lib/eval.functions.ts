import { createServerFn } from "@tanstack/react-start";

export const listEvalRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("eval_runs")
    .select("id, model, summary, results, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    model: r.model,
    created_at: r.created_at,
    summary: JSON.stringify(r.summary),
    results: JSON.stringify(r.results),
  }));
});
