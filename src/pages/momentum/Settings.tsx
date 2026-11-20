import { useEffect, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarConnections } from "@/components/momentum/CalendarConnections";
import { useMomentum } from "@/lib/momentum/store";
import { toast } from "sonner";

export default function Settings() {
  const { state, dispatch } = useMomentum();
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

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Make Momentum Yours</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {state.onboarding?.status === "completed" ? "Retake the questionnaire to update your theme, dashboard and study habits. You'll confirm before anything changes." : "Answer a few questions and we'll set up your Study Plan and schedule for you."}
          </p>
          <Button asChild variant="outline" className="w-fit"><Link to="/welcome"><Sparkles className="mr-1.5 h-4 w-4" />{state.onboarding?.status === "completed" ? "Retake onboarding" : "Start onboarding"}</Link></Button>
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
              dispatch({ type: "reset" });
              toast.success("Demo data restored");
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
            An AI-powered student productivity and accountability platform. Brief analysis, plan generation, distraction
            blocking, evidence verification and assignment review are simulated demo features in this build. Calendar links are read-only and stored only in your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
