import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { BriefAnalysis } from "@/lib/momentum/ai";
import { analyzeBriefAI, generatePlanAI, type AiSource } from "@/lib/momentum/aiClient";
import { AssignmentForm, validateDraft } from "@/components/momentum/AssignmentForm";
import { useMomentum } from "@/lib/momentum/store";
import type { Assignment } from "@/lib/momentum/types";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 10);

const SAMPLE = `Digital Marketing Strategy Report
Module: MKT301 Digital Marketing
Deadline: 12 December 2026
Word count: 3000 words
Weighting: worth 40% of the module grade
Referencing: Harvard

You must critically evaluate a real brand's digital presence and propose an evidence-based digital marketing strategy.

Required sections: Introduction, Market analysis, Strategy recommendations, Implementation plan, Conclusion, References.

Rubric:
Critical analysis: 30%
Use of evidence: 25%
Strategy recommendations: 25%
Structure & clarity: 10%
Referencing: 10%`;

export default function Planner() {
  const { dispatch } = useMomentum();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [brief, setBrief] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<AiSource | null>(null);

  const runAnalysis = (text: string) => {
    if (text.trim().length < 40) {
      toast.error("Paste a bit more of the brief first", { description: "At least a couple of sentences helps the analysis." });
      return;
    }
    setAnalysing(true);
    analyzeBriefAI(text)
      .then(({ data, source }) => {
        setAnalysis(data);
        setSource(source);
        toast.success("Brief analysed", {
          description:
            source === "ai"
              ? "Review the extracted details, edit anything, then generate your plan."
              : "AI unavailable — used offline extraction. Double-check the details.",
        });
      })
      .finally(() => setAnalysing(false));
  };

  const onFile = async (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      const text = await file.text();
      setBrief(text);
      runAnalysis(text);
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const { extractPdfText } = await import("@/lib/momentum/pdf");
        const text = await extractPdfText(file);
        if (!text) {
          toast.error("No text found in this PDF", { description: "It may be a scanned image. Try pasting the brief text instead." });
          return;
        }
        setBrief(text);
        runAnalysis(text);
      } catch {
        toast.error("Couldn't read this PDF", { description: "Try another file or paste the brief text." });
      }
    } else {
      toast.error("Unsupported file", { description: "Upload a PDF, .txt or .md file — or just paste the brief text." });
    }
  };

  const generate = async () => {
    if (!analysis) return;
    const err = validateDraft(analysis);
    if (err) {
      toast.error(err);
      return;
    }
    setGenerating(true);
    const assignment: Assignment = {
      ...analysis, // the student's corrected details, not the raw extraction
      id: uid(),
      briefText: brief,
      createdAt: new Date().toISOString(),
    };
    const { data: tasks, source: planSource } = await generatePlanAI(assignment);
    dispatch({ type: "addAssignment", assignment, tasks });
    setGenerating(false);
    toast.success("Your plan is ready", {
      description: `${tasks.length} ${planSource === "ai" ? "AI-generated" : "personalised"} tasks created for "${assignment.title}".`,
    });
    navigate(`/assignments/${assignment.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">AI Assignment Planner</h1>
        <p className="text-sm text-muted-foreground">
          Paste or upload your brief — Momentum extracts the details and builds a personalised plan.
        </p>
        <Badge variant="outline" className="mt-2 border-brand-lilac/50 bg-brand-soft-purple text-brand-charcoal">
          {source === "fallback" ? "Offline mode · AI unavailable, using built-in extraction" : "AI-powered · always check the extracted details"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">1 · Your assignment brief</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={14}
              placeholder="Paste your assignment brief here — include the deadline, word count, weighting and rubric if you have them…"
              className="resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runAnalysis(brief)} disabled={analysing} className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
                {analysing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {analysing ? "Analysing…" : "Analyse brief"}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <FileUp className="mr-1.5 h-4 w-4" /> Upload PDF or .txt
              </Button>
              <Button variant="ghost" className="text-brand-lavender" onClick={() => setBrief(SAMPLE)}>
                Try a sample brief
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf,.txt,.md,text/plain"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Extracted details */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">2 · Review & edit details</CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
                <Sparkles className="h-8 w-8 text-brand-lilac" />
                <p className="text-sm font-semibold">Nothing extracted yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Analyse a brief and the key details will appear here for you to check and edit.
                </p>
              </div>
            ) : (
              <AssignmentForm value={analysis} onChange={setAnalysis} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generate */}
      <Card className="border-brand-lavender/30 bg-brand-soft-purple/50 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-bold text-brand-charcoal">3 · Generate your personalised plan</p>
            <p className="text-xs text-brand-charcoal/70">
              Momentum turns this brief into dated tasks and milestones scaled to your deadline — no generic to-do lists.
            </p>
          </div>
          <Button onClick={generate} disabled={!analysis || generating} size="lg" className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
            {generating ? "Building your plan…" : "Generate My Plan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
