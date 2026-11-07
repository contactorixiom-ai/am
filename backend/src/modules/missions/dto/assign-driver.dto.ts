import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDriverDto {
  @ApiProperty({ description: 'Identifiant du convoyeur à affecter' })
  @IsUUID()
  driverId!: string;
}
