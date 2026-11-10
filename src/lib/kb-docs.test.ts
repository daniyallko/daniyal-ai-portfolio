import { describe, expect, it } from "vitest";
import { buildChunks, chunkDocument, setExtraChunks } from "./portfolio";
describe("admin documents", () => {
  const doc = {
    id: "12345678-aaaa-bbbb-cccc-000000000000",
    title: "Cert",
    section: "Certifications",
    content: ("word ".repeat(150) + "\n\n").repeat(4),
  };
  it("splits long documents into chunks of at most 900 chars", () => {
    const c = chunkDocument(doc);
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.text.length <= 900)).toBe(true);
  });
  it("adds document chunks to the corpus", () => {
    const before = buildChunks().length;
    setExtraChunks(chunkDocument(doc));
    expect(buildChunks().length).toBe(before + chunkDocument(doc).length);
    setExtraChunks([]);
  });
});
