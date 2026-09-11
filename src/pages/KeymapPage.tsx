import {
  useState,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  IconKeyboard,
  IconDeviceFloppy,
  IconChevronUp,
  IconChevronDown,
  IconAlertCircle,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconRestore,
  IconAlertTriangle,
  IconCopy,
  IconInfoCircle,
  IconLink,
  IconPencil,
  IconLock,
  IconRefresh,
  IconPrinter,
} from "@tabler/icons-react";
import { useStudioLockState } from "@cormoran/zmk-studio-react-hook";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { ConnectionContext } from "../components/DeviceConnection";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { KeyboardLayout } from "../components/KeyboardLayout";
import { BrowserKeyInputOverlay } from "../components/BrowserKeyInputOverlay";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { SensorRotationConfig } from "../components/SensorRotationConfig";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { useKeymap, getKeymapLoadingLabel } from "../hooks/useKeymap";
import { usePhysicalLayoutModules } from "../hooks/usePhysicalLayoutModules";
import { useRuntimeSensorRotate } from "../hooks/useRuntimeSensorRotate";
import { useRuntimeMacro } from "../hooks/useRuntimeMacro";
import { useInputStream } from "../hooks/useInputStream";
import { getAvailableLayouts, getLayoutLabel } from "../lib/keyboardLayouts";
import type { BehaviorBinding } from "../hooks/useKeymap";
import { useStudioUnlock } from "../hooks/useStudioUnlock";
import {
  findBaseLayer,
  findTransparentBehaviorId,
  isAltBaseLayer,
  planCopyFromBase,
  type CopyPlan,
} from "../lib/keymap/copyLayer";
import {
  findKeyPressBehaviorId,
  nextKeyPosition,
} from "../lib/keymap/quickAssign";
import { QuickAssignBar } from "../components/keymap/QuickAssignBar";
import { useLanguage } from "../hooks/useLanguage";
import { ResetVersionMenu } from "../components/versionHistory/ResetVersionMenu";
import { VersionDiffModal } from "../components/versionHistory/VersionDiffModal";
import { useKeymapVersionHistory } from "../hooks/versionHistory/useKeymapVersionHistory";
import { useIsTabActive } from "../hooks/useIsTabActive";
import { HexIcon } from "../components/brand/HexIcon";
import { KeymapPrintSheet } from "../components/KeymapPrintSheet";
import { SavedKeymapsMenu } from "../components/savedKeymaps/SavedKeymapsMenu";
import { useSavedKeymaps } from "../hooks/useSavedKeymaps";
import {
  parseShareCode,
  shareCodeFromHash,
  unresolvedBehaviorNames,
  type SavedKeymap,
  type SavedKeymapPayload,
} from "../lib/savedKeymaps";
import { GalleryDialog } from "../components/gallery/GalleryDialog";
import { useGallery } from "../hooks/useGallery";
import {
  fetchGalleryKeymap,
  forgetPost,
  galleryErrorMessage,
  myPostIds,
  publishToGallery,
  rememberPost,
  type GalleryCard,
} from "../lib/gallery";

