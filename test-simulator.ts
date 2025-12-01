import { OSSimulator } from "./lib/os-simulator";

const sim = new OSSimulator();

console.log("Initial State:");
console.log(JSON.stringify(sim.getState().procesos, null, 2));

console.log("Creating Process...");
sim.crearProceso();

console.log("Running 10 ticks...");
for (let i = 0; i < 10; i++) {
  sim.ejecutarTick();
  const state = sim.getState();
  console.log(`Tick ${i+1}: Time=${state.tiempoSimulacion}, Running=${state.colaRunning?.pid}, Ready=${state.colaReady.length}, Blocked=${state.colaBlocked.length}`);
}

console.log("Final State:");
console.log(JSON.stringify(sim.getState().procesos, null, 2));
