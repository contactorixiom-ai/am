import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Fichier déjà envoyé par POST /storage/upload (dossier « staff »). */
export class StaffFileUploadDto {
  @ApiProperty() @IsUrl({ require_tld: false })
  fileUrl!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiProperty() @IsString() @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType invalide' })
  mimeType!: string;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  fileSize!: number;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(40)
  category!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  spentAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  missionId?: string;
}

/** Pièce envoyée par le convoyeur ou le salarié lui-même. */
export class MyStaffFileDto extends StaffFileUploadDto {
  @ApiProperty({ enum: ['EXPENSE', 'EMPLOYEE_DOCUMENT'] })
  @IsIn(['EXPENSE', 'EMPLOYEE_DOCUMENT'])
  kind!: 'EXPENSE' | 'EMPLOYEE_DOCUMENT';

  @ApiPropertyOptional({ description: 'Montant TTC en centimes (justificatif de frais)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000)
  amountCents?: number;

  @ApiPropertyOptional({ description: 'Demande de la RH à laquelle la pièce répond' })
  @IsOptional() @IsUUID()
  requestId?: string;
}

/** Pièce déposée par l'équipe Axis dans l'espace d'une personne. */
export class PersonStaffFileDto extends StaffFileUploadDto {
  @ApiProperty({ enum: ['TRAVEL', 'HR_DOCUMENT'] })
  @IsIn(['TRAVEL', 'HR_DOCUMENT'])
  kind!: 'TRAVEL' | 'HR_DOCUMENT';
}

export class StaffRequestDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dueAt?: string;
}

export class ReviewStaffFileDto {
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'] })
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED'])
  status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class AnnouncementDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  title!: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(4000)
  body!: string;

  @ApiProperty({ enum: ['ALL', 'DRIVERS', 'TEAM', 'PEOPLE'] })
  @IsIn(['ALL', 'DRIVERS', 'TEAM', 'PEOPLE'])
  audience!: 'ALL' | 'DRIVERS' | 'TEAM' | 'PEOPLE';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true })
  recipientIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false })
  attachmentUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  attachmentName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[\w.+-]+\/[\w.+-]+$/)
  attachmentMime?: string;
}
