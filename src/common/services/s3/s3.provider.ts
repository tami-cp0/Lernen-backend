import { S3Client } from "@aws-sdk/client-s3";

// USES CLOUDFLARE R2 s3 compatible storage

export const S3_PROVIDER = 'S3_CLIENT';

export const S3Provider = {
  provide: S3_PROVIDER,
  useFactory: () => {
    return new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // needed for tebi
    });
  },
};
