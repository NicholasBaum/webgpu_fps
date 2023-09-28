import { BaseRenderer } from "./baseRenderer";
import { cubeVertexArray } from "./meshes/cube";
// import { UIInteraction } from "./uiInteraction";

const canvas = document.querySelector("canvas")!;
const renderer = new BaseRenderer(canvas);
await renderer.initialize();
//let ui = new UIInteraction(renderer);