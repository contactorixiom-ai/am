import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class SignContractDto {
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
