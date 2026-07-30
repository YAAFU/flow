import Home from "../page";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";

export default function AppPage() {
  return (
    <OnboardingGate>
      <Home />
    </OnboardingGate>
  );
}
