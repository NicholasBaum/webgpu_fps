import { WASDCamera } from "./core/camera";
import { Engine } from "./core/engine";
import { BoxesScene } from "./core/scene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(new BoxesScene(), canvas, new WASDCamera());
await engine.run();