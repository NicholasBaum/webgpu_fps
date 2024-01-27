import { Engine } from "./core/engine";
import { addCheckBox, addRadioButton, createColumn, createRow } from "./helper/htmlBuilder";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { SphereScene } from "./scenes/sphereScene";
import { TargetLightScene } from "./scenes/targetLightScene";
import { Scene } from "./core/scene";

const scenes = [
    { name: "Simple", scene: () => new SimpleScene() },
    { name: "NormaMap", scene: () => new NormalMappingScene() },
    { name: "ShadowMap", scene: () => new ShadowMapScene() },
    { name: "TargetLight", scene: () => new TargetLightScene() },
    { name: "Sphere", scene: () => new SphereScene() }
];

const canvas = document.querySelector("canvas")!;
const engine = new Engine(scenes[4].scene(), canvas);
await engine.run();

async function loadScene(scene: Scene): Promise<void> {
    engine.scene = scene;
    await engine.run();
}

// UI creation
const uiContainer = createRow();
document.body.insertBefore(uiContainer, canvas.nextSibling);
const col = uiContainer.appendChild(createColumn());
const config = col.appendChild(createColumn());
const engineConfig = col.appendChild(createColumn());
engine.scene.attachUi(config);
addEngineUI(engineConfig);
const sceneSelect = uiContainer.appendChild(createColumn('0px 0px 0px 200px'));
addScenesSelection(sceneSelect);

function addScenesSelection(container: HTMLDivElement) {
    const row = createRow();
    container.appendChild(row);

    addRadioButton(row, scenes, x => x.name, async (i) => {
        await loadScene(scenes[i].scene());
    });
}

function addEngineUI(container: HTMLDivElement) {
    let checkboxes = new Array<HTMLInputElement>();
    engine.scene.lights.filter(x => x.renderShadowMap).forEach((l, i) => {
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
