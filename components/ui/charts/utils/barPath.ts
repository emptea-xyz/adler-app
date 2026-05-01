/**
 * Utility for creating bar chart paths with top-rounded corners.
 */
import { Skia } from "@shopify/react-native-skia";

/**
 * Create a Skia path for a bar with rounded top corners.
 * Bottom corners are square (sits flush on baseline).
 */
export function makeTopRoundedBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const path = Skia.Path.Make();
  const r = Math.min(radius, width / 2, height);

  path.moveTo(x, y + height);
  path.lineTo(x, y + r);
  path.quadTo(x, y, x + r, y);
  path.lineTo(x + width - r, y);
  path.quadTo(x + width, y, x + width, y + r);
  path.lineTo(x + width, y + height);
  path.close();

  return path;
}
