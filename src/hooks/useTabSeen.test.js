// Tab badges clear when the tab is opened and only show what arrived since.
import { renderHook, act } from "@testing-library/react";
import { useTabSeen } from "./useTabSeen";

const render = (initial) => renderHook(
  ({ tab, quiz, loaded = true, owner = "student:1" }) => useTabSeen(owner, tab, { quiz }, { quiz: loaded }),
  { initialProps: initial },
);

beforeEach(() => localStorage.clear());

describe("useTabSeen", () => {
  it("shows the whole count for a tab never opened", () => {
    const { result } = render({ tab: "dashboard", quiz: 1 });
    expect(result.current("quiz")).toBe(1);
  });

  it("clears when the tab is opened and stays cleared after leaving", () => {
    const { result, rerender } = render({ tab: "dashboard", quiz: 1 });
    rerender({ tab: "quiz", quiz: 1 });
    expect(result.current("quiz")).toBeNull();
    rerender({ tab: "dashboard", quiz: 1 }); // quiz still not done — badge stays gone
    expect(result.current("quiz")).toBeNull();
  });

  it("shows only quizzes that arrive after the tab was opened", () => {
    const { result, rerender } = render({ tab: "quiz", quiz: 2 });
    rerender({ tab: "dashboard", quiz: 2 });
    rerender({ tab: "dashboard", quiz: 3 });
    expect(result.current("quiz")).toBe(1);
  });

  it("a finished quiz lowers the memory, so the next new one still shows", () => {
    const { result, rerender } = render({ tab: "quiz", quiz: 2 });
    rerender({ tab: "dashboard", quiz: 1 }); // one done
    rerender({ tab: "dashboard", quiz: 2 }); // one new
    expect(result.current("quiz")).toBe(1);
  });

  it("ignores a count until it has loaded (a loading page can't wipe what was seen)", () => {
    localStorage.setItem("tabSeen:student:1", JSON.stringify({ quiz: 3 }));
    const { result, rerender } = render({ tab: "dashboard", quiz: 0, loaded: false });
    expect(result.current("quiz")).toBeNull();
    rerender({ tab: "dashboard", quiz: 3, loaded: true });
    expect(result.current("quiz")).toBeNull(); // still the 3 already seen
  });

  it("remembers across reloads, per user", () => {
    const first = render({ tab: "quiz", quiz: 2 });
    first.unmount();
    const again = render({ tab: "dashboard", quiz: 2 });
    expect(again.result.current("quiz")).toBeNull();
    const other = render({ tab: "dashboard", quiz: 2, owner: "student:2" });
    expect(other.result.current("quiz")).toBe(2);
  });

  it("never shows a badge on the tab that is open", () => {
    const { result, rerender } = render({ tab: "quiz", quiz: 1 });
    act(() => rerender({ tab: "quiz", quiz: 4 }));
    expect(result.current("quiz")).toBeNull();
  });
});
