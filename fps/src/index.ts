import { mat4 } from "wgpu-matrix";
import { Engine } from "./core/engine";
import { addCheckBox, addRadioButton, createContainer, createRow } from "./helper/htmlBuilder";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { SphereScene } from "./scenes/sphereScene";
import { TargetLightScene } from "./scenes/targetLightScene";

const canvas = document.querySelector("canvas")!;
const scene = new SphereScene();
const engine = new Engine(scene, canvas);
await engine.run();



const uiContainer = createContainer();
document.body.insertBefore(uiContainer, canvas.nextSibling);
scene.attachUi(uiContainer);
addScenesUI();
addEngineUI();


function addScenesUI() {

}


function addEngineUI() {
    let checkboxes = new Array<HTMLInputElement>();
    scene.lights.filter(x => x.renderShadowMap).forEach((l, i) => {
        const row = createRow();
        uiContainer.appendChild(row);
        addCheckBox(row, `ShadowMap${i}`, (checkbox) => {
            l.showShadows = checkbox.checked;
        });
        let c = addCheckBox(row, `show`, (checkbox) => {
            checkboxes.filter(x => x != checkbox).forEach(x => x.checked = false);
            engine.drawnShadowMapId = checkbox.checked ? i : -1;
        }, false);
        checkboxes.push(c);
    });

    if (engine.renderer.length < 2)
        return;
    const row = createRow();
    uiContainer.appendChild(row);
    addRadioButton(row, engine.renderer, x => x.name, (i) => {
        engine.setRendererByIndex(i);
    });
}