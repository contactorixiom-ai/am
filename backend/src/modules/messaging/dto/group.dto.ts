import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Responsables d\'exploitation' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class UpdateGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  addIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  removeIds?: string[];
}

export class OpenDirectDto {
  @ApiProperty()
  @IsUUID('4')
  userId!: string;
}
