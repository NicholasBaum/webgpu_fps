import { Engine } from "./core/engine";
import { SimpleScene } from "./scenes/simpleScene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(new SimpleScene(), canvas);
await engine.run();