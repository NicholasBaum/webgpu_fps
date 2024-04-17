import { addCheckBox, addSelectList, addRadioButton, addTitle, createColumn, createRow, addNumericUpDown } from "../helper/htmlBuilder";
import { Engine } from "./engine";
import { LightType } from "./light";
import { Scene } from "./scene";

export type SceneSource = { name: string, build: () => Scene }

export class EngineUI {
    constructor(public engine: Engine, public canvas: HTMLElement, public scenes: SceneSource[], public currentScene: SceneSource) {

    }

    async loadSceneAsync(scene: SceneSource): Promise<void> {
        this.currentScene = scene;
        this.engine.scene = this.currentScene.build();
        await this.engine.run();
        this.refresh();
    }

    refresh() {
        const name = "uiContainer"
        let root = document.querySelector(`#${name}`)
        if (root) {
            root.innerHTML = '';
        }
        else {
            root = createRow(name);
            document.body.insertBefore(root, this.canvas.nextSibling);
        }
        const leftRoot = root.appendChild(createColumn());

        const configDiv = leftRoot.appendChild(createColumn());
        addTitle(configDiv, "Options");
        this.addOptions(configDiv);

        const engineDiv = leftRoot.appendChild(createColumn());
        addTitle(engineDiv, "Renderer");
        this.addRendererControls(engineDiv);

        const rightRoot = root.appendChild(createColumn({ margin: '0px 200px 0px auto' }))

        const scenesDiv = rightRoot.appendChild(createColumn());
        addTitle(scenesDiv, "Scenes");
        this.addScenesSelection(scenesDiv, this.currentScene);
    }

    public addOptions(container: HTMLDivElement): void {
        let scene = this.engine.scene;
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
                m.asset.material.disableNormalMap = !checkbox.checked;
        });
    }

    addRendererControls(container: HTMLDivElement) {
        const engine = this.engine;

        // shadow map on/off, show map, light view
        let mapCB = new Array<HTMLInputElement>();
        let viewCB = new Array<HTMLInputElement>();
        let environmentCB: HTMLInputElement | undefined = undefined;
        let irradianceCB: HTMLInputElement | undefined = undefined;
        let prefilteredCB: HTMLInputElement | undefined = undefined;
        let brdfCB: HTMLInputElement | undefined = undefined;
        let currentCB: HTMLInputElement | undefined = undefined;

        const refreshState = (newCB: HTMLInputElement) => {
            if (currentCB && currentCB != newCB) {
                currentCB.checked = false;
            }
            currentCB = newCB;
            engine.setRendererByIndex(0);
            engine.showShadowMapView_Id = -1;
            engine.showEnvironmentMapView = false;
            engine.showIrradianceMapView = false;
            engine.showPrefilteredMapView = false;
            engine.showBrdfMapView = false;
            if (!currentCB?.checked) return;
            // find corresponding "renderer" and set value
            mapCB.forEach((cb, i) => { if (cb == currentCB) engine.showShadowMapView_Id = i; });
            viewCB.forEach((cb, i) => { if (cb == currentCB) engine.setRendererByIndex(i + 1); });
            if (environmentCB == currentCB) engine.showEnvironmentMapView = true;
            if (irradianceCB == currentCB) engine.showIrradianceMapView = true;
            if (prefilteredCB == currentCB) engine.showPrefilteredMapView = true;
            if (brdfCB == currentCB) engine.showBrdfMapView = true;
        };

        engine.scene.lights.filter(x => x.renderShadowMap).forEach((l, i) => {
            const row = createRow();
            container.appendChild(row);
            addCheckBox(row, `ShadowMap${i}`, (checkbox) => { l.showShadows = checkbox.checked; });
            mapCB.push(addCheckBox(row, `map`, refreshState, false));
            viewCB.push(addCheckBox(row, `view`, refreshState, false));
        });

        // environment map
        if (engine.scene.environmentMap) {
            const row = createRow();
            container.appendChild(row);
            addCheckBox(row, `Environment`, (checkbox) => { engine.renderEnvironment = checkbox.checked; });
            environmentCB = addCheckBox(row, 'map', refreshState, false);
            irradianceCB = addCheckBox(row, 'irradiance', refreshState, false);
            prefilteredCB = addCheckBox(row, 'prefilter', refreshState, false);
            addNumericUpDown(row, 0, engine.scene.environmentMap.prefEnvMapMipLevelCount - 1, 0, 1, x => engine.showPrefEnvMapIndex = x)
            brdfCB = addCheckBox(row, 'brdf', refreshState, false);
        }
    }

    addScenesSelection(container: HTMLDivElement, initial: SceneSource) {
        const row = createRow();
        container.appendChild(row);

        addSelectList(row, this.scenes, x => x.name, async (i) => {
            await this.loadSceneAsync(this.scenes[i]);
        }, initial);
    }
}