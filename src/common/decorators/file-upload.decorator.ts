import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { FileUploadOptions } from '../interfaces/file-upload-options';
import { ImageResizeInterceptor } from '../interceptors/image-resize.interceptor';

export function FileUpload(opts: FileUploadOptions) {
  const {
    fieldName,
    destination = './uploads',
    maxSize = 5 * 1024 * 1024,
    fileFilter,
    maxWidth,
    quality,
  } = opts;
  console.log('FileUpload');

  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter:
          fileFilter ??
          ((req, file, cb) => {
            console.log('[FileInterceptor] Incoming file:', file.originalname);
            if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif)$/)) {
              return cb(new Error('Only image files are allowed'), false);
            }
            cb(null, true);
          }),
      }),
      // new ImageResizeInterceptor({
      //   destination,
      //   maxWidth: opts.maxWidth,
      //   quality: opts.quality,
      // }),
    ),
  );
}
