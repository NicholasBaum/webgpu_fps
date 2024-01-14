import { Engine } from "./core/engine";
import { addCheckBox, createRow } from "./helper/htmlBuilder";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";

const canvas = document.querySelector("canvas")!;
const scene = new ShadowMapScene();
scene.attachUi(canvas);
const engine = new Engine(scene, canvas);
addEngineUI();
await engine.run();


function addEngineUI() {
    const row = createRow();
    scene.uiContainer.appendChild(row);
    addCheckBox(row, 'show_shadow_map', (checkbox) => {
        engine.showShadowMap = checkbox.checked;
    }, false);
}