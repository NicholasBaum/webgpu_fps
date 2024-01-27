import { Engine } from "./core/engine";
import { addCheckBox, addRadioButton, createColumn, createRow } from "./helper/htmlBuilder";
import { NormalMappingScene } from "./scenes/normalMappingScene";
import { ShadowMapScene } from "./scenes/shadowMapScene";
import { SimpleScene } from "./scenes/simpleScene";
import { SphereScene } from "./scenes/sphereScene";
import { TargetLightScene } from "./scenes/targetLightScene";
import { Scene } from "./core/scene";

type SceneSource = { name: string, build: () => Scene }

const scenes: SceneSource[] = [
    { name: "Simple", build: () => new SimpleScene() },
    { name: "NormaMap", build: () => new NormalMappingScene() },
    { name: "ShadowMap", build: () => new ShadowMapScene() },
    { name: "TargetLight", build: () => new TargetLightScene() },
    { name: "Sphere", build: () => new SphereScene() }
];

const canvas = document.querySelector("canvas")!;
const engine = new Engine(scenes[0].build(), canvas);

await loadSceneAsync(scenes[scenes.length - 1]);

async function loadSceneAsync(scene: SceneSource): Promise<void> {
    engine.scene = scene.build();
    await engine.run();
    refreshUI(scene);
}

// UI creation
function refreshUI(scene: SceneSource) {
    const name = "uiContainer"
    let uiContainer = document.querySelector(`#${name}`)
    if (uiContainer) {
        uiContainer.innerHTML = '';
    }
    else {
        uiContainer = createRow(name);
        document.body.insertBefore(uiContainer, canvas.nextSibling);
    }
    const col = uiContainer.appendChild(createColumn());
    const configDiv = col.appendChild(createColumn());
    const engineDiv = col.appendChild(createColumn());
    engine.scene.attachUi(configDiv);
    addEngineUI(engineDiv);

    const col2 = uiContainer.appendChild(createColumn('0px 0px 0px 200px'));
    col2.innerHTML = '<h4 style="margin:5px">Scenes</h4>';
    const sceneSelectDiv = col2.appendChild(createColumn());
    addScenesSelection(sceneSelectDiv, scene);
}

function addScenesSelection(container: HTMLDivElement, initial: SceneSource) {
    const row = createRow();
    container.appendChild(row);

    addRadioButton(row, scenes, x => x.name, async (i) => {
        await loadSceneAsync(scenes[i]);
    }, initial);
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
