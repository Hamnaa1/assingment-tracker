import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeBrief, generatePlan, type BriefAnalysis } from "@/lib/momentum/ai";
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

  const runAnalysis = (text: string) => {
    if (text.trim().length < 40) {
      toast.error("Paste a bit more of the brief first", { description: "At least a couple of sentences helps the analysis." });
      return;
    }
    setAnalysing(true);
    // Simulated AI latency for a realistic experience.
    setTimeout(() => {
      setAnalysis(analyzeBrief(text));
      setAnalysing(false);
      toast.success("Brief analysed", { description: "Review the extracted details, edit anything, then generate your plan." });
    }, 1200);
  };

  const onFile = async (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      const text = await file.text();
      setBrief(text);
      runAnalysis(text);
    } else {
      toast.error("Unsupported file", { description: "Demo mode accepts .txt / .md files — or just paste the brief text." });
    }
  };

  const generate = () => {
    if (!analysis) return;
    if (!analysis.title.trim()) {
      toast.error("Assignment title is required");
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      const assignment: Assignment = {
        id: uid(),
        title: analysis.title,
        module: analysis.module,
        deadline: analysis.deadline,
        wordCount: analysis.wordCount,
        weighting: analysis.weighting,
        difficulty: analysis.difficulty,
        deliverables: analysis.deliverables,
        rubric: analysis.rubric,
        sections: analysis.sections,
        referencingStyle: analysis.referencingStyle,
        instructions: analysis.instructions,
        briefText: brief,
        createdAt: new Date().toISOString(),
      };
      const tasks = generatePlan(assignment);
      dispatch({ type: "addAssignment", assignment, tasks });
      setGenerating(false);
      toast.success("Your plan is ready", { description: `${tasks.length} personalised tasks created for "${assignment.title}".` });
      navigate(`/assignments/${assignment.id}`);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">AI Assignment Planner</h1>
        <p className="text-sm text-muted-foreground">
          Paste or upload your brief — Momentum extracts the details and builds a personalised plan.
        </p>
        <Badge variant="outline" className="mt-2 border-brand-lilac/50 bg-brand-soft-purple text-brand-charcoal">
          Simulated AI · demo mode
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
                <FileUp className="mr-1.5 h-4 w-4" /> Upload .txt
              </Button>
              <Button variant="ghost" className="text-brand-lavender" onClick={() => setBrief(SAMPLE)}>
                Try a sample brief
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </div>
          </CardContent>
        </Card>

        {/* Extracted details */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">2 · Review extracted details</CardTitle>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Title</Label>
                  <Input value={analysis.title} onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Module</Label>
                  <Input value={analysis.module} onChange={(e) => setAnalysis({ ...analysis, module: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Deadline</Label>
                  <Input type="date" value={analysis.deadline} onChange={(e) => setAnalysis({ ...analysis, deadline: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Word count</Label>
                  <Input
                    type="number"
                    value={analysis.wordCount ?? ""}
                    onChange={(e) => setAnalysis({ ...analysis, wordCount: parseInt(e.target.value) || undefined })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Weighting (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={analysis.weighting ?? ""}
                    onChange={(e) => setAnalysis({ ...analysis, weighting: parseInt(e.target.value) || undefined })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Difficulty (1–5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={analysis.difficulty}
                    onChange={(e) => setAnalysis({ ...analysis, difficulty: Math.min(5, Math.max(1, parseInt(e.target.value) || 3)) as 1 | 2 | 3 | 4 | 5 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Referencing style</Label>
                  <Input
                    value={analysis.referencingStyle ?? ""}
                    placeholder="e.g. Harvard"
                    onChange={(e) => setAnalysis({ ...analysis, referencingStyle: e.target.value || undefined })}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Sections (comma separated)</Label>
                  <Input
                    value={analysis.sections.join(", ")}
                    onChange={(e) => setAnalysis({ ...analysis, sections: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Rubric (criterion: weight%, one per line)</Label>
                  <Textarea
                    rows={4}
                    value={analysis.rubric.map((r) => `${r.criterion}: ${r.weight}%`).join("\n")}
                    onChange={(e) =>
                      setAnalysis({
                        ...analysis,
                        rubric: e.target.value
                          .split("\n")
                          .map((l) => {
                            const m = l.match(/(.+?)\s*:\s*(\d{1,3})/);
                            return m ? { criterion: m[1].trim(), weight: parseInt(m[2]) } : null;
                          })
                          .filter((r): r is { criterion: string; weight: number } => !!r),
                      })
                    }
                  />
                </div>
              </div>
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
