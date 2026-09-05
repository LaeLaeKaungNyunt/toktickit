import { Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export interface GetFileStreamResult {
  stream: Readable;
  contentType: string;
  contentLength: number;
}

export interface IStorageService {
  uploadFile(key: string, body: Buffer, mimeType: string): Promise<void>;
  getFileStream(key: string): Promise<GetFileStreamResult>;
  deleteFile(key: string): Promise<void>;
}

export class SeaweedFSStorageService implements IStorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.SEAWEEDFS_S3_ENDPOINT ?? "";
    this.bucket = process.env.SEAWEEDFS_BUCKET ?? "toktickit-attachments";

    if (!endpoint) {
      throw new Error(
        "SEAWEEDFS_S3_ENDPOINT environment variable is missing. SeaweedFS storage service cannot be initialized."
      );
    }

    this.s3Client = new S3Client({
      endpoint,
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "any",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "any",
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(key: string, body: Buffer, mimeType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    });
    await this.s3Client.send(command);
  }

  async getFileStream(key: string): Promise<GetFileStreamResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    if (!response.Body) {
      const error = new Error("Object body is missing");
      (error as any).code = "NoSuchKey";
      throw error;
    }
    return {
      stream: response.Body as Readable,
      contentType: response.ContentType ?? "application/octet-stream",
      contentLength: response.ContentLength ?? 0,
    };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (err: any) {
      // Idempotent deletion when object is already missing
      if (
        err.name === "NoSuchKey" ||
        err.name === "NotFound" ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return;
      }
      throw err;
    }
  }
}

export class MockStorageService implements IStorageService {
  private store = new Map<string, { buffer: Buffer; mimeType: string }>();

  async uploadFile(key: string, body: Buffer, mimeType: string): Promise<void> {
    this.store.set(key, { buffer: Buffer.from(body), mimeType });
  }

  async getFileStream(key: string): Promise<GetFileStreamResult> {
    const item = this.store.get(key);
    if (!item) {
      const error = new Error("Object not found");
      (error as any).code = "NoSuchKey";
      throw error;
    }
    const stream = Readable.from(item.buffer);
    return {
      stream,
      contentType: item.mimeType,
      contentLength: item.buffer.length,
    };
  }

  async deleteFile(key: string): Promise<void> {
    // Idempotent deletion
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

let activeStorageService: IStorageService | null = null;

export function getStorageService(): IStorageService {
  if (!activeStorageService) {
    activeStorageService = new SeaweedFSStorageService();
  }
  return activeStorageService;
}

export function setStorageService(service: IStorageService): void {
  activeStorageService = service;
}

export function resetStorageService(): void {
  activeStorageService = null;
}
