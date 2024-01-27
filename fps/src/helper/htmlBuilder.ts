export const BASEPATH = window.location.pathname;

export function createColumn(margin?: string) {
    const containerDiv = document.createElement('div');
    containerDiv.style.display = 'flex';
    containerDiv.style.flexDirection = 'column';
    containerDiv.style.margin = margin ?? "";
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

export function addRadioButton<T>(
    row: HTMLDivElement, items: Iterable<T>,
    labelSelector: (x: T) => string | null,
    selectionChangedCallback: (i: number) => void,
    initialSelection: number = 0
) {
    let checkboxes = new Array<HTMLInputElement>();
    let currentIndex = initialSelection;
    for (const [i, item] of [...items].entries()) {
        let cb = addCheckBox(row, labelSelector(item) ?? "", (c) => {
            if (currentIndex != i) {
                checkboxes[currentIndex].checked = false;
                currentIndex = i;
                selectionChangedCallback(i);
            }
            else {
                // only setting the value doesn't trigger a callback
                checkboxes[initialSelection].checked = true;
                if (currentIndex != initialSelection) {
                    currentIndex = initialSelection;
                    selectionChangedCallback(currentIndex);
                }
            }
        }, initialSelection == i);
        checkboxes.push(cb);
    }
}