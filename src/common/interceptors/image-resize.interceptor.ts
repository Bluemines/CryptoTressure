import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import * as sharp from 'sharp';

export interface ImageResizeOptions {
  destination: string;
  maxWidth?: number;
  quality?: number;
}

@Injectable()
export class ImageResizeInterceptor implements NestInterceptor {
  constructor(private opts: ImageResizeOptions) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const file: Express.Multer.File = req.file;
    if (!file) {
      return next.handle();
    }

    // --- run sharp on the buffer ---
    const { maxWidth = 800, quality = 75, destination } = this.opts;
    const optimized = await sharp(file.buffer)
      .resize({ width: maxWidth })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    // --- generate the same filename Multer would have done ---
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      extname(file.originalname);
    const fullPath = join(destination, uniqueName);

    // --- write optimized image to disk ---
    await fs.mkdir(destination, { recursive: true });
    await fs.writeFile(fullPath, optimized);

    // --- swap out the file props your controllers expect ---
    req.file.filename = uniqueName;
    req.file.path = fullPath;
    req.file.destination = destination;
    req.file.buffer = optimized; // in case anyone re-uses it
    req.file.size = optimized.length;

    return next.handle();
  }
}
