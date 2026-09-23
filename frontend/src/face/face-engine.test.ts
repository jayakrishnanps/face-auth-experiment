import { afterEach, describe, expect, it, vi } from 'vitest';
import { preferredCamera } from './camera';

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
    videoHeight: 480,
  };
  return { track, stream, video: video as unknown as HTMLVideoElement };
}
const face = () => ({
  box: [230, 140, 180, 200],
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
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            { kind: 'videoinput', label: 'Integrated Camera', deviceId: 'laptop' },
          ]),
        getUserMedia: () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          }),
      },
    });
    const abort = new AbortController();
    const started = startCamera(video, abort.signal);
    await vi.waitFor(() => expect(resolvePermission).toBeDefined());
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
  it('prefers the integrated webcam over a linked phone and external webcam', () => {
    const devices = [
      { label: 'OPPO F17', deviceId: 'phone' },
      { label: 'USB Webcam', deviceId: 'usb' },
      { label: 'Integrated Camera', deviceId: 'laptop' },
    ] as MediaDeviceInfo[];
    expect(preferredCamera(devices)?.deviceId).toBe('laptop');
    expect(preferredCamera(devices.slice(0, 1))).toBeUndefined();
  });
  it('opens the exact laptop device instead of the browser default', async () => {
    const { video, stream } = camera();
    video.srcObject = null;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', label: 'OPPO F17', deviceId: 'phone' },
          { kind: 'videoinput', label: 'Integrated Camera', deviceId: 'laptop' },
        ]),
        getUserMedia,
      },
    });
    await startCamera(video);
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ deviceId: { exact: 'laptop' } }),
      }),
    );
    expect(video.srcObject).toBe(stream);
  });
  it('allows a phone camera only when explicitly selected', async () => {
    const { video, stream } = camera();
    video.srcObject = null;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([{ kind: 'videoinput', label: 'OPPO F17', deviceId: 'phone' }]),
        getUserMedia,
      },
    });
    await expect(startCamera(video)).rejects.toThrow(/No laptop webcam/);
    expect(getUserMedia).not.toHaveBeenCalled();
    await startCamera(video, undefined, 'phone');
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ deviceId: { exact: 'phone' } }) }),
    );
  });
  it('switches from a permission bootstrap stream to the laptop before playback', async () => {
    const initial = camera();
    const laptop = camera();
    laptop.video.srcObject = null;
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial.stream)
      .mockResolvedValueOnce(laptop.stream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValueOnce([{ kind: 'videoinput', label: '', deviceId: '' }])
          .mockResolvedValue([
            { kind: 'videoinput', label: 'OPPO F17', deviceId: 'phone' },
            { kind: 'videoinput', label: 'Integrated Camera', deviceId: 'laptop' },
          ]),
        getUserMedia,
      },
    });
    await startCamera(laptop.video);
    expect(initial.track.stop).toHaveBeenCalledOnce();
    expect(laptop.video.srcObject).toBe(laptop.stream);
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ deviceId: { exact: 'laptop' } }),
      }),
    );
  });
  it('times out stalled playback and releases the camera', async () => {
    vi.useFakeTimers();
    const { video, stream, track } = camera();
    video.srcObject = null;
    vi.mocked(video.play).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const result = startCamera(video, undefined, 'laptop');
    const rejected = expect(result).rejects.toThrow(/not sending video/);
    await vi.advanceTimersByTimeAsync(10_001);
    await rejected;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('releases streams that arrive after a camera startup timeout', async () => {
    vi.useFakeTimers();
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
    const result = startCamera(video, undefined, 'laptop');
    const rejected = expect(result).rejects.toThrow(/Camera access timed out/);
    await vi.advanceTimersByTimeAsync(30_001);
    await rejected;
    resolvePermission(stream);
    await Promise.resolve();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('collects three distinct inference results over time and rejects multi-face frames', async () => {
    await loadModels();
    vi.useFakeTimers();
    mocks.detect
      .mockResolvedValue({ face: [face()] })
      .mockResolvedValueOnce({ face: [face(), face()] });
    const progress = vi.fn();
    const result = captureEnrollmentSamples(camera().video, progress);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toHaveLength(3);
    expect(progress.mock.calls[0][0]).toMatchObject({
      collected: 0,
      message: 'Only one person should be in the frame.',
    });
    expect(progress.mock.calls.at(-1)?.[0].collected).toBe(3);
    expect(mocks.detect.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
  it('captures only one valid sample for login', async () => {
    vi.useFakeTimers();
    mocks.detect.mockResolvedValue({ face: [face()] });
    const progress = vi.fn();
    const result = captureLoginSample(camera().video, progress);
    await vi.advanceTimersByTimeAsync(1100);
    expect(progress.mock.calls.every(([value]) => value.collected === 0)).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toHaveLength(1024);
    expect(mocks.detect.mock.calls.length).toBeGreaterThan(1);
  });
  it('does not enroll an off-center face and restarts the hold after movement', async () => {
    vi.useFakeTimers();
    const centered = face();
    mocks.detect.mockResolvedValue({ face: [centered] });
    const progress = vi.fn();
    const result = captureEnrollmentSamples(camera().video, progress);
    await vi.advanceTimersByTimeAsync(900);
    mocks.detect.mockResolvedValue({ face: [{ ...centered, box: [0, 0, 180, 200] }] });
    await vi.advanceTimersByTimeAsync(500);
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({
      collected: 0,
      message: 'Center your face in the guide.',
    });
    mocks.detect.mockResolvedValue({ face: [centered] });
    await vi.advanceTimersByTimeAsync(900);
    expect(progress.mock.calls.at(-1)?.[0].collected).toBe(0);
    await vi.advanceTimersByTimeAsync(4500);
    expect(await result).toHaveLength(3);
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
