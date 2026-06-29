import { isOssConfigured, presignVisitImageUrl } from "@/lib/oss";
import type { VisitImage, VisitWithImages } from "@/lib/types/travel";

export function presignVisitImage(image: VisitImage): VisitImage {
  if (!image.oss_url || !isOssConfigured()) return image;
  return {
    ...image,
    oss_url: presignVisitImageUrl(image.oss_url),
  };
}

export function withPresignedVisitImages(visits: VisitWithImages[]): VisitWithImages[] {
  if (!isOssConfigured()) return visits;
  return visits.map((visit) => ({
    ...visit,
    images: visit.images.map(presignVisitImage),
  }));
}
