import { useEffect } from "react";

export default function StoryLayoutController({ store }) {
  useEffect(() => {
    const apply = (story) => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      (story.sections || []).forEach((section) => {
        const root = document.querySelector(section.selector || "#" + section.id);
        if (!root) return;

        const duration = Math.max(1, Number(section.duration) || 1);
        const pinned = Boolean(section.pin?.enabled);

        root.dataset.storySection = section.id;
        root.style.setProperty("--story-duration", String(duration));

        // Story timing owns section geometry. Hidden negative margins from the
        // visual stylesheet would make the next section enter before this
        // timeline block has actually ended.
        root.style.marginTop = "0px";

        if (pinned) {
          root.style.minHeight = "calc(100svh + " + duration + "svh)";
        } else {
          // Non-pinned sections still use their timeline duration as physical
          // scroll length; pinning only controls whether the stage is sticky.
          root.style.minHeight = duration + "svh";
        }

        const stage = section.stageSelector
          ? root.querySelector(section.stageSelector)
          : null;

        if (stage) {
          stage.dataset.storyPinned = pinned ? "true" : "false";
          stage.style.position = pinned ? "sticky" : "relative";

          if (pinned) {
            stage.style.top = "0";
            // The sticky viewport must be exactly one viewport high. A larger
            // CSS min-height shortens the effective pin distance.
            stage.style.height = "100svh";
            stage.style.minHeight = "100svh";
          } else {
            stage.style.top = "auto";
            stage.style.removeProperty("height");
            stage.style.removeProperty("min-height");
          }
        }
      });
    };

    apply(store.get());
    return store.subscribe(apply);
  }, [store]);

  return null;
}
