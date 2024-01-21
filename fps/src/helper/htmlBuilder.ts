export const BASEPATH = window.location.pathname;

export function createContainer() {
    const containerDiv = document.createElement('div');
    containerDiv.style.display = 'flex';
    containerDiv.style.flexDirection = 'column';
    return containerDiv;
}

export function createRow() {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    return row;
}

export function createCheckBox(name: string, defaultValue = true): [HTMLInputElement, HTMLLabelElement] {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = name;
    checkbox.name = checkbox.id;
    checkbox.checked = defaultValue;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = checkbox.id;

    return [checkbox, label];
}

export function addCheckBox(row: HTMLDivElement, name: string, callback: (checkbox: HTMLInputElement) => void, defaultValue = true): HTMLInputElement {
    let [checkbox, label] = createCheckBox(name, defaultValue);
    row.appendChild(checkbox);
    row.appendChild(label);
    checkbox.addEventListener('change', () => callback(checkbox));
    return checkbox;
}