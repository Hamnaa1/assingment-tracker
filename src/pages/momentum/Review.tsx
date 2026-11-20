import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reviewWork } from "@/lib/momentum/ai";
import { useMomentum } from "@/lib/momentum/store";
import { LEVEL_STYLES } from "@/lib/momentum/priority";
import type { ReviewResult } from "@/lib/momentum/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Review() {
  const { state, dispatch } = useMomentum();
  const [assignmentId, setAssignmentId] = useState("");
  const [submission, setSubmission] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const assignment = state.assignments.find((a) => a.id === assignmentId);

  const run = () => {
    if (!assignment) {
      toast.error("Choose an assignment first");
      return;
    }
    if (submission.trim().split(/\s+/).length < 50) {
      toast.error("Paste more of your work", { description: "At least a few paragraphs gives the review something to work with." });
      return;
    }
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const r = reviewWork(assignment, submission);
      dispatch({ type: "addReview", review: r });
      setResult(r);
      setRunning(false);
      toast.success("Review complete", { description: "Scroll down for your rubric breakdown and suggestions." });
    }, 2000);
  };

  const scoreColor = (s: number) => (s >= 75 ? "text-brand-success" : s >= 50 ? "text-brand-warning" : "text-brand-error");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Momentum Review</h1>
        <p className="text-sm text-muted-foreground">Check your work against the original brief and rubric before you submit.</p>
        <Badge variant="outline" className="mt-2 border-brand-lilac/50 bg-brand-soft-purple text-brand-charcoal">
          Simulated AI · demo mode — scores are estimates, not guaranteed grades
        </Badge>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Submit work for review</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Assignment</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the assignment this work is for…" />
              </SelectTrigger>
              <SelectContent>
                {state.assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Your work</Label>
            <Textarea
              rows={10}
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="Paste your draft here — the more complete, the more useful the review…"
              className="resize-none"
            />
          </div>
          <Button onClick={run} disabled={running} className="w-fit bg-brand-lavender text-white hover:bg-brand-lavender/90">
            {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
            {running ? "Reviewing against the rubric…" : "Run review"}
          </Button>
        </CardContent>
      </Card>

      {result && assignment && (
        <div className="flex flex-col gap-6">
          {/* Readiness score */}
          <Card className="border-brand-lavender/30 bg-brand-soft-purple/50 shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-6 p-6">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e3ed" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="#8875e8" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - result.readinessScore / 100)}`}
                  />
                </svg>
                <span className="text-3xl font-extrabold text-brand-charcoal">{result.readinessScore}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-brand-charcoal">Submission readiness</p>
                <p className="text-sm text-brand-charcoal/75">
                  AI estimate for "{assignment.title}" based on {result.wordCount} words reviewed against {assignment.rubric.length} rubric criteria.
                  This is guidance, not a guaranteed grade.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rubric breakdown */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Rubric breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {result.rubricBreakdown.map((r) => (
                <div key={r.criterion} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{r.criterion}</span>
                    <span className={cn("text-sm font-extrabold", scoreColor(r.score))}>{r.score}/100</span>
                  </div>
                  <Progress value={r.score} className="h-2 [&>div]:bg-brand-lilac" />
                  <p className="text-xs text-muted-foreground">{r.explanation}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Strengths */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-brand-success" /> Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-success" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Missing */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-brand-warning" /> Missing requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.missing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing obvious missing — every required section was detected.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {result.missing.map((s) => (
                      <li key={s} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-warning" />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Suggestions */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-brand-lavender" /> How to improve
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {result.suggestions.map((s) => (
                <div key={s.what} className="flex flex-col gap-1 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{s.what}</span>
                    <Badge variant="outline" className={cn("text-[11px]", LEVEL_STYLES[s.priority].badge)}>
                      {LEVEL_STYLES[s.priority].label} priority
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground"><span className="font-semibold">Why it matters:</span> {s.why}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-semibold">How:</span> {s.how}</p>
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-lilac" />
                Citations are detected, not verified — always check your references yourself before submitting.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
