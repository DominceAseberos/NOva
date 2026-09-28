export function createStoryStore(initialStory, options = {}) {
  const {
    storageKey = "scroll-story:draft",
    historyLimit = 80,
    persistDraft = true,
  } = options;

  let story = structuredClone(initialStory);
  let past = [];
  let future = [];
  const listeners = new Set();

  const emit = () => {
    if (persistDraft && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(story));
      } catch {
        // Draft persistence is best-effort.
      }
    }
    listeners.forEach((listener) => listener(story));
  };

  const snapshot = () => structuredClone(story);

  const replace = (nextStory, { record = true } = {}) => {
    if (record) {
      past.push(snapshot());
      if (past.length > historyLimit) past.shift();
      future = [];
    }
    story = structuredClone(nextStory);
    emit();
  };

  const update = (mutator, options = {}) => {
    const next = snapshot();
    const result = mutator(next);
    replace(result || next, options);
  };

  return {
    get: snapshot,
    replace,
    update,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    undo() {
      if (!past.length) return false;
      future.push(snapshot());
      story = past.pop();
      emit();
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(snapshot());
      story = future.pop();
      emit();
      return true;
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
    restoreDraft() {
      if (typeof localStorage === "undefined") return false;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return false;
        story = JSON.parse(raw);
        emit();
        return true;
      } catch {
        return false;
      }
    },
    clearDraft() {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(storageKey);
      }
    },
  };
}
