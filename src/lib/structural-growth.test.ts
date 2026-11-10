import { describe, expect, it } from "vitest";
import { growTopology, newGrowth, restoreGrowth, targetWords } from "./structural-growth";

describe("observed structural growth", () => {
  it("targets slightly more than the input length", () => {
    expect(targetWords("one two three four five six seven eight nine ten")).toBe(11);
  });
  it("retains every fold and renders only words actually visited", () => {
    const s = newGrowth();
    const r = growTopology(s, "unvisited", [{ name: "mo", path: ["STONE", "*water*", "→", "shore"] }], true);
    expect(r.lanes[0].path).toEqual(["STONE", "*water*", "→", "shore"]);
    expect(r.selected.every((w) => r.lanes.some((l) => l.path[w.depth] === w.node))).toBe(true);
    expect(r.selected.map((w) => w.word)).not.toContain("unvisited");
  });
  it("keeps dormant structure and isolates restored profiles", () => {
    const a = newGrowth(); growTopology(a, "stone river", [{ name: "mo", path: ["stone", "river"] }], false);
    const b = restoreGrowth(a);
    growTopology(b, "cloud mist", [], false);
    expect(a.nodes.cloud).toBeUndefined();
    expect(b.nodes.stone).toBeDefined(); expect(b.edges['["stone","river"]']).toBeDefined();
  });
  it("does not count a shared spawn as convergence", () => {
    const r = growTopology(newGrowth(), "stone", [{ name: "a", path: ["stone"] }, { name: "b", path: ["stone"] }], false);
    expect(r.telemetry).not.toContain("[CONVERGENCE]");
  });
  it("stops without filler when topology cannot meet the target", () => {
    const r = growTopology(newGrowth(), "one two three four five six seven eight nine ten", [{ name: "a", path: ["stone", "river"] }], true);
    expect(r.reason).toBe("exhausted"); expect(r.selected.length).toBe(2); expect(r.target).toBe(11);
  });
});