import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMomentum } from "@/lib/momentum/store";
import { toast } from "sonner";

export default function Settings() {
  const { state, dispatch } = useMomentum();
  const [name, setName] = useState(state.studentName);

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
          <CardTitle className="text-lg">Demo data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Momentum stores everything locally in your browser. Reset to restore the original demo assignments, tasks and focus sessions.
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
            blocking, evidence verification and assignment review are simulated demo features in this build; your data
            never leaves this browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
