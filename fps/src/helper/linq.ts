export function groupBy<T, Key extends object>(items: Array<T>, keySelector: (x: T) => Key): Map<Key, Array<T>> {
    return groupByWith(items, keySelector, (a, b) => a === b); 
}

export function groupByValues<T, Key extends object>(items: Array<T>, keySelector: (x: T) => Key): Map<Key, Array<T>> {
    return groupByWith(items, keySelector, firstValueComparer);
}

export function groupByWith<T, Key>(items: Array<T>, keySelector: (x: T) => Key, comparer: (a: Key, b: Key) => boolean): Map<Key, Array<T>> {
    let groups: Map<Key, Array<T>> = items.reduce((acc, m) => {
        let key = keySelector(m);
        let existingKey = Array.from(acc.keys()).find(k => comparer(k, key));
        if (!existingKey) {
            acc.set(key, []);
        }
        acc.get(existingKey ?? key)?.push(m);
        return acc;
    }, new Map<Key, Array<T>>());

    return groups;
}


const firstValueComparer = (a: object, b: object): boolean => {
    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.values(a);
        const keysB = Object.values(b);
        if (keysA.length !== keysB.length)
            return false;
        for (let i = 0; i < keysA.length; i++) {
            if (keysA[i] !== keysB[i])
                return false;
        }
        return true;
    }
    return false;
};