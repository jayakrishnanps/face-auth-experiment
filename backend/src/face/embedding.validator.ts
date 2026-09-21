import { ValidateBy } from 'class-validator';
import { EMBEDDING_SIZE } from './face.constants';

export function isEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_SIZE &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100) &&
    value.some((n) => n !== 0)
  );
}

export function IsEmbedding() {
  return ValidateBy({
    name: 'isEmbedding',
    validator: {
      validate: isEmbedding,
      defaultMessage: () =>
        'embedding must contain 1024 finite numbers and must not be a zero vector',
    },
  });
}

export function IsEnrollment() {
  return ValidateBy({
    name: 'isEnrollment',
    validator: {
      validate: (value) => Array.isArray(value) && value.length === 3 && value.every(isEmbedding),
      defaultMessage: () => 'embeddings must contain exactly three valid 1024-number vectors',
    },
  });
}
