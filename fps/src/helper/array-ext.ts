function flattenFloat32Arrays(arrays: Float32Array[]): Float32Array {
    // Calculate the total length of the flattened array
    const totalLength = arrays.reduce((acc, cur) => acc + cur.length, 0);

    // Create a new Float32Array to store the flattened data
    const flattenedArray = new Float32Array(totalLength);

    // Loop through each sub-array and copy elements to the flattened array
    let offset = 0;
    for (const arr of arrays) {
        flattenedArray.set(arr, offset);
        offset += arr.length;
    }

    return flattenedArray;
}