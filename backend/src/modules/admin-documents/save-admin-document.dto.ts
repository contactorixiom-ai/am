import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveAdminDocumentDto {
  @ApiPropertyOptional({ description: 'Identifiant donné par l\'appli (évite les doublons)' })
  @IsOptional() @IsString() @MaxLength(80)
  clientRef?: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60)
  typeId!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160)
  typeLabel!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80)
  reference!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(40)
  activity!: string;

  @ApiProperty({ description: 'Champs du formulaire, pour régénérer le PDF à l\'identique' })
  @IsObject()
  values!: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  createdAt?: string;
}
