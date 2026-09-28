import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSectionRanges,
  getStoryDuration,
  keyframeTime,
  storyPointToSectionProgress,
  upsertCameraKeyframe,
  upsertProductKeyframe,
} from "../core/storyMath.js";
import { validateStory } from "../core/validateStory.js";
import {
  getStoryRuntimeApi,
  getStoryRuntimeState,
  subscribeStoryRuntimeApi,
  subscribeStoryRuntimeState,
} from "../runtime/editorBridge.js";
import "./editor.css";

const radToDeg = (value) => (Number(value || 0) * 180) / Math.PI;
const degToRad = (value) => (Number(value || 0) * Math.PI) / 180;
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));

function NumberField({ label, value, step = 0.01, onChange }) {
  return (
    <label className="sse-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function downloadStory(story) {
  const blob = new Blob([JSON.stringify(story, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "story.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ScrollStoryEditor({ store, savePath = "src/story/nova-story.json" }) {
  const [story, setStory] = useState(() => store.get());
  const [runtime, setRuntime] = useState(() => getStoryRuntimeState());
  const [api, setApi] = useState(() => getStoryRuntimeApi());
  const [preview, setPreview] = useState(false);
  const [compact, setCompact] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState("translate");
  const [activeTrack, setActiveTrack] = useState("product");
  const [selectedKeyframe, setSelectedKeyframe] = useState(null);
  const [selectedSection, setSelectedSection] = useState(
    story.sections?.[0]?.id || "top"
  );
  const [inspector, setInspector] = useState(null);
  const [cameraInspector, setCameraInspector] = useState(null);
  const [editableParts, setEditableParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [partInspector, setPartInspector] = useState(null);
  const [saveStatus, setSaveStatus] = useState("Saved JSON is the source of truth");
  const timelineRef = useRef(null);
  const pinCaptureRef = useRef(null);
  const autoKeyTimerRef = useRef(null);
  const wasManipulatingRef = useRef(false);
  const playbackRafRef = useRef(null);

  useEffect(() => store.subscribe(setStory), [store]);
  useEffect(() => subscribeStoryRuntimeState(setRuntime), []);
  useEffect(() => subscribeStoryRuntimeApi(setApi), []);

  useEffect(() => {
    if (!api) return;
    const parts = api.getEditableParts?.() || [];
    setEditableParts(parts);
    setSelectedPartId((current) => current || parts[0]?.id || null);
  }, [api, runtime.ready]);

  useEffect(() => {
    const transformTrack = activeTrack === "product" || activeTrack === "parts";
    api?.setEditorEnabled?.(!preview && transformTrack);
    api?.setTransformMode?.(mode);

    if (activeTrack === "parts") {
      api?.selectEditablePart?.(selectedPartId);
    } else if (activeTrack === "product") {
      api?.selectEditablePart?.(null);
    }

    return () => api?.setEditorEnabled?.(false);
  }, [api, preview, mode, activeTrack, selectedPartId]);

  useEffect(() => {
    if (!api || preview || runtime.manipulating) return;
    const next = api.captureProductState?.();
    if (next) setInspector(next);
    const cameraNext = api.captureCameraState?.();
    if (cameraNext) setCameraInspector(cameraNext);

    if (selectedPartId) {
      const partNext = api.capturePartState?.(selectedPartId);
      if (partNext) setPartInspector(partNext);
    }
  }, [
    api,
    preview,
    runtime.time,
    runtime.manipulating,
    runtime.ready,
    selectedPartId,
  ]);

  useEffect(() => {
    const editableTarget = (target) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;

    const onKeyDown = (event) => {
      if (editableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "w") setMode("translate");
      if (key === "e") setMode("rotate");
      if (key === "r") setMode("scale");
      if (key === "c") setCompact((value) => !value);

      if (key === "p" && !event.repeat && !pinCaptureRef.current) {
        const currentStory = store.get();
        const location = storyPointToSectionProgress(
          currentStory,
          getStoryRuntimeState().time
        );
        const section = currentStory.sections.find(
          (item) => item.id === location.section
        );

        if (section) {
          pinCaptureRef.current = {
            sectionId: section.id,
            startY: window.scrollY,
            startDuration: Number(section.duration) || 1,
            addedVh: 0,
            originalStory: structuredClone(currentStory),
          };

          store.update((next) => {
            const target = next.sections.find((item) => item.id === section.id);
            if (target) {
              target.pin = { ...(target.pin || {}), enabled: true };
            }
          });

          setSelectedSection(section.id);
          setSaveStatus("PIN CAPTURE · scroll while holding P to extend");
        }
      }

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      }

      if ((key === "delete" || key === "backspace") && selectedKeyframe) {
        event.preventDefault();
        store.update((next) => {
          const track = activeTrack === "camera" ? "camera" : "product";
          next.tracks[track] = (next.tracks[track] || []).filter(
            (item) => item.id !== selectedKeyframe
          );
        });
        api?.clearEditorPreview?.(
          activeTrack === "camera" ? "camera" : "product"
        );
        api?.scrollToTime?.(getStoryRuntimeState().time);
        setSaveStatus("Removed " + activeTrack + " keyframe");
        setSelectedKeyframe(null);
      }

      if (key === "k") {
        event.preventDefault();
        document.querySelector("[data-sse-save-keyframe]")?.click();
      }
      if (key === " ") {
        event.preventDefault();
        setPreview((value) => !value);
      }
    };

    const onWheel = (event) => {
      const capture = pinCaptureRef.current;
      if (!capture) return;

      event.preventDefault();

      const deltaVh =
        (Math.abs(event.deltaY) / Math.max(1, window.innerHeight)) * 100;

      if (deltaVh <= 0) return;

      capture.addedVh += deltaVh;

      store.update(
        (next) => {
          const section = next.sections.find(
            (item) => item.id === capture.sectionId
          );
          if (!section) return;

          section.duration = round(
            Math.max(5, capture.startDuration + capture.addedVh),
            2
          );
          section.pin = { ...(section.pin || {}), enabled: true };
        },
        { record: false }
      );

      // Keep the viewport physically pinned while the user is "drawing"
      // additional scroll duration with the wheel/trackpad.
      window.scrollTo({ top: capture.startY, behavior: "instant" });

      setSaveStatus(
        "PIN CAPTURE · +" +
          round(capture.addedVh, 1) +
          "vh · " +
          capture.sectionId
      );
    };

    const onKeyUp = (event) => {
      if (event.key.toLowerCase() !== "p" || !pinCaptureRef.current) return;

      const capture = pinCaptureRef.current;
      pinCaptureRef.current = null;

      const committed = store.get();
      store.replace(capture.originalStory, { record: false });
      store.replace(committed, { record: true });

      window.scrollTo({ top: capture.startY, behavior: "instant" });

      setSaveStatus(
        "Pinned " +
          capture.sectionId +
          " +" +
          round(capture.addedVh, 1) +
          "vh"
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [store, selectedKeyframe, activeTrack, api]);

  const ranges = useMemo(() => getSectionRanges(story), [story]);
  const total = useMemo(() => getStoryDuration(story), [story]);
  const productKeyframes = story.tracks?.product || [];
  const cameraKeyframes = story.tracks?.camera || [];
  const activeTimelineTrack = activeTrack === "camera" ? "camera" : "product";
  const activeKeyframes =
    activeTimelineTrack === "camera" ? cameraKeyframes : productKeyframes;

  const currentSection =
    story.sections.find((section) => section.id === selectedSection) ||
    story.sections[0];

  useEffect(() => {
    if (!playing || !api || preview) return undefined;

    const startedAt = performance.now();
    const startTime = getStoryRuntimeState().time;
    const unitsPerMs = total / 30000;

    const tick = (now) => {
      const nextTime = Math.min(
        total,
        startTime + (now - startedAt) * unitsPerMs
      );
      api.scrollToTime?.(nextTime);

      if (nextTime >= total - 0.001) {
        setPlaying(false);
        return;
      }

      playbackRafRef.current = requestAnimationFrame(tick);
    };

    playbackRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackRafRef.current) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [playing, api, total, preview]);

  useEffect(() => {
    setSelectedKeyframe(null);
  }, [activeTrack]);

  const commitAutoKey = ({
    track = activeTrack,
    stateOverride = null,
    record = true,
    label = "AUTO KEY",
  } = {}) => {
    const currentStory = store.get();
    const runtimeNow = getStoryRuntimeState();
    const location = storyPointToSectionProgress(currentStory, runtimeNow.time);
    const trackItems = currentStory.tracks?.[track] || [];
    const tolerance = 0.01;

    const nearby = trackItems.find(
      (item) =>
        item.section === location.section &&
        Math.abs((item.progress ?? 0) - location.progress) <= tolerance
    );

    const selected = trackItems.find((item) => item.id === selectedKeyframe);
    const selectedIsHere =
      selected &&
      selected.section === location.section &&
      Math.abs((selected.progress ?? 0) - location.progress) <= tolerance * 2;

    const existing = selectedIsHere ? selected : nearby;
    const id =
      existing?.id ||
      track +
        "-" +
        location.section +
        "-" +
        Math.round(location.progress * 10000);

    if (track === "camera") {
      const captured = stateOverride || api?.captureCameraState?.() || cameraInspector;
      if (!captured) return null;

      const keyframe = {
        id,
        section: location.section,
        progress: round(location.progress, 5),
        ease: existing?.ease || "smooth",
        state: {
          position: (captured.position || [0, 1.18, 4.45]).map((value) =>
            round(value, 4)
          ),
          target: (captured.target || [0, -0.08, 0]).map((value) =>
            round(value, 4)
          ),
          fov: round(captured.fov ?? 36, 3),
        },
      };

      store.replace(
        upsertCameraKeyframe(currentStory, keyframe, tolerance),
        { record }
      );
      setSelectedKeyframe(id);
      setSelectedSection(location.section);
      api?.clearEditorPreview?.("camera");
      setSaveStatus(label + " · camera · " + location.section);
      return keyframe;
    }

    const captured = stateOverride || api?.captureProductState?.() || inspector;
    if (!captured) return null;

    const keyframe = {
      id,
      section: location.section,
      progress: round(location.progress, 5),
      chapter: existing?.chapter || runtimeNow.chapter || "CUSTOM",
      ease: existing?.ease || "smooth",
      state: {
        x: round(captured.x),
        y: round(captured.y),
        z: round(captured.z),
        rx: round(captured.rx, 5),
        ry: round(captured.ry, 5),
        rz: round(captured.rz, 5),
        scale: round(captured.scale),
        lid: round(captured.lid ?? 1),
        keyboardLight: round(captured.keyboardLight ?? 1),
        explodeEnabled: captured.explodeEnabled !== false,
        explode: round(captured.explode),
        parts: structuredClone(captured.parts || {}),
        screen: Math.round(captured.screen || 0),
        cool: round(captured.cool),
        warm: round(captured.warm),
        ambient: round(captured.ambient),
        shadow: round(captured.shadow),
        opacity: round(captured.opacity ?? 1),
      },
    };

    store.replace(
      upsertProductKeyframe(currentStory, keyframe, tolerance),
      { record }
    );
    setSelectedKeyframe(id);
    setSelectedSection(location.section);
    api?.clearEditorPreview?.("product");
    setSaveStatus(label + " · product · " + location.section);
    return keyframe;
  };

  const scheduleAutoKey = (track, state) => {
    if (autoKeyTimerRef.current) {
      window.clearTimeout(autoKeyTimerRef.current);
    }
    autoKeyTimerRef.current = window.setTimeout(() => {
      commitAutoKey({
        track,
        stateOverride: state,
        record: true,
        label: "AUTO KEY",
      });
      autoKeyTimerRef.current = null;
    }, 120);
  };

  const updateInspector = (patch) => {
    const live = api?.captureProductState?.() || inspector || {};
    const next = { ...live, ...patch };
    setInspector(next);
    api?.previewProductState?.(next);
    scheduleAutoKey("product", next);
  };

  const updateCameraInspector = (patch) => {
    const next = { ...(cameraInspector || {}), ...patch };
    setCameraInspector(next);
    api?.previewCameraState?.(next);
    scheduleAutoKey("camera", next);
  };

  const updatePartById = (id, patch) => {
    if (!id) return;
    const fallback = {
      visible: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    const current =
      id === selectedPartId && partInspector
        ? partInspector
        : api?.capturePartState?.(id) || fallback;
    const next = { ...current, ...patch };

    if (id === selectedPartId) setPartInspector(next);
    api?.previewPartState?.(id, next);

    const captured = api?.captureProductState?.();
    if (captured) {
      setInspector(captured);
      scheduleAutoKey("product", captured);
    }
  };

  const updatePartInspector = (patch) => {
    updatePartById(selectedPartId, patch);
  };

  useEffect(() => {
    if (
      !api ||
      (activeTrack !== "product" && activeTrack !== "parts")
    ) {
      wasManipulatingRef.current = runtime.manipulating;
      return;
    }

    if (runtime.manipulating) {
      wasManipulatingRef.current = true;
      return;
    }

    if (wasManipulatingRef.current) {
      wasManipulatingRef.current = false;
      const captured = api.captureProductState?.();
      if (captured) {
        setInspector(captured);
        if (activeTrack === "parts" && selectedPartId) {
          const partNext = api.capturePartState?.(selectedPartId);
          if (partNext) setPartInspector(partNext);
        }
        commitAutoKey({
          track: "product",
          stateOverride: captured,
          record: true,
          label: activeTrack === "parts" ? "AUTO KEY · PART" : "AUTO KEY",
        });
      }
    }
  }, [runtime.manipulating, api, activeTrack, selectedPartId]);

  useEffect(
    () => () => {
      if (autoKeyTimerRef.current) {
        window.clearTimeout(autoKeyTimerRef.current);
      }
    },
    []
  );

  const previewKeyframeState = (keyframe, track = activeTrack) => {
    if (!keyframe) return;

    if (track === "camera") {
      const state = keyframe.state || {};
      setCameraInspector(state);
      api?.previewCameraState?.(state);
      return;
    }

    const state = keyframe.state || {};
    setInspector((current) => ({ ...(current || {}), ...state }));
    api?.previewProductState?.(state);
  };

  const selectAndPreviewKeyframe = (keyframe, track = activeTrack) => {
    if (!keyframe) return;
    const at = keyframeTime(story, keyframe);
    setActiveTrack((current) =>
      current === "parts" && track === "product" ? "parts" : track
    );
    setSelectedKeyframe(keyframe.id);
    setSelectedSection(keyframe.section);
    api?.scrollToTime?.(at);

    // Apply the saved pose immediately after the seek clears any prior preview.
    // The rendered object is therefore the source of visual feedback, not JSON.
    previewKeyframeState(keyframe, track);
  };

  const saveKeyframe = () => {
    const location = storyPointToSectionProgress(story, runtime.time);
    const existing =
      activeKeyframes.find((item) => item.id === selectedKeyframe) || null;

    const id =
      existing?.id ||
      activeTimelineTrack +
        "-" +
        location.section +
        "-" +
        Math.round(location.progress * 10000);

    if (activeTrack === "camera") {
      const captured = api?.captureCameraState?.() || cameraInspector;
      if (!captured) return;

      const keyframe = {
        id,
        section: location.section,
        progress: round(location.progress, 5),
        ease: existing?.ease || "smooth",
        state: {
          position: (captured.position || [0, 1.18, 4.45]).map((value) =>
            round(value, 4)
          ),
          target: (captured.target || [0, -0.08, 0]).map((value) =>
            round(value, 4)
          ),
          fov: round(captured.fov ?? 36, 3),
        },
      };

      store.replace(upsertCameraKeyframe(story, keyframe));
      setSelectedKeyframe(id);
      setSaveStatus("Camera keyframe updated in editor draft");
      return;
    }

    const captured = api?.captureProductState?.() || inspector;
    if (!captured) return;

    const keyframe = {
      id,
      section: location.section,
      progress: round(location.progress, 5),
      chapter: existing?.chapter || runtime.chapter || "CUSTOM",
      ease: existing?.ease || "smooth",
      state: {
        x: round(captured.x),
        y: round(captured.y),
        z: round(captured.z),
        rx: round(captured.rx, 5),
        ry: round(captured.ry, 5),
        rz: round(captured.rz, 5),
        scale: round(captured.scale),
        lid: round(captured.lid ?? 1),
        keyboardLight: round(captured.keyboardLight ?? 1),
        explodeEnabled: captured.explodeEnabled !== false,
        explode: round(captured.explode),
        parts: structuredClone(captured.parts || {}),
        screen: Math.round(captured.screen || 0),
        cool: round(captured.cool),
        warm: round(captured.warm),
        ambient: round(captured.ambient),
        shadow: round(captured.shadow),
        opacity: round(captured.opacity ?? 1),
      },
    };

    store.replace(upsertProductKeyframe(story, keyframe));
    setSelectedKeyframe(id);
    setSaveStatus("Product keyframe updated in editor draft");
  };

  const deleteKeyframeById = (track, id) => {
    if (!id) return;
    store.update((next) => {
      next.tracks[track] = (next.tracks[track] || []).filter(
        (item) => item.id !== id
      );
    });
    api?.clearEditorPreview?.(track);
    api?.scrollToTime?.(getStoryRuntimeState().time);
    setActiveTrack((current) =>
      current === "parts" && track === "product" ? "parts" : track
    );
    setSelectedKeyframe((current) => (current === id ? null : current));
    setSaveStatus("Removed " + track + " keyframe");
  };

  const deleteKeyframe = () => {
    if (!selectedKeyframe) return;
    deleteKeyframeById(activeTimelineTrack, selectedKeyframe);
  };

  const updateSection = (patch) => {
    store.update((next) => {
      const section = next.sections.find((item) => item.id === selectedSection);
      if (section) Object.assign(section, patch);
    });
  };

  const saveProject = async () => {
    try {
      const validationErrors = validateStory(story);
      if (validationErrors.length) {
        setSaveStatus("Invalid story: " + validationErrors[0]);
        return;
      }

      setSaveStatus("Saving...");
      const response = await fetch("/__scroll-story/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: savePath, story }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Save failed");
      }
      store.clearDraft();
      setSaveStatus("Saved to " + result.path);
    } catch (error) {
      setSaveStatus("Save failed — use Export JSON");
    }
  };

  const beginTimelineScrub = (event) => {
    if (!api || !timelineRef.current) return;

    event.preventDefault();
    setPlaying(false);
    setSelectedKeyframe(null);

    const seek = (pointerEvent) => {
      const rect = timelineRef.current.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(
          1,
          (pointerEvent.clientX - rect.left) / Math.max(1, rect.width)
        )
      );
      const time = progress * total;
      api.scrollToTime?.(time);
      setSaveStatus(
        "SCRUB · " + round(time, 1) + " / " + round(total, 1)
      );
    };

    seek(event);

    const move = (pointerEvent) => seek(pointerEvent);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setSaveStatus("Playhead · " + round(getStoryRuntimeState().time, 1));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const beginKeyframeDrag = (event, keyframe, track = activeTrack) => {
    event.preventDefault();
    event.stopPropagation();

    const timeline = timelineRef.current;
    if (!timeline) return;

    // A keyframe dot is a pose button first. Pressing it immediately seeks to
    // and previews that saved pose. Only a real horizontal drag retimes it.
    selectAndPreviewKeyframe(keyframe, track);

    const original = store.get();
    let finalStory = original;
    const startX = event.clientX;
    let moved = false;

    const move = (pointerEvent) => {
      if (!moved && Math.abs(pointerEvent.clientX - startX) < 4) return;
      moved = true;

      const rect = timeline.getBoundingClientRect();
      const normalized = Math.max(
        0,
        Math.min(
          1,
          (pointerEvent.clientX - rect.left) / Math.max(1, rect.width)
        )
      );
      const time = normalized * getStoryDuration(store.get());
      const location = storyPointToSectionProgress(store.get(), time);
      finalStory = store.get();

      const target = (finalStory.tracks[track] || []).find(
        (item) => item.id === keyframe.id
      );
      if (!target) return;

      target.section = location.section;
      target.progress = round(location.progress, 5);
      store.replace(finalStory, { record: false });
      setSelectedSection(location.section);
      api?.scrollToTime?.(time);
      previewKeyframeState(target, track);
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);

      if (!moved) {
        setSaveStatus("Selected keyframe · " + (keyframe.chapter || "CAMERA"));
        return;
      }

      const committed = structuredClone(finalStory);
      store.replace(original, { record: false });
      store.replace(committed, { record: true });
      setSaveStatus("Keyframe timing changed");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const beginSectionResize = (event, sectionId) => {
    event.preventDefault();
    event.stopPropagation();

    const timeline = timelineRef.current;
    if (!timeline) return;

    const original = store.get();
    const originalSection = original.sections.find(
      (item) => item.id === sectionId
    );
    if (!originalSection) return;

    const startX = event.clientX;
    const startDuration = Number(originalSection.duration) || 1;
    let finalStory = original;

    const move = (pointerEvent) => {
      const rect = timeline.getBoundingClientRect();
      const unitsPerPixel =
        getStoryDuration(store.get()) / Math.max(1, rect.width);
      const nextDuration = Math.max(
        5,
        startDuration + (pointerEvent.clientX - startX) * unitsPerPixel
      );

      finalStory = store.get();
      const section = finalStory.sections.find(
        (item) => item.id === sectionId
      );
      if (!section) return;

      section.duration = round(nextDuration, 2);
      store.replace(finalStory, { record: false });
      setSelectedSection(sectionId);
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const committed = structuredClone(finalStory);
      store.replace(original, { record: false });
      store.replace(committed, { record: true });
      setSaveStatus("Section duration changed");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  if (preview) {
    return (
      <button
        className="sse-preview-return"
        onClick={() => setPreview(false)}
        title="Return to editor"
      >
        EDIT
      </button>
    );
  }

  return (
    <aside
      className="sse"
      data-compact={compact ? "true" : "false"}
      aria-label="Scroll Story Editor"
    >
      <div className="sse-topbar">
        <div>
          <div className="sse-brand-row">
            <strong>SCROLL STORY</strong>
            <i className="sse-live-badge">LIVE VIEW</i>
            <i className="sse-autokey-badge">AUTO KEY ON</i>
          </div>
          <span>{story.project?.name || "Project"} · schema {story.schemaVersion}</span>
        </div>

        <div className="sse-actions">
          <button disabled={activeTrack === "camera"} onClick={() => setMode("translate")} data-active={mode === "translate"}>W Move</button>
          <button disabled={activeTrack === "camera"} onClick={() => setMode("rotate")} data-active={mode === "rotate"}>E Rotate</button>
          <button disabled={activeTrack === "camera"} onClick={() => setMode("scale")} data-active={mode === "scale"}>R Scale</button>
          <button onClick={() => store.undo()} disabled={!store.canUndo()}>Undo</button>
          <button onClick={() => store.redo()} disabled={!store.canRedo()}>Redo</button>
          <button
            className="sse-keyframe-quick"
            onClick={saveKeyframe}
            disabled={!api}
          >
            Save keyframe
          </button>
          <button onClick={() => setCompact((value) => !value)}>
            {compact ? "Expand" : "Compact"}
          </button>
          <button onClick={() => setPreview(true)}>Preview</button>
          <button className="sse-primary" onClick={saveProject}>Save JSON</button>
          <button onClick={() => downloadStory(story)}>Export</button>
        </div>
      </div>

      <div className="sse-body">
        <section className="sse-inspector">
          <div className="sse-panel-heading">
            <div className="sse-track-tabs">
              <button
                data-active={activeTrack === "product"}
                onClick={() => setActiveTrack("product")}
              >
                Product
              </button>
              <button
                data-active={activeTrack === "parts"}
                onClick={() => setActiveTrack("parts")}
              >
                Parts
              </button>
              <button
                data-active={activeTrack === "camera"}
                onClick={() => setActiveTrack("camera")}
              >
                Camera
              </button>
            </div>
            <span>{runtime.chapter} / {runtime.time.toFixed(1)}</span>
          </div>

          {activeTrack === "product" ? (
            <>
              <div className="sse-fields">
                <NumberField label="X" value={inspector?.x ?? 0} onChange={(x) => updateInspector({ x })} />
                <NumberField label="Y" value={inspector?.y ?? 0} onChange={(y) => updateInspector({ y })} />
                <NumberField label="Z" value={inspector?.z ?? 0} onChange={(z) => updateInspector({ z })} />
                <NumberField label="RX deg" step={1} value={radToDeg(inspector?.rx)} onChange={(value) => updateInspector({ rx: degToRad(value) })} />
                <NumberField label="RY deg" step={1} value={radToDeg(inspector?.ry)} onChange={(value) => updateInspector({ ry: degToRad(value) })} />
                <NumberField label="RZ deg" step={1} value={radToDeg(inspector?.rz)} onChange={(value) => updateInspector({ rz: degToRad(value) })} />
                <NumberField label="Scale" value={inspector?.scale ?? 1} onChange={(scale) => updateInspector({ scale })} />
                <NumberField label="Lid open" value={inspector?.lid ?? 1} step={0.05} onChange={(lid) => updateInspector({ lid })} />
                <NumberField label="Keyboard light" value={inspector?.keyboardLight ?? 1} step={0.05} onChange={(keyboardLight) => updateInspector({ keyboardLight })} />
                <NumberField label="Explode" value={inspector?.explode ?? 0} step={0.05} onChange={(explode) => updateInspector({ explode })} />
                <label className="sse-check sse-check--compact">
                  <input
                    type="checkbox"
                    checked={inspector?.explodeEnabled !== false}
                    onChange={(event) =>
                      updateInspector({ explodeEnabled: event.target.checked })
                    }
                  />
                  <span>Explode on</span>
                </label>
              </div>
              <div className="sse-fields sse-fields--secondary">
                <NumberField label="Cool light" value={inspector?.cool ?? 2.8} onChange={(cool) => updateInspector({ cool })} />
                <NumberField label="Warm light" value={inspector?.warm ?? 1.1} onChange={(warm) => updateInspector({ warm })} />
                <NumberField label="Ambient" value={inspector?.ambient ?? 1.25} onChange={(ambient) => updateInspector({ ambient })} />
                <NumberField label="Shadow" value={inspector?.shadow ?? 0.55} onChange={(shadow) => updateInspector({ shadow })} />
                <NumberField label="Opacity" value={inspector?.opacity ?? 1} onChange={(opacity) => updateInspector({ opacity })} />
              </div>
            </>
          ) : activeTrack === "parts" ? (
            <div className="sse-parts-panel">
              <label className="sse-wide-field">
                <span>Component</span>
                <select
                  value={selectedPartId || ""}
                  onChange={(event) => {
                    const id = event.target.value || null;
                    setSelectedPartId(id);
                    api?.selectEditablePart?.(id);
                    const next = id ? api?.capturePartState?.(id) : null;
                    if (next) setPartInspector(next);
                  }}
                >
                  {editableParts.map((part) => (
                    <option value={part.id} key={part.id}>
                      {part.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sse-check sse-check--inline">
                <input
                  type="checkbox"
                  checked={partInspector?.visible !== false}
                  onChange={(event) =>
                    updatePartInspector({ visible: event.target.checked })
                  }
                />
                <span>Visible</span>
              </label>

              <div className="sse-part-callout-actions">
                <button
                  type="button"
                  onClick={() =>
                    updatePartInspector({
                      position: [
                        0.14,
                        partInspector?.position?.[1] ?? 0,
                        partInspector?.position?.[2] ?? 0,
                      ],
                    })
                  }
                >
                  Move out +X
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePartInspector({
                      position: [
                        -0.14,
                        partInspector?.position?.[1] ?? 0,
                        partInspector?.position?.[2] ?? 0,
                      ],
                    })
                  }
                >
                  Move out -X
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePartInspector({
                      visible: true,
                      position: [0, 0, 0],
                      rotation: [0, 0, 0],
                      scale: [1, 1, 1],
                    })
                  }
                >
                  Return to explode
                </button>
              </div>
              <p className="sse-part-callout-hint">
                Part transforms are relative to the exploded pose. Drag with W/E/R,
                save the OUT key, return the part, then save the RETURN key before
                moving the next component.
              </p>

              <div className="sse-part-browser">
                {editableParts.map((part) => {
                  const visible =
                    inspector?.parts?.[part.id]?.visible !== false;
                  return (
                    <div
                      className="sse-part-chip"
                      data-selected={selectedPartId === part.id}
                      key={part.id}
                    >
                      <button
                        type="button"
                        className="sse-part-select"
                        onClick={() => {
                          setSelectedPartId(part.id);
                          api?.selectEditablePart?.(part.id);
                          const next = api?.capturePartState?.(part.id);
                          if (next) setPartInspector(next);
                        }}
                      >
                        {part.label}
                      </button>
                      <button
                        type="button"
                        className="sse-part-eye"
                        data-visible={visible}
                        title={visible ? "Hide component" : "Show component"}
                        aria-label={
                          (visible ? "Hide " : "Show ") + part.label
                        }
                        onClick={() =>
                          updatePartById(part.id, { visible: !visible })
                        }
                      >
                        {visible ? "◉" : "○"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="sse-fields sse-fields--parts">
                <NumberField
                  label="Part X"
                  value={partInspector?.position?.[0] ?? 0}
                  onChange={(value) =>
                    updatePartInspector({
                      position: [
                        value,
                        partInspector?.position?.[1] ?? 0,
                        partInspector?.position?.[2] ?? 0,
                      ],
                    })
                  }
                />
                <NumberField
                  label="Part Y"
                  value={partInspector?.position?.[1] ?? 0}
                  onChange={(value) =>
                    updatePartInspector({
                      position: [
                        partInspector?.position?.[0] ?? 0,
                        value,
                        partInspector?.position?.[2] ?? 0,
                      ],
                    })
                  }
                />
                <NumberField
                  label="Part Z"
                  value={partInspector?.position?.[2] ?? 0}
                  onChange={(value) =>
                    updatePartInspector({
                      position: [
                        partInspector?.position?.[0] ?? 0,
                        partInspector?.position?.[1] ?? 0,
                        value,
                      ],
                    })
                  }
                />
                <NumberField
                  label="RX deg"
                  step={1}
                  value={radToDeg(partInspector?.rotation?.[0])}
                  onChange={(value) =>
                    updatePartInspector({
                      rotation: [
                        degToRad(value),
                        partInspector?.rotation?.[1] ?? 0,
                        partInspector?.rotation?.[2] ?? 0,
                      ],
                    })
                  }
                />
                <NumberField
                  label="RY deg"
                  step={1}
                  value={radToDeg(partInspector?.rotation?.[1])}
                  onChange={(value) =>
                    updatePartInspector({
                      rotation: [
                        partInspector?.rotation?.[0] ?? 0,
                        degToRad(value),
                        partInspector?.rotation?.[2] ?? 0,
                      ],
                    })
                  }
                />
                <NumberField
                  label="RZ deg"
                  step={1}
                  value={radToDeg(partInspector?.rotation?.[2])}
                  onChange={(value) =>
                    updatePartInspector({
                      rotation: [
                        partInspector?.rotation?.[0] ?? 0,
                        partInspector?.rotation?.[1] ?? 0,
                        degToRad(value),
                      ],
                    })
                  }
                />
                <NumberField
                  label="Scale X"
                  value={partInspector?.scale?.[0] ?? 1}
                  onChange={(value) =>
                    updatePartInspector({
                      scale: [
                        value,
                        partInspector?.scale?.[1] ?? 1,
                        partInspector?.scale?.[2] ?? 1,
                      ],
                    })
                  }
                />
                <NumberField
                  label="Scale Y"
                  value={partInspector?.scale?.[1] ?? 1}
                  onChange={(value) =>
                    updatePartInspector({
                      scale: [
                        partInspector?.scale?.[0] ?? 1,
                        value,
                        partInspector?.scale?.[2] ?? 1,
                      ],
                    })
                  }
                />
                <NumberField
                  label="Scale Z"
                  value={partInspector?.scale?.[2] ?? 1}
                  onChange={(value) =>
                    updatePartInspector({
                      scale: [
                        partInspector?.scale?.[0] ?? 1,
                        partInspector?.scale?.[1] ?? 1,
                        value,
                      ],
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="sse-fields sse-fields--camera">
              <NumberField label="Cam X" value={cameraInspector?.position?.[0] ?? 0} onChange={(value) => updateCameraInspector({ position: [value, cameraInspector?.position?.[1] ?? 1.18, cameraInspector?.position?.[2] ?? 4.45] })} />
              <NumberField label="Cam Y" value={cameraInspector?.position?.[1] ?? 1.18} onChange={(value) => updateCameraInspector({ position: [cameraInspector?.position?.[0] ?? 0, value, cameraInspector?.position?.[2] ?? 4.45] })} />
              <NumberField label="Cam Z" value={cameraInspector?.position?.[2] ?? 4.45} onChange={(value) => updateCameraInspector({ position: [cameraInspector?.position?.[0] ?? 0, cameraInspector?.position?.[1] ?? 1.18, value] })} />
              <NumberField label="Look X" value={cameraInspector?.target?.[0] ?? 0} onChange={(value) => updateCameraInspector({ target: [value, cameraInspector?.target?.[1] ?? -0.08, cameraInspector?.target?.[2] ?? 0] })} />
              <NumberField label="Look Y" value={cameraInspector?.target?.[1] ?? -0.08} onChange={(value) => updateCameraInspector({ target: [cameraInspector?.target?.[0] ?? 0, value, cameraInspector?.target?.[2] ?? 0] })} />
              <NumberField label="Look Z" value={cameraInspector?.target?.[2] ?? 0} onChange={(value) => updateCameraInspector({ target: [cameraInspector?.target?.[0] ?? 0, cameraInspector?.target?.[1] ?? -0.08, value] })} />
              <NumberField label="FOV" value={cameraInspector?.fov ?? 36} step={1} onChange={(fov) => updateCameraInspector({ fov })} />
            </div>
          )}

          <div className="sse-keyframe-actions">
            <button className="sse-primary" data-sse-save-keyframe onClick={saveKeyframe}>
              {selectedKeyframe ? "Update " : "Save "}
              {activeTrack === "parts" ? "part state" : activeTrack + " keyframe"}
            </button>
            <button onClick={() => setSelectedKeyframe(null)}>New</button>
            <button onClick={deleteKeyframe} disabled={!selectedKeyframe}>Delete</button>
          </div>
        </section>

        <section className="sse-section-panel">
          <div className="sse-panel-heading">
            <strong>Section / pin</strong>
            <span>Longer duration = longer scroll hold</span>
          </div>

          <label className="sse-wide-field">
            <span>Section</span>
            <select
              value={selectedSection}
              onChange={(event) => setSelectedSection(event.target.value)}
            >
              {story.sections.map((section) => (
                <option value={section.id} key={section.id}>{section.label}</option>
              ))}
            </select>
          </label>

          <NumberField
            label="Duration (vh)"
            value={currentSection?.duration || 1}
            step={5}
            onChange={(duration) => updateSection({ duration: Math.max(1, duration) })}
          />

          <label className="sse-check">
            <input
              type="checkbox"
              checked={Boolean(currentSection?.pin?.enabled)}
              onChange={(event) =>
                updateSection({
                  pin: { ...(currentSection.pin || {}), enabled: event.target.checked },
                })
              }
            />
            <span>Pin section stage</span>
          </label>

          <p className="sse-help">
            Scroll to any moment, pose the model with the gizmo, then press K or Save keyframe.
            W/E/R switch move, rotate, and scale. Hold P while scrolling to add pin duration. Space toggles clean preview.
          </p>
        </section>
      </div>

      <div className="sse-timeline-wrap">
        <div className="sse-transport">
          <div className="sse-transport-group">
            <button
              className="sse-transport-play"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              title={playing ? "Pause timeline" : "Play timeline"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="sse-timecode">
              {runtime.time.toFixed(1)}
              <i>/</i>
              {total.toFixed(1)}
            </span>
            <span className="sse-chapter-readout">{runtime.chapter}</span>
          </div>

          <div className="sse-transport-group sse-transport-group--right">
            <span className="sse-status">{saveStatus}</span>
            <button
              className="sse-delete-keyframe"
              disabled={!selectedKeyframe}
              onClick={deleteKeyframe}
              title="Delete selected keyframe (Delete / Backspace)"
            >
              Delete keyframe
            </button>
          </div>
        </div>

        <div className="sse-timeline-editor">
          <div className="sse-track-labels">
            <div className="sse-track-label sse-track-label--ruler">TIME</div>
            <div className="sse-track-label">SECTIONS</div>
            <button
              className="sse-track-label"
              data-active={
                activeTrack === "product" || activeTrack === "parts"
              }
              onClick={() => setActiveTrack("product")}
            >
              PRODUCT
            </button>
            <button
              className="sse-track-label"
              data-active={activeTrack === "camera"}
              onClick={() => setActiveTrack("camera")}
            >
              CAMERA
            </button>
          </div>

          <div
            className="sse-time-area"
            ref={timelineRef}
            onPointerDown={beginTimelineScrub}
          >
            <div className="sse-ruler">
              {[0, 0.25, 0.5, 0.75, 1].map((value) => (
                <span
                  className="sse-ruler-tick"
                  key={value}
                  style={{ left: value * 100 + "%" }}
                >
                  {round(total * value, 0)}
                </span>
              ))}
            </div>

            <div
              className="sse-playhead"
              style={{ left: (runtime.time / Math.max(1, total)) * 100 + "%" }}
            />

            <div className="sse-lane sse-lane--sections">
              {ranges.map((section) => (
                <button
                  key={section.id}
                  className="sse-section-block"
                  style={{
                    left: (section.start / total) * 100 + "%",
                    width: (section.duration / total) * 100 + "%",
                  }}
                  data-selected={selectedSection === section.id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setPlaying(false);
                    setSelectedSection(section.id);
                    api?.scrollToTime?.(section.start);
                  }}
                >
                  <span>{section.label}</span>
                  {section.pin?.enabled && <i>PIN</i>}
                  <b
                    className="sse-section-resize"
                    title="Drag to change section scroll duration"
                    onPointerDown={(event) =>
                      beginSectionResize(event, section.id)
                    }
                  />
                </button>
              ))}
            </div>

            <div
              className="sse-lane sse-lane--keyframes"
              data-active={
                activeTrack === "product" || activeTrack === "parts"
              }
            >
              {productKeyframes.map((keyframe) => {
                const at = keyframeTime(story, keyframe);
                return (
                  <button
                    key={keyframe.id}
                    className="sse-keyframe"
                    data-selected={
                      (activeTrack === "product" ||
                        activeTrack === "parts") &&
                      selectedKeyframe === keyframe.id
                    }
                    title={
                      (keyframe.chapter || "PRODUCT") +
                      " / " +
                      keyframe.section +
                      " · click pose · drag timing · right-click delete"
                    }
                    style={{ left: (at / total) * 100 + "%" }}
                    onPointerDown={(event) =>
                      beginKeyframeDrag(event, keyframe, "product")
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteKeyframeById("product", keyframe.id);
                    }}
                  >
                    <span>{keyframe.chapter || "PRODUCT"}</span>
                  </button>
                );
              })}
            </div>

            <div
              className="sse-lane sse-lane--keyframes"
              data-active={activeTrack === "camera"}
            >
              {cameraKeyframes.map((keyframe) => {
                const at = keyframeTime(story, keyframe);
                return (
                  <button
                    key={keyframe.id}
                    className="sse-keyframe sse-keyframe--camera"
                    data-selected={
                      activeTrack === "camera" &&
                      selectedKeyframe === keyframe.id
                    }
                    title={
                      "CAMERA / " +
                      keyframe.section +
                      " · click pose · drag timing · right-click delete"
                    }
                    style={{ left: (at / total) * 100 + "%" }}
                    onPointerDown={(event) =>
                      beginKeyframeDrag(event, keyframe, "camera")
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteKeyframeById("camera", keyframe.id);
                    }}
                  >
                    <span>CAMERA</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
