import { IsString, IsOptional, MaxLength, IsIn, Validate } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Role } from '../user.types';

@ValidatorConstraint({ name: 'AtLeastOneField', async: false })
export class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
    validate(_: any, args: ValidationArguments): boolean {
        const object = args.object as any;
        return !!(object.firstName || object.lastName || object.role);
    }

    defaultMessage(args: ValidationArguments): string {
        return 'At least one field (firstName, lastName, or role) must be provided';
    }
}

export class UpdateProfileBodyDTO {
    @Validate(AtLeastOneFieldConstraint)
    private readonly _dummyField: boolean;

    @ApiPropertyOptional({
        description: 'Optional first name of the user',
        example: 'Tamilore',
        maxLength: 50,
    })
    @MaxLength(50, { message: 'firstName must not exceed 50 characters' })
    @IsString({ message: 'firstName must be a string' })
    @IsOptional()
    firstName?: string;

    @ApiPropertyOptional({
        description: 'Optional last name of the user',
        example: 'Adeyemi',
        maxLength: 50,
    })
    @MaxLength(50, { message: 'lastName must not exceed 50 characters' })
    @IsString({ message: 'lastName must be a string' })
    @IsOptional()
    lastName?: string;

    @ApiPropertyOptional({
        description: 'User role within the system',
        example: 'teacher',
        enum: ['learner', 'teacher'],
    })
    @IsIn(['learner', 'teacher'], {
        message: 'role must be one of: learner, teacher',
    })
    @IsString({ message: 'role must be a string' })
    @IsOptional()
    role?: Omit<Role, 'admin'>;
}
