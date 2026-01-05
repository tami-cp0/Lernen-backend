import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_PROVIDER } from './s3.provider';
import { ConfigService } from '@nestjs/config';
import { s3ConfigType } from 'src/config/config.types';
import { Readable } from 'stream';

export type ValidBuckets = 'user-docs';
export const validBuckets: ValidBuckets[] = ['user-docs'];

@Injectable()
export class S3Service {
    constructor(
        @Inject(S3_PROVIDER) private readonly s3: S3Client,
        private configService: ConfigService,
    ) {}

    // Upload buffer since i use multer memory storage
    async uploadObject(bucket: string, key: string, body: Buffer, contentType?: string) {
        await this.s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }),
        );

        return {
            key,
            url: `${this.configService.get<s3ConfigType>('s3')!.endpoint}/${bucket}/${key}`,
        };
    }

    // Generate signed URL for downloading
    async getSignedUrl(bucket: string, key: string, expiresInSeconds = 86400) {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        return await awsGetSignedUrl(this.s3, command, {
            expiresIn: expiresInSeconds,
        });
    }

    // Delete object
    async deleteObject(bucket: string, key: string) {
        await this.s3.send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }),
        );

        return { deleted: true };
    }

    // Helper: generate unique keys
    generateKey(userId: string, filename: string) {
        const timestamp = Date.now();
        return `${userId}/${timestamp}/${filename}`;
    }
}
