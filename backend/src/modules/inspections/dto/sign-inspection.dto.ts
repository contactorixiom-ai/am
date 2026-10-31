import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class SignInspectionDto {
  @ApiProperty({ enum: ['CLIENT', 'DRIVER'] })
  @IsIn(['CLIENT', 'DRIVER'])
  party!: 'CLIENT' | 'DRIVER';

  @ApiProperty({
    description:
      "Image de la signature : URL http(s) (issue de /storage/upload) ou data URL produite par le pavé de signature.",
  })
  @IsString()
  @MaxLength(2_000_000)
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'signatureUrl doit être une URL http(s) ou une data URL d\'image',
  })
  signatureUrl!: string;
}
