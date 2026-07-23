import { describe, expect, it } from "vitest";
import {
  GUIDE_TEMPLATES,
  createBlankGuideDraft,
  createGuideDrafts,
  toPlannerDrafts,
} from "@/lib/guide-templates";

describe("guide templates", () => {
  it("offers three editable examples and a blank start", () => {
    expect(GUIDE_TEMPLATES.map((template) => template.id)).toEqual([
      "school",
      "work",
      "project",
      "blank",
    ]);
    expect(createGuideDrafts("school")).toHaveLength(4);
    expect(createGuideDrafts("work")).toHaveLength(4);
    expect(createGuideDrafts("project")).toHaveLength(4);
    expect(createGuideDrafts("blank")).toEqual([]);
  });

  it("returns fresh draft objects instead of mutating template fixtures", () => {
    const first = createGuideDrafts("school");
    first[0].title = "แก้เฉพาะฉบับร่าง";
    const second = createGuideDrafts("school");
    expect(second[0].title).toBe("เข้าเรียน");
  });

  it("keeps blank rows out of planner input and validates useful rows", () => {
    const blank = createBlankGuideDraft();
    const drafts = toPlannerDrafts([
      blank,
      { ...blank, id: "useful", title: "อ่านบทเรียน", durationMin: 90 },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      draftId: "useful",
      title: "อ่านบทเรียน",
      durationMin: 90,
      place: "",
    });
  });
});
