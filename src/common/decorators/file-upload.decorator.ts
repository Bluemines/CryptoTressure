import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { FileUploadOptions } from '../interfaces/file-upload-options';
import { v4 as uuid } from 'uuid';

export function FileUpload(opts: FileUploadOptions) {
  const {
    fieldName,
    destination = './uploads',
    maxSize = 5 * 1024 * 1024,
  } = opts;

  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: diskStorage({
          destination,
          filename: (_req, file, cb) =>
            cb(null, `${uuid()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: maxSize },
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.match(/^image\/(jpe?g|png|gif)$/)) {
            return cb(
              new Error('Only JPG, JPEG, PNG or GIF files are allowed'),
              false,
            );
          }
          cb(null, true);
        },
      }),
    ),
  );
}
