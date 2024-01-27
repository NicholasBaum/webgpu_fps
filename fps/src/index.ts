import { mat4 } from "wgpu-matrix";
import { Engine } from "./core/engine";
import { addCheckBox, addRadioButton, createColumn, createRow } from "./helper/htmlBuilder";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { SphereScene } from "./scenes/sphereScene";
import { TargetLightScene } from "./scenes/targetLightScene";

const canvas = document.querySelector("canvas")!;
const scene = new SphereScene();
const engine = new Engine(scene, canvas);
await engine.run();



const uiContainer = createRow();
document.body.insertBefore(uiContainer, canvas.nextSibling);
const col = uiContainer.appendChild(createColumn());
const config = col.appendChild(createColumn());
const engineConfig = col.appendChild(createColumn());
scene.attachUi(config);
addEngineUI(engineConfig);
const sceneSelect = uiContainer.appendChild(createColumn('0px 0px 0px 200px'));
addScenesSelection(sceneSelect);

function addScenesSelection(container: HTMLDivElement) {
    // const row = createRow();
    // container.appendChild(row);
    // addCheckBox(row, "test", (x) => { })
}

function addEngineUI(container: HTMLDivElement) {
    let checkboxes = new Array<HTMLInputElement>();
    scene.lights.filter(x => x.renderShadowMap).forEach((l, i) => {
        const row = createRow();
        container.appendChild(row);
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
    container.appendChild(row);
    addRadioButton(row, engine.renderer, x => x.name, (i) => {
        engine.setRendererByIndex(i);
    });
}