import { describe, expect, it } from "vitest";
import { getHelpDocs } from "./helpDocsRegistry";

describe("helpDocsRegistry", () => {
  it("returns application doc first, then module docs in module order", () => {
    const docs = getHelpDocs();
    expect(docs.map((doc) => doc.moduleId)).toEqual([
      "application",
      "dashboards",
      "trafficAnalysis",
      "help",
      "settings",
      "userSettings"
    ]);
  });

  it("includes core module documentation entries", () => {
    const docs = getHelpDocs();
    expect(docs.some((doc) => doc.title === "Application Overview")).toBe(true);
    expect(docs.some((doc) => doc.title === "Dashboard Module")).toBe(true);
    expect(docs.some((doc) => doc.title === "Help Module")).toBe(true);
  });
});
