export const BEHAVIORS = [
  {
    id: 29,
    displayName: "Layer-Tap",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 34,
    displayName: "Mod-Tap",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 35,
    displayName: "Transparent",
    metadata: [],
  },
  {
    id: 3,
    displayName: "Mouse Key Press",
    metadata: [
      {
        param1: [
          {
            name: "MB1",
            constant: 1,
          },
          {
            name: "MB2",
            constant: 2,
          },
          {
            name: "MB3",
            constant: 4,
          },
          {
            name: "MB4",
            constant: 8,
          },
          {
            name: "MB5",
            constant: 16,
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 4,
    displayName: "mouse_move",
    metadata: [],
  },
  {
    id: 5,
    displayName: "mouse_scroll",
    metadata: [],
  },
  {
    id: 6,
    displayName: "None",
    metadata: [],
  },

  {
    id: 8,
    displayName: "Caps Word",
    metadata: [],
  },
  {
    id: 9,
    displayName: "External Power",
    metadata: [],
  },
  {
    id: 10,
    displayName: "Key Press",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 11,
    displayName: "Grave/Escape",
    metadata: [],
  },
  {
    id: 12,
    displayName: "Key Repeat",
    metadata: [],
  },
  {
    id: 13,
    displayName: "Key Toggle",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 14,
    displayName: "Sticky Key",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 15,
    displayName: "Momentary Layer",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 16,
    displayName: "Sticky Layer",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 17,
    displayName: "To Layer",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [],
      },
    ],
  },
  {
    id: 18,
    displayName: "Toggle Layer",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [],
      },
    ],
  },

  {
    id: 21,
    displayName: "Bluetooth",
    metadata: [
      {
        param1: [
          {
            name: "Next Profile",
            constant: 1,
          },
          {
            name: "Previous Profile",
            constant: 2,
          },
          {
            name: "Clear All Profiles",
            constant: 4,
          },
          {
            name: "Clear Selected Profile",
            constant: 0,
          },
        ],
        param2: [],
      },
      {
        param1: [
          {
            name: "Select Profile",
            constant: 3,
          },
          {
            name: "Disconnect Profile",
            constant: 5,
          },
        ],
        param2: [
          {
            name: "Profile",
            range: {
              min: 0,
              max: 4,
            },
          },
        ],
      },
    ],
  },
  {
    id: 22,
    displayName: "Bootloader",
    metadata: [],
  },
  {
    id: 23,
    displayName: "Studio Unlock",
    metadata: [],
  },
  {
    id: 24,
    displayName: "Reset",
    metadata: [],
  },

  {
    id: 30,
    displayName: "Output Selection",
    metadata: [
      {
        param1: [
          {
            name: "Toggle Outputs",
            constant: 0,
          },
          {
            name: "USB Output",
            constant: 1,
          },
          {
            name: "BLE Output",
            constant: 2,
          },
        ],
        param2: [],
      },
    ],
  },
  // タップ/ホールドの判定時間プリセット。実機のキーマップが同じものを定義
  // しているので(clickboard_ergotrack.keymap / goforty_max.keymap の
  // behaviors ブロック)、デモでも同じ選択肢が並ぶようにしてある。
  // hold-tap のパラメータ種別は子ビヘイビアから継承されるため、
  // mod-tap 系は キー+キー、layer-tap 系は レイヤー+キー になる。
  {
    id: 40,
    displayName: "Mod-Tap 150ms",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 41,
    displayName: "Mod-Tap 200ms",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 42,
    displayName: "Mod-Tap 280ms",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 43,
    displayName: "Layer-Tap 150ms",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 44,
    displayName: "Layer-Tap 200ms",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 45,
    displayName: "Layer-Tap 280ms",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    // zmk-feature-runtime-tap-dance's &rtd, with the slot range the firmware
    // publishes, so the demo keymap can put a tap dance on a key.
    id: 46,
    displayName: "Tap Dance",
    metadata: [
      {
        param1: [
          {
            name: "Tap dance",
            range: {
              min: 0,
              max: 3,
            },
          },
        ],
        param2: [],
      },
    ],
  },
  // QMK の PERMISSIVE_HOLD 相当(flavor = "balanced"、180ms)。4 機種とも
  // キーマップに定義してある(mt_perm / lt_perm)。アプリは表示名の末尾の
  // 「<数値>ms」と括弧の中身でプリセットを見分けるので、名前は実機と同じ。
  {
    id: 47,
    displayName: "Mod-Tap 180ms (Permissive)",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 48,
    displayName: "Layer-Tap 180ms (Permissive)",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  // 長押しの判定方式を 200ms で揃えた 3 択のうち、新しく足された 3 つ。
  // タイピング優先は素の Mod-Tap / Layer-Tap、Mod-Tap の反応優先は
  // Mod-Tap 200ms。"Mod-Tap 200ms (Balanced)" があることが「このファームの
  // 素の Mod-Tap はタイピング優先」の目印になる(holdTapChoice.ts)。
  {
    id: 51,
    displayName: "Mod-Tap 200ms (Balanced)",
    metadata: [
      {
        param1: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 52,
    displayName: "Layer-Tap 200ms (Balanced)",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  {
    id: 53,
    displayName: "Layer-Tap 200ms (Hold-preferred)",
    metadata: [
      {
        param1: [
          {
            name: "Layer",
            layerId: {},
          },
        ],
        param2: [
          {
            name: "Key",
            hidUsage: {
              keyboardMax: 255,
              consumerMax: 4095,
            },
          },
        ],
      },
    ],
  },
  // ClickBoard ErgoTrack's default keymap uses the two below (the switches
  // under the trackpads, and the speed keys), so the demo has to know them
  // for that keymap to load. Names and values are the ones zmk-driver-iqs9151
  // reports: behavior_drag_click.c takes no parameters,
  // behavior_zip_dynamic_scale.c lists these (ZDS_XY/SC/ALL, ZDS_INC/DEC/RST).
  {
    id: 49,
    displayName: "Left Click (Drag)",
    metadata: [],
  },
  {
    id: 50,
    displayName: "Pointer Speed Adjust",
    metadata: [
      {
        param1: [
          { name: "Cursor", constant: 0 },
          { name: "Scroll", constant: 1 },
          { name: "Cursor and scroll", constant: 2 },
        ],
        param2: [
          { name: "Faster", constant: 1 },
          { name: "Slower", constant: 2 },
          { name: "Reset to default", constant: 3 },
        ],
      },
    ],
  },
].sort((a, b) => a.id - b.id);
