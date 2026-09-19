import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUrl } from 'class-validator';

export class SignInspectionDto {
  @ApiProperty({ enum: ['CLIENT', 'DRIVER'] })
  @IsIn(['CLIENT', 'DRIVER'])
  party!: 'CLIENT' | 'DRIVER';

  @ApiProperty({ description: 'URL de la signature (image PNG sur le storage)' })
  @IsUrl({ require_tld: false })
  signatureUrl!: string;
}
