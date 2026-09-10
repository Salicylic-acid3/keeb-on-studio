/**
 * An in-memory stand-in for the slice of KV the gallery uses.
 *
 * The two behaviours the gallery actually leans on are reproduced faithfully,
 * because getting either wrong here would hide a real bug: keys come back in
 * ascending lexicographic order (which is what makes newest-first work), and
 * `list` returns each key's metadata without reading its value (which is what
 * makes a page one operation instead of twenty-five).
 */
import type { GalleryKV } from "../gallery";

interface Entry {
  value: string;
  metadata?: unknown;
}

export class FakeKV implements GalleryKV {
  private readonly entries = new Map<string, Entry>();
  /** Every operation performed, so a test can assert what a call cost. */
  readonly operations: Array<{ op: string; key: string }> = [];

  get(key: string): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  async get(key: string, type?: "json"): Promise<unknown> {
    this.operations.push({ op: "get", key });
    const entry = this.entries.get(key);
    if (!entry) return null;
    return type === "json" ? JSON.parse(entry.value) : entry.value;
  }

  async getWithMetadata<Metadata>(
    key: string,
  ): Promise<{ value: unknown; metadata: Metadata | null }> {
    this.operations.push({ op: "getWithMetadata", key });
    const entry = this.entries.get(key);
    if (!entry) return { value: null, metadata: null };
    return {
      value: JSON.parse(entry.value),
      metadata: (entry.metadata as Metadata) ?? null,
    };
  }

  async put(
    key: string,
    value: string,
    options?: { metadata?: unknown },
  ): Promise<void> {
    this.operations.push({ op: "put", key });
    this.entries.set(key, { value, metadata: options?.metadata });
  }

  async list<Metadata>(options: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string; metadata?: Metadata }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    this.operations.push({ op: "list", key: options.prefix });
    const matching = [...this.entries.keys()]
      .filter((name) => name.startsWith(options.prefix))
      .sort();
    // The cursor is the last key returned; real KV's is opaque, but the
    // contract that matters -- resume strictly after it -- is the same.
    const start = options.cursor
      ? matching.findIndex((name) => name > options.cursor!)
      : 0;
    const from = start === -1 ? matching.length : start;
    const limit = options.limit ?? 1000;
    const page = matching.slice(from, from + limit);
    const complete = from + page.length >= matching.length;
    return {
      keys: page.map((name) => ({
        name,
        metadata: this.entries.get(name)?.metadata as Metadata,
      })),
      list_complete: complete,
      ...(complete ? {} : { cursor: page[page.length - 1] }),
    };
  }

  async delete(key: string): Promise<void> {
    this.operations.push({ op: "delete", key });
    this.entries.delete(key);
  }

  /** How many writes a stretch of work cost, against the 1,000/day tier. */
  writeCount(): number {
    return this.operations.filter((o) => o.op === "put" || o.op === "delete")
      .length;
  }

  size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }
}
