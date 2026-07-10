import { describe, expect, it } from "vitest";
import { paginate } from "../../src/transport/pagination.js";

async function collect<T>(gen: AsyncGenerator<T, void, void>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe("paginate", () => {
  it("walks every page until nextCursor is absent", async () => {
    const pages: Record<string, { data: number[]; nextCursor?: string }> = {
      "": { data: [1, 2], nextCursor: "p2" },
      p2: { data: [3, 4], nextCursor: "p3" },
      p3: { data: [5], nextCursor: undefined },
    };
    const seen: (string | undefined)[] = [];
    const items = await collect(
      paginate<number>((cursor) => {
        seen.push(cursor);
        return Promise.resolve(pages[cursor ?? ""]!);
      }),
    );
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toEqual([undefined, "p2", "p3"]);
  });

  it("yields nothing for an immediately-empty first page", async () => {
    const items = await collect(paginate<number>(() => Promise.resolve({ data: [] })));
    expect(items).toEqual([]);
  });

  it("stops if the server echoes the same cursor forever, instead of looping", async () => {
    let calls = 0;
    const items = await collect(
      paginate<number>((cursor) => {
        calls++;
        if (calls > 5) throw new Error("infinite loop guard didn't stop pagination");
        return Promise.resolve({ data: [calls], nextCursor: cursor ?? "same" });
      }),
    );
    // First call: cursor=undefined, nextCursor="same" (different from undefined) -> continues.
    // Second call: cursor="same", nextCursor="same" (equal) -> stops.
    expect(items).toEqual([1, 2]);
    expect(calls).toBe(2);
  });

  it("propagates a rejected fetchPage as a thrown error from the generator", async () => {
    const gen = paginate<number>(() => Promise.reject(new Error("boom")));
    await expect(collect(gen)).rejects.toThrow("boom");
  });

  it("stops paging immediately when the consumer breaks out of the loop", async () => {
    let calls = 0;
    const pages: Record<string, { data: number[]; nextCursor?: string }> = {
      "": { data: [1, 2], nextCursor: "p2" },
      p2: { data: [3, 4], nextCursor: "p3" },
      p3: { data: [5], nextCursor: undefined },
    };
    const seen: number[] = [];
    for await (const item of paginate<number>((cursor) => {
      calls++;
      return Promise.resolve(pages[cursor ?? ""]!);
    })) {
      seen.push(item);
      if (item === 2) break;
    }
    expect(seen).toEqual([1, 2]);
    expect(calls).toBe(1);
  });
});
