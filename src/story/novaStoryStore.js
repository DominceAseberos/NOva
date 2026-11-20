import initialStory from "./nova-story.json";
import { createStoryStore } from "../scroll-story/core/createStoryStore.js";

if (typeof localStorage !== "undefined") {
  try {
    localStorage.removeItem("scroll-story:nova:draft");
  } catch {
    // Best-effort cleanup of stale pre-macro draft.
  }
}

export const novaStoryStore = createStoryStore(initialStory, {
  storageKey: "scroll-story:nova:draft:v5",
  historyLimit: 120,
  persistDraft: true,
});

export function isStoryEditorMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("editor") === "1" || params.has("editor");
}
