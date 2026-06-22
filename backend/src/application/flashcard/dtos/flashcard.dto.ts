import { IsString, IsOptional, IsInt, Min, Max, IsArray, IsUUID } from 'class-validator';

export class GenerateFlashcardsDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  cardCount?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  documentIds?: string[];
}
