/**
 * Image optimisation via sharp: convert to WebP, cap the long edge at 2000px,
 * never enlarge. Returns the output dimensions so callers can record them.
 *
 * We never delete or overwrite source images in place — callers pass a distinct
 * destination path, and old files stay in git history.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface OptimiseOptions {
  maxEdge?: number;
  quality?: number;
}

export interface OptimisedImage {
  dest: string;
  width: number;
  height: number;
  bytes: number;
}

export async function optimiseImage(
  srcPath: string,
  destPath: string,
  opts: OptimiseOptions = {},
): Promise<OptimisedImage> {
  const maxEdge = opts.maxEdge ?? 2000;
  const quality = opts.quality ?? 82;

  await mkdir(dirname(destPath), { recursive: true });

  const pipeline = sharp(srcPath)
    .rotate() // respect EXIF orientation
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality });

  const info = await pipeline.toFile(destPath);
  return { dest: destPath, width: info.width, height: info.height, bytes: info.size };
}
