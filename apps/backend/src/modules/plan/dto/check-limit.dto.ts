import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckLimitDto {
  @ApiProperty({
    description: 'Cantidad actual del recurso',
    example: 5,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  current: number;
}
