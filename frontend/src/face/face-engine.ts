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

export { startCamera, stopCamera } from './camera';

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
  let steadySince: number | undefined;
  let previousBox: number[] | undefined;
  while (samples.length < total) {
    checkCancelled(signal);
    if (performance.now() > deadline)
      throw new Error('Capture timed out. Improve the lighting, center your face, and try again.');
    const tracks = (video.srcObject as MediaStream | null)?.getVideoTracks();
    if (!tracks?.some((track) => track.readyState === 'live'))
      throw new Error('The camera disconnected. Please reconnect it and retry.');
    const faces = await detectFace(video, signal);
    let message = qualityMessage(faces, video.videoWidth, video.videoHeight);
    if (message) {
      steadySince = undefined;
      previousBox = undefined;
    } else {
      const box = faces[0].box;
      const moved =
        previousBox &&
        box.some(
          (value, index) => Math.abs(value - previousBox![index]) > video.videoWidth * 0.025,
        );
      if (steadySince === undefined || moved) steadySince = performance.now();
      previousBox = [...box];
      if (performance.now() - steadySince < 1200) message = 'Hold still in the center…';
    }
    if (!message) {
      samples.push(createEmbedding(faces[0]));
      steadySince = undefined;
      previousBox = undefined;
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
