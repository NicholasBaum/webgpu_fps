export class Gui {

    private children: IControl[] = [];
    private parent: HTMLElement;
    private container: HTMLElement;

    constructor(parent?: HTMLElement) {
        this.parent = parent ?? document.body;
        this.container = document.createElement('div');
        const style = {
            position: 'absolute',
            padding: '4px',
            backgroundColor: '#0008',
            color: '#FFF',
            fontFamily: "'Roboto', sans-serif",
            fontSize: '12px',
            fontWeight: '400',
            lineHeight: '1.4',
            letterSpacing: '0.5px',
            display: 'flex',
            flexDirection: 'column'
        } as CSSStyleDeclaration;
        applyCss(this.container, style as any)
        this.parent.appendChild(this.container);
    }

    clear() {
        this.container.innerHTML = '';
        this.children = [];
    }

    public on: boolean = true;
    setRefreshLoop() {
        this.on = true;
        const refresh = () => {
            if (!this.on)
                return;
            requestAnimationFrame(() => {
                this.update();
                refresh();
            });
        }
        refresh();
    }

    update() {
        this.children.forEach(x => x.update());
    }

    add(control: IControl) {
        this.children.push(control);
        this.container.appendChild(control.html);
    }

    addText(text: string): void
    addText(textProvider: () => string): void
    addText(arg: string | (() => string)) {
        this.add(new Text(arg));
    }

}

export interface IControl {
    html: HTMLElement;
    update(): void;
}

export class Text implements IControl {

    html: HTMLElement;
    private getText: () => string;

    constructor(arg: string | (() => string)) {
        this.getText = typeof arg == 'string' ? () => { return arg; } : arg;
        this.html = document.createElement('span');
        applyCss(this.html, { 'whiteSpace': 'pre' });
        this.html.innerHTML = this.getText();
    }

    update() {
        const text = this.getText();
        if (this.html.innerText != text)
            this.html.innerText = text;
    }
}

function applyCss(element: HTMLElement, style: Record<string, string>) {
    for (const property in style) {
        if (style.hasOwnProperty(property)) {
            element.style[property as any] = style[property];
        }
    }
}