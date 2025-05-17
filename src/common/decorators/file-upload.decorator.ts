import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileUploadOptions } from '../interfaces/file-upload-options';

export function FileUpload(opts: FileUploadOptions) {
  const {
    fieldName,
    destination = './uploads',
    maxSize = 5 * 1024 * 1024,
    fileFilter,
  } = opts;

  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: diskStorage({
          destination,
          filename: (_req, file, cb) => {
            const uniqueName =
              Date.now() +
              '-' +
              Math.round(Math.random() * 1e9) +
              extname(file.originalname);
            cb(null, uniqueName);
          },
        }),
        fileFilter:
          fileFilter ??
          ((req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif)$/)) {
              return cb(new Error('Only image files are allowed'), false);
            }
            cb(null, true);
          }),
        limits: { fileSize: maxSize },
      }),
    ),
  );
}
