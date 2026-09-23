import { describe, expect, it } from 'vitest';
import { qualityMessage, type DetectedFace } from './quality';

const goodFace = (): DetectedFace => ({
  box: [100, 50, 180, 200],
  boxScore: 0.95,
  faceScore: 0.95,
  embedding: Array(1024).fill(0.1),
});
describe('Capture quality gates', () => {
  it('accepts exactly one sufficiently large, confident face with an embedding', () => {
    expect(qualityMessage([goodFace()], 640)).toBeNull();
  });
  it('rejects no face and multiple faces', () => {
    expect(qualityMessage([], 640)).toMatch(/Look at the camera/);
    expect(qualityMessage([goodFace(), goodFace()], 640)).toMatch(/Only one/);
  });
  it('requires a centered, fully visible face when checking a video frame', () => {
    expect(qualityMessage([{ ...goodFace(), box: [230, 140, 180, 200] }], 640, 480)).toBeNull();
    expect(qualityMessage([goodFace()], 640, 480)).toMatch(/Center/);
    expect(qualityMessage([{ ...goodFace(), box: [-10, 140, 660, 200] }], 640, 480)).toMatch(
      /Center/,
    );
  });
  it('rejects small, uncertain, missing, malformed, and non-finite embeddings', () => {
    for (const patch of [
      { box: [0, 0, 50, 60] },
      { boxScore: 0.5 },
      { faceScore: 0.5 },
      { embedding: undefined },
      { embedding: [1] },
      { embedding: Array(1024).fill(NaN) },
      { embedding: Array(1024).fill(0) },
    ]) {
      expect(qualityMessage([{ ...goodFace(), ...patch }], 640)).not.toBeNull();
    }
  });
});
