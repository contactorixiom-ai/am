import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParcelCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ParcelItemDto {
  @ApiProperty()
  @IsString() @MaxLength(120)
  description!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  valueCents?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  hsCode?: string;
}

export class CreateParcelDto {
  @ApiPropertyOptional({ enum: ParcelCategory })
  @IsOptional() @IsEnum(ParcelCategory)
  category?: ParcelCategory;

  @ApiProperty()
  @Type(() => Number) @IsNumber() @Min(0)
  weightKg!: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  declaredValueCents?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  recipientFirstName!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  recipientLastName!: string;

  @ApiProperty()
  @Matches(/^\+?[0-9\s-]{8,20}$/)
  recipientPhone!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail()
  recipientEmail?: string;

  @ApiProperty({ example: 'FR' })
  @IsString() @MaxLength(2)
  originCountry!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  originCity!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  originAddress?: string;

  @ApiProperty({ example: 'SN' })
  @IsString() @MaxLength(2)
  destinationCountry!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  destinationCity!: string;

  @ApiProperty()
  @IsString() @MaxLength(200)
  destinationAddress!: string;

  @ApiPropertyOptional({ type: [ParcelItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParcelItemDto)
  items?: ParcelItemDto[];
}
