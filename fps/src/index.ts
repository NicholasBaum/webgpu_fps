import { WASDCamera } from "./core/camera/wasdCamera";
import { Engine } from "./core/engine";
import { BoxesScene } from "./scenes/boxesScene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(new BoxesScene(), canvas);
await engine.run();