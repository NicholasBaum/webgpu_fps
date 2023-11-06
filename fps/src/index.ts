import { BaseRenderer } from "./baseRenderer";
import { WASDCamera } from "./core/camera";
import { createInputHandler } from "./core/input";

const canvas = document.querySelector("canvas")!;
const renderer = new BaseRenderer(canvas, new WASDCamera(), createInputHandler(window));
await renderer.initialize();