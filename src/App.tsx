import Friends from "./pages/momentum/Friends";
import StudyPlan from "./pages/momentum/StudyPlan";
import Onboarding from "./pages/momentum/Onboarding";
import CalendarPage from "./pages/momentum/Calendar";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { MomentumProvider } from "./lib/momentum/store";
import MomentumLayout from "./components/momentum/MomentumLayout";
import Dashboard from "./pages/momentum/Dashboard";
import Assignments from "./pages/momentum/Assignments";
import AssignmentDetail from "./pages/momentum/AssignmentDetail";
import Planner from "./pages/momentum/Planner";
import Focus from "./pages/momentum/Focus";
import Review from "./pages/momentum/Review";
import Settings from "./pages/momentum/Settings";
import Auth from "./pages/momentum/Auth";
import OAuthConsent from "./pages/momentum/OAuthConsent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <MomentumProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route element={<MomentumLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/assignments/:id" element={<AssignmentDetail />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/plan" element={<StudyPlan />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/focus" element={<Focus />} />
              <Route path="/review" element={<Review />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/welcome" element={<Onboarding />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MomentumProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
