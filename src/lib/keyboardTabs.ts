/**
 * Which tabs a keyboard has anything for.
 *
 * The Trackpad tab is the runtime input processor's page: pointer and
 * scroll speed, rotation, the gesture bindings, the pad's own settings. On a
 * keyboard built without that module — GoFortyMax Ortho, or anything else
 * without a pointing device — every one of those is missing, and the page
 * could only open on a warning telling the owner to enable a firmware module
 * they have no use for. A tab that exists to tell you it does not apply is
 * worse than no tab; it reads as a fault.
 *
 * The keyboard says what it has: the custom subsystem listing taken at
 * connection names every module that registered a Studio subsystem. The
 * Trackpad tab appears when `cormoran_rip` is among them and not otherwise.
 * A listing that failed (null) counts as "not there": the page would be
 * unusable either way, and the keyboard's other pages carry on without it.
 */
import { RUNTIME_INPUT_PROCESSOR_SUBSYSTEM_IDENTIFIER } from "../hooks/useRuntimeInputProcessor";

export interface ListedSubsystem {
  identifier?: string;
}

export function keyboardHasTrackpadTab(
  subsystems: readonly ListedSubsystem[] | null | undefined,
): boolean {
  return (
    subsystems?.some(
      (subsystem) =>
        subsystem.identifier === RUNTIME_INPUT_PROCESSOR_SUBSYSTEM_IDENTIFIER,
    ) ?? false
  );
}
