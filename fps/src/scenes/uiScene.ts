import { Scene } from "../core/scene";
import { LightType } from "../core/light";
import { addCheckBox, createContainer, createRow } from "../helper/htmlBuilder";

export class UiScene extends Scene {

    uiContainer!: HTMLDivElement;

    public override attachUi(canvas: HTMLCanvasElement): void {
        let ui = createContainer();
        this.uiContainer = ui;
        const row = createRow();
        ui.appendChild(row);

        for (let [i, l] of this.lights.entries()) {
            addCheckBox(row, `${LightType[l.type]}Light_${i.toString().padStart(2, '0')}`, (checkbox) => {
                l.intensity = checkbox.checked ? 1 : 0;
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

        document.body.insertBefore(ui, canvas.nextSibling);
    }
}