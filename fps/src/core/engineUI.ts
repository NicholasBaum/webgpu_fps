import { addCheckBox, addRadioButton, createColumn, createRow } from "../helper/htmlBuilder";
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
        let uiContainer = document.querySelector(`#${name}`)
        if (uiContainer) {
            uiContainer.innerHTML = '';
        }
        else {
            uiContainer = createRow(name);
            document.body.insertBefore(uiContainer, this.canvas.nextSibling);
        }
        const col = uiContainer.appendChild(createColumn());
        const configDiv = col.appendChild(createColumn());
        const engineDiv = col.appendChild(createColumn());
        this.attachUi(configDiv);
        this.addEngineUI(engineDiv);

        const col2 = uiContainer.appendChild(createColumn('0px 0px 0px 200px'));
        col2.innerHTML = '<h4 style="margin:5px">Scenes</h4>';
        const sceneSelectDiv = col2.appendChild(createColumn());
        this.addScenesSelection(sceneSelectDiv, this.currentScene);
    }

    addScenesSelection(container: HTMLDivElement, initial: SceneSource) {
        const row = createRow();
        container.appendChild(row);

        addRadioButton(row, this.scenes, x => x.name, async (i) => {
            await this.loadSceneAsync(this.scenes[i]);
        }, initial);
    }

    addEngineUI(container: HTMLDivElement) {
        const engine = this.engine;
        let checkboxes = new Array<HTMLInputElement>();
        engine.scene.lights.filter(x => x.renderShadowMap).forEach((l, i) => {
            const row = createRow();
            container.appendChild(row);
            addCheckBox(row, `ShadowMap${i}`, (checkbox) => {
                l.showShadows = checkbox.checked;
            });
            let c = addCheckBox(row, `show`, (checkbox) => {
                checkboxes.filter(x => x != checkbox).forEach(x => x.checked = false);
                engine.renderShadowMapView_Id = checkbox.checked ? i : -1;
            }, false);
            checkboxes.push(c);
        });


        // shadowmap / light views
        if (engine.renderer.length > 1) {
            const row = createRow();
            container.appendChild(row);
            addRadioButton(row, engine.renderer, x => x.name, (i) => {
                engine.setRendererByIndex(i);
            });
        }


        if (engine.scene.environmentMap) {
            const row = createRow();
            container.appendChild(row);
            addCheckBox(row, 'Environment Map', c => {
                engine.renderEnvironmentMapView = c.checked;
            }, false);
        }
    }

    public attachUi(container: HTMLDivElement): void {
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

        const row3 = createRow();
        container.appendChild(row3);

        addCheckBox(row3, 'normal_mapping', (checkbox) => {
            for (let m of scene.models)
                m.asset.material.disableNormalMap = !checkbox.checked;
        });
    }
}