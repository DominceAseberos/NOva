import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export function createThreeTransformAdapter({
  camera,
  domElement,
  scene,
  target,
  mode = "translate",
  space = "world",
  size = 0.72,
  onStart,
  onEnd,
  onChange,
}) {
  if (!camera || !domElement || !scene || !target) {
    throw new Error("createThreeTransformAdapter requires camera, domElement, scene, and target.");
  }

  const controls = new TransformControls(camera, domElement);
  controls.attach(target);
  controls.setMode(mode);
  controls.setSpace(space);
  controls.size = size;
  controls.enabled = false;

  const helper = controls.getHelper();
  helper.visible = false;
  helper.renderOrder = 1000;
  scene.add(helper);

  const handleMouseDown = () => onStart?.({ controls, target });
  const handleMouseUp = () => onEnd?.({ controls, target });
  const handleObjectChange = () => onChange?.({ controls, target });

  controls.addEventListener("mouseDown", handleMouseDown);
  controls.addEventListener("mouseUp", handleMouseUp);
  controls.addEventListener("objectChange", handleObjectChange);

  return {
    controls,
    helper,
    target,
    setEnabled(enabled) {
      const next = Boolean(enabled);
      controls.enabled = next;
      helper.visible = next;
    },
    setMode(nextMode) {
      if (["translate", "rotate", "scale"].includes(nextMode)) {
        controls.setMode(nextMode);
      }
    },
    setSpace(nextSpace) {
      if (["world", "local"].includes(nextSpace)) {
        controls.setSpace(nextSpace);
      }
    },
    attach(nextTarget) {
      controls.attach(nextTarget);
    },
    detach() {
      controls.detach();
    },
    dispose() {
      controls.removeEventListener("mouseDown", handleMouseDown);
      controls.removeEventListener("mouseUp", handleMouseUp);
      controls.removeEventListener("objectChange", handleObjectChange);
      controls.detach();
      controls.dispose();
      if (helper.parent) helper.parent.remove(helper);
    },
  };
}
