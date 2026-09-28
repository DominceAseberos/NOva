let api = null;
const apiListeners = new Set();
const runtimeListeners = new Set();
let runtimeState = {
  time: 0,
  section: "top",
  progress: 0,
  chapter: "ARRIVAL",
  manipulating: false,
  ready: false,
};

export function registerStoryRuntimeApi(nextApi) {
  api = nextApi;
  apiListeners.forEach((listener) => listener(api));
  return () => {
    if (api === nextApi) {
      api = null;
      apiListeners.forEach((listener) => listener(null));
    }
  };
}

export function getStoryRuntimeApi() {
  return api;
}

export function subscribeStoryRuntimeApi(listener) {
  apiListeners.add(listener);
  listener(api);
  return () => apiListeners.delete(listener);
}

export function publishStoryRuntimeState(nextState) {
  runtimeState = { ...runtimeState, ...nextState };
  runtimeListeners.forEach((listener) => listener(runtimeState));
}

export function getStoryRuntimeState() {
  return { ...runtimeState };
}

export function subscribeStoryRuntimeState(listener) {
  runtimeListeners.add(listener);
  listener(runtimeState);
  return () => runtimeListeners.delete(listener);
}
