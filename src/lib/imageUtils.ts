// src/lib/imageUtils.ts

/**
 * Determines the CSS object-position for an image based on focal point data.
 * In a real-world scenario, focal point data (e.g., coordinates of a face)
 * would be obtained from an image analysis service or pre-calculated.
 * For now, it defaults to 'center center'.
 *
 * @param imageUrl The URL of the image.
 * @param focalPoint An optional object with x and y coordinates for the focal point (0-100).
 * @returns A CSS object-position string.
 */
export const getObjectPosition = (imageUrl: string, focalPoint?: { x: number; y: number }): string => {
  if (focalPoint) {
    // In a more advanced implementation, you might adjust these values based on image aspect ratio
    // and the containing element's aspect ratio to ensure the focal point remains visible.
    return `${focalPoint.x}% ${focalPoint.y}%`;
  }
  return 'center center'; // Default to center if no focal point is provided
};
