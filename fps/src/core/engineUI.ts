import { addCheckBox, addRadioButton, addTitle, createColumn, createRow } from "../helper/htmlBuilder";
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

        const rightRoot = root.appendChild(createColumn({ margin: '0px 0px 0px 200px' }))
        const scenesDiv = rightRoot.appendChild(createColumn());
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
            });
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
        let currentCB: HTMLInputElement | undefined = undefined;

        const refreshState = (newCB: HTMLInputElement) => {
            if (currentCB && currentCB != newCB) {
                currentCB.checked = false;
            }
            currentCB = newCB;
            engine.setRendererByIndex(0);
            engine.showShadowMapView_Id = -1;
            if (!currentCB?.checked) return;
            // find corresponding "renderer" and set value
            mapCB.forEach((cb, i) => { if (cb == currentCB) engine.showShadowMapView_Id = i; });
            viewCB.forEach((cb, i) => { if (cb == currentCB) engine.setRendererByIndex(i + 1); });
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
            addCheckBox(row, 'map', c => { engine.showEnvironmentMapView = c.checked; }, false);
        }
    }

    addScenesSelection(container: HTMLDivElement, initial: SceneSource) {
        const row = createRow();
        container.appendChild(row);

        addRadioButton(row, this.scenes, x => x.name, async (i) => {
            await this.loadSceneAsync(this.scenes[i]);
        }, initial);
    }
}