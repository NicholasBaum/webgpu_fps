import { addCheckBox, addSelectList, addTitle, createColumn, createRow, addNumericUpDown, NumericUpDown } from "../helper/htmlBuilder";
import { Engine } from "./engine";
import { LightType } from "./light";
import { Scene } from "./scene";

export type SceneBuilder = { name: string, build: () => Scene }

export class UIController {

    engine!: Engine;
    currentScene?: SceneBuilder;

    get uiContainer() {
        if (!this._uiContainer) {
            this._uiContainer = createRow('ui-container')
            document.body.insertBefore(this._uiContainer, this.canvas.nextSibling)
        }
        return this._uiContainer
    }
    private _uiContainer?: HTMLElement;

    constructor(
        private canvas: HTMLCanvasElement,
        public scenes: SceneBuilder[],
    ) { }

    async loadSceneAsync(sceneBuilder: SceneBuilder): Promise<void> {
        this.engine?.destroy();
        this.currentScene = sceneBuilder;
        this.engine = new Engine(sceneBuilder.build(), this.canvas);
        await this.engine.runAsync()
        attachUi(this);
        // force layout reset
        this.canvas.height = 10;
        this.canvas.width = 10;
        document.body.offsetWidth;
    }
}

function attachUi(controller: UIController) {
    let parent = controller.uiContainer;
    if (parent)
        parent.innerHTML = '';

    // left menu
    const leftMenu = parent.appendChild(createColumn());

    const sceneEl = leftMenu.appendChild(createColumn());
    insertSceneUI(sceneEl, controller.engine.scene, "Options");

    const engineEL = leftMenu.appendChild(createColumn());
    insertEngineUI(engineEL, controller.engine, "Renderer");

    // right menu
    const rightMenu = parent.appendChild(createColumn({ margin: '0px 200px 0px auto' }))
    insertSceneSelection(rightMenu, controller, "Scenes");
}


function insertSceneUI(container: HTMLDivElement, scene: Scene, name?: string): void {
    if (name)
        addTitle(container, name);
    let ui = createColumn();
    container.appendChild(ui);
    container = ui;
    const row = createRow();
    ui.appendChild(row);

    for (let [i, l] of scene.lights.entries()) {
        addCheckBox(row, `${LightType[l.type]}Light_${i.toString().padStart(2, '0')}`, (checkbox) => {
            l.isOn = checkbox.checked;
        }, l.isOn);
    }

    addCheckBox(row, 'isAnimated', (checkbox) => {
        scene.isAnimated = checkbox.checked;
    }, scene.isAnimated);

    const row2 = createRow();
    ui.appendChild(row2);

    addCheckBox(row2, 'ambient', (checkbox) => {
        for (let l of scene.lights.values())
            l.disableAmbientColor = !checkbox.checked;
    });

    addCheckBox(row2, 'diffuse', (checkbox) => {
        for (let l of scene.lights.values())
            l.disableDiffuseColor = !checkbox.checked;
    });

    addCheckBox(row2, 'specular', (checkbox) => {
        for (let l of scene.lights.values())
            l.disableSpecularColor = !checkbox.checked;
    });

    addCheckBox(row2, 'normal_mapping', (checkbox) => {
        for (let m of scene.models)
            m.material.disableNormalMap = !checkbox.checked;
    });
}

function insertEngineUI(container: HTMLDivElement, engine: Engine, name?: string) {
    if (!engine.scene.lights.some(x => x.useShadowMap) && !engine.scene.environmentMap)
        return;
    if (name)
        addTitle(container, name);

    // reference to every control
    let selectedCB: HTMLInputElement | undefined = undefined;
    let mapCB = new Array<HTMLInputElement>();
    let viewCB = new Array<HTMLInputElement>();
    let environmentCB: HTMLInputElement | undefined = undefined;
    let irradianceCB: HTMLInputElement | undefined = undefined;
    let prefilteredCB: HTMLInputElement | undefined = undefined;
    let brdfCB: HTMLInputElement | undefined = undefined;
    let specNumeric: NumericUpDown | undefined = undefined;

    // function to reset everything on changes
    const refreshState = (newSelection: HTMLInputElement) => {
        if (selectedCB && selectedCB != newSelection) {
            selectedCB.checked = false;
        }
        selectedCB = newSelection;
        // reset engine
        engine.showScene();
        // return if the selected checkbox isn't checked
        if (!selectedCB?.checked)
            return;
        // update engine depending on what checkbox is actually selected
        mapCB.forEach((cb, i) => { if (cb == selectedCB) engine.showShadowMap(i); });
        viewCB.forEach((cb, i) => { if (cb == selectedCB) engine.showLightView(i); });
        if (environmentCB == selectedCB) engine.showEnvironmentMap();
        if (irradianceCB == selectedCB) engine.showIrradianceMap();
        if (prefilteredCB == selectedCB) engine.showEnvSpecularMap(specNumeric!.value);
        if (brdfCB == selectedCB) engine.showBrdfMap();
    };

    // light view controls
    engine.scene.lights.filter(x => x.useShadowMap).forEach((l, i) => {
        const row = createRow();
        container.appendChild(row);
        addCheckBox(row, `ShadowMap${i}`, (checkbox) => { l.showShadows = checkbox.checked; });
        mapCB.push(addCheckBox(row, `map`, refreshState, false));
        viewCB.push(addCheckBox(row, `view`, refreshState, false));
    });

    // environment map controls
    if (engine.scene.environmentMap) {
        const row = createRow();
        container.appendChild(row);
        addCheckBox(row, `Environment`, (checkbox) => { engine.showBackground = checkbox.checked; });
        environmentCB = addCheckBox(row, 'map', refreshState, false);
        irradianceCB = addCheckBox(row, 'irradiance', refreshState, false);
        prefilteredCB = addCheckBox(row, 'prefilter', refreshState, false);
        specNumeric = addNumericUpDown(row, 0, engine.scene.environmentMap.specularMipsCount - 1, 0, 1, x => engine.showEnvSpecularMap(x))
        brdfCB = addCheckBox(row, 'brdf', refreshState, false);
    }
}

function insertSceneSelection(container: HTMLDivElement, controller: UIController, name?: string) {
    if (name)
        addTitle(container, name);
    addSelectList(container, controller.scenes, x => x.name, async (i) => {
        await controller.loadSceneAsync(controller.scenes[i]);
    }, controller.currentScene);
}
