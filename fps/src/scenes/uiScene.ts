import { Scene } from "../core/scene";
import { LightType } from "../core/light";
import { addCheckBox, createColumn, createRow } from "../helper/htmlBuilder";

export class UiScene extends Scene {

    uiContainer!: HTMLDivElement;

    public override attachUi(container: HTMLDivElement): void {
        let ui = createColumn();
        container.appendChild(ui);
        this.uiContainer = ui;
        const row = createRow();
        ui.appendChild(row);

        for (let [i, l] of this.lights.entries()) {
            addCheckBox(row, `${LightType[l.type]}Light_${i.toString().padStart(2, '0')}`, (checkbox) => {
                l.isOn = checkbox.checked;
            });
        }

        addCheckBox(row, 'isAnimated', (checkbox) => {
            this.isAnimated = checkbox.checked;
        }, this.isAnimated);

        const row2 = createRow();
        ui.appendChild(row2);

        addCheckBox(row2, 'ambient', (checkbox) => {
            for (let l of this.lights.values())
                l.disableAmbientColor = !checkbox.checked;
        });

        addCheckBox(row2, 'diffuse', (checkbox) => {
            for (let l of this.lights.values())
                l.disableDiffuseColor = !checkbox.checked;
        });

        addCheckBox(row2, 'specular', (checkbox) => {
            for (let l of this.lights.values())
                l.disableSpecularColor = !checkbox.checked;
        });

        const row3 = createRow();
        this.uiContainer.appendChild(row3);

        addCheckBox(row3, 'normal_mapping', (checkbox) => {
            for (let m of this.models)
                m.asset.material.disableNormalMap = !checkbox.checked;
        });
    }
}