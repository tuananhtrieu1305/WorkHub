import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

export const createR2ClientConfig = (env = process.env) => {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: env.R2_REGION || "auto",
    bucketName: env.R2_BUCKET_NAME,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  };
};

export const createR2Client = (env = process.env) => {
  const { bucketName, ...clientConfig } = createR2ClientConfig(env);

  return {
    client: new S3Client(clientConfig),
    bucketName,
  };
};

export const buildR2ObjectKey = ({ documentId, versionId }) => {
  if (!documentId || !versionId) {
    throw new Error("documentId and versionId are required to build R2 key");
  }

  return `documents/${documentId}/versions/${versionId}/object`;
};

export const createR2StorageService = ({ client, bucketName }) => {
  if (!client) {
    throw new Error("R2 storage service requires an S3-compatible client");
  }

  if (!bucketName) {
    throw new Error("R2 storage service requires a bucket name");
  }

  return {
    async putObject({ key, body, contentType, contentLength, metadata }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: contentLength,
          Metadata: metadata,
        }),
      );

      return { bucketName, key };
    },

    async getObjectStream({ key }) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      return {
        body: result.Body,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        metadata: result.Metadata,
      };
    },

    async headObject({ key }) {
      const result = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        metadata: result.Metadata,
      };
    },

    async deleteObject({ key }) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      return { bucketName, key };
    },
  };
};

export const getDefaultR2StorageService = () => {
  return createR2StorageService(createR2Client());
};

let storageServiceOverride = null;

export const setR2StorageServiceOverride = (storageService) => {
  storageServiceOverride = storageService;
};

export const clearR2StorageServiceOverride = () => {
  storageServiceOverride = null;
};

export const getR2StorageService = () => {
  return storageServiceOverride || getDefaultR2StorageService();
};

export default getR2StorageService;
