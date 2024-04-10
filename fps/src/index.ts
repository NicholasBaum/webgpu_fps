import { Engine } from "./core/engine";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { SphereScene } from "./scenes/sphereScene";
import { TargetLightScene } from "./scenes/targetLightScene";
import { ReflectionMapScene } from "./scenes/reflectionMapScene";
import { PbrScene } from "./scenes/pbrScene";
import { EngineUI, SceneSource } from "./core/engineUI";
import { pbrSamplesScene } from "./scenes/pbrSamplesScene";

const scenes: SceneSource[] = [
    { name: "Pbr Samples", build: () => new pbrSamplesScene() },
    { name: "Pbr", build: () => new PbrScene() },
    { name: "Environment Map", build: () => new ReflectionMapScene() },
    { name: "Sphere", build: () => new SphereScene() },
    { name: "Target Light", build: () => new TargetLightScene() },
    { name: "Shadow Map", build: () => new ShadowMapScene() },
    { name: "Normal Map", build: () => new NormalMappingScene() },
    { name: "Simple", build: () => new SimpleScene() },
];

const currentScene = scenes[0];
const canvas = document.querySelector("canvas")!;
const engine = new Engine(currentScene.build(), canvas);
await engine.run();
const ui = new EngineUI(engine, canvas, scenes, currentScene);
ui.refresh();