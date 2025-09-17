import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class VerifyBodyDTO {
  @ApiProperty()
  @IsNotEmpty({ message: 'token is required and cannot be empty' })
  token: string;
}