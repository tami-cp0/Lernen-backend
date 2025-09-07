import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Role } from './user.types';
import { otps, users } from 'src/database/schema';
import { and, eq, ne, or } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/common/services/email/email.service';
import { UserWithAuthAccountsWithoutPassword } from '../auth/auth.types';

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
            role?: Omit<Role, 'admin'>
        }
    ) {
        const updates: Partial<typeof users.$inferInsert> = {};

        if (data.firstName) updates.firstName = data.firstName;
        if (data.lastName) updates.lastName = data.lastName;
        if (data.role) updates.role = data.role as Role;

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

    private generateOtp(length = 6): string {
        const min = Math.pow(10, length - 1); // e.g. 100000
        const max = Math.pow(10, length) - 1; // e.g. 999999
        return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    // async updateEmail(email: string, user: UserWithAuthAccountsWithoutPassword) {
    //     const exists = !!(await this.databaseService.db.query.users.findFirst({
    //         where: and(
    //             eq(users.email, email),
    //             ne(users.id, user.id)
    //         )
    //     }));

    //     if (exists) {
    //         throw new BadRequestException('Email already exists');
    //     }

    //     const otp = this.generateOtp();
    //     await this.databaseService.db.insert(otps).values({
    //         userId: user.id,
    //         otpHash: await bcrypt.hash(otp, 10),
    //         purpose: 'email_verification',
    //         expiresAt: new Date(Date.now() + 10 * 60 * 1000), // OTP valid for 10 minutes
    //         consumed: false,
    //     })

    //     await this.emailService.sendEmail('email_verification', email, {
    //         name: user.firstName,
    //         otp
    //     });

    //     return {
    //         message: 'An email for OTP verification has been sent to your email.',
    //     };
    // }

    // async verifyEmailUpdate(userId: string, otp: string, newEmail: string) {
    // }

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
