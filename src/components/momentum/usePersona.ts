import { useMomentum } from "@/lib/momentum/store";
import { personaOf, vocabOf, type ProfileInfo } from "@/lib/momentum/persona";

/** The signed-in user's saved role profile and matching wording. */
export function usePersona() {
  const { state } = useMomentum();
  const profile: ProfileInfo | undefined = state.onboarding?.answers;
  return { profile, persona: personaOf(profile), v: vocabOf(profile) };
}
