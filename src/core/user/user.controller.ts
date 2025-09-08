import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt/jwt.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Request } from 'express';
import { UpdateProfileBodyDTO } from './dto/updateProfile.dto';
import { ApiDefaultDocProtected } from 'src/swagger';
import { ApiBadRequestResponse, ApiExtraModels, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, getSchemaPath } from '@nestjs/swagger';
import { GetAllUsersResponseDTO, ProfileResponseDTO } from './dto/responses.dto';

@ApiExtraModels(ProfileResponseDTO, GetAllUsersResponseDTO)
@Controller('users')
export class UserController {
    constructor(
        private userService: UserService,
    ) {}

    @ApiOperation({
        summary: 'Get authenticated user profile',
        description: `
            Retrieves the complete profile information for the authenticated user.
            - Returns user details including email, name, role, and preferences
            - Only accessible to authenticated users
            - Returns the user's own profile data
        `,
    })
    @ApiOkResponse({
        description: 'User profile retrieved successfully',
        schema: { $ref: getSchemaPath(ProfileResponseDTO) },
    })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@Req() req: Request) {
        return {
            message: 'User profile retrieved successfully',
            data: {
                user: req.user!
            }
        };
    }

    @ApiOperation({
        summary: 'Update user profile',
        description: `
            Updates the authenticated user's profile information.
            - At least one field (firstName, lastName, or role) must be provided
            - Users cannot update their role to 'admin'
            - Returns the updated user profile
        `,
    })
    @ApiOkResponse({
        description: 'Profile updated successfully',
        schema: { $ref: getSchemaPath(ProfileResponseDTO) },
    })
    @ApiBadRequestResponse({
        description: 'Validation error - at least one field required or invalid field values',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { 
                    type: 'array',
                    items: { type: 'string' },
                    example: 'At least one field (firstName, lastName, or role) must be provided'
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard)
    @Put('update-profile')
    async updateProfile(@Req() req: Request, @Body() body: UpdateProfileBodyDTO) {
        return await this.userService.updateProfile(req.user!.id, body);
    }

    // flag later
    // @ApiOperation({
    //     summary: 'Delete user account',
    //     description: `
    //         Permanently deletes the authenticated user's account and all associated data.
    //         - Deletes the user record from the database
    //         - Cascades to remove all associated data (chats, messages, documents, auth accounts)
    //         - This action is irreversible
    //         - User will be logged out and cannot access the account after deletion
    //     `,
    // })
    // @ApiNoContentResponse({
    //     description: 'Account deleted successfully',
    // })
    // @ApiDefaultDocProtected()
    // @UseGuards(JwtAuthGuard)
    // @Delete('delete-account')
    // async deleteAccount(@Req() req: Request) {
    //     return await this.userService.deleteAccount(req.user!.id);
    // }

    @ApiOperation({
        summary: 'Get all users (Admin only)',
        description: `
            Retrieves all users in the system except admin users.
            - Only accessible to users with 'admin' role
            - Returns all user profiles excluding other admins
        `,
    })
    @ApiOkResponse({
        description: 'All users fetched successfully',
        schema: { $ref: getSchemaPath(GetAllUsersResponseDTO) },
    })
    @ApiForbiddenResponse({
        description: 'Access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: { type: 'string', example: 'Access denied' },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(['admin'])
    @Get('all')
    async getAllUsers() {
        return await this.userService.getAllUsers();
    }

    @ApiOperation({
        summary: 'Get user by ID or email (Admin only)',
        description: `
            Retrieves a specific user by their ID or email address.
            - Only accessible to users with 'admin' role
            - Can search by either user ID (UUID) or email address
            - Returns complete user profile information
            - Useful for admin user management and support
        `,
    })
    @ApiOkResponse({
        description: 'User fetched successfully',
        schema: { $ref: getSchemaPath(ProfileResponseDTO) },
    })
    @ApiBadRequestResponse({
        description: 'User not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'User not found' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiForbiddenResponse({
        description: 'Access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: { type: 'string', example: 'Access denied' },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(['admin'])
    @Get(':identifier/user')
    async getUserByIdOrEmail(@Body() body: { identifier: string }) {
        return await this.userService.getUserByIdOrEmail(body.identifier);
    }
}
