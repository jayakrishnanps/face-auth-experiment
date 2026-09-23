export const MODEL_VERSION = '3.3.6/faceres';
export const EMBEDDING_SIZE = 1024;

export interface DetectedFace {
  box: number[];
  boxScore: number;
  faceScore: number;
  embedding?: number[];
}

export function qualityMessage(
  faces: DetectedFace[],
  frameWidth: number,
  frameHeight = 0,
): string | null {
  if (faces.length === 0) return 'Look at the camera and keep your face in the frame.';
  if (faces.length !== 1) return 'Only one person should be in the frame.';
  const face = faces[0];
  if (face.boxScore < 0.8 || face.faceScore < 0.7)
    return 'Face the camera directly and try a little more light.';
  if (Math.min(face.box[2], face.box[3]) < Math.max(120, frameWidth * 0.18))
    return 'Move a little closer to the camera.';
  if (frameWidth > 0 && frameHeight > 0) {
    const [x, y, width, height] = face.box;
    if (
      x < 0 ||
      y < 0 ||
      x + width > frameWidth ||
      y + height > frameHeight ||
      Math.abs(x + width / 2 - frameWidth / 2) > frameWidth * 0.12 ||
      Math.abs(y + height / 2 - frameHeight / 2) > frameHeight * 0.12
    )
      return 'Center your face in the guide.';
  }
  if (
    !face.embedding ||
    face.embedding.length !== EMBEDDING_SIZE ||
    !face.embedding.every(Number.isFinite) ||
    !face.embedding.some((n) => n !== 0)
  )
    return 'Hold still while we get a clear reading.';
  return null;
}
