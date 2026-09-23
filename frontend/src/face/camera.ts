export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === 'videoinput',
  );
}

const phoneCamera = /phone|oppo|android|iphone|mobile|droidcam|iriun|continuity/i;

export function cameraLabel(device: MediaDeviceInfo, index: number) {
  if (phoneCamera.test(device.label)) return `Phone camera (${index + 1})`;
  if (/integrated|built.?in|internal|laptop|facetime/i.test(device.label)) return 'Laptop camera';
  return `Camera ${index + 1}`;
}

export function preferredCamera(devices: MediaDeviceInfo[]) {
  const local = devices.filter(
    (device) => device.label && !phoneCamera.test(device.label) && !/virtual/i.test(device.label),
  );
  return (
    local.find((device) => /integrated|built.?in|internal|laptop|facetime/i.test(device.label)) ??
    local[0]
  );
}

export function stopCamera(video: HTMLVideoElement) {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  video.pause();
  video.srcObject = null;
}

function bounded<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeout: number,
  message: string,
) {
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      finish(() => reject(signal?.reason ?? new DOMException('Cancelled', 'AbortError')));
    const timer = setTimeout(() => finish(() => reject(new Error(message))), timeout);
    const finish = (callback: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback();
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

export async function startCamera(
  video: HTMLVideoElement,
  signal?: AbortSignal,
  deviceId?: string,
  onDevices?: (devices: MediaDeviceInfo[]) => void,
) {
  signal?.throwIfAborted();
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('Camera access requires localhost or HTTPS and a supported browser.');
  stopCamera(video);
  let stream: MediaStream | undefined;
  const open = async (id?: string) => {
    let expired = false;
    const request = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          ...(id ? { deviceId: { exact: id } } : { facingMode: 'user' }),
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      .then((result) => {
        if (expired || signal?.aborted) result.getTracks().forEach((track) => track.stop());
        return result;
      });
    try {
      return await bounded(
        request,
        signal,
        30_000,
        'Camera access timed out. Check camera permission and select your laptop camera, then retry.',
      );
    } finally {
      expired = true;
    }
  };
  try {
    let devices = await listCameras();
    signal?.throwIfAborted();
    onDevices?.(devices);
    let chosen = deviceId || preferredCamera(devices)?.deviceId;
    if (!chosen && devices.some((device) => device.label))
      throw new Error('Select a camera below. No laptop webcam was identified.');
    stream = await open(chosen);
    signal?.throwIfAborted();
    if (!chosen) {
      devices = await listCameras();
      signal?.throwIfAborted();
      onDevices?.(devices);
      chosen = preferredCamera(devices)?.deviceId;
      // Permission can be required before the browser reveals camera names.
      stream.getTracks().forEach((track) => track.stop());
      stream = undefined;
      if (!chosen) throw new Error('Select your laptop camera below, then retry.');
      stream = await open(chosen);
      signal?.throwIfAborted();
    }
    video.srcObject = stream;
    const abort = () => stopCamera(video);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const message =
        'The selected camera is not sending video. Select your laptop camera and close other camera apps, then retry.';
      await bounded(video.play(), signal, 10_000, message);
      const deadline = performance.now() + 10_000;
      while (
        video.readyState < 2 ||
        !video.videoWidth ||
        stream.getVideoTracks().every((track) => track.muted)
      ) {
        signal?.throwIfAborted();
        if (performance.now() > deadline) throw new Error(message);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      signal?.throwIfAborted();
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
    }
    signal?.throwIfAborted();
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError')
        throw new Error(
          'Camera permission was denied. Allow camera access in your browser, then retry.',
        );
      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
        throw new Error('The selected camera is unavailable. Select another camera and retry.');
      if (error.name === 'NotReadableError')
        throw new Error(
          'Your camera could not open. Close other camera apps and select your laptop camera.',
        );
    }
    throw error;
  }
}
