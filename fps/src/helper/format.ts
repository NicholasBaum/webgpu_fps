import { Mat4 } from "wgpu-matrix";

export function log(mat4: Mat4) {
    displayColumnMajor(mat4, mat4.length == 16 ? 4 : (mat4.length == 9 ? 3 : 1));
}

export function displayRowMajor(array: number[] | Float32Array | Float64Array, columns: number) {
    var rows = array.length / columns;
    var output = '';
    for (var i = 0; i < rows; i++) {
        var row = [];
        for (var j = 0; j < columns; j++) {
            var index = i * columns + j;
            if (index < array.length) {
                row.push(array[index]);
            } else {
                row.push('');
            }
        }
        output += row.join('\t') + '\n';
    }
    console.log(output);
}

export function displayColumnMajor(array: number[] | Float32Array | Float64Array, columns: number) {
    var rows = array.length / columns;
    var output = '';
    for (var i = 0; i < columns; i++) { // Iterating over columns first
        var col = [];
        for (var j = 0; j < rows; j++) { // Then iterate over rows
            var index = j * columns + i; // Accessing elements in column-major order
            if (index < array.length) {
                col.push(array[index]);
            } else {
                col.push('');
            }
        }
        output += col.join('\t') + '\n';
    }
    console.log(output);
}