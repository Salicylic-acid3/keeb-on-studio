# QMK (Vial) side

Keeb-On! Studio has two halves. The ZMK half is the original app at `/`.
The QMK half lives at `/qmk` and in `src/qmk/`, and talks to this
workshop's Vial keyboards (vial-qmk fork, Vial protocol 6) over WebHID.

## Layout

- `src/lib/firmware.ts` — which half a URL belongs to.
- `src/components/FirmwareToggle.tsx` — the ZMK / QMK switch on the top page.
- `src/qmk/QmkApp.tsx` — the QMK half: top page in QMK mode, connection, tabs.
- `src/qmk/lib/vial/` — transport (WebHID + demo), protocol client,
  definition decoding (xz + vial.json), KLE layout parsing.
- `src/qmk/lib/keycodes/` — QMK keycode table (generated), codec, captions.
- `src/qmk/lib/zmkBridge.ts` — shows the QMK keymap to the shared UI as a
  ZMK-shaped keymap (pretend behaviors, lossless keycode translation), so
  KeyboardLayout, KeycodeSelector and QuickAssignBar serve both sides.
- `src/qmk/lib/osBlocks.ts` — OS-block grouping of layers and block copy.
- `src/qmk/demo/` — the demo keyboards' data (every QMK keyboard on the firmware list, as its multi-os firmware builds it), generated from the firmware; picked with "Keyboard" on the keymap page in demo mode.

## Regenerating

```
node --experimental-strip-types scripts/generateQmkKeycodes.ts ../vial-qmk/quantum/keycodes.h
python3 scripts/generateQmkDemoBoards.py ../vial-qmk
```

## Firmware side

`users/salicylic_acid3/keebon_os.c` in the vial-qmk fork implements the
OS-switch module; `vial.json` carries a `keebOn` field (`osProtocol`,
`osBlocks`) that tells the app which layers form which block.
