import type { Human, FaceResult } from '@vladmandic/human';
import { qualityMessage } from './quality';

export interface CaptureProgress {
  collected: number;
  total: number;
  message: string;
}
type ProgressCallback = (progress: CaptureProgress) => void;

let modelPromise: Promise<Human> | undefined;

export function loadModels(): Promise<Human> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { Human } = await import('@vladmandic/human');
      const human = new Human({
        backend: 'webgl',
        modelBasePath: '/models/',
        cacheSensitivity: 0,
        face: {
          enabled: true,
          detector: {
            maxDetected: 3,
            minConfidence: 0.6,
            rotation: true,
            skipFrames: 0,
            skipTime: 0,
          },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: { enabled: true, skipFrames: 0, skipTime: 0 },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await human.load();
      await human.warmup();
      return human;
    })().catch(() => {
      modelPromise = undefined;
      throw new Error(
        'Face models could not load. Check that model files are installed and hardware acceleration is enabled, then retry.',
      );
    });
  }
  return modelPromise;
}

function checkCancelled(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

export function stopCamera(video: HTMLVideoElement) {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  video.pause();
  video.srcObject = null;
}

export async function startCamera(video: HTMLVideoElement, signal?: AbortSignal) {
  checkCancelled(signal);
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('Camera access requires localhost or HTTPS and a supported browser.');
  stopCamera(video);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError')
        throw new Error(
          'Camera permission was denied. Allow camera access in your browser, then retry.',
        );
      if (error.name === 'NotFoundError')
        throw new Error('No camera was found. Connect a webcam and retry.');
      if (error.name === 'NotReadableError')
        throw new Error('Your camera is in use. Close other camera apps and retry.');
    }
    throw new Error('The camera could not start. Check your camera connection and retry.');
  }
  if (signal?.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    checkCancelled(signal);
  }
  video.srcObject = stream;
  const abort = () => stopCamera(video);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await video.play();
    const deadline = performance.now() + 10_000;
    while (video.readyState < 2 || !video.videoWidth) {
      checkCancelled(signal);
      if (performance.now() > deadline)
        throw new Error('The camera did not provide a video frame. Please retry.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    checkCancelled(signal);
  } catch (error) {
    stopCamera(video);
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

// Serialize model access, including a new capture started while an old inference exits.
let detectionQueue: Promise<unknown> = Promise.resolve();
export async function detectFace(
  video: HTMLVideoElement,
  signal?: AbortSignal,
): Promise<FaceResult[]> {
  const detection = detectionQueue.then(async () => {
    checkCancelled(signal);
    const human = await loadModels();
    checkCancelled(signal);
    const faces = (await human.detect(video)).face;
    checkCancelled(signal);
    return faces;
  });
  detectionQueue = detection.catch(() => undefined);
  return detection;
}

export function createEmbedding(face: FaceResult): number[] {
  const error = qualityMessage([face], 0);
  if (error || !face.embedding) throw new Error(error ?? 'Could not create a face embedding.');
  return [...face.embedding];
}

async function capture(
  video: HTMLVideoElement,
  total: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<number[][]> {
  const samples: number[][] = [];
  const deadline = performance.now() + 30_000;
  let lastSample = -Infinity;
  while (samples.length < total) {
    checkCancelled(signal);
    if (performance.now() > deadline)
      throw new Error('Capture timed out. Improve the lighting, center your face, and try again.');
    const tracks = (video.srcObject as MediaStream | null)?.getVideoTracks();
    if (!tracks?.some((track) => track.readyState === 'live'))
      throw new Error('The camera disconnected. Please reconnect it and retry.');
    const faces = await detectFace(video, signal);
    const message = qualityMessage(faces, video.videoWidth);
    if (!message && performance.now() - lastSample >= 900) {
      samples.push(createEmbedding(faces[0]));
      lastSample = performance.now();
    }
    onProgress({
      collected: samples.length,
      total,
      message:
        message ??
        (samples.length === total
          ? 'Face captured. Finishing up…'
          : 'Looking good. Hold still for the next sample.'),
    });
    if (samples.length < total) await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return samples;
}

export function captureEnrollmentSamples(
  video: HTMLVideoElement,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
) {
  return capture(video, 3, onProgress, signal);
}
export async function captureLoginSample(
  video: HTMLVideoElement,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
) {
  return (await capture(video, 1, onProgress, signal))[0];
}
