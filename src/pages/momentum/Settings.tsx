import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarConnections } from "@/components/momentum/CalendarConnections";
import { useMomentum } from "@/lib/momentum/store";
import { toast } from "sonner";

export default function Settings() {
  const { state, dispatch, commit } = useMomentum();
  const [name, setName] = useState(state.studentName);
  useEffect(() => {
    if (window.location.hash === "#calendars") document.getElementById("calendars")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalise your Momentum workspace.</p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button
            className="w-fit bg-brand-lavender text-white hover:bg-brand-lavender/90"
            onClick={() => {
              dispatch({ type: "setName", name: name.trim() || "Alex" });
              toast.success("Saved");
            }}
          >
            Save
          </Button>
        </CardContent>
      </Card>

      <Card id="calendars" className="scroll-mt-6 border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Connected calendars</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarConnections />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Demo data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Your workspace is saved to your account. Reset to restore the original demo assignments, tasks and focus sessions.
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => {
              const save = async () => { try { await commit({ type: "reset" }); toast.success("Demo data restored"); } catch { toast.error("Couldn't restore demo data — check your connection.", { action: { label: "Retry", onClick: () => void save() } }); } }; void save();
            }}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> Reset demo data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">About Momentum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-bold text-foreground">Momentum</span> — Plan smarter. Stay focused. Submit stronger.
          </p>
          <p>
            An AI-powered student productivity and accountability platform. Brief analysis, plan generation and assignment review use a
            real AI model (with an offline fallback). Distraction blocking and evidence verification are simulated demo features in this build. Calendar links are read-only and stored only in your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
