import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parseMediaInput } from "./service";

const blob = (name: string) => ({ url: `https://abc123.public.blob.vercel-storage.com/newsdesk/${name}-XyZ.png`, sha256: "f".repeat(64), name, bytes: 1000 });

describe("parseMediaInput", () => {
  it("accepts up to five images from our Blob store", () => {
    expect(parseMediaInput([blob("a"), blob("b")])).toHaveLength(2);
    expect(parseMediaInput([])).toEqual([]);
  });

  it("rejects anything else: other hosts, http, look-alike domains, too many, bad shapes", () => {
    expect(parseMediaInput([{ ...blob("a"), url: "https://example.com/a.png" }])).toBeNull();
    expect(parseMediaInput([{ ...blob("a"), url: "http://abc.public.blob.vercel-storage.com/a.png" }])).toBeNull();
    expect(parseMediaInput([{ ...blob("a"), url: "https://public.blob.vercel-storage.com.evil.io/a.png" }])).toBeNull();
    expect(parseMediaInput(Array.from({ length: 6 }, (_, i) => blob(String(i))))).toBeNull();
    expect(parseMediaInput("nope")).toBeNull();
    expect(parseMediaInput([{ url: 5 }])).toBeNull();
  });
});