export function KeymapPage() {
  const { t, language } = useLanguage();
  const connection = useContext(ConnectionContext);
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const keymap = useKeymap();
  const physicalLayoutModules = usePhysicalLayoutModules();
  const sensorRotate = useRuntimeSensorRotate();
  // Defer macro loading (see the effect below): the macro list is only needed
  // to label macro keys, not to paint the preview, so we don't let its RPCs
  // compete with the keymap load. autoLoad:false suppresses the on-mount fetch.
  const runtimeMacro = useRuntimeMacro({ autoLoad: false });
  const inputStream = useInputStream();
  // Snapshots the keymap into IndexedDB after every full load, and drives the
  // "restore a previous version" flow behind the reset dropdown.
  const versionHistory = useKeymapVersionHistory(keymap, t);
  const isTabActive = useIsTabActive();
  // Proactive lock state: the fast-keymap subsystem is unsecured, so the keymap
  // is viewable while Studio is locked. We use this to (a) show a lock badge in
  // place of Save/Reset and (b) prompt for unlock the moment the user tries to
  // edit — rather than letting the edit fail and then reacting.
  const { locked } = useStudioLockState();
  // Proactive unlock gate (opens the shared unlock modal); the reactive
  // fail→modal→retry path is handled inside useKeymap via runWithUnlock.
  const { requireUnlock: requireUnlocked } = useStudioUnlock();

  // Local UI state
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<number | null>(
    null,
  );
  const [showKeycodeSelector, setShowKeycodeSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  // "Copy from Base", offered on Alt Base only. `copyProgress` is non-null
  // while it runs: one key is one RPC, so on a 79-key board this is a visible
  // stretch of time rather than an instant, and it has to say so.
  const [copyPlan, setCopyPlan] = useState<CopyPlan | null>(null);
  const [copyProgress, setCopyProgress] = useState<number | null>(null);
  // The bottom keyboard: off until asked for. See QuickAssignBar for why it
  // is not the default way to edit a key.
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  // True only after a run has walked off the end of the board. Kept apart
  // from "no key selected", which is also how the panel starts — saying "that
  // was the last key" to someone who has not set one yet would be nonsense.
  const [quickAssignFinished, setQuickAssignFinished] = useState(false);
  // Popup listing the device's deleted (restorable) layers, opened from the
  // restore button in the layer toolbar.
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // Guards the deferred macro load so it fires once per keymap load; reset when
  // a new load starts (see the effect below).
  const macrosRequestedRef = useRef(false);

  // Get current layer
  const currentLayer = useMemo(() => {
    if (!keymap.keymap?.layers) return null;
    return keymap.keymap.layers[selectedLayerIndex] ?? null;
  }, [keymap.keymap?.layers, selectedLayerIndex]);

  // Get current physical layout
  const currentLayout = useMemo(() => {
    if (!keymap.physicalLayouts?.layouts) return null;
    const index = keymap.physicalLayouts.activeLayoutIndex;
    return keymap.physicalLayouts.layouts[index] ?? null;
  }, [keymap.physicalLayouts]);

  // Named keymaps the user keeps in this browser. Deliberately usable in demo
  // mode: laying out a keymap before the keyboard arrives is a real thing, and
  // the record is matched to a keyboard by shape rather than by device.
  const savedKeymaps = useSavedKeymaps({
    layers: keymap.keymap?.layers,
    behaviors: keymap.behaviors,
    connected: currentLayout
      ? {
          layoutName: currentLayout.name,
          keyCount: currentLayout.keys.length,
        }
      : null,
    isDemo: connection.isDemo,
    setBinding: keymap.setBinding,
    addLayer: keymap.addLayer,
  });
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  // The link produced by "Copy a share link", kept on screen so it can be
  // copied by hand when the clipboard is unavailable (and read before sending
  // when it is).
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // A keymap that arrived in the address bar, waiting to be accepted. Held
  // rather than added: opening a link is not consent to fill someone's list.
  const [incoming, setIncoming] = useState<SavedKeymapPayload | null>(null);

  // The public gallery. Opened from the My keymaps menu rather than given a
  // tab of its own: it is a way a keymap arrives, like a file or a link, not a
  // separate place in the app.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const gallery = useGallery();
  const [myPosts, setMyPosts] = useState<ReadonlySet<string>>(() =>
    myPostIds(),
  );
  const [galleryBusyId, setGalleryBusyId] = useState<string | null>(null);

  // Layers for the selector
  const layersForSelector = useMemo(() => {
    if (!keymap.keymap?.layers) return [];
    return keymap.keymap.layers.map((l) => ({ id: l.id, name: l.name }));
  }, [keymap.keymap?.layers]);

  // Get current binding for selected key
  const currentBinding = useMemo(() => {
    if (selectedKeyPosition === null || !currentLayer) return null;
    return currentLayer.bindings[selectedKeyPosition] ?? null;
  }, [selectedKeyPosition, currentLayer]);

  // `requireUnlocked` (from the shared unlock gate) guards an edit action: if
  // Studio is locked it opens the unlock modal and returns false so the caller
  // bails out. `unknown` lock state is treated as unlocked (optimistic) — a
  // rare edit during that brief window still surfaces the modal reactively when
  // the request fails (see useKeymap's runWithUnlock).
  //
  // `withUnlock` wraps an edit behind that gate *and* resumes it after unlock:
  // run the action now if unlocked, otherwise hand it to the modal so it
  // replays the exact operation the user attempted once they unlock — instead
  // of silently dropping the click.
  const withUnlock = useCallback(
    (action: () => void | Promise<void>) => {
      if (!requireUnlocked(action)) return;
      void action();
    },
    [requireUnlocked],
  );

  // Why a file or a link was refused. Shared between the two because they are
  // the same document arriving by different roads, and so fail the same way.
  const describeRefusal = useCallback(
    (reason: string) => {
      const reasons: Record<string, string> = {
        "too-large": t("That file is too big to be a keymap."),
        "not-json": t("That file is not JSON."),
        "not-a-keymap": t("That file is not a Keeb-On! Studio keymap."),
        "not-a-share-code": t("That link does not carry a keymap."),
        "newer-format": t(
          "That keymap was made by a newer version of Keeb-On! Studio.",
        ),
        malformed: t("That keymap file is damaged."),
      };
      return reasons[reason] ?? reasons.malformed;
    },
    [t],
  );

  // A file that came from someone else is data, not a command: it lands in the
  // list and is only written to the keyboard if the user then loads it.
  const handleImportFile = useCallback(
    async (file: File) => {
      const result = await savedKeymaps.importFromFile(file);
      if (result.ok) {
        setLoadNotice(
          t('Added "{{name}}" to your keymaps.', { name: result.record.name }),
        );
        return;
      }
      setLoadNotice(describeRefusal(result.reason));
    },
    [savedKeymaps, describeRefusal, t],
  );

  const handleShare = useCallback(
    async (record: Parameters<typeof savedKeymaps.shareLink>[0]) => {
      const url = await savedKeymaps.shareLink(record);
      if (!url) return;
      setShareUrl(url);
      try {
        await navigator.clipboard?.writeText(url);
        setLoadNotice(t("Share link copied."));
      } catch {
        // Clipboard access is refused often enough -- an insecure origin, a
        // permission prompt declined -- that the link is shown either way.
        setLoadNotice(t("Copy this link to share the keymap."));
      }
    },
    [savedKeymaps, t],
  );

  // A keymap arriving in the address bar. The code is read once and the
  // fragment is cleared straight away: it should not survive a refresh, and a
  // page whose URL is two thousand characters of base64 is its own problem.
  const sharedCodeHandled = useRef(false);
  useEffect(() => {
    if (sharedCodeHandled.current) return;
    const code = shareCodeFromHash(window.location.hash);
    if (!code) return;
    sharedCodeHandled.current = true;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    void parseShareCode(code).then((result) => {
      if (result.ok) setIncoming(result.keymap);
      else setLoadNotice(describeRefusal(result.reason));
    });
  }, [describeRefusal]);

  // The offer renders under a full-height keyboard, so someone who followed a
  // link would land on the board with the reason they came for off-screen.
  //
  // `isLoading` is in the dependencies because the card appears before the
  // keymap does: scrolling at that moment moves nothing (the page is still
  // short), and the board then loads and pushes the card below the fold. So it
  // scrolls again once the layout has settled.
  const incomingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!incoming) return;
    // Optional call: jsdom has no layout and so no scrollIntoView, and this is
    // presentation -- not worth failing a render over.
    incomingRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
  }, [incoming, keymap.isLoading]);

  // Publishing follows exactly the rule a share link follows: it needs a real
  // keyboard. The button is not rendered in demo mode, and the Worker refuses
  // a board it does not know -- neither is a security boundary, both are the
  // gallery staying about these keyboards.
  const handlePublish = useCallback(
    async (record: SavedKeymap) => {
      const board = connection.deviceName;
      if (!board) return;
      const result = await publishToGallery(
        {
          schemaVersion: record.schemaVersion,
          name: record.name,
          description: record.description,
          target: record.target,
          behaviors: record.behaviors,
          layers: record.layers,
          fromDemo: record.fromDemo,
        },
        board,
      );
      if (!result.ok) {
        setLoadNotice(galleryErrorMessage(result.error, t, result.limit));
        return;
      }
      setMyPosts(rememberPost(result.value.id));
      setLoadNotice(
        t('Published "{{name}}" to the gallery.', { name: record.name }),
      );
      // The list this browser is holding is now one post out of date.
      void gallery.refresh();
    },
    [connection.deviceName, gallery, t],
  );

  // Same rule as a file and a link: it lands in My keymaps, and putting it on
  // the keyboard stays a separate, deliberate step.
  const handleOpenFromGallery = useCallback(
    async (post: GalleryCard) => {
      setGalleryBusyId(post.id);
      const result = await fetchGalleryKeymap(post.id);
      setGalleryBusyId(null);
      if (!result.ok) {
        setLoadNotice(galleryErrorMessage(result.error, t));
        return;
      }
      const stored = await savedKeymaps.addKeymap(result.value);
      setGalleryOpen(false);
      setLoadNotice(
        stored
          ? t('Added "{{name}}" to your keymaps.', { name: stored.name })
          : t("That keymap could not be saved."),
      );
    },
    [savedKeymaps, t],
  );

  const handleReportPost = useCallback(
    async (post: GalleryCard) => {
      setGalleryBusyId(post.id);
      const error = await gallery.report(post.id);
      setGalleryBusyId(null);
      setLoadNotice(
        error
          ? galleryErrorMessage(error, t)
          : t("Reported. The maintainer will take a look."),
      );
    },
    [gallery, t],
  );

  const handleDeletePost = useCallback(
    async (post: GalleryCard) => {
      setGalleryBusyId(post.id);
      const error = await gallery.remove(post.id);
      setGalleryBusyId(null);
      if (error) {
        setLoadNotice(galleryErrorMessage(error, t));
        return;
      }
      setMyPosts(forgetPost(post.id));
      setLoadNotice(t("Removed from the gallery."));
    },
    [gallery, t],
  );

  const handleAcceptIncoming = useCallback(async () => {
    if (!incoming) return;
    const stored = await savedKeymaps.addKeymap(incoming);
    setIncoming(null);
    setLoadNotice(
      stored
        ? t('Added "{{name}}" to your keymaps.', { name: stored.name })
        : t("That keymap could not be saved."),
    );
  }, [incoming, savedKeymaps, t]);

  // Names the behaviors a load could not match. The list is capped because the
  // point is to recognise what is missing, not to read every instance of it.
  const formatBehaviorNames = useCallback(
    (names: string[]) => {
      const shown = names.slice(0, 3);
      const listed = new Intl.ListFormat(language, {
        style: "long",
        type: "conjunction",
      }).format(shown);
      const rest = names.length - shown.length;
      return rest > 0
        ? t("{{names}} and {{count}} more", { names: listed, count: rest })
        : listed;
    },
    [language, t],
  );

  // A record whose layers did not all fit, kept so the notice can offer to make
  // room and load it again.
  const [needsLayers, setNeedsLayers] = useState<SavedKeymap | null>(null);

  // Loading a saved keymap writes through the same edit path as the editor, so
  // it lands as unsaved changes the user reviews and then Saves -- rather than
  // going straight to the keyboard on the one action most likely to be a slip.
  const runLoad = useCallback(
    (record: SavedKeymap, options?: { addMissingLayers?: boolean }) =>
      withUnlock(async () => {
        const outcome = await savedKeymaps.load(record, options);
        const notes = [
          t("Loaded {{count}} keys as unsaved changes.", {
            count: outcome.written,
          }),
        ];
        if (outcome.addedLayers > 0) {
          notes.push(
            t("Added {{count}} layers to make room.", {
              count: outcome.addedLayers,
            }),
          );
        }
        if (outcome.unresolved.length > 0) {
          // Naming the behavior is the whole answer; a bare count leaves the
          // user comparing two keyboards key by key to find it.
          const names = unresolvedBehaviorNames(outcome.unresolved);
          notes.push(
            names.length > 0
              ? t(
                  "{{count}} keys were left alone: this keyboard has no {{names}}.",
                  {
                    count: outcome.unresolved.length,
                    names: formatBehaviorNames(names),
                  },
                )
              : t(
                  "{{count}} keys were left alone: this keyboard has no such behavior.",
                  { count: outcome.unresolved.length },
                ),
          );
        }
        if (outcome.skippedLayers > 0) {
          notes.push(
            t("{{count}} layers were skipped: this keyboard has fewer.", {
              count: outcome.skippedLayers,
            }),
          );
        }
        setLoadNotice(notes.join(" "));
        // Only offer to add layers when adding them is what is missing --
        // after a run that already tried, a remaining shortfall means the
        // keyboard is out of slots and the button would just fail again.
        setNeedsLayers(
          outcome.skippedLayers > 0 && !options?.addMissingLayers
            ? record
            : null,
        );
      }),
    [savedKeymaps, t, withUnlock, formatBehaviorNames],
  );

  const handleLoadSaved = useCallback(
    (record: SavedKeymap) => runLoad(record),
    [runLoad],
  );

  // Handle key click
  const handleKeyClick = useCallback(
    (keyPosition: number) =>
      withUnlock(() => {
        setSelectedKeyPosition(keyPosition);
        setQuickAssignFinished(false);
        // With the bottom keyboard open, a click on the board chooses what to
        // set next rather than opening the dialog over it. Opening both would
        // put a modal on top of the panel the user is working in.
        if (!quickAssignOpen) {
          setShowKeycodeSelector(true);
        }
      }),
    [withUnlock, quickAssignOpen],
  );

  // --- The bottom keyboard -------------------------------------------------

  // Key positions in the order the layout draws them. A layout may skip
  // numbers (ErgoTrack's gesture positions sit above its physical keys), so
  // "the next key" means the next one here, not the next integer.
  const layoutPositions = useMemo(
    () => currentLayout?.keys.map((_, index) => index) ?? [],
    [currentLayout],
  );

  const keyPressBehaviorId = useMemo(
    () => findKeyPressBehaviorId(keymap.behaviors),
    [keymap.behaviors],
  );

  // The keycode currently on the selected key, so the bottom keyboard can
  // highlight it. Only meaningful when that key is a plain key press.
  const quickAssignSelectedCode = useMemo(() => {
    if (!currentBinding || currentBinding.behaviorId !== keyPressBehaviorId) {
      return -1;
    }
    return currentBinding.param1;
  }, [currentBinding, keyPressBehaviorId]);

  const handleQuickAssign = useCallback(
    (code: number) =>
      withUnlock(async () => {
        if (
          !currentLayer ||
          selectedKeyPosition === null ||
          keyPressBehaviorId === null
        ) {
          return;
        }
        const ok = await keymap.setBinding(
          currentLayer.id,
          selectedKeyPosition,
          {
            behaviorId: keyPressBehaviorId,
            param1: code,
            param2: 0,
          },
        );
        // Only advance when the key actually took. Moving on after a refusal
        // would leave a gap the user has no reason to look for.
        if (ok) {
          const next = nextKeyPosition(layoutPositions, selectedKeyPosition);
          setSelectedKeyPosition(next);
          setQuickAssignFinished(next === null);
        }
      }),
    [
      currentLayer,
      selectedKeyPosition,
      keyPressBehaviorId,
      keymap,
      layoutPositions,
      withUnlock,
    ],
  );

  // Handle key reset
  const handleKeyReset = useCallback(
    (keyPosition: number) =>
      withUnlock(async () => {
        if (!currentLayer) return;
        await keymap.resetBinding(currentLayer.id, keyPosition);
      }),
    [currentLayer, keymap, withUnlock],
  );

  // Handle key reset-to-default (in-memory edit; becomes an unsaved change)
  const handleKeyResetToDefault = useCallback(
    (keyPosition: number) =>
      withUnlock(async () => {
        if (!currentLayer) return;
        await keymap.resetBindingToDefault(currentLayer.id, keyPosition);
      }),
    [currentLayer, keymap, withUnlock],
  );

  // Handle binding selection
  const handleBindingSelect = useCallback(
    (binding: BehaviorBinding) =>
      withUnlock(async () => {
        if (!currentLayer || selectedKeyPosition === null) return;
        await keymap.setBinding(currentLayer.id, selectedKeyPosition, binding);
        setShowKeycodeSelector(false);
        setSelectedKeyPosition(null);
      }),
    [currentLayer, selectedKeyPosition, keymap, withUnlock],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await keymap.saveChanges();
    } finally {
      setIsSaving(false);
    }
  }, [keymap]);

  // Re-read the keymap from the keyboard. The page keeps its state across tab
  // switches now, so this is the way to pick up changes made outside the app
  // (or to retry after a failed load). Unsaved edits are staged on the device
  // itself, so a reload shows them again rather than dropping them.
  const handleReload = useCallback(() => {
    void keymap.loadKeymapData();
  }, [keymap]);

  // Handle discard
  const handleDiscard = useCallback(async () => {
    if (!confirm(t("Are you sure you want to discard all changes?"))) return;
    setIsDiscarding(true);
    try {
      await keymap.discardChanges();
    } finally {
      setIsDiscarding(false);
    }
  }, [keymap, t]);

  // Handle reset-to-default: reset the persistent keymap to the hard-coded
  // default, then close the confirmation dialog. Gated on unlock (it edits +
  // saves) like every other keymap edit.
  const handleResetToDefault = useCallback(
    () =>
      withUnlock(async () => {
        setIsResetting(true);
        try {
          const ok = await keymap.resetToDefault();
          if (ok) {
            setShowResetDialog(false);
          }
        } finally {
          setIsResetting(false);
        }
      }),
    [keymap, withUnlock],
  );

  // Handle layer move up
  // Whether "Copy from Base" belongs on screen right now, and what it would do.
  // Recomputed as the layer changes so the button can say the real numbers
  // rather than a generic warning.
  const copyFromBase = useMemo(() => {
    const layers = keymap.keymap?.layers;
    if (!layers || !currentLayer || !isAltBaseLayer(currentLayer)) return null;
    const base = findBaseLayer(layers);
    if (!base || base.id === currentLayer.id) return null;
    return {
      base,
      plan: planCopyFromBase(
        base,
        currentLayer,
        findTransparentBehaviorId(keymap.behaviors),
      ),
    };
  }, [keymap.keymap?.layers, keymap.behaviors, currentLayer]);

  const runCopyFromBase = useCallback(
    async (plan: CopyPlan) => {
      if (!currentLayer) return;
      setCopyPlan(null);
      setCopyProgress(0);
      try {
        // One key at a time and in order: the RPC is per-binding, and firing
        // them all at once would race the transport rather than go faster.
        // A key the device refuses stops the run -- finishing a half-copied
        // layer silently would be worse than stopping where it broke.
        for (const [index, write] of plan.writes.entries()) {
          const ok = await keymap.setBinding(
            currentLayer.id,
            write.keyPosition,
            write.binding,
          );
          if (!ok) break;
          setCopyProgress(index + 1);
        }
      } finally {
        setCopyProgress(null);
      }
    },
    [currentLayer, keymap],
  );

  const handleCopyFromBase = useCallback(() => {
    if (!copyFromBase) return;
    withUnlock(() => {
      // Nothing to destroy means nothing to ask about. A confirmation that
      // always appears is one nobody reads by the third time.
      if (copyFromBase.plan.overwrites === 0) {
        return runCopyFromBase(copyFromBase.plan);
      }
      setCopyPlan(copyFromBase.plan);
    });
  }, [copyFromBase, runCopyFromBase, withUnlock]);

  const handleMoveLayerUp = useCallback(
    () =>
      withUnlock(async () => {
        if (selectedLayerIndex <= 0) return;
        const success = await keymap.moveLayer(
          selectedLayerIndex,
          selectedLayerIndex - 1,
        );
        if (success) {
          setSelectedLayerIndex(selectedLayerIndex - 1);
        }
      }),
    [selectedLayerIndex, keymap, withUnlock],
  );

  // Handle layer move down
  const handleMoveLayerDown = useCallback(
    () =>
      withUnlock(async () => {
        if (!keymap.keymap?.layers) return;
        if (selectedLayerIndex >= keymap.keymap.layers.length - 1) return;
        const success = await keymap.moveLayer(
          selectedLayerIndex,
          selectedLayerIndex + 1,
        );
        if (success) {
          setSelectedLayerIndex(selectedLayerIndex + 1);
        }
      }),
    [selectedLayerIndex, keymap, withUnlock],
  );

  // Handle add layer
  const handleAddLayer = useCallback(
    () =>
      withUnlock(async () => {
        const result = await keymap.addLayer();
        if (result) {
          // Select the new layer
          setSelectedLayerIndex(result.index);
        }
      }),
    [keymap, withUnlock],
  );

  // Handle delete layer
  const handleDeleteLayer = useCallback(
    () =>
      withUnlock(async () => {
        if (!keymap.keymap?.layers || keymap.keymap.layers.length <= 1) return;
        if (!confirm(t("Are you sure you want to delete this layer?"))) return;

        const success = await keymap.removeLayer(selectedLayerIndex);
        if (success) {
          // Adjust selected index if we deleted the last layer
          if (selectedLayerIndex >= keymap.keymap.layers.length - 1) {
            setSelectedLayerIndex(Math.max(0, selectedLayerIndex - 1));
          }
        }
      }),
    [selectedLayerIndex, keymap, t, withUnlock],
  );

  // Handle restore of a single deleted layer (picked from the restore popup).
  // Restores the chosen layer id at the end of the layer list and selects it.
  const handleRestoreLayer = useCallback(
    (layerId: number) => {
      setShowRestoreMenu(false);
      withUnlock(async () => {
        const atIndex = keymap.keymap?.layers.length ?? 0;
        const layer = await keymap.restoreLayer(layerId, atIndex);
        if (layer) {
          setSelectedLayerIndex(atIndex);
        }
      });
    },
    [keymap, withUnlock],
  );

  // Handle "restore all": restore every deleted layer in id order, appending
  // each to the end. removedLayerIds is snapshotted first since it shrinks as
  // each restore completes, and atIndex is advanced manually (the closure's
  // keymap.layers length is the render snapshot, so it doesn't grow mid-loop).
  const handleRestoreAllLayers = useCallback(() => {
    setShowRestoreMenu(false);
    withUnlock(async () => {
      const ids = [...keymap.removedLayerIds];
      if (ids.length === 0) return;
      let atIndex = keymap.keymap?.layers.length ?? 0;
      for (const layerId of ids) {
        const layer = await keymap.restoreLayer(layerId, atIndex);
        if (layer) atIndex += 1;
      }
      if (atIndex > 0) setSelectedLayerIndex(atIndex - 1);
    });
  }, [keymap, withUnlock]);

  // Handle open rename dialog
  const handleOpenRenameDialog = useCallback(
    () =>
      withUnlock(() => {
        if (!keymap.keymap?.layers) return;
        const layer = keymap.keymap.layers[selectedLayerIndex];
        if (!layer) return;
        setRenameValue(layer.name);
        setShowRenameDialog(true);
      }),
    [keymap.keymap?.layers, selectedLayerIndex, withUnlock],
  );

  // Handle rename confirm
  const handleRenameConfirm = useCallback(async () => {
    if (!keymap.keymap?.layers) return;
    const layer = keymap.keymap.layers[selectedLayerIndex];
    if (!layer) return;
    setIsRenaming(true);
    try {
      await keymap.setLayerName(layer.id, renameValue);
      setShowRenameDialog(false);
    } finally {
      setIsRenaming(false);
    }
  }, [keymap, selectedLayerIndex, renameValue]);

  useEffect(() => {
    if (
      inputStream.activeLayerIndex === null ||
      !keymap.keymap?.layers[inputStream.activeLayerIndex]
    ) {
      return;
    }

    setSelectedLayerIndex(inputStream.activeLayerIndex);
  }, [inputStream.activeLayerIndex, keymap.keymap?.layers]);

  // Stream mode highlights (and beeps on) every key press, which only makes
  // sense while the Keymap tab is on screen. The page stays mounted when you
  // switch tabs, so turn the stream off on the way out instead of letting it
  // keep chirping in the background.
  const { isEnabled: isStreamEnabled, toggleStream } = inputStream;
  useEffect(() => {
    if (!isTabActive && isStreamEnabled) {
      void toggleStream();
    }
  }, [isTabActive, isStreamEnabled, toggleStream]);

  // Re-ask for the non-key modules when the active physical layout changes.
  // A real keyboard's trackpads do not move when you switch layout, so this
  // costs it one repeated answer; demo mode stands in for two different
  // keyboards, and only one of them has trackpads, so without this it would
  // draw ErgoTrack's pads underneath the GoFortyMax grid.
  const { loadModules: loadPhysicalLayoutModules } = physicalLayoutModules;
  const activePhysicalLayoutIndex = keymap.physicalLayouts?.activeLayoutIndex;
  useEffect(() => {
    if (activePhysicalLayoutIndex === undefined) return;
    void loadPhysicalLayoutModules();
  }, [activePhysicalLayoutIndex, loadPhysicalLayoutModules]);

  // Load the runtime-macro list as the FINAL step of the keymap tab load: only
  // after the keymap has fully loaded (preview + background behaviors/layers) so
  // the macro RPCs (list_macros / get_macro_global_settings) run last instead of
  // competing with the preview. Fires once per load; reset when a load restarts.
  const { isAvailable: isMacroAvailable, loadMacros: loadRuntimeMacros } =
    runtimeMacro;
  useEffect(() => {
    if (keymap.isLoading) {
      macrosRequestedRef.current = false;
      return;
    }
    if (
      keymap.isFullyLoaded &&
      isMacroAvailable &&
      !macrosRequestedRef.current
    ) {
      macrosRequestedRef.current = true;
      void loadRuntimeMacros();
    }
  }, [
    keymap.isLoading,
    keymap.isFullyLoaded,
    isMacroAvailable,
    loadRuntimeMacros,
  ]);

  return (
    <div className="keymap-print-root p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <HexIcon>
              <IconKeyboard
                size={24}
                className="text-[var(--color-electric)]"
              />
            </HexIcon>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text)]">
                {t("Keymap")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("Configure key bindings and layers")}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {connection.isConnected && keymap.keymap && (
            <div className="flex items-center gap-2 ml-auto">
              {inputStream.isAvailable && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("Stream")}
                  </span>
                  <Switch.Root
                    checked={inputStream.isEnabled}
                    onCheckedChange={() => void inputStream.toggleStream()}
                    disabled={inputStream.isToggling || keymap.isLoading}
                    aria-label={t("Toggle stream mode")}
                    className="w-10 h-5 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-border)] border border-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Switch.Thumb className="block w-4 h-4 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                  </Switch.Root>
                </div>
              )}
              {/* Reading is allowed while locked, so Reload sits outside the
                  lock branch below. */}
              <button
                className="btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
                onClick={handleReload}
                disabled={keymap.isLoading}
                title={t("Reload the keymap from the keyboard")}
              >
                <IconRefresh
                  size={16}
                  className={keymap.isLoading ? "animate-spin" : undefined}
                />
                {t("Reload")}
              </button>
              {/* The sheet is always rendered (hidden on screen), so Cmd+P
                  produces the same pages without going through this button. */}
              {currentLayout && keymap.keymap && (
                <button
                  className="btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
                  onClick={() => window.print()}
                  title={t("Print one page per layer")}
                >
                  <IconPrinter size={16} />
                  {t("Print")}
                </button>
              )}
              {/* When Studio is locked, editing is disabled — show a lock badge
                  (click to unlock) instead of the Save / Reset controls. */}
              {locked ? (
                <button
                  type="button"
                  onClick={() => requireUnlocked()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 transition-colors"
                  title={t("Studio is locked — click to unlock")}
                >
                  <IconLock size={16} />
                  {t("Locked")}
                </button>
              ) : (
                <>
                  {/* Reset, Discard and every captured version live in one
                      dropdown — see ResetVersionMenu. */}
                  <SavedKeymapsMenu
                    keymaps={savedKeymaps.keymaps}
                    canSave={savedKeymaps.canSave}
                    canShare={savedKeymaps.canShare}
                    isDurable={savedKeymaps.isDurable}
                    compatibility={savedKeymaps.compatibility}
                    onSave={(name, description) => {
                      void savedKeymaps.save(name, description);
                    }}
                    onLoad={handleLoadSaved}
                    onDelete={(record) => {
                      void savedKeymaps.remove(record.id);
                    }}
                    onExport={savedKeymaps.exportToFile}
                    onImport={handleImportFile}
                    onShare={(record) => {
                      void handleShare(record);
                    }}
                    onPublish={(record) => {
                      void handlePublish(record);
                    }}
                    onBrowseGallery={() => {
                      setGalleryOpen(true);
                      void gallery.refresh();
                    }}
                    disabled={keymap.isLoading}
                  />
                  <div className="flex-shrink-0">
                    <ResetVersionMenu
                      versions={versionHistory.versions}
                      onSelectVersion={versionHistory.selectVersion}
                      disabled={keymap.isLoading}
                      isBusy={
                        isResetting || isDiscarding || versionHistory.isBusy
                      }
                      resetToDefault={{
                        description: keymap.isFastKeymapAvailable
                          ? t(
                              "Restores the keyboard's built-in default keymap and writes it to flash immediately.",
                            )
                          : t(
                              'This keyboard cannot reset the keymap on its own. To clear the keymap, use "Reset all settings" in the Settings tab, which restores every setting to its firmware default.',
                            ),
                        onSelect: () => setShowResetDialog(true),
                        disabled:
                          !keymap.isFastKeymapAvailable ||
                          isResetting ||
                          keymap.isLoading,
                      }}
                      discard={{
                        description: t(
                          "Drops the unsaved edits in keyboard memory and reloads the keymap stored on the keyboard.",
                        ),
                        onSelect: () => void handleDiscard(),
                        disabled: !keymap.hasUnsavedChanges || isDiscarding,
                      }}
                    />
                  </div>
                  <button
                    className="btn-electric text-sm flex items-center gap-1.5"
                    onClick={handleSave}
                    disabled={
                      isSaving || !keymap.hasUnsavedChanges || keymap.isLoading
                    }
                  >
                    {isSaving ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <IconDeviceFloppy size={16} />
                    )}
                    {t("Save")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Not Connected State */}
        {!connection.isConnected && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Connect your keyboard to edit keymaps")}
            </p>
          </div>
        )}

        {/* Error State (unlock errors are handled by the shared unlock modal) */}
        {keymap.error && (
          <div
            role="alert"
            className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3"
          >
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">{t(keymap.error)}</p>
          </div>
        )}
        {inputStream.error && (
          <div
            role="alert"
            className="glass-card p-4 mb-4 border-red-500/20 bg-red-500/10 flex items-center gap-3"
          >
            <IconAlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">{t(inputStream.error)}</p>
            <button
              className="ml-auto text-xs text-red-300 hover:text-red-200"
              onClick={inputStream.clearError}
            >
              {t("Dismiss")}
            </button>
          </div>
        )}
        {/* Loading State */}
        {connection.isConnected && keymap.isLoading && (
          <LoadingIndicator
            className="mb-6"
            label={getKeymapLoadingLabel(t, keymap.loadingProgress)}
            current={keymap.loadingProgress?.current}
            total={keymap.loadingProgress?.total}
          />
        )}

        {/* Main Content */}
        {connection.isConnected && keymap.keymap && currentLayout && (
          <>
            {/* Layer Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div
                className="flex gap-2 flex-1 overflow-x-auto pb-2 basis-full sm:basis-auto"
                role="group"
                aria-label={t("Keymap layers")}
              >
                {keymap.keymap.layers.map((layer, index) => (
                  <button
                    key={layer.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      index === selectedLayerIndex
                        ? "bg-[var(--color-electric)]/20 text-[var(--color-electric)] border border-[var(--color-electric)]/30"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                    aria-pressed={index === selectedLayerIndex}
                  >
                    {layer.name || t("Layer {{id}}", { id: index })}
                  </button>
                ))}
              </div>

              {/* Layer Management Buttons */}
              <Tooltip.Provider delayDuration={200}>
                <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2 ml-auto">
                  {/* Layer Sorting Label */}
                  <span className="text-xs text-[var(--color-text-muted)] mr-1">
                    {t("Sort")}:
                  </span>

                  {/* Move Up Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleMoveLayerUp}
                        disabled={selectedLayerIndex <= 0}
                        aria-label={t("Move layer up (higher priority)")}
                      >
                        <IconChevronUp
                          size={16}
                          className="text-[var(--color-text-muted)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("Move layer up (higher priority)")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Move Down Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleMoveLayerDown}
                        disabled={
                          selectedLayerIndex >= keymap.keymap.layers.length - 1
                        }
                        aria-label={t("Move layer down (lower priority)")}
                      >
                        <IconChevronDown
                          size={16}
                          className="text-[var(--color-text-muted)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("Move layer down (lower priority)")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>

                {/* Layer Add/Delete/Restore Buttons */}
                <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-2">
                  {/* Copy from Base — only on Alt Base, which is the one layer
                      meant to hold a whole layout rather than a few keys over
                      a transparent field. */}
                  {copyFromBase && (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={handleCopyFromBase}
                          disabled={
                            copyProgress !== null ||
                            copyFromBase.plan.writes.length === 0
                          }
                          aria-label={t("Copy from Base")}
                        >
                          {copyProgress !== null ? (
                            <IconLoader2
                              size={16}
                              className="animate-spin text-[var(--color-electric)]"
                            />
                          ) : (
                            <IconCopy
                              size={16}
                              className="text-[var(--color-text-muted)]"
                            />
                          )}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                          sideOffset={5}
                        >
                          {copyProgress !== null
                            ? t("Copying… {{done}} / {{total}}", {
                                done: copyProgress,
                                total: copyFromBase.plan.writes.length,
                              })
                            : copyFromBase.plan.writes.length === 0
                              ? t("This layer already matches Base")
                              : t("Copy from Base")}
                          <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  )}

                  {/* Rename Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleOpenRenameDialog}
                        aria-label={t("Rename current layer")}
                      >
                        <IconPencil
                          size={16}
                          className="text-[var(--color-text-muted)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("Rename current layer")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Add Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleAddLayer}
                        disabled={
                          keymap.availableLayers <= keymap.keymap.layers.length
                        }
                        aria-label={t("Add new layer")}
                      >
                        <IconPlus
                          size={16}
                          className="text-[var(--color-neon)]"
                        />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("Add new layer")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Delete Layer Button */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={handleDeleteLayer}
                        disabled={keymap.keymap.layers.length <= 1}
                        aria-label={t("Delete current layer")}
                      >
                        <IconTrash size={16} className="text-red-400" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                        sideOffset={5}
                      >
                        {t("Delete current layer")}
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  {/* Restore Layer Button — opens a popup listing the device's
                      deleted (restorable) layers: a "restore all" action on top,
                      then one row per deleted layer. */}
                  <div className="relative">
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          className="p-2 rounded-lg hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => setShowRestoreMenu((open) => !open)}
                          disabled={keymap.removedLayerIds.length === 0}
                          aria-label={t("Restore deleted layer")}
                          aria-haspopup="menu"
                          aria-expanded={showRestoreMenu}
                        >
                          <IconRestore
                            size={16}
                            className="text-[var(--color-electric)]"
                          />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50"
                          sideOffset={5}
                        >
                          {keymap.removedLayerIds.length > 0
                            ? t("Restore deleted layer ({{count}} available)", {
                                count: keymap.removedLayerIds.length,
                              })
                            : t("No deleted layers to restore")}
                          <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    {showRestoreMenu && keymap.removedLayerIds.length > 0 && (
                      <>
                        {/* Click-away backdrop */}
                        <button
                          type="button"
                          aria-hidden="true"
                          tabIndex={-1}
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={() => setShowRestoreMenu(false)}
                        />
                        <div
                          role="menu"
                          aria-label={t("Restore deleted layer")}
                          className="absolute right-0 top-full mt-1 z-50 min-w-[12rem] max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-xl py-1"
                        >
                          <button
                            role="menuitem"
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left text-[var(--color-electric)] hover:bg-[var(--color-border)]"
                            onClick={handleRestoreAllLayers}
                          >
                            <IconRestore size={14} />
                            {t("Restore all deleted layers ({{count}})", {
                              count: keymap.removedLayerIds.length,
                            })}
                          </button>
                          <div className="my-1 border-t border-[var(--color-border)]" />
                          {keymap.removedLayerIds.map((layerId) => (
                            <button
                              key={`restore-${layerId}`}
                              role="menuitem"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
                              onClick={() => handleRestoreLayer(layerId)}
                            >
                              <IconRestore
                                size={14}
                                className="text-[var(--color-text-muted)]"
                              />
                              {t("Layer {{id}}", { id: layerId })}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Tooltip.Provider>
            </div>

            <div className="relative flex items-center gap-2 justify-between flex-wrap mb-4">
              {/* Physical Layout Selector (if multiple layouts) */}
              {keymap.physicalLayouts &&
                keymap.physicalLayouts.layouts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="keymap-physical-layout"
                      className="text-xs text-[var(--color-text-muted)]"
                    >
                      {t("Physical Layout")}:
                    </label>
                    <select
                      id="keymap-physical-layout"
                      value={keymap.physicalLayouts.activeLayoutIndex}
                      onChange={(e) =>
                        keymap.setActiveLayout(Number(e.target.value))
                      }
                      className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
                    >
                      {keymap.physicalLayouts.layouts.map((layout, index) => (
                        <option key={index} value={index}>
                          {layout.name || t("Layout {{id}}", { id: index + 1 })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Keyboard Layout Selector */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="keymap-os-layout"
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  {t("OS Layout")}:
                </label>
                <select
                  id="keymap-os-layout"
                  value={keyboardLayoutContext.layout}
                  onChange={(e) =>
                    keyboardLayoutContext.setLayout(
                      e.target
                        .value as import("../lib/keyboardLayouts").KeyboardLayoutType,
                    )
                  }
                  className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
                >
                  {getAvailableLayouts().map((layoutType) => (
                    <option key={layoutType} value={layoutType}>
                      {getLayoutLabel(layoutType)}
                    </option>
                  ))}
                </select>
                <Tooltip.Provider delayDuration={200}>
                  {/* Tips: */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <IconInfoCircle size={14} />
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-2 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50 max-w-xs"
                        sideOffset={5}
                      >
                        <div className="mb-1 font-semibold text-[var(--color-electric)]">
                          {t("Choose OS's keyboard layout setting")}
                        </div>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            {t(
                              "This setting only affects the visual key labels in Keeb-On! Studio web UI.",
                            )}
                          </li>
                          <li>
                            {t(
                              "Changing this does not update any firmware setting. The keyboard is detected as US regardless of this setting. Please change the layout setting in your OS if needed. For MacOS, USB connection is always detected as US and cannot be changed for now.",
                            )}
                          </li>
                          <li>
                            {t(
                              "The selection is saved in your browser's local storage for now.",
                            )}
                          </li>
                        </ul>
                        <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>

              {inputStream.isEnabled && <BrowserKeyInputOverlay />}
            </div>

            {/* Keyboard Layout */}
            {currentLayer && (
              <div className="glass-card p-8 relative">
                {/* Status indicator: unsaved edits (neon), saved-but-
                    customized-from-default (electric/blue), or saved-and-stock
                    (muted). */}
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-xs"
                  title={
                    !keymap.hasUnsavedChanges &&
                    keymap.isKeymapChangedFromDefault
                      ? t("Saved — changed from the default keymap")
                      : undefined
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      keymap.hasUnsavedChanges
                        ? "bg-[var(--color-neon)]"
                        : keymap.isKeymapChangedFromDefault
                          ? "bg-[var(--color-electric)]"
                          : "bg-[var(--color-text-muted)]"
                    }`}
                  />
                  <span
                    className={
                      keymap.hasUnsavedChanges
                        ? "text-[var(--color-neon)]"
                        : keymap.isKeymapChangedFromDefault
                          ? "text-[var(--color-electric)]"
                          : "text-[var(--color-text-muted)]"
                    }
                  >
                    {keymap.hasUnsavedChanges
                      ? t("Unsaved changes")
                      : t("Saved")}
                  </span>
                </div>
                <KeyboardLayout
                  layout={currentLayout}
                  layer={currentLayer}
                  layers={keymap.keymap.layers}
                  behaviors={keymap.behaviors}
                  selectedKey={selectedKeyPosition}
                  onKeyClick={handleKeyClick}
                  onKeyReset={handleKeyReset}
                  onKeyResetToDefault={handleKeyResetToDefault}
                  isBindingModified={keymap.isBindingModified}
                  isBindingOriginalKnown={keymap.isBindingOriginalKnown}
                  isBindingChangedFromDefault={
                    keymap.isBindingChangedFromDefault
                  }
                  getOriginalBinding={keymap.getOriginalBinding}
                  getDefaultBinding={keymap.getDefaultBinding}
                  keyboardLayout={keyboardLayoutContext.layout}
                  runtimeMacros={runtimeMacro.macros}
                  modules={
                    physicalLayoutModules.isAvailable
                      ? physicalLayoutModules.modules
                      : []
                  }
                  highlightedKeys={inputStream.highlightedKeys}
                  ariaLabel={t("Keyboard layout for {{layer}}", {
                    layer:
                      currentLayer.name ||
                      t("Layer {{id}}", { id: selectedLayerIndex }),
                  })}
                />

                {/* Under the board, because that is what it edits: you look
                    at the key that is about to change, then at the keyboard
                    you are choosing from, and both stay put. */}
                <QuickAssignBar
                  open={quickAssignOpen}
                  onOpenChange={(next) => {
                    setQuickAssignOpen(next);
                    if (next) setQuickAssignFinished(false);
                  }}
                  targetLabel={
                    selectedKeyPosition === null
                      ? null
                      : t("Key {{position}}", {
                          position: selectedKeyPosition + 1,
                        })
                  }
                  selectedCode={quickAssignSelectedCode}
                  onAssign={handleQuickAssign}
                  keyboardLayout={keyboardLayoutContext.layout}
                  finished={quickAssignFinished}
                  disabled={locked || keyPressBehaviorId === null}
                />
              </div>
            )}

            {/* What loading a saved keymap actually did. Worth stating rather
                than leaving the user to spot it: a load can be partial, and
                nothing is written to the keyboard until they Save. */}
            {loadNotice && (
              <div className="glass-card p-4 mt-4 flex items-start gap-3">
                <div className="p-2">
                  <IconInfoCircle
                    size={20}
                    className="text-[var(--color-electric)]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {loadNotice}
                  </p>
                  {/* Shown whether or not the clipboard worked: the copy can
                      fail silently, and seeing the link is how you know. */}
                  {shareUrl && (
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="input-field w-full mt-2 text-xs font-mono"
                      aria-label={t("Share link")}
                    />
                  )}
                </div>
                {/* Adding layers changes the shape of the keyboard, not just
                    what is on it, so it waits behind a button rather than
                    happening as a side effect of loading. */}
                {needsLayers && (
                  <button
                    className="btn-electric text-xs flex-shrink-0"
                    onClick={() => {
                      void runLoad(needsLayers, { addMissingLayers: true });
                    }}
                  >
                    {t("Add the layers and load again")}
                  </button>
                )}
                <button
                  className="btn-ghost text-xs"
                  onClick={() => {
                    setLoadNotice(null);
                    setShareUrl(null);
                    setNeedsLayers(null);
                  }}
                >
                  {t("Dismiss")}
                </button>
              </div>
            )}

            {/* A keymap someone sent. Nothing has been stored yet: a link is an
                invitation, and accepting it is the user's to do. */}
            {incoming && (
              <div
                ref={incomingRef}
                className="glass-card p-4 mt-4 flex items-start gap-3"
              >
                <div className="p-2">
                  <IconLink
                    size={20}
                    className="text-[var(--color-electric)]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)]">
                    {t('Someone shared the keymap "{{name}}" with you.', {
                      name: incoming.name,
                    })}
                  </p>
                  {incoming.description && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-3">
                      {incoming.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {t(
                      "Made for {{layoutName}}. Adding it only puts it in your keymaps — nothing is written to the keyboard.",
                      { layoutName: incoming.target.layoutName },
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    className="btn-electric text-xs"
                    onClick={() => {
                      void handleAcceptIncoming();
                    }}
                  >
                    {t("Add to my keymaps")}
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setIncoming(null)}
                  >
                    {t("Discard")}
                  </button>
                </div>
              </div>
            )}

            {physicalLayoutModules.error && (
              <div className="glass-card p-4 mt-4 border-yellow-500/20 bg-yellow-500/10 flex items-center gap-3">
                <div className="p-2">
                  <IconAlertTriangle size={24} />
                </div>
                <p className="text-sm">
                  {t(
                    "Physical layout module preview could not be loaded: {{error}}",
                    { error: physicalLayoutModules.error },
                  )}
                </p>
              </div>
            )}

            {sensorRotate.isAvailable && currentLayer && (
              <div className="mt-6">
                <SensorRotationConfig
                  selectedLayerId={currentLayer.id}
                  behaviors={keymap.behaviors}
                  layers={layersForSelector}
                  keyboardLayout={keyboardLayoutContext.layout}
                />
              </div>
            )}
          </>
        )}
        {/* Info */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            {connection.isConnected
              ? t(
                  "Click on a key to modify its binding. Modified keys are highlighted in green and show the original binding on hover. Use the Discard button to drop unsaved changes, or Reset to restore the default keymap.",
                )
              : t(
                  "Connect your keyboard to edit keymaps. Click on a key to modify its binding.",
                )}
          </p>
        </div>
      </div>

      {/* Rename Layer Dialog */}
      <Dialog.Root
        open={showRenameDialog}
        onOpenChange={(open) => !open && setShowRenameDialog(false)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              renameInputRef.current?.focus();
              renameInputRef.current?.select();
            }}
          >
            <Dialog.Title className="text-base font-medium text-[var(--color-text)] mb-4">
              {t("Rename Layer")}
            </Dialog.Title>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRenameConfirm();
                if (e.key === "Escape") setShowRenameDialog(false);
              }}
              maxLength={keymap.maxLayerNameLength || undefined}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)] mb-4"
              placeholder={t("Layer name")}
            />
            <div className="flex gap-3">
              <button
                className="flex-1 btn-ghost border border-[var(--color-border)]"
                onClick={() => setShowRenameDialog(false)}
                disabled={isRenaming}
              >
                {t("Cancel")}
              </button>
              <button
                className="flex-1 btn-electric flex items-center justify-center gap-2"
                onClick={() => void handleRenameConfirm()}
                disabled={isRenaming}
              >
                {isRenaming && (
                  <IconLoader2 size={16} className="animate-spin" />
                )}
                {t("Rename")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Copy-from-Base confirmation. Only shown when the copy would replace
          keys the user configured on this layer; a transparent layer is filled
          without asking. */}
      <Dialog.Root
        open={copyPlan !== null}
        onOpenChange={(open) => {
          if (!open) setCopyPlan(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
            <Dialog.Title className="text-base font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <IconAlertTriangle
                size={18}
                className="text-[var(--color-warning)]"
              />
              {t("Copy Base onto this layer?")}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-5">
              {t(
                "{{overwrites}} of the {{writes}} keys this changes already have something other than transparent on them, and those will be replaced. Nothing is written to the keyboard until you press Save.",
                {
                  overwrites: copyPlan?.overwrites ?? 0,
                  writes: copyPlan?.writes.length ?? 0,
                },
              )}
            </Dialog.Description>
            <div className="flex gap-3">
              <button
                className="flex-1 btn-ghost border border-[var(--color-border)]"
                onClick={() => setCopyPlan(null)}
              >
                {t("Cancel")}
              </button>
              <button
                className="flex-1 btn-electric"
                onClick={() => {
                  if (copyPlan) void runCopyFromBase(copyPlan);
                }}
              >
                {t("Copy from Base")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reset-to-Default Confirmation Dialog */}
      <Dialog.Root
        open={showResetDialog}
        onOpenChange={(open) => {
          if (!open && !isResetting) setShowResetDialog(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
            <Dialog.Title className="text-base font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <IconAlertTriangle
                size={18}
                className="text-[var(--color-warning)]"
              />
              {t("Reset to default keymap?")}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--color-text-muted)] mb-5">
              {t(
                "This resets the saved keymap on your keyboard back to its hard-coded default and writes it to flash immediately. All saved key bindings will be lost. This cannot be undone.",
              )}
            </Dialog.Description>
            <div className="flex gap-3">
              <button
                className="flex-1 btn-ghost border border-[var(--color-border)]"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
              >
                {t("Cancel")}
              </button>
              <button
                className="flex-1 btn-electric flex items-center justify-center gap-2"
                onClick={() => void handleResetToDefault()}
                disabled={isResetting}
              >
                {isResetting && (
                  <IconLoader2 size={16} className="animate-spin" />
                )}
                {t("Reset to default")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Restore-a-version diff modal (opened from the reset dropdown) */}
      <VersionDiffModal
        {...versionHistory.diffModalProps}
        labeler={versionHistory.labeler}
      />

      <GalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        posts={gallery.posts}
        isLoading={gallery.isLoading}
        isLoadingMore={gallery.isLoadingMore}
        hasMore={gallery.hasMore}
        error={gallery.error}
        mine={myPosts}
        busyId={galleryBusyId}
        onOpenPost={(post) => {
          void handleOpenFromGallery(post);
        }}
        onReport={(post) => {
          void handleReportPost(post);
        }}
        onDelete={(post) => {
          void handleDeletePost(post);
        }}
        onLoadMore={() => {
          void gallery.loadMore();
        }}
      />

      {/* Keycode Selector Dialog */}
      <KeycodeSelector
        open={showKeycodeSelector}
        onClose={() => {
          setShowKeycodeSelector(false);
          setSelectedKeyPosition(null);
        }}
        onSelect={handleBindingSelect}
        currentBinding={currentBinding}
        behaviors={keymap.behaviors}
        layers={layersForSelector}
        keyboardLayout={keyboardLayoutContext.layout}
        runtimeMacros={runtimeMacro.macros}
      />

      {currentLayout && keymap.keymap && (
        <KeymapPrintSheet
          layout={currentLayout}
          layers={keymap.keymap.layers}
          behaviors={keymap.behaviors}
          keyboardLayout={keyboardLayoutContext.layout}
          modules={
            physicalLayoutModules.isAvailable
              ? physicalLayoutModules.modules
              : []
          }
          runtimeMacros={runtimeMacro.macros}
          deviceName={connection.deviceName}
        />
      )}
    </div>
  );
}
