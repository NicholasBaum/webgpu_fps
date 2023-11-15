import { WASDCamera } from "./core/camera/wasdCamera";
import { Engine } from "./core/engine";
import { BoxesScene } from "./scenes/boxesScene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(new BoxesScene(true), canvas, new WASDCamera({ position: [0, 0, -10] }));
await engine.run();