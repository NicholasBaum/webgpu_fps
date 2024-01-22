export function groupBy<T, Key>(items: Array<T>, keySelector: (x: T) => Key,): Map<Key, Array<T>> {
    let groups: Map<Key, Array<T>> = items.reduce((acc, m) => {
        let key = keySelector(m);
        if (!acc.has(key))
            acc.set(key, []);
        acc.get(key)?.push(m);
        return acc;
    }, new Map<Key, Array<T>>());

    return groups;
}