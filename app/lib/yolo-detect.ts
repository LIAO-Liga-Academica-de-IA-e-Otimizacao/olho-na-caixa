/**
 * Runs the trained top-layer network in the browser.
 *
 * The file is the ONNX export of sim/assets/detect/top-layer.pt. One session
 * is reused. The photo is padded to 320×320 the same way the training did,
 * and the boxes are moved back onto the original photo before NMS.
 */

import { decodeYolo, layerFromDetections } from "./detections";
import type { Point } from "./frame-quality";
import type { ProduceItem, TopLayer } from "./top-layer";
import { ANCHORS, CLASS_COUNT, MODEL_SIZE, letterboxLayout, undoLetterbox } from "./yolo-frame";

const MODEL_URL = "/models/top-layer.onnx";

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

type Runtime = typeof import("onnxruntime-web");
type Session = Awaited<ReturnType<Runtime["InferenceSession"]["create"]>>;

let sessionPromise: Promise<Session> | null = null;

export async function detectTopLayer(
  image: Pixels,
  corners: Point[],
  lengthCm: number,
  widthCm: number,
  item: ProduceItem,
): Promise<TopLayer> {
  const started = performance.now();
  const session = await loadSession();
  const tensor = await tensorOf(image);
  const output = await session.run({ [session.inputNames[0]]: tensor });
  const raw = output[session.outputNames[0]].data;
  const fractions = undoLetterbox(
    Float32Array.from(raw as ArrayLike<number>),
    ANCHORS,
    letterboxLayout(image.width, image.height),
    image.width,
    image.height,
  );
  const detections = decodeYolo(fractions, ANCHORS, CLASS_COUNT, image.width, image.height);
  const layer = layerFromDetections(detections, corners, lengthCm, widthCm, item);
  return { ...layer, elapsedMs: performance.now() - started };
}

async function loadSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = import("onnxruntime-web/wasm").then(async (ort) => {
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    });
  }
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}

async function tensorOf(image: Pixels) {
  const ort = await import("onnxruntime-web/wasm");
  const box = letterboxLayout(image.width, image.height);
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) throw new Error("canvas");
  const copy = new Uint8ClampedArray(image.width * image.height * 4);
  copy.set(image.data);
  sourceContext.putImageData(new ImageData(copy, image.width, image.height), 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas");
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  context.drawImage(
    source,
    0,
    0,
    image.width,
    image.height,
    box.left,
    box.top,
    box.resizedWidth,
    box.resizedHeight,
  );
  const pixels = context.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
  const data = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  const plane = MODEL_SIZE * MODEL_SIZE;
  for (let index = 0; index < plane; index += 1) {
    data[index] = pixels[index * 4] / 255;
    data[plane + index] = pixels[index * 4 + 1] / 255;
    data[2 * plane + index] = pixels[index * 4 + 2] / 255;
  }
  return new ort.Tensor("float32", data, [1, 3, MODEL_SIZE, MODEL_SIZE]);
}
