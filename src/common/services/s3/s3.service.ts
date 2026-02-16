import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
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
		private configService: ConfigService
	) {}

	// Upload buffer since i use multer memory storage
	async uploadObject(
		bucket: string,
		key: string,
		body: Buffer,
		contentType?: string
	) {
		await this.s3.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: body,
				CacheControl: 'private, max-age=3600', // Cache for 1 hour
				ContentType: contentType,
			})
		);

		return {
			key,
			url: `${
				this.configService.get<s3ConfigType>('s3')!.endpoint
			}/${bucket}/${key}`,
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

	// Generate pre-signed URL for uploading (client-side S3 upload)
	async getPresignedPutUrl(
		bucket: string,
		key: string,
		contentType: string,
		expiresInSeconds = 900
	) {
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
		});

		return await awsGetSignedUrl(this.s3, command, {
			expiresIn: expiresInSeconds,
		});
	}

	// Download object from S3 and return as buffer
	async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
		const response = await this.s3.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: key,
			})
		);

		const stream = response.Body as Readable;
		const chunks: Buffer[] = [];

		return new Promise((resolve, reject) => {
			stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
			stream.on('error', reject);
			stream.on('end', () => resolve(Buffer.concat(chunks)));
		});
	}

	// Delete object
	async deleteObject(bucket: string, key: string) {
		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: key,
			})
		);

		return { deleted: true };
	}

	// Helper: generate unique keys
	generateKey(userId: string, filename: string) {
		const timestamp = Date.now();
		return `${userId}/${timestamp}-${filename}`;
	}
}
