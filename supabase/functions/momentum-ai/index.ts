import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const MODEL = "google/gemini-2.5-flash";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

const PRIORITY = { type: "string", enum: ["low", "medium", "high", "critical"] };
const strings = { type: "array", items: { type: "string" } };

const assignmentSchema = z.object({
  title: z.string().max(300),
  module: z.string().max(200),
  deadline: z.string().max(40),
  wordCount: z.number().optional(),
  weighting: z.number().optional(),
  difficulty: z.number(),
  deliverables: z.array(z.string().max(300)).max(30),
  rubric: z.array(z.object({ criterion: z.string().max(300), weight: z.number() })).max(30),
  sections: z.array(z.string().max(300)).max(30),
  referencingStyle: z.string().max(60).optional(),
  instructions: z.string().max(4000).optional(),
  type: z.string().max(60).optional(),
  description: z.string().max(4000).optional(),
  learningOutcomes: z.array(z.string().max(500)).max(30).optional(),
  assessmentCriteria: z.array(z.string().max(500)).max(30).optional(),
  briefText: z.string().max(40000).optional(),
}).passthrough();

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyzeBrief"), text: z.string().min(1).max(40000), today: z.string().max(40) }),
  z.object({ action: z.literal("generatePlan"), assignment: assignmentSchema, today: z.string().max(40), daysUntilDeadline: z.number() }),
  z.object({ action: z.literal("reviewWork"), assignment: assignmentSchema, submission: z.string().min(1).max(60000) }),
]);

const TOOLS = {
  analyzeBrief: {
    name: "save_brief_analysis",
    description: "Structured details extracted from a university assignment brief.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        module: { type: "string", description: "Module name and/or code, e.g. 'MKT301 Digital Marketing'." },
        deadline: { type: "string", description: "Due date as YYYY-MM-DD. Resolve relative dates using today's date." },
        deadlineTime: { type: "string", description: "Due time as HH:mm (24h) if stated." },
        wordCount: { type: "number" },
        weighting: { type: "number", description: "Percentage of the module grade (0-100)." },
        difficulty: { type: "integer", minimum: 1, maximum: 5 },
        type: { type: "string", enum: ["Essay", "Report", "Presentation", "Case study", "Dissertation", "Portfolio", "Project", "Reflective piece", "Exam", "Other"] },
        description: { type: "string", description: "One or two sentence summary of what the student must do." },
        deliverables: strings,
        sections: { ...strings, description: "Required or recommended sections, in order." },
        rubric: {
          type: "array",
          items: { type: "object", properties: { criterion: { type: "string" }, weight: { type: "number" } }, required: ["criterion", "weight"] },
          description: "Marking criteria with percentage weights summing to ~100. Infer sensible weights if not stated.",
        },
        referencingStyle: { type: "string" },
        instructions: { type: "string", description: "Key lecturer instructions or constraints." },
        learningOutcomes: strings,
        assessmentCriteria: strings,
        submissionFormat: { type: "string" },
      },
      required: ["title", "module", "deadline", "difficulty", "deliverables", "sections", "rubric"],
    },
  },
  generatePlan: {
    name: "save_plan",
    description: "An ordered study plan of concrete tasks for the assignment.",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short, specific action (max ~60 chars)." },
              description: { type: "string", description: "What to do and why, referencing the brief/rubric." },
              estimatedMinutes: { type: "integer", minimum: 0, maximum: 600 },
              dayOffset: { type: "integer", minimum: 0, description: "Days from today the task should start." },
              priority: PRIORITY,
              milestone: { type: "boolean" },
            },
            required: ["title", "description", "estimatedMinutes", "dayOffset", "priority"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  reviewWork: {
    name: "save_review",
    description: "Formative feedback on a draft against the assignment brief and rubric.",
    parameters: {
      type: "object",
      properties: {
        rubricBreakdown: {
          type: "array",
          items: {
            type: "object",
            properties: { criterion: { type: "string" }, score: { type: "integer", minimum: 0, maximum: 100 }, explanation: { type: "string" } },
            required: ["criterion", "score", "explanation"],
          },
          description: "One entry per rubric criterion, using the exact criterion names given.",
        },
        strengths: strings,
        missing: { ...strings, description: "Required elements of the brief that are missing or weak." },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: { what: { type: "string" }, why: { type: "string" }, how: { type: "string" }, priority: PRIORITY },
            required: ["what", "why", "how", "priority"],
          },
        },
      },
      required: ["rubricBreakdown", "strengths", "missing", "suggestions"],
    },
  },
} as const;

function buildMessages(req: z.infer<typeof requestSchema>) {
  switch (req.action) {
    case "analyzeBrief":
      return [
        { role: "system", content: "You extract structured details from UK university assignment briefs. Only use information present in the brief; infer conservatively (e.g. sensible rubric weights or sections) when missing. Never invent a module code." },
        { role: "user", content: `Today is ${req.today}.\n\nAssignment brief:\n"""\n${req.text}\n"""` },
      ];
    case "generatePlan": {
      const { briefText, ...details } = req.assignment;
      return [
        { role: "system", content: "You are an academic study coach. Build a realistic, specific task plan for a student: research, outlining, drafting each section, revision against the rubric, referencing and final submission. Tasks must be concrete to THIS brief (name the actual sections, sources, theories), not generic. Use 6-14 tasks. Mark 2-4 key checkpoints as milestones. Spread dayOffset across the available days; the final task must be on the last day." },
        { role: "user", content: `Today is ${req.today}. Days until deadline: ${req.daysUntilDeadline} (valid dayOffset range 0-${Math.max(0, req.daysUntilDeadline - 1)}).\n\nAssignment details:\n${JSON.stringify(details, null, 2)}${briefText ? `\n\nOriginal brief:\n"""\n${briefText.slice(0, 15000)}\n"""` : ""}` },
      ];
    }
    case "reviewWork": {
      const { briefText, ...details } = req.assignment;
      return [
        { role: "system", content: "You are a fair, encouraging university marker giving formative feedback. Score each rubric criterion 0-100 based on the submission's actual content and quote or reference specific parts of it. You cannot verify that citations are real — never claim they are verified. Scores are estimates, not grades." },
        { role: "user", content: `Assignment details:\n${JSON.stringify(details, null, 2)}${briefText ? `\n\nOriginal brief:\n"""\n${briefText.slice(0, 10000)}\n"""` : ""}\n\nStudent submission:\n"""\n${req.submission}\n"""` },
      ];
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 503);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const body = parsed.data;
    const tool = TOOLS[body.action];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(body),
        tools: [{ type: "function", function: tool }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });

    if (aiResponse.status === 429) return json({ error: "AI rate limit reached, try again shortly" }, 429);
    if (aiResponse.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      return json({ error: "AI request failed" }, 502);
    }

    const aiData = await aiResponse.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "AI returned no structured result" }, 502);

    return json({ data: JSON.parse(args), model: MODEL });
  } catch (error) {
    console.error("momentum-ai error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
