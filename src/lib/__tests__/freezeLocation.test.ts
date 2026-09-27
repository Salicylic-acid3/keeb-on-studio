import { freezeLocationLines, hasFreezeLocation } from "../freezeLocation";
import { resolveDataAddress, type ElfInfo } from "../elfAnalysis";

const t = (key: string, params?: Record<string, string | number>) =>
  params ? key.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k])) : key;

const elf: ElfInfo = {
  fileName: "zephyr.elf",
  symbols: [
    { name: "k_sleep", address: 0x1000, size: 0x40 },
    { name: "rpc_tx_buffer_write", address: 0x2000, size: 0x100 },
  ],
  objects: [{ name: "rpc_transport_mutex", address: 0x20000100, size: 20 }],
  lines: [],
};

const resolvers = {
  resolve: (address: number) => {
    const a = address & ~1;
    const sym = elf.symbols.find(
      (s) => a >= s.address && a < s.address + s.size,
    );
    return sym ? { functionName: sym.name, offset: a - sym.address } : null;
  },
  resolveData: (address: number) => resolveDataAddress(elf, address),
};

describe("freeze location", () => {
  const freeze = {
    channelId: 1,
    queueName: "lowprio_workq",
    threadState: 0x02,
    pendedOn: 0x20000100,
    frames: [0x1011, 0x2045, 0x9999],
  };

  test("names the state, the object waited on, and each frame", () => {
    expect(freezeLocationLines(freeze, t, resolvers)).toEqual([
      "Thread: waiting on a kernel object",
      "Waiting on: rpc_transport_mutex",
      "PC → k_sleep+0x10",
      "LR → rpc_tx_buffer_write+0x44",
      "#2 → 0x00009999",
    ]);
  });

  test("falls back to hex without an ELF", () => {
    const lines = freezeLocationLines(freeze, t);
    expect(lines[1]).toBe("Waiting on: 0x20000100");
    expect(lines[2]).toBe("PC → 0x00001011");
  });

  test("says nothing for a freeze recorded by older firmware", () => {
    const old = {
      channelId: 1,
      queueName: "lowprio_workq",
      threadState: 0,
      pendedOn: 0,
      frames: [],
    };
    expect(hasFreezeLocation(old)).toBe(false);
    expect(freezeLocationLines(old, t, resolvers)).toEqual([]);
  });

  test("does not name an address past the end of a data object", () => {
    expect(resolveDataAddress(elf, 0x20000100 + 24)).toBeNull();
    expect(resolveDataAddress(elf, 0x20000104)).toEqual({
      name: "rpc_transport_mutex",
      offset: 4,
    });
  });
});
