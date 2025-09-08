import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Role } from './user.types';
import { users } from 'src/database/schema';
import { eq, ne, or } from 'drizzle-orm';
import { EmailService } from 'src/common/services/email/email.service';

@Injectable()
export class UserService {
    constructor(
        private databaseService: DatabaseService,
        private emailService: EmailService
    ) {}

    async updateProfile(
        userId: string,
        data: {
            firstName?: string, lastName?: string,
            role?: Omit<Role, 'admin'>, educationLevel ?: string
        }
    ) {
        const updates: Partial<typeof users.$inferInsert> = {};

        if (data.firstName) updates.firstName = data.firstName;
        if (data.lastName) updates.lastName = data.lastName;
        if (data.role) updates.role = data.role as Role;
        if (data.educationLevel) updates.educationLevel = data.educationLevel;

        const [user] = await this.databaseService.db
            .update(users)
            .set(updates)
            .where(eq(users.id, userId))
            .returning();

        return {
            message: 'Profile updated successfully',
            data: {
                user
            }
        }
    }

    async deleteAccount(userId: string) {
        // Delete all auth accounts associated with the user
        await this.databaseService.db.delete(users).where(eq(users.id, userId));

        return;
    }

    async getAllUsers() {
        const allUsers = await this.databaseService.db.query.users.findMany({
            where: ne(users.role, 'admin'),
        });

        return {
            message: 'All users fetched successfully',
            data: {
                users: allUsers
            }
        };
    }

    async getUserByIdOrEmail(identifier: string) {
        const user = await this.databaseService.db.query.users.findFirst({
            where: or(
                eq(users.id, identifier),
                eq(users.email, identifier)
            )
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        return {
            message: 'User fetched successfully',
            data: {
                user
            }
        };
    }
}
