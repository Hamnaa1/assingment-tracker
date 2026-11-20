import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSIGNMENT_TYPES, type BriefAnalysis } from "@/lib/momentum/ai";

export type AssignmentDraft = BriefAnalysis;

const REF_STYLES = ["Harvard", "APA", "MLA", "Chicago", "Vancouver", "OSCOLA", "IEEE"];

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  return (
    <div className="col-span-2 flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={item} aria-label={`${label} ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={`Add to ${label}`} onClick={add}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Every AI-extracted assignment field, editable. */
export function AssignmentForm({ value, onChange, showAiNotice = true }: { value: AssignmentDraft; onChange: (v: AssignmentDraft) => void; showAiNotice?: boolean }) {
  const set = <K extends keyof AssignmentDraft>(k: K, v: AssignmentDraft[K]) => onChange({ ...value, [k]: v });
  const num = (s: string) => (s === "" ? undefined : Math.max(0, parseInt(s) || 0));
  const rubricTotal = value.rubric.reduce((s, r) => s + (r.weight || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-4">
      {showAiNotice && (
        <div className="col-span-2 flex items-start gap-2 rounded-lg border border-brand-warning/40 bg-brand-warning/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-warning" />
          <span>AI-extracted details can be wrong. Check every field — especially the deadline, word count and rubric — and correct anything before generating your plan.</span>
        </div>
      )}
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="af-title">Assignment title</Label>
        <Input id="af-title" value={value.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-module">Module / course</Label>
        <Input id="af-module" value={value.module} onChange={(e) => set("module", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Assignment type</Label>
        <Select value={value.type ?? ""} onValueChange={(v) => set("type", v)}>
          <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
          <SelectContent>{ASSIGNMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="af-desc">Description</Label>
        <Textarea id="af-desc" rows={3} value={value.description ?? ""} onChange={(e) => set("description", e.target.value || undefined)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-deadline">Submission deadline</Label>
        <Input id="af-deadline" type="date" value={value.deadline} onChange={(e) => e.target.value && set("deadline", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-time">Deadline time</Label>
        <Input id="af-time" type="time" value={value.deadlineTime ?? ""} onChange={(e) => set("deadlineTime", e.target.value || undefined)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-words">Word count</Label>
        <Input id="af-words" type="number" min={0} value={value.wordCount ?? ""} onChange={(e) => set("wordCount", num(e.target.value))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-weight">Weighting (%)</Label>
        <Input id="af-weight" type="number" min={0} max={100} value={value.weighting ?? ""} onChange={(e) => set("weighting", e.target.value === "" ? undefined : Math.min(100, num(e.target.value) ?? 0))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Difficulty</Label>
        <Select value={String(value.difficulty)} onValueChange={(v) => set("difficulty", Number(v) as AssignmentDraft["difficulty"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["1 · Easy", "2 · Manageable", "3 · Moderate", "4 · Challenging", "5 · Very hard"].map((l, i) => <SelectItem key={l} value={String(i + 1)}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="af-ref">Referencing style</Label>
        <Input id="af-ref" list="af-ref-styles" placeholder="e.g. Harvard" value={value.referencingStyle ?? ""} onChange={(e) => set("referencingStyle", e.target.value || undefined)} />
        <datalist id="af-ref-styles">{REF_STYLES.map((r) => <option key={r} value={r} />)}</datalist>
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="af-format">Submission format</Label>
        <Input id="af-format" placeholder="e.g. Word document via Turnitin" value={value.submissionFormat ?? ""} onChange={(e) => set("submissionFormat", e.target.value || undefined)} />
      </div>

      <ListEditor label="Required tasks / deliverables" items={value.deliverables} onChange={(v) => set("deliverables", v)} placeholder="Add a deliverable…" />
      <ListEditor label="Required sections" items={value.sections} onChange={(v) => set("sections", v)} placeholder="Add a section…" />
      <ListEditor label="Learning outcomes" items={value.learningOutcomes ?? []} onChange={(v) => set("learningOutcomes", v)} placeholder="Add a learning outcome…" />
      <ListEditor label="Assessment criteria" items={value.assessmentCriteria ?? []} onChange={(v) => set("assessmentCriteria", v)} placeholder="Add a criterion…" />

      <div className="col-span-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Rubric</Label>
          <span className={rubricTotal === 100 ? "text-xs text-muted-foreground" : "text-xs font-semibold text-brand-warning"}>Total {rubricTotal}%</span>
        </div>
        {value.rubric.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input aria-label={`Rubric criterion ${i + 1}`} value={r.criterion} onChange={(e) => set("rubric", value.rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} />
            <Input aria-label={`Rubric weight ${i + 1}`} type="number" min={0} max={100} className="w-20" value={r.weight} onChange={(e) => set("rubric", value.rubric.map((x, j) => (j === i ? { ...x, weight: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) } : x)))} />
            <span className="text-xs text-muted-foreground">%</span>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Remove criterion" onClick={() => set("rubric", value.rubric.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set("rubric", [...value.rubric, { criterion: "", weight: 0 }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add rubric row
        </Button>
      </div>

      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="af-instr">Additional lecturer instructions</Label>
        <Textarea id="af-instr" rows={3} value={value.instructions ?? ""} onChange={(e) => set("instructions", e.target.value || undefined)} />
      </div>
    </div>
  );
}

export function draftFromAssignment(a: AssignmentDraft & { id?: string }): AssignmentDraft {
  const { title, module, deadline, wordCount, weighting, difficulty, deliverables, rubric, sections, referencingStyle, instructions, type, description, deadlineTime, learningOutcomes, assessmentCriteria, submissionFormat } = a;
  return { title, module, deadline, wordCount, weighting, difficulty, deliverables: [...deliverables], rubric: rubric.map((r) => ({ ...r })), sections: [...sections], referencingStyle, instructions, type, description, deadlineTime, learningOutcomes: [...(learningOutcomes ?? [])], assessmentCriteria: [...(assessmentCriteria ?? [])], submissionFormat };
}

export function validateDraft(d: AssignmentDraft): string | null {
  if (!d.title.trim()) return "Assignment title is required";
  if (!d.deadline) return "Set a submission deadline";
  return null;
}
