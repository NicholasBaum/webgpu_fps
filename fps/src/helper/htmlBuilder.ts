export const BASEPATH = window.location.pathname;

export function createColumn(opt?: { margin?: string, header?: string }) {
    const containerDiv = document.createElement('div');
    containerDiv.style.display = 'flex';
    containerDiv.style.flexDirection = 'column';
    containerDiv.style.margin = opt?.margin ?? "";
    return containerDiv;
}

export function createRow(id?: string) {
    const row = document.createElement('div');
    if (id)
        row.id = id;
    row.style.display = 'flex';
    row.style.gap = '10px';
    return row;
}

export function addTitle(col: HTMLElement, title: string) {
    col.innerHTML = `<h4 style="margin:5px">${title}</h4>`;
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
    row: HTMLDivElement,
    items: Iterable<T>,
    labelSelector: (x: T) => string | null,
    selectionChangedCallback: (i: number) => void,
    initial: number | T = 0
) {
    let initialSelection = typeof initial == 'number' ?
        initial :
        Math.max(0, [...items].indexOf(initial));
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

export function addSelectList<T>(
    row: HTMLDivElement,
    items: Iterable<T>,
    labelSelector: (x: T) => string | null,
    selectionChangedCallback: (i: number) => void,
    initial: number | T = 0
) {
    let select = document.createElement('select');
    select.setAttribute('size', '7');
    let currentIndex: number;

    if (typeof initial === 'number') {
        currentIndex = initial;
    } else {
        currentIndex = Math.max(0, [...items].indexOf(initial));
    }

    for (const [i, item] of [...items].entries()) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.text = labelSelector(item) ?? i.toString();
        select.appendChild(option);
    }

    select.value = currentIndex.toString();
    select.addEventListener('change', () => {
        const newIndex = parseInt(select.value);
        if (currentIndex !== newIndex) {
            currentIndex = newIndex;
            selectionChangedCallback(currentIndex);
        }
    });

    row.appendChild(select);
}
