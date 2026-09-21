import { faceSimilarity, FaceService } from '../src/face/face.service';
import { isEmbedding } from '../src/face/embedding.validator';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// Load only the matching source from the pinned upstream package, not TensorFlow.
const source = readFileSync(
  resolve(dirname(require.resolve('@vladmandic/human')), '../src/face/match.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const upstream: { similarity?: (a: number[], b: number[]) => number } = {};
new Function('exports', compiled)(upstream);

describe('Human-compatible face matching', () => {
  const base = Array.from({ length: 1024 }, (_, i) => Math.sin(i));
  it.each([0, 0.1, 0.3, 0.5, 1, 2, 5])(
    'matches the installed Human implementation at offset %s',
    (offset) => {
      const comparison = base.map((value, i) => value + Math.cos(i) * offset);
      expect(faceSimilarity(base, comparison)).toBe(upstream.similarity!(base, comparison));
    },
  );
  it('chooses the best of the account’s templates', () => {
    expect(new FaceService().bestSimilarity(base, [base.map((value) => value + 5), base])).toBe(1);
    expect(new FaceService().bestSimilarity(base, [])).toBe(0);
  });
  it('rejects zero, non-finite, wrong-size, and string vectors', () => {
    for (const input of [
      Array(1024).fill(0),
      Array(1024).fill(NaN),
      Array(1024).fill(Infinity),
      [1],
      Array(1024).fill('1'),
    ]) {
      expect(isEmbedding(input)).toBe(false);
    }
  });
});
