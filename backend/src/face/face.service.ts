import { Injectable } from '@nestjs/common';
import { isEmbedding } from './embedding.validator';

// Human 3.3.6 match.similarity defaults: order=2, multiplier=25, min=.2, max=.8.
// Reference: https://github.com/vladmandic/human/blob/v3.3.6/src/face/match.ts
// Keep both rounding stages: plain cosine similarity is not interchangeable.
export function faceSimilarity(first: number[], second: number[]): number {
  if (!isEmbedding(first) || !isEmbedding(second)) return 0;
  const sum = first.reduce((total, value, index) => total + (value - second[index]) ** 2, 0);
  const distance = Math.round(100 * 25 * sum) / 100;
  if (distance === 0) return 1;
  const normalized = (1 - Math.sqrt(distance) / 100 - 0.2) / 0.6;
  return Math.round(100 * Math.max(0, Math.min(1, normalized))) / 100;
}

@Injectable()
export class FaceService {
  bestSimilarity(embedding: number[], templates: number[][]) {
    return templates.reduce(
      (best, template) => Math.max(best, faceSimilarity(embedding, template)),
      0,
    );
  }
}
