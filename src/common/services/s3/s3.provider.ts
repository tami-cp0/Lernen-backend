import { S3Client } from "@aws-sdk/client-s3";

// USES TEBI s3 compatible storage

export const S3_PROVIDER = 'S3_CLIENT';

export const S3Provider = {
  provide: S3_PROVIDER,
  useFactory: () => {
    return new S3Client({
      region: 'auto',
      endpoint: process.env.TEBI_S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.TEBI_ACCESS_KEY!,
        secretAccessKey: process.env.TEBI_SECRET_KEY!,
      },
      forcePathStyle: true, // needed for tebi
    });
  },
};
