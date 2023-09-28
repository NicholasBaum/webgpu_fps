// import { BaseRenderer } from "./baseRenderer";
// import { Vec2 } from "./primitves/vec2";

// export class UIInteraction {
//     private isMouseDown = false;
//     private start: Vec2 = new Vec2(0, 0);
//     constructor(private renderer: BaseRenderer) {
//         // Add event listeners
//         document.addEventListener("mousedown", (e) => this.handleMouseDown(e));
//         document.addEventListener("mouseup", (e) => this.handleMouseUp(e));
//         document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
//         document.addEventListener("wheel", (e) => this.handleMouseWheel(e));
//     }
//     // Function to handle mouse down event
//     private handleMouseDown(event: MouseEvent) {
//         if (event.button === 0) { // Check if the left mouse button is pressed (button code 0)
//             this.isMouseDown = true;
//             this.start = new Vec2(event.clientX, event.clientY);
//         }
//     }

//     // Function to handle mouse up event
//     private handleMouseUp(event: MouseEvent) {
//         if (event.button === 0) { // Check if the left mouse button is released (button code 0)
//             this.isMouseDown = false;
//         }
//     }

//     // Function to handle mouse move event
//     private handleMouseMove(event: MouseEvent) {
//         if (this.isMouseDown) {
//             const current = new Vec2(event.clientX, event.clientY);
//             const delta = current.sub(this.start);
//             this.start = current;
//             this.renderer.pan(new Vec2(-delta.x, delta.y));

//             const startTime = performance.now();
//             this.renderer.render();
//             const endTime = performance.now();
//             const elapsedTime = endTime - startTime; // Time difference in milliseconds
//             console.log(`Elapsed time: ${elapsedTime}ms`);
//         }
//     }

//     private handleMouseWheel(event: any) {
//         var delta = event.deltaY || event.detail || event.wheelDelta;
//         this.renderer.zoom(delta < 0 ? 0.9 : 1.1, new Vec2(event.clientX, event.clientY));
//         const startTime = performance.now();
//         this.renderer.render();
//         const endTime = performance.now();
//         const elapsedTime = endTime - startTime;
//         console.log(`Elapsed time: ${elapsedTime}ms`);
//     }
// }