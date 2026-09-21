import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsString, MaxLength } from 'class-validator';
import { IsEmbedding, IsEnrollment } from '../face/embedding.validator';
import { MODEL_VERSION } from '../face/face.constants';

class FaceAuthDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Equals(MODEL_VERSION, { message: 'Face model version mismatch. Refresh the application.' })
  modelVersion!: string;
}
export class RegisterDto extends FaceAuthDto {
  @IsEnrollment() embeddings!: number[][];
}
export class FaceLoginDto extends FaceAuthDto {
  @IsEmbedding() embedding!: number[];
}
