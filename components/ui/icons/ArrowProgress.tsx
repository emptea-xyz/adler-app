import { Canvas, Group, Path, rect, Skia, StrokeJoin, StrokeCap } from "@shopify/react-native-skia";
import {
    interpolateColor,
    useDerivedValue,
    type SharedValue,
} from "react-native-reanimated";

const ARROW_PATH = "M0 23.5355H300M280 3.53552L300 23.5355L280 43.5355";

const SRC_W = 305;
const SRC_H = 48;
const STROKE_WIDTH = 5;

interface ArrowProgressProps {
    /** Rendered width in dp */
    width?: number;
    /** Rendered height in dp – defaults to preserve aspect ratio */
    height?: number;
    /** Animated progress 0–1 (SharedValue for smooth transitions) */
    progress: SharedValue<number>;
    /** Animated error flash 0–1 (0 = normal, 1 = red) */
    errorFlash?: SharedValue<number>;
}

function makeOutline(svgPath: string, strokeWidth: number) {
    const path = Skia.Path.MakeFromSVGString(svgPath);
    if (!path) return null;
    path.stroke({
        width: strokeWidth,
        miter_limit: 10,
        join: StrokeJoin.Miter,
        cap: StrokeCap.Butt,
    });
    return path;
}

export function ArrowProgress({
    width = 152,
    height,
    progress,
    errorFlash,
}: ArrowProgressProps) {
    const h = height ?? Math.round((width / SRC_W) * SRC_H);
    const scaleX = width / SRC_W;
    const scaleY = h / SRC_H;
    const matrix = Skia.Matrix([scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);

    const basePath = makeOutline(ARROW_PATH, STROKE_WIDTH);
    const fillPath = makeOutline(ARROW_PATH, STROKE_WIDTH);

    const clipPath = useDerivedValue(() => {
        const p = Skia.Path.Make();
        const clamped = Math.max(0, Math.min(1, progress.value));
        p.addRect(rect(0, 0, width * clamped, h));
        return p;
    });

    const fillColor = useDerivedValue(() => {
        if (!errorFlash || errorFlash.value === 0) return Skia.Color("rgba(0,0,0,0.8)");
        const c = interpolateColor(
            errorFlash.value,
            [0, 1],
            ["rgba(0,0,0,0.8)", "rgba(225,68,68,0.9)"]
        );
        return Skia.Color(c as unknown as string);
    });

    if (!basePath || !fillPath) return null;
    basePath.transform(matrix);
    fillPath.transform(matrix);

    return (
        <Canvas style={{ width, height: h }}>
            <Path path={basePath} color="rgba(0,0,0,0.15)" />
            <Group clip={clipPath}>
                <Path path={fillPath} color={fillColor} />
            </Group>
        </Canvas>
    );
}
