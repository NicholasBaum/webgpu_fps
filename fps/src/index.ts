import { WASDCamera } from "./core/camera/wasdCamera";
import { Engine } from "./core/engine";
import { BoxesScene } from "./scenes/boxesScene";

const canvas = document.querySelector("canvas")!;
const scene = new BoxesScene({
    isAnimated: true,
    camera: new WASDCamera({ position: [0, 0, -10] })
});
const engine = new Engine(scene, canvas);

await engine.run();