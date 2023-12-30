import { Engine } from "./core/engine";
import { DirectLightScene } from "./scenes/directLightScene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(new DirectLightScene(), canvas);
await engine.run();