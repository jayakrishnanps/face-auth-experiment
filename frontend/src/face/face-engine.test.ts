import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), warmup: vi.fn(), detect: vi.fn() }));
vi.mock('@vladmandic/human', () => ({
  Human: class {
    load = mocks.load;
    warmup = mocks.warmup;
    detect = mocks.detect;
  },
}));
import {
  captureEnrollmentSamples,
  captureLoginSample,
  loadModels,
  startCamera,
  stopCamera,
} from './face-engine';

function camera() {
  const track = { stop: vi.fn(), readyState: 'live' };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = {
    srcObject: stream,
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    readyState: 2,
    videoWidth: 640,
  };
  return { track, stream, video: video as unknown as HTMLVideoElement };
}
const face = () => ({
  box: [0, 0, 180, 200],
  boxScore: 0.95,
  faceScore: 0.95,
  embedding: Array(1024).fill(0.1),
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Reusable camera lifecycle', () => {
  it('stops every track and clears the video reference', () => {
    const { video, track } = camera();
    stopCamera(video);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('stops a stream when camera permission resolves after cancellation', async () => {
    const { video, stream, track } = camera();
    video.srcObject = null;
    let resolvePermission!: (value: unknown) => void;
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          }),
      },
    });
    const abort = new AbortController();
    const started = startCamera(video, abort.signal);
    abort.abort();
    resolvePermission(stream);
    await expect(started).rejects.toThrow();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('gives a useful message when camera permission is denied', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
    });
    await expect(startCamera(camera().video)).rejects.toThrow(/permission was denied/);
  });
  it('collects three distinct inference results over time and rejects multi-face frames', async () => {
    await loadModels();
    vi.useFakeTimers();
    mocks.detect
      .mockResolvedValue({ face: [face()] })
      .mockResolvedValueOnce({ face: [face(), face()] });
    const progress = vi.fn();
    const result = captureEnrollmentSamples(camera().video, progress);
    await vi.advanceTimersByTimeAsync(2500);
    expect(await result).toHaveLength(3);
    expect(progress.mock.calls[0][0]).toMatchObject({
      collected: 0,
      message: 'Only one person should be in the frame.',
    });
    expect(progress.mock.calls.at(-1)?.[0].collected).toBe(3);
    expect(mocks.detect.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
  it('captures only one valid sample for login', async () => {
    mocks.detect.mockResolvedValue({ face: [face()] });
    expect(await captureLoginSample(camera().video, vi.fn())).toHaveLength(1024);
    expect(mocks.detect).toHaveBeenCalledOnce();
  });
  it('times out instead of looping forever when there is no face', async () => {
    vi.useFakeTimers();
    mocks.detect.mockResolvedValue({ face: [] });
    const result = captureLoginSample(camera().video, vi.fn());
    const rejected = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(31_000);
    await rejected;
  });
});
