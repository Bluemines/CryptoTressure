import { FileFilterCallback } from 'multer';

export interface FileUploadOptions {
  fieldName: string;
  destination?: string;
  maxSize?: number;
  maxWidth: number;
  quality: number;
  fileFilter?: (
    req: any,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => void;
}
