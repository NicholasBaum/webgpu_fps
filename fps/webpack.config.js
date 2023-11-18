const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
module.exports = {
    entry: './src/index.ts',
    devtool: "inline-source-map",
    devServer: {
        static: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.wgsl$/i,
                type: 'asset/source',
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "crypto": false,
            "crypto-browserify": false,
        }
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: "index.html",
            template: "./src/index.html",
        }),
        new CopyPlugin({
            patterns: [
                { from: "src/assets", to: "assets" }
            ],
        }),
    ],
};