// typescript needs this module so it can use webpacks assets feature
declare module '*.wgsl' {
    const shader: string;
    export default shader;
}