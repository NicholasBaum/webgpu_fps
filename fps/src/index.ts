import { UIController, SceneBuilder } from "./core/uIController";
import { EnvironmentMapScene } from "./scenes/environmentMapScene";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { PbrSamplesScene } from "./scenes/pbrSamplesScene";
import { PbrScene } from "./scenes/pbrScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { TargetLightScene } from "./scenes/targetLightScene";
import { InstancingBenchmark } from "./scenes/instancingBenchmark";
import { NormalMappingDebugScene } from "./scenes/NormalMappingDebugScene";
import { buildObjTestSceneAsync, } from "./scenes/objTestScene";

const scenes: SceneBuilder[] = [
    { name: "Obj Test", build: buildObjTestSceneAsync },
    { name: "Pbr Samples", build: () => new PbrSamplesScene() },
    { name: "Pbr", build: () => new PbrScene() },
    { name: "Benchmark", build: () => new InstancingBenchmark() },
    { name: "Environment Map", build: () => new EnvironmentMapScene() },
    { name: "Target Light", build: () => new TargetLightScene() },
    { name: "Shadow Map", build: () => new ShadowMapScene() },
    { name: "Normal Map", build: () => new NormalMappingScene() },
    { name: "Simple", build: () => new SimpleScene() },
];

const canvas = document.querySelector("canvas")!;
await (new UIController(canvas, scenes)).loadSceneAsync(scenes[0]);