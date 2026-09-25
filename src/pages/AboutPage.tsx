/**
 * The Home tab, reachable before a keyboard is connected.
 *
 * Someone who arrived without a keyboard -- deciding whether to buy one, or
 * sent here by a link -- can still see what the app does, which keyboards it
 * is for, and the Q&A, all of which sit on the Home tab behind the
 * connection gate. The splash screen's guide links here.
 */
import { StandaloneFrame } from "../components/StandaloneFrame";
import { HomePage } from "./HomePage";

export const ABOUT_PATH = "/about";

export function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <StandaloneFrame onBack={onBack}>
      <HomePage />
    </StandaloneFrame>
  );
}
