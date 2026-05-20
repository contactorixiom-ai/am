import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jean.dupont@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{8,20}$/, { message: 'Invalid phone format' })
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.CLIENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: AccountType, default: AccountType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional({ example: 'Axis Trans SARL' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  companyName?: string;
}
