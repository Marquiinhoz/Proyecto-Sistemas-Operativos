(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/process-manager.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProcessManager",
    ()=>ProcessManager
]);
class ProcessManager {
    procesos;
    colaNew;
    colaTerminated;
    ultimoPID = 0;
    MIN_BLOCK_SIZE = 32 * 1024;
    constructor(){
        this.procesos = [];
        this.colaNew = [];
        this.colaTerminated = [];
    }
    getAll() {
        return this.procesos;
    }
    getNew() {
        return this.colaNew;
    }
    getTerminated() {
        return this.colaTerminated;
    }
    getLastPID() {
        return this.ultimoPID;
    }
    crearProceso(tiempoSimulacion, tamanioSolicitado, burstTimeSolicitado, prioridadSolicitada, maxInterrupcionesSolicitadas, porcentajeDatosSolicitado, porcentajeVariableSolicitado) {
        const pid = ++this.ultimoPID;
        let tamanio = tamanioSolicitado || 0;
        if (!tamanio) {
            const minExp = 15; // 32KB
            const maxExp = 19; // 512KB
            const exp = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
            tamanio = Math.pow(2, exp);
        } else {
            tamanio = Math.pow(2, Math.ceil(Math.log2(tamanio)));
            if (tamanio < this.MIN_BLOCK_SIZE) tamanio = this.MIN_BLOCK_SIZE;
        }
        const burstTime = burstTimeSolicitado ?? Math.floor(Math.random() * 15) + 5;
        const prioridad = prioridadSolicitada ?? Math.floor(Math.random() * 4);
        const pctDatos = porcentajeDatosSolicitado ?? Math.floor(Math.random() * 30) + 10;
        const pctVariable = porcentajeVariableSolicitado ?? Math.floor(Math.random() * 20) + 5;
        const proceso = {
            pid,
            estado: "new",
            programCounter: 0,
            burstTime,
            tiempoRestante: burstTime,
            tiempoLlegada: tiempoSimulacion,
            tiempoEspera: 0,
            tiempoRespuesta: -1,
            tiempoTurnaround: 0,
            prioridad,
            tamanio,
            dirBase: -1,
            porcentajeDatos: pctDatos,
            porcentajeVariable: pctVariable,
            stackPointer: 0,
            heapPointer: 0,
            interrupciones: 0,
            // Rigorous Requirement: Interrupts dependent on size and burst time
            maxInterrupciones: maxInterrupcionesSolicitadas ?? Math.min(20, Math.max(5, Math.floor(burstTime * 0.5 + tamanio / 1024 / 50 + Math.random() * 5))),
            errores: 0,
            cambiosContexto: 0,
            porcentajeProcesado: 0,
            ioType: null,
            ioTimeRemaining: 0,
            isIdle: false,
            memoryAddress: `0x${Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}`,
            pcbOffsets: {
                pid: "0x00",
                estado: "0x04",
                pc: "0x08",
                regs: "0x0C",
                memLimit: "0x10",
                files: "0x18"
            },
            esProceSO: false,
            archivosAbiertos: Math.floor(Math.random() * 3),
            paginasMemoria: []
        };
        this.procesos.push(proceso);
        this.colaNew.push(proceso);
        return proceso;
    }
    admitirProcesos(memoria, scheduler) {
        const porAdmitir = [
            ...this.colaNew
        ];
        for (const proceso of porAdmitir){
            if (memoria.asignarMemoria(proceso)) {
                proceso.estado = "ready";
                const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
                proceso.heapPointer = proceso.dirBase + dataSize;
                proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;
                scheduler.add(proceso);
                this.colaNew = this.colaNew.filter((p)=>p.pid !== proceso.pid);
            }
        }
    }
    terminarProceso(proceso, tiempoActual, memoryManager) {
        proceso.estado = "terminated";
        proceso.tiempoFinalizacion = tiempoActual;
        proceso.tiempoTurnaround = proceso.tiempoFinalizacion - proceso.tiempoLlegada;
        // Rigorous Requirement: Release resources beyond memory
        if (proceso.archivosAbiertos > 0) {
            console.log(`[System] Liberando ${proceso.archivosAbiertos} descriptores de archivo para PID ${proceso.pid}`);
            proceso.archivosAbiertos = 0;
        }
        memoryManager.liberarMemoria(proceso.pid);
        this.colaTerminated.push(proceso);
    }
    createIdleProcess() {
        return {
            pid: 0,
            estado: "ready",
            programCounter: 0,
            burstTime: Infinity,
            tiempoRestante: Infinity,
            tiempoLlegada: 0,
            tiempoEspera: 0,
            tiempoRespuesta: 0,
            tiempoTurnaround: 0,
            prioridad: -1,
            tamanio: 0,
            dirBase: 0,
            porcentajeDatos: 0,
            porcentajeVariable: 0,
            stackPointer: 0,
            heapPointer: 0,
            interrupciones: 0,
            maxInterrupciones: 0,
            errores: 0,
            cambiosContexto: 0,
            porcentajeProcesado: 0,
            ioType: null,
            ioTimeRemaining: 0,
            isIdle: true,
            esProceSO: true,
            memoryAddress: "0x0000",
            pcbOffsets: {},
            archivosAbiertos: 0,
            paginasMemoria: []
        };
    }
    getProcess(pid) {
        return this.procesos.find((p)=>p.pid === pid);
    }
    editarProceso(pid, updates, memoria) {
        const proceso = this.getProcess(pid);
        if (!proceso) return false;
        // Si se cambia el tamaño, necesitamos reasignar memoria
        if (updates.tamanio !== undefined && updates.tamanio !== proceso.tamanio) {
            const nuevoTamanio = Math.pow(2, Math.ceil(Math.log2(updates.tamanio)));
            if (nuevoTamanio < this.MIN_BLOCK_SIZE) return false;
            // Liberar memoria actual
            if (proceso.dirBase !== -1) {
                memoria.liberarMemoria(proceso.pid);
            }
            proceso.dirBase = -1;
            proceso.estado = "new";
            // Actualizar tamaño
            proceso.tamanio = nuevoTamanio;
            // Intentar reasignar memoria
            if (!memoria.asignarMemoria(proceso)) {
                return false; // No hay memoria disponible
            }
            // Recalcular punteros
            const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
            proceso.heapPointer = proceso.dirBase + dataSize;
            proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;
        }
        // Actualizar otros campos
        if (updates.burstTime !== undefined) {
            proceso.burstTime = updates.burstTime;
            // Ajustar tiempo restante proporcionalmente si el proceso está corriendo
            if (proceso.estado === "running" || proceso.tiempoRestante > 0) {
                const ratio = proceso.tiempoRestante / (proceso.burstTime || 1);
                proceso.tiempoRestante = Math.max(0, Math.floor(updates.burstTime * ratio));
            } else {
                proceso.tiempoRestante = updates.burstTime;
            }
            proceso.porcentajeProcesado = proceso.burstTime > 0 ? (proceso.burstTime - proceso.tiempoRestante) / proceso.burstTime * 100 : 0;
        }
        if (updates.prioridad !== undefined) {
            proceso.prioridad = Math.max(0, Math.min(3, updates.prioridad));
        }
        if (updates.porcentajeDatos !== undefined) {
            proceso.porcentajeDatos = Math.min(100, Math.max(0, updates.porcentajeDatos));
            if (proceso.dirBase !== -1) {
                const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
                proceso.heapPointer = proceso.dirBase + dataSize;
            }
        }
        if (updates.porcentajeVariable !== undefined) {
            proceso.porcentajeVariable = Math.min(100, Math.max(0, updates.porcentajeVariable));
        }
        if (updates.maxInterrupciones !== undefined) {
            proceso.maxInterrupciones = Math.max(1, Math.min(20, updates.maxInterrupciones));
        }
        return true;
    }
    eliminarProceso(pid, memoria, scheduler, dispatcher, ioManager) {
        const proceso = this.getProcess(pid);
        if (!proceso) return false;
        // Si está corriendo, expropiarlo
        if (proceso.estado === "running" && dispatcher) {
            const running = dispatcher.getRunning();
            if (running && running.pid === pid) {
                dispatcher.preempt();
            }
        }
        // Remover de todas las colas
        this.colaNew = this.colaNew.filter((p)=>p.pid !== pid);
        // Remover de cola ready (scheduler)
        const readyQueue = scheduler.getQueue();
        const readyIndex = readyQueue.findIndex((p)=>p.pid === pid);
        if (readyIndex !== -1) {
            readyQueue.splice(readyIndex, 1);
        }
        // Remover de colas de I/O
        if (ioManager && typeof ioManager.removerInterrupcionesProceso === 'function') {
            ioManager.removerInterrupcionesProceso(pid);
        }
        // Liberar memoria
        if (proceso.dirBase !== -1) {
            memoria.liberarMemoria(pid);
        }
        // Remover del array de procesos
        this.procesos = this.procesos.filter((p)=>p.pid !== pid);
        this.colaTerminated = this.colaTerminated.filter((p)=>p.pid !== pid);
        return true;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/memory-manager.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MemoryManager",
    ()=>MemoryManager
]);
class MemoryManager {
    memoria;
    strategyFit = "FirstFit";
    MEMORY_SIZE = 2 * 1024 * 1024;
    constructor(){
        this.memoria = [
            {
                direccionInicio: 0,
                direccionFin: this.MEMORY_SIZE,
                tamanio: this.MEMORY_SIZE,
                pid: null,
                ocupado: false,
                esBuddy: false
            }
        ];
    }
    getMemoryState() {
        return this.memoria;
    }
    getStrategy() {
        return this.strategyFit;
    }
    setStrategy(strategy) {
        this.strategyFit = strategy;
    }
    asignarMemoria(proceso) {
        const sizeNeeded = proceso.tamanio;
        const bloques = this.memoria;
        // Find candidate blocks
        let candidates = [];
        bloques.forEach((b, i)=>{
            if (!b.ocupado && b.tamanio >= sizeNeeded) {
                candidates.push({
                    index: i,
                    block: b
                });
            }
        });
        if (candidates.length === 0) return false;
        let selectedIdx = -1;
        if (this.strategyFit === "FirstFit") {
            selectedIdx = candidates[0].index;
        } else if (this.strategyFit === "BestFit") {
            candidates.sort((a, b)=>a.block.tamanio - b.block.tamanio);
            selectedIdx = candidates[0].index;
        } else if (this.strategyFit === "WorstFit") {
            candidates.sort((a, b)=>b.block.tamanio - a.block.tamanio);
            selectedIdx = candidates[0].index;
        }
        if (selectedIdx === -1) return false;
        // Split logic
        let currentIdx = selectedIdx;
        while(this.memoria[currentIdx].tamanio > sizeNeeded){
            this.dividirBloque(currentIdx);
        // After split, we continue with the first block (usually lower address)
        }
        const bloqueFinal = this.memoria[currentIdx];
        bloqueFinal.ocupado = true;
        bloqueFinal.pid = proceso.pid;
        proceso.dirBase = bloqueFinal.direccionInicio;
        return true;
    }
    dividirBloque(index) {
        const bloque = this.memoria[index];
        const nuevoTam = bloque.tamanio / 2;
        const buddy1 = {
            ...bloque,
            tamanio: nuevoTam,
            direccionFin: bloque.direccionInicio + nuevoTam
        };
        const buddy2 = {
            direccionInicio: bloque.direccionInicio + nuevoTam,
            direccionFin: bloque.direccionFin,
            tamanio: nuevoTam,
            pid: null,
            ocupado: false,
            esBuddy: true
        };
        this.memoria.splice(index, 1, buddy1, buddy2);
    }
    liberarMemoria(pid) {
        const index = this.memoria.findIndex((b)=>b.pid === pid);
        if (index === -1) return;
        this.memoria[index].pid = null;
        this.memoria[index].ocupado = false;
        this.combinarBloques();
    }
    combinarBloques() {
        let merged = true;
        while(merged){
            merged = false;
            for(let i = 0; i < this.memoria.length - 1; i++){
                const b1 = this.memoria[i];
                const b2 = this.memoria[i + 1];
                if (!b1.ocupado && !b2.ocupado && b1.tamanio === b2.tamanio) {
                    const combinedSize = b1.tamanio * 2;
                    // Check alignment for buddy system
                    if (b1.direccionInicio % combinedSize === 0) {
                        const nuevoBloque = {
                            direccionInicio: b1.direccionInicio,
                            direccionFin: b2.direccionFin,
                            tamanio: combinedSize,
                            pid: null,
                            ocupado: false,
                            esBuddy: false
                        };
                        this.memoria.splice(i, 2, nuevoBloque);
                        merged = true;
                        break;
                    }
                }
            }
        }
    }
    getFragmentation(procesos) {
        let internal = 0;
        let external = 0;
        this.memoria.forEach((b)=>{
            if (!b.ocupado) {
                external += b.tamanio;
            } else if (b.pid !== null) {
                const p = procesos.find((proc)=>proc.pid === b.pid);
                if (p) {
                    internal += b.tamanio - p.tamanio;
                }
            }
        });
        return {
            internal,
            external
        };
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/io-manager.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IOManager",
    ()=>IOManager
]);
class IOManager {
    colasDispositivos;
    interrupcionesActivas;
    interrupcionesTotal = 0;
    constructor(){
        this.colasDispositivos = {
            keyboard: [],
            disk: [],
            printer: [],
            monitor: [],
            network: []
        };
        this.interrupcionesActivas = [];
    }
    getDeviceQueues() {
        return this.colasDispositivos;
    }
    getActiveInterrupts() {
        return this.interrupcionesActivas;
    }
    getTotalInterrupts() {
        return this.interrupcionesTotal;
    }
    solicitarIO(proceso, device) {
        this.colasDispositivos[device].push(proceso);
        proceso.ioType = device;
        // If device is idle, start processing
        const activeForDevice = this.interrupcionesActivas.find((i)=>i.dispositivo === device);
        if (!activeForDevice) {
            this.procesarSiguienteIO(device);
        }
    }
    procesarSiguienteIO(device) {
        const queue = this.colasDispositivos[device];
        if (queue.length === 0) return;
        const proceso = queue[0]; // Peek
        // Requirement: Duration 5-20 depending on burst-time
        // Formula: Base 5 + (Burst/2) + Random(0-5), clamped to [5, 20]
        const duracion = Math.min(20, Math.max(5, Math.floor(5 + proceso.burstTime / 2 + Math.random() * 5)));
        const interrupt = {
            id: Math.random(),
            dispositivo: device,
            duracion,
            tiempoRestante: duracion,
            pidAsociado: proceso.pid,
            esManual: device === "keyboard",
            estado: "active"
        };
        this.interrupcionesActivas.push(interrupt);
        this.interrupcionesTotal++;
        proceso.interrupciones++;
    }
    verificarInterrupciones() {
        const completedProcesses = [];
        for(let i = this.interrupcionesActivas.length - 1; i >= 0; i--){
            const irq = this.interrupcionesActivas[i];
            if (irq.esManual && irq.estado === "waiting") continue;
            irq.tiempoRestante--;
            if (irq.tiempoRestante <= 0) {
                const p = this.finalizarIO(irq);
                if (p) completedProcesses.push(p);
            }
        }
        return completedProcesses;
    }
    finalizarIO(irq) {
        this.interrupcionesActivas = this.interrupcionesActivas.filter((i)=>i.id !== irq.id);
        const queue = this.colasDispositivos[irq.dispositivo];
        const procIdx = queue.findIndex((p)=>p.pid === irq.pidAsociado);
        let proceso = null;
        if (procIdx !== -1) {
            proceso = queue.splice(procIdx, 1)[0];
            proceso.ioType = null;
        }
        this.procesarSiguienteIO(irq.dispositivo);
        return proceso;
    }
    resolverInterrupcionManual(id, accion) {
        const irq = this.interrupcionesActivas.find((i)=>i.id === id);
        if (!irq) return null;
        if (accion === "continuar") {
            irq.estado = "active";
            irq.esManual = false;
            return null;
        } else {
            // Cancel: Finish immediately
            return this.finalizarIO(irq);
        }
    }
    removerInterrupcionesProceso(pid) {
        // Remover de colas de dispositivos
        Object.keys(this.colasDispositivos).forEach((device)=>{
            const queue = this.colasDispositivos[device];
            const index = queue.findIndex((p)=>p.pid === pid);
            if (index !== -1) {
                queue.splice(index, 1);
            }
        });
        // Remover interrupciones activas
        this.interrupcionesActivas = this.interrupcionesActivas.filter((irq)=>irq.pidAsociado !== pid);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/scheduler.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Scheduler",
    ()=>Scheduler
]);
class Scheduler {
    colaReady = [];
    // Rigorous Requirement: Claridad Apropiativo vs No Apropiativo
    // (a) FCFS: No Apropiativo
    // (e) Prioridades (No Apropiativo por defecto en esta impl, configurable)
    // (b) Round Robin: Apropiativo (por Quantum)
    // (c) SJF: Apropiativo (SRTF) o No Apropiativo
    algorithm = "FCFS";
    apropiativo = false;
    quantum = 3;
    constructor(){
        this.colaReady = [];
    }
    getQueue() {
        return this.colaReady;
    }
    getAlgorithm() {
        return this.algorithm;
    }
    isApropiativo() {
        return this.apropiativo;
    }
    getQuantum() {
        return this.quantum;
    }
    setAlgorithm(algo) {
        this.algorithm = algo;
    }
    setApropiativo(apropiativo) {
        this.apropiativo = apropiativo;
    }
    setQuantum(quantum) {
        this.quantum = quantum;
    }
    add(proceso) {
        proceso.estado = "ready";
        this.colaReady.push(proceso);
    }
    getNext() {
        if (this.colaReady.length === 0) return undefined;
        let selectedIdx = 0;
        switch(this.algorithm){
            case "FCFS":
            case "RoundRobin":
                selectedIdx = 0;
                break;
            case "SJF":
                selectedIdx = this.findBestIndex((p)=>p.burstTime);
                break;
            case "Prioridades":
                selectedIdx = this.findBestIndex((p)=>p.prioridad);
                break;
        }
        const selected = this.colaReady[selectedIdx];
        this.colaReady.splice(selectedIdx, 1);
        return selected;
    }
    findBestIndex(metric) {
        let bestIdx = 0;
        let bestVal = metric(this.colaReady[0]);
        for(let i = 1; i < this.colaReady.length; i++){
            const val = metric(this.colaReady[i]);
            if (val < bestVal) {
                bestVal = val;
                bestIdx = i;
            }
        }
        return bestIdx;
    }
    debeExpropiar(running) {
        if (!this.apropiativo) return false;
        if (this.colaReady.length === 0) return false;
        if (this.algorithm === "SJF") {
            return this.colaReady.some((p)=>p.burstTime < running.tiempoRestante);
        }
        if (this.algorithm === "Prioridades") {
            return this.colaReady.some((p)=>p.prioridad < running.prioridad);
        }
        return false;
    }
    checkQuantum(running) {
        if (this.algorithm !== "RoundRobin") return false;
        return (running.burstTime - running.tiempoRestante) % this.quantum === 0;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/dispatcher.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Dispatcher",
    ()=>Dispatcher
]);
class Dispatcher {
    colaRunning = null;
    cambiosContextoTotal = 0;
    getRunning() {
        return this.colaRunning;
    }
    getTotalContextSwitches() {
        return this.cambiosContextoTotal;
    }
    dispatch(proceso, tiempoSimulacion) {
        this.colaRunning = proceso;
        proceso.estado = "running";
        if (proceso.tiempoRespuesta === -1) {
            proceso.tiempoRespuesta = tiempoSimulacion - proceso.tiempoLlegada;
        }
        proceso.cambiosContexto++;
        this.cambiosContextoTotal++;
    }
    preempt() {
        if (!this.colaRunning) return null;
        const p = this.colaRunning;
        this.colaRunning = null;
        return p;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/error-manager.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorManager",
    ()=>ErrorManager
]);
class ErrorManager {
    clearErrors() {
        this.errors = [];
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/os-simulator.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OSSimulator",
    ()=>OSSimulator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$process$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/process-manager.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$memory$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/memory-manager.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$io$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/io-manager.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/scheduler.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$dispatcher$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/dispatcher.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$error$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/error-manager.ts [app-client] (ecmascript)");
;
;
;
;
;
;
class OSSimulator {
    processManager;
    memoryManager;
    ioManager;
    scheduler;
    dispatcher;
    errorManager;
    tiempoSimulacion = 0;
    erroresTotal = 0;
    logs = [];
    ultimoLogId = 0;
    MAX_LOGS = 500;
    rngFormulas = [
        "Size = 2^ceil(log2(random(32KB, 512KB)))",
        "Burst = random(5, 20)",
        "IO_Duration = random(5, 20)",
        "Error = random() < 0.005"
    ];
    agregarLog(tipo, mensaje, pid) {
        this.logs.push({
            id: ++this.ultimoLogId,
            tiempo: this.tiempoSimulacion,
            tipo,
            mensaje,
            pid
        });
        // Mantener solo los últimos MAX_LOGS
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }
    }
    constructor(initialQuantum = 3){
        this.processManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$process$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ProcessManager"]();
        this.memoryManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$memory$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MemoryManager"]();
        this.ioManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$io$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IOManager"]();
        this.scheduler = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scheduler"]();
        this.dispatcher = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$dispatcher$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dispatcher"]();
        this.errorManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$error$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ErrorManager"]();
        // Rigorous Requirement: Quantum configurable at start
        this.scheduler.setQuantum(initialQuantum);
    }
    getState() {
        return {
            procesos: this.processManager.getAll(),
            colaNew: this.processManager.getNew(),
            colaReady: this.scheduler.getQueue(),
            colaRunning: this.dispatcher.getRunning(),
            colaBlocked: this.processManager.getAll().filter((p)=>p.estado === 'blocked'),
            colaTerminated: this.processManager.getTerminated(),
            colasDispositivos: this.ioManager.getDeviceQueues(),
            memoria: this.memoryManager.getMemoryState(),
            interrupcionesActivas: this.ioManager.getActiveInterrupts(),
            scheduler: this.scheduler.getAlgorithm(),
            apropiativo: this.scheduler.isApropiativo(),
            quantum: this.scheduler.getQuantum(),
            memoryStrategy: this.memoryManager.getStrategy(),
            ultimoPID: this.processManager.getLastPID(),
            tiempoSimulacion: this.tiempoSimulacion,
            cambiosContextoTotal: this.dispatcher.getTotalContextSwitches(),
            erroresTotal: this.erroresTotal,
            interrupcionesTotal: this.ioManager.getTotalInterrupts(),
            fragmentation: this.memoryManager.getFragmentation(this.processManager.getAll()),
            rngFormulas: this.rngFormulas,
            logs: [
                ...this.logs
            ].reverse()
        };
    }
    ejecutarTick() {
        this.tiempoSimulacion++;
        // 1. I/O
        const finishedIO = this.ioManager.verificarInterrupciones();
        finishedIO.forEach((p)=>{
            this.agregarLog("io", `I/O completado para PID ${p.pid}`, p.pid);
            this.agregarLog("process_state", `PID ${p.pid} desbloqueado, movido a Ready`, p.pid);
            this.scheduler.add(p);
        });
        // 2. Admit
        const procesosAdmitidos = this.processManager.getNew();
        this.processManager.admitirProcesos(this.memoryManager, this.scheduler);
        const nuevosAdmitidos = this.processManager.getNew();
        procesosAdmitidos.forEach((p)=>{
            if (!nuevosAdmitidos.find((np)=>np.pid === p.pid)) {
                this.agregarLog("memory", `PID ${p.pid} admitido a memoria (${(p.tamanio / 1024).toFixed(0)} KB)`, p.pid);
                this.agregarLog("process_state", `PID ${p.pid} cambió de New a Ready`, p.pid);
            }
        });
        // 3. Scheduler/Dispatcher
        if (!this.dispatcher.getRunning()) {
            let next = this.scheduler.getNext();
            // Idle Process Logic
            if (!next) {
                // Check if we are already running idle? No, dispatcher is empty.
                // Create a temporary idle process if none exists or reuse one?
                // Ideally, we just say "CPU Idle" in logs, but requirements say "Process Idle PID 0"
                // Let's create a transient one or just log it. 
                // Better: The scheduler should return an Idle process if queue is empty?
                // Or we handle it here.
                // Let's instantiate one if needed.
                const idle = this.processManager.createIdleProcess();
                this.dispatcher.dispatch(idle, this.tiempoSimulacion);
                this.agregarLog("cpu", "CPU Idle (PID 0)", 0);
            } else {
                this.dispatcher.dispatch(next, this.tiempoSimulacion);
                this.agregarLog("context_switch", `PID ${next.pid} despachado a CPU`, next.pid);
                this.agregarLog("scheduler", `Planificador seleccionó PID ${next.pid} (${this.scheduler.getAlgorithm()})`, next.pid);
            }
        } else {
            const running = this.dispatcher.getRunning();
            // Check for Timer Interrupt (Quantum)
            if (this.scheduler.isApropiativo() && this.scheduler.checkQuantum(running)) {
                this.agregarLog("interrupt", `Interrupción de Timer (Quantum expirado) para PID ${running.pid}`, running.pid);
                this.dispatcher.preempt();
                running.estado = "ready";
                this.scheduler.add(running);
                // Immediate switch if possible
                const next = this.scheduler.getNext();
                if (next) {
                    this.dispatcher.dispatch(next, this.tiempoSimulacion);
                    this.agregarLog("context_switch", `PID ${next.pid} despachado a CPU (Preemption)`, next.pid);
                }
            } else if (Math.random() < 0.005) {
                running.errores++;
                this.erroresTotal++;
                this.agregarLog("error", `Error detectado en PID ${running.pid}. Proceso terminado.`, running.pid);
                // Requirement: Cancel process on error
                const p = this.dispatcher.preempt();
                if (p) {
                    // Log error or mark as error state? Terminated is fine.
                    this.processManager.terminarProceso(p, this.tiempoSimulacion, this.memoryManager);
                    return; // End tick for this process
                }
            }
            // Tick
            running.programCounter++;
            running.tiempoRestante--;
            running.porcentajeProcesado = (running.burstTime - running.tiempoRestante) / running.burstTime * 100;
            // Terminate
            if (running.tiempoRestante <= 0) {
                const p = this.dispatcher.preempt(); // Remove from running
                if (p) {
                    this.agregarLog("process_state", `PID ${p.pid} terminado exitosamente`, p.pid);
                    this.processManager.terminarProceso(p, this.tiempoSimulacion, this.memoryManager);
                }
            } else if (this.scheduler.checkQuantum(running)) {
                const p = this.dispatcher.preempt();
                if (p) {
                    this.agregarLog("context_switch", `Quantum agotado para PID ${p.pid}. Movido a cola Ready`, p.pid);
                    this.scheduler.add(p);
                }
            } else if (this.scheduler.debeExpropiar(running)) {
                const p = this.dispatcher.preempt();
                if (p) {
                    this.agregarLog("context_switch", `PID ${p.pid} expropiado por planificador`, p.pid);
                    this.scheduler.add(p);
                }
            } else if (running.interrupciones < running.maxInterrupciones && Math.random() < 0.2) {
                const devices = [
                    "disk",
                    "printer",
                    "monitor",
                    "network"
                ];
                const device = devices[Math.floor(Math.random() * devices.length)];
                const p = this.dispatcher.preempt();
                if (p) {
                    p.estado = "blocked";
                    this.agregarLog("process_state", `PID ${p.pid} bloqueado por I/O (${device})`, p.pid);
                    this.agregarLog("io", `Solicitud de I/O: PID ${p.pid} → ${device}`, p.pid);
                    this.ioManager.solicitarIO(p, device);
                }
            }
        }
        // Update waiting time
        this.scheduler.getQueue().forEach((p)=>p.tiempoEspera++);
    }
    crearProceso(size, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable) {
        const proceso = this.processManager.crearProceso(this.tiempoSimulacion, size, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable);
        this.agregarLog("process_state", `Nuevo proceso creado: PID ${proceso.pid}`, proceso.pid);
        // Rigorous Requirement: Invoke scheduler/admission immediately
        this.processManager.admitirProcesos(this.memoryManager, this.scheduler);
        return proceso;
    }
    generarProcesosIniciales(n) {
        for(let i = 0; i < n; i++)this.crearProceso();
    }
    resolverInterrupcionManual(id, accion) {
        const p = this.ioManager.resolverInterrupcionManual(id, accion);
        if (p) {
            this.agregarLog("interrupt", `Interrupción de teclado resuelta: ${accion} para PID ${p.pid}`, p.pid);
            this.agregarLog("process_state", `PID ${p.pid} desbloqueado después de I/O manual`, p.pid);
            this.scheduler.add(p);
        }
    }
    setScheduler(s) {
        this.scheduler.setAlgorithm(s);
        this.agregarLog("scheduler", `Política de planificación cambiada a: ${s}`);
    }
    setApropiativo(b) {
        this.scheduler.setApropiativo(b);
        this.agregarLog("scheduler", `Modo apropiativo ${b ? "activado" : "desactivado"}`);
    }
    setQuantum(n) {
        this.scheduler.setQuantum(n);
        this.agregarLog("scheduler", `Quantum actualizado a: ${n}`);
    }
    setMemoryStrategy(s) {
        this.memoryManager.setStrategy(s);
        this.agregarLog("memory", `Estrategia de memoria cambiada a: ${s}`);
    }
    editarProceso(pid, updates) {
        const resultado = this.processManager.editarProceso(pid, updates, this.memoryManager);
        if (resultado) {
            this.agregarLog("process_state", `Proceso PID ${pid} editado`, pid);
        }
        return resultado;
    }
    eliminarProceso(pid) {
        const resultado = this.processManager.eliminarProceso(pid, this.memoryManager, this.scheduler, this.dispatcher, this.ioManager);
        if (resultado) {
            this.agregarLog("process_state", `Proceso PID ${pid} eliminado`, pid);
        }
        return resultado;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card,
    "CardAction",
    ()=>CardAction,
    "CardContent",
    ()=>CardContent,
    "CardDescription",
    ()=>CardDescription,
    "CardFooter",
    ()=>CardFooter,
    "CardHeader",
    ()=>CardHeader,
    "CardTitle",
    ()=>CardTitle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
;
;
function Card({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Card;
function CardHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_c1 = CardHeader;
function CardTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('leading-none font-semibold', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 33,
        columnNumber: 5
    }, this);
}
_c2 = CardTitle;
function CardDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground text-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_c3 = CardDescription;
function CardAction({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-action",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_c4 = CardAction;
function CardContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('px-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_c5 = CardContent;
function CardFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex items-center px-6 [.border-t]:pt-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_c6 = CardFooter;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "Card");
__turbopack_context__.k.register(_c1, "CardHeader");
__turbopack_context__.k.register(_c2, "CardTitle");
__turbopack_context__.k.register(_c3, "CardDescription");
__turbopack_context__.k.register(_c4, "CardAction");
__turbopack_context__.k.register(_c5, "CardContent");
__turbopack_context__.k.register(_c6, "CardFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScrollArea",
    ()=>ScrollArea,
    "ScrollBar",
    ()=>ScrollBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-scroll-area/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
function ScrollArea({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "scroll-area",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('relative', className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Viewport"], {
                "data-slot": "scroll-area-viewport",
                className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScrollBar, {}, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Corner"], {}, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_c = ScrollArea;
function ScrollBar({ className, orientation = 'vertical', ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaScrollbar"], {
        "data-slot": "scroll-area-scrollbar",
        orientation: orientation,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex touch-none p-px transition-colors select-none', orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent', orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaThumb"], {
            "data-slot": "scroll-area-thumb",
            className: "bg-border relative flex-1 rounded-full"
        }, void 0, false, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_c1 = ScrollBar;
;
var _c, _c1;
__turbopack_context__.k.register(_c, "ScrollArea");
__turbopack_context__.k.register(_c1, "ScrollBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge,
    "badgeVariants",
    ()=>badgeVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
const badgeVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])('inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden', {
    variants: {
        variant: {
            default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
            secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
            destructive: 'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
            outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground'
        }
    },
    defaultVariants: {
        variant: 'default'
    }
});
function Badge({ className, variant, asChild = false, ...props }) {
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : 'span';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "badge",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(badgeVariants({
            variant
        }), className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/badge.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c = Badge;
;
var _c;
__turbopack_context__.k.register(_c, "Badge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button,
    "buttonVariants",
    ()=>buttonVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", {
    variants: {
        variant: {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90',
            destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
            outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
            link: 'text-primary underline-offset-4 hover:underline'
        },
        size: {
            default: 'h-9 px-4 py-2 has-[>svg]:px-3',
            sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
            lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
            icon: 'size-9',
            'icon-sm': 'size-8',
            'icon-lg': 'size-10'
        }
    },
    defaultVariants: {
        variant: 'default',
        size: 'default'
    }
});
function Button({ className, variant, size, asChild = false, ...props }) {
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : 'button';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
_c = Button;
;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/progress.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Progress",
    ()=>Progress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-progress/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
function Progress({ className, value, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "progress",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Indicator"], {
            "data-slot": "progress-indicator",
            className: "bg-primary h-full w-full flex-1 transition-all",
            style: {
                transform: `translateX(-${100 - (value || 0)}%)`
            }
        }, void 0, false, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/progress.tsx",
            lineNumber: 22,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/progress.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_c = Progress;
;
var _c;
__turbopack_context__.k.register(_c, "Progress");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Dialog",
    ()=>Dialog,
    "DialogClose",
    ()=>DialogClose,
    "DialogContent",
    ()=>DialogContent,
    "DialogDescription",
    ()=>DialogDescription,
    "DialogFooter",
    ()=>DialogFooter,
    "DialogHeader",
    ()=>DialogHeader,
    "DialogOverlay",
    ()=>DialogOverlay,
    "DialogPortal",
    ()=>DialogPortal,
    "DialogTitle",
    ()=>DialogTitle,
    "DialogTrigger",
    ()=>DialogTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-dialog/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as XIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
;
function Dialog({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "dialog",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
_c = Dialog;
function DialogTrigger({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "dialog-trigger",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
_c1 = DialogTrigger;
function DialogPortal({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        "data-slot": "dialog-portal",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
_c2 = DialogPortal;
function DialogClose({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
        "data-slot": "dialog-close",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 30,
        columnNumber: 10
    }, this);
}
_c3 = DialogClose;
function DialogOverlay({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        "data-slot": "dialog-overlay",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c4 = DialogOverlay;
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        "data-slot": "dialog-portal",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
                "data-slot": "dialog-content",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg', className),
                ...props,
                children: [
                    children,
                    showCloseButton && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
                        "data-slot": "dialog-close",
                        className: "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__["XIcon"], {}, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                                lineNumber: 74,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                                lineNumber: 75,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                        lineNumber: 70,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c5 = DialogContent;
function DialogHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex flex-col gap-2 text-center sm:text-left', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
_c6 = DialogHeader;
function DialogFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 95,
        columnNumber: 5
    }, this);
}
_c7 = DialogFooter;
function DialogTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"], {
        "data-slot": "dialog-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('text-lg leading-none font-semibold', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
_c8 = DialogTitle;
function DialogDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"], {
        "data-slot": "dialog-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground text-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 124,
        columnNumber: 5
    }, this);
}
_c9 = DialogDescription;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "Dialog");
__turbopack_context__.k.register(_c1, "DialogTrigger");
__turbopack_context__.k.register(_c2, "DialogPortal");
__turbopack_context__.k.register(_c3, "DialogClose");
__turbopack_context__.k.register(_c4, "DialogOverlay");
__turbopack_context__.k.register(_c5, "DialogContent");
__turbopack_context__.k.register(_c6, "DialogHeader");
__turbopack_context__.k.register(_c7, "DialogFooter");
__turbopack_context__.k.register(_c8, "DialogTitle");
__turbopack_context__.k.register(_c9, "DialogDescription");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
;
;
function Input({ className, type, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        type: type,
        "data-slot": "input",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/input.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Input;
;
var _c;
__turbopack_context__.k.register(_c, "Input");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/label.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Label",
    ()=>Label
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$label$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-label/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
function Label({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$label$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/label.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = Label;
;
var _c;
__turbopack_context__.k.register(_c, "Label");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Select",
    ()=>Select,
    "SelectContent",
    ()=>SelectContent,
    "SelectGroup",
    ()=>SelectGroup,
    "SelectItem",
    ()=>SelectItem,
    "SelectLabel",
    ()=>SelectLabel,
    "SelectScrollDownButton",
    ()=>SelectScrollDownButton,
    "SelectScrollUpButton",
    ()=>SelectScrollUpButton,
    "SelectSeparator",
    ()=>SelectSeparator,
    "SelectTrigger",
    ()=>SelectTrigger,
    "SelectValue",
    ()=>SelectValue
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-select/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as CheckIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-client] (ecmascript) <export default as ChevronDownIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/chevron-up.js [app-client] (ecmascript) <export default as ChevronUpIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
;
function Select({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "select",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
_c = Select;
function SelectGroup({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"], {
        "data-slot": "select-group",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
_c1 = SelectGroup;
function SelectValue({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Value"], {
        "data-slot": "select-value",
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
_c2 = SelectValue;
function SelectTrigger({ className, size = 'default', children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "select-trigger",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className),
        ...props,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                asChild: true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {
                    className: "size-4 opacity-50"
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_c3 = SelectTrigger;
function SelectContent({ className, children, position = 'popper', ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
            "data-slot": "select-content",
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md', position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1', className),
            position: position,
            ...props,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollUpButton, {}, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 72,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Viewport"], {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'),
                    children: children
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 73,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollDownButton, {}, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 82,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 61,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, this);
}
_c4 = SelectContent;
function SelectLabel({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
        "data-slot": "select-label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground px-2 py-1.5 text-xs', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 93,
        columnNumber: 5
    }, this);
}
_c5 = SelectLabel;
function SelectItem({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Item"], {
        "data-slot": "select-item",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "absolute right-2 flex size-3.5 items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemIndicator"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__["CheckIcon"], {
                        className: "size-4"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                        lineNumber: 117,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 116,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 115,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemText"], {
                children: children
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 107,
        columnNumber: 5
    }, this);
}
_c6 = SelectItem;
function SelectSeparator({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Separator"], {
        "data-slot": "select-separator",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-border pointer-events-none -mx-1 my-1 h-px', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 130,
        columnNumber: 5
    }, this);
}
_c7 = SelectSeparator;
function SelectScrollUpButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollUpButton"], {
        "data-slot": "select-scroll-up-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex cursor-default items-center justify-center py-1', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__["ChevronUpIcon"], {
            className: "size-4"
        }, void 0, false, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 151,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
_c8 = SelectScrollUpButton;
function SelectScrollDownButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollDownButton"], {
        "data-slot": "select-scroll-down-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex cursor-default items-center justify-center py-1', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {
            className: "size-4"
        }, void 0, false, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 169,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
_c9 = SelectScrollDownButton;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "Select");
__turbopack_context__.k.register(_c1, "SelectGroup");
__turbopack_context__.k.register(_c2, "SelectValue");
__turbopack_context__.k.register(_c3, "SelectTrigger");
__turbopack_context__.k.register(_c4, "SelectContent");
__turbopack_context__.k.register(_c5, "SelectLabel");
__turbopack_context__.k.register(_c6, "SelectItem");
__turbopack_context__.k.register(_c7, "SelectSeparator");
__turbopack_context__.k.register(_c8, "SelectScrollUpButton");
__turbopack_context__.k.register(_c9, "SelectScrollDownButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tabs",
    ()=>Tabs,
    "TabsContent",
    ()=>TabsContent,
    "TabsList",
    ()=>TabsList,
    "TabsTrigger",
    ()=>TabsTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-tabs/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/utils.ts [app-client] (ecmascript)");
'use client';
;
;
;
function Tabs({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "tabs",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex flex-col gap-2', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = Tabs;
function TabsList({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["List"], {
        "data-slot": "tabs-list",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c1 = TabsList;
function TabsTrigger({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "tabs-trigger",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, this);
}
_c2 = TabsTrigger;
function TabsContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tabs$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
        "data-slot": "tabs-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex-1 outline-none', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c3 = TabsContent;
;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "Tabs");
__turbopack_context__.k.register(_c1, "TabsList");
__turbopack_context__.k.register(_c2, "TabsTrigger");
__turbopack_context__.k.register(_c3, "TabsContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ProcessPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$progress$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/progress.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/tabs.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$pen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/square-pen.js [app-client] (ecmascript) <export default as Edit>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
function ProcessPanel({ state, onCreate, onEdit, onDelete, simulator }) {
    _s();
    const [modalOpen, setModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [editModalOpen, setEditModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [editingPid, setEditingPid] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        nombre: "",
        tamanio: "",
        burst: "",
        prioridad: "",
        dispositivoIO: "",
        maxInterrupciones: "",
        porcentajeDatos: "",
        porcentajeVariable: ""
    });
    const [editFormData, setEditFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        tamanio: "",
        burst: "",
        prioridad: "",
        maxInterrupciones: "",
        porcentajeDatos: "",
        porcentajeVariable: ""
    });
    if (!state) return null;
    const handleCreateProcess = ()=>{
        const tamanio = formData.tamanio ? parseInt(formData.tamanio) * 1024 : undefined // Convert KB to bytes
        ;
        const burst = formData.burst ? parseInt(formData.burst) : undefined;
        const prioridad = formData.prioridad ? parseInt(formData.prioridad) : undefined;
        const maxInterrupciones = formData.maxInterrupciones ? parseInt(formData.maxInterrupciones) : undefined;
        const porcentajeDatos = formData.porcentajeDatos ? parseInt(formData.porcentajeDatos) : undefined;
        const porcentajeVariable = formData.porcentajeVariable ? parseInt(formData.porcentajeVariable) : undefined;
        onCreate(tamanio, burst, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable);
        setModalOpen(false);
        setFormData({
            nombre: "",
            tamanio: "",
            burst: "",
            prioridad: "",
            dispositivoIO: "",
            maxInterrupciones: "",
            porcentajeDatos: "",
            porcentajeVariable: ""
        });
    };
    const handleEditClick = (pid)=>{
        const proceso = state.procesos.find((p)=>p.pid === pid);
        if (proceso) {
            setEditingPid(pid);
            setEditFormData({
                tamanio: (proceso.tamanio / 1024).toString(),
                burst: proceso.burstTime.toString(),
                prioridad: proceso.prioridad.toString(),
                maxInterrupciones: proceso.maxInterrupciones.toString(),
                porcentajeDatos: proceso.porcentajeDatos.toString(),
                porcentajeVariable: proceso.porcentajeVariable.toString()
            });
            setEditModalOpen(true);
        }
    };
    const handleEditProcess = ()=>{
        if (editingPid === null) return;
        const tamanio = editFormData.tamanio ? parseInt(editFormData.tamanio) * 1024 : undefined;
        const burst = editFormData.burst ? parseInt(editFormData.burst) : undefined;
        const prioridad = editFormData.prioridad ? parseInt(editFormData.prioridad) : undefined;
        const maxInterrupciones = editFormData.maxInterrupciones ? parseInt(editFormData.maxInterrupciones) : undefined;
        const porcentajeDatos = editFormData.porcentajeDatos ? parseInt(editFormData.porcentajeDatos) : undefined;
        const porcentajeVariable = editFormData.porcentajeVariable ? parseInt(editFormData.porcentajeVariable) : undefined;
        onEdit(editingPid, {
            tamanio,
            burstTime: burst,
            prioridad,
            maxInterrupciones,
            porcentajeDatos,
            porcentajeVariable
        });
        setEditModalOpen(false);
        setEditingPid(null);
    };
    const handleDeleteClick = (pid)=>{
        if (confirm(`¿Está seguro de eliminar el proceso PID ${pid}?`)) {
            onDelete(pid);
        }
    };
    const getStatusColor = (status)=>{
        switch(status){
            case "running":
                return "bg-green-500";
            case "ready":
                return "bg-blue-500";
            case "blocked":
                return "bg-red-500";
            case "new":
                return "bg-yellow-500";
            case "terminated":
                return "bg-gray-500";
            default:
                return "bg-gray-500";
        }
    };
    const ProcessList = ({ processes, showOrder = false })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2 pr-4",
            children: [
                processes.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-center text-muted-foreground py-8 text-sm",
                    children: "No hay procesos en esta cola."
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 121,
                    columnNumber: 9
                }, this),
                processes.map((proc, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `p-3 rounded-lg border ${proc.estado === "running" ? "border-green-500 bg-green-500/10" : "border-border bg-card"}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-5 gap-2 text-xs items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                                showOrder && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-muted-foreground font-mono mr-1",
                                                    children: [
                                                        index + 1,
                                                        "."
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 135,
                                                    columnNumber: 31
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-lg",
                                                    children: [
                                                        "#",
                                                        proc.pid
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 136,
                                                    columnNumber: 17
                                                }, this),
                                                proc.esProceSO && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    variant: "secondary",
                                                    className: "text-[10px] h-5 bg-purple-100 text-purple-800 hover:bg-purple-100",
                                                    children: "SYSTEM"
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 138,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    variant: "outline",
                                                    className: `${getStatusColor(proc.estado)} text-white border-none`,
                                                    children: proc.estado.toUpperCase()
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 142,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 134,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-1 mt-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    size: "sm",
                                                    variant: "ghost",
                                                    className: "h-6 w-6 p-0",
                                                    onClick: ()=>handleEditClick(proc.pid),
                                                    title: "Editar proceso",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$pen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit$3e$__["Edit"], {
                                                        className: "w-3 h-3"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 154,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 147,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    size: "sm",
                                                    variant: "ghost",
                                                    className: "h-6 w-6 p-0 text-red-500 hover:text-red-700",
                                                    onClick: ()=>handleDeleteClick(proc.pid),
                                                    title: "Eliminar proceso",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                        className: "w-3 h-3"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 163,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 156,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 146,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                "Prioridad: ",
                                                proc.prioridad
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 166,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 133,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                "Size: ",
                                                (proc.tamanio / 1024).toFixed(0),
                                                " KB"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 173,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                "Base: ",
                                                proc.dirBase === -1 ? "Pend." : `0x${proc.dirBase.toString(16).toUpperCase()}`
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 174,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 172,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1 w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex justify-between text-[10px]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        "PC: ",
                                                        proc.programCounter
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 182,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        proc.porcentajeProcesado.toFixed(0),
                                                        "%"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 183,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 181,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$progress$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Progress"], {
                                            value: proc.porcentajeProcesado,
                                            className: "h-1.5"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 185,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-muted-foreground mt-1",
                                            children: [
                                                "Burst: ",
                                                proc.burstTime,
                                                " | Rest: ",
                                                proc.tiempoRestante
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 186,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 180,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                "Wait: ",
                                                proc.tiempoEspera
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 193,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                "Turn: ",
                                                proc.tiempoTurnaround
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 194,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                "Ctx: ",
                                                proc.cambiosContexto
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 195,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                "I/O: ",
                                                proc.interrupciones
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 196,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-red-500",
                                            children: [
                                                "Err: ",
                                                proc.errores
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 197,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 192,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1 text-[10px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        "Data: ",
                                                        proc.porcentajeDatos,
                                                        "%"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 203,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        "Var: ",
                                                        proc.porcentajeVariable,
                                                        "%"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 204,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 202,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-full bg-muted h-1.5 rounded-full overflow-hidden flex",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-blue-400 h-full",
                                                    style: {
                                                        width: `${proc.porcentajeDatos}%`
                                                    },
                                                    title: "Data"
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 207,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-yellow-400 h-full",
                                                    style: {
                                                        width: `${proc.porcentajeVariable}%`
                                                    },
                                                    title: "Variable"
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 208,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-300 h-full flex-1",
                                                    title: "Code/Stack"
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 209,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 206,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex justify-between text-[9px] text-muted-foreground mt-0.5",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        "SP: ",
                                                        proc.stackPointer
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 212,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        "HP: ",
                                                        proc.heapPointer
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 213,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 211,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 201,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 131,
                            columnNumber: 11
                        }, this)
                    }, proc.pid, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 126,
                        columnNumber: 9
                    }, this))
            ]
        }, void 0, true, {
            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
            lineNumber: 119,
            columnNumber: 5
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 h-[600px] flex flex-col border-border overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4 flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Gestión de Procesos"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 225,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            size: "sm",
                            onClick: ()=>setModalOpen(true),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                    className: "w-4 h-4 mr-1"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 228,
                                    columnNumber: 13
                                }, this),
                                " Nuevo Proceso"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 227,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 226,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 224,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-5 gap-2 mb-2 text-xs font-semibold text-muted-foreground text-center flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "PID / Estado"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 234,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Memoria"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 235,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "CPU / Tiempos"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 236,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Contadores"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 237,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Segmentos"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 238,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 233,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                defaultValue: "all",
                className: "flex-1 flex flex-col min-h-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsList"], {
                        className: "grid w-full grid-cols-5 mb-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "all",
                                children: [
                                    "Todos (",
                                    state.procesos.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 243,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "new",
                                children: [
                                    "New (",
                                    state.colaNew.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 244,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "ready",
                                children: [
                                    "Ready (",
                                    state.colaReady.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 245,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "blocked",
                                children: [
                                    "Blocked (",
                                    state.colaBlocked.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 246,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "terminated",
                                children: [
                                    "Term (",
                                    state.colaTerminated.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 247,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 242,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                        className: "flex-1 min-h-0 overflow-y-auto",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                value: "all",
                                className: "mt-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProcessList, {
                                    processes: state.procesos
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 252,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 251,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                value: "new",
                                className: "mt-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProcessList, {
                                    processes: state.colaNew
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 255,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                value: "ready",
                                className: "mt-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProcessList, {
                                    processes: state.colaReady,
                                    showOrder: true
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 259,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 257,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                value: "blocked",
                                className: "mt-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProcessList, {
                                    processes: state.colaBlocked
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 262,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 261,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                                value: "terminated",
                                className: "mt-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProcessList, {
                                    processes: state.colaTerminated
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 265,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 264,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 250,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 241,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: modalOpen,
                onOpenChange: setModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md max-h-[90vh] overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: "Crear Nuevo Proceso"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 274,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 273,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4 py-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "nombre",
                                            children: "Nombre del Proceso"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 278,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "nombre",
                                            value: formData.nombre,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    nombre: e.target.value
                                                }),
                                            placeholder: "Nombre (opcional)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 279,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 277,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "tamanio",
                                            children: "Tamaño (KB)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 287,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "tamanio",
                                            type: "number",
                                            min: "32",
                                            max: "512",
                                            value: formData.tamanio,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    tamanio: e.target.value
                                                }),
                                            placeholder: "32-512 KB"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 288,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "Se ajustará a la potencia de 2 más cercana"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 297,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 286,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "burst",
                                            children: "Burst Time"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 302,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "burst",
                                            type: "number",
                                            min: "5",
                                            max: "20",
                                            value: formData.burst,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    burst: e.target.value
                                                }),
                                            placeholder: "5-20"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 303,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 301,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "prioridad",
                                            children: "Prioridad"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 314,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "prioridad",
                                            type: "number",
                                            min: "0",
                                            max: "3",
                                            value: formData.prioridad,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    prioridad: e.target.value
                                                }),
                                            placeholder: "0-3 (menor = mayor prioridad)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 315,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 313,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "dispositivoIO",
                                            children: "Tipo de Dispositivo I/O"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 326,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                            value: formData.dispositivoIO,
                                            onValueChange: (value)=>setFormData({
                                                    ...formData,
                                                    dispositivoIO: value
                                                }),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                                                        placeholder: "Seleccionar dispositivo"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 332,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 331,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "disk",
                                                            children: "Disk"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 335,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "printer",
                                                            children: "Printer"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 336,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "monitor",
                                                            children: "Monitor"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 337,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "network",
                                                            children: "Network"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 338,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "keyboard",
                                                            children: "Keyboard"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 339,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 334,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 327,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "El dispositivo se asignará aleatoriamente si no se especifica"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 342,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 325,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "maxInterrupciones",
                                            children: "Máximo de Interrupciones"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 347,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "maxInterrupciones",
                                            type: "number",
                                            min: "5",
                                            max: "20",
                                            value: formData.maxInterrupciones,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    maxInterrupciones: e.target.value
                                                }),
                                            placeholder: "5-20"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 348,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 346,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "porcentajeDatos",
                                            children: "Porcentaje de Datos (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 359,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "porcentajeDatos",
                                            type: "number",
                                            min: "10",
                                            max: "40",
                                            value: formData.porcentajeDatos,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    porcentajeDatos: e.target.value
                                                }),
                                            placeholder: "10-40%"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 360,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 358,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "porcentajeVariable",
                                            children: "Porcentaje Variable (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 371,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "porcentajeVariable",
                                            type: "number",
                                            min: "5",
                                            max: "25",
                                            value: formData.porcentajeVariable,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    porcentajeVariable: e.target.value
                                                }),
                                            placeholder: "5-25%"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 372,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 370,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 276,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    onClick: ()=>setModalOpen(false),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 384,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: handleCreateProcess,
                                    children: "Crear Proceso"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 387,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 383,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 272,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 271,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: editModalOpen,
                onOpenChange: setEditModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md max-h-[90vh] overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: [
                                    "Editar Proceso PID ",
                                    editingPid
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 398,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 397,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4 py-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-tamanio",
                                            children: "Tamaño (KB)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 402,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-tamanio",
                                            type: "number",
                                            min: "32",
                                            max: "512",
                                            value: editFormData.tamanio,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    tamanio: e.target.value
                                                }),
                                            placeholder: "32-512 KB"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 403,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "Se ajustará a la potencia de 2 más cercana"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 412,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 401,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-burst",
                                            children: "Burst Time"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 417,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-burst",
                                            type: "number",
                                            min: "5",
                                            max: "20",
                                            value: editFormData.burst,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    burst: e.target.value
                                                }),
                                            placeholder: "5-20"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 418,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 416,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-prioridad",
                                            children: "Prioridad"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 429,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-prioridad",
                                            type: "number",
                                            min: "0",
                                            max: "3",
                                            value: editFormData.prioridad,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    prioridad: e.target.value
                                                }),
                                            placeholder: "0-3 (menor = mayor prioridad)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 430,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 428,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-maxInterrupciones",
                                            children: "Máximo de Interrupciones"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 441,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-maxInterrupciones",
                                            type: "number",
                                            min: "5",
                                            max: "20",
                                            value: editFormData.maxInterrupciones,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    maxInterrupciones: e.target.value
                                                }),
                                            placeholder: "5-20"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 442,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 440,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-porcentajeDatos",
                                            children: "Porcentaje de Datos (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 453,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-porcentajeDatos",
                                            type: "number",
                                            min: "10",
                                            max: "40",
                                            value: editFormData.porcentajeDatos,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    porcentajeDatos: e.target.value
                                                }),
                                            placeholder: "10-40%"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 454,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 452,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-porcentajeVariable",
                                            children: "Porcentaje Variable (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 465,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "edit-porcentajeVariable",
                                            type: "number",
                                            min: "5",
                                            max: "25",
                                            value: editFormData.porcentajeVariable,
                                            onChange: (e)=>setEditFormData({
                                                    ...editFormData,
                                                    porcentajeVariable: e.target.value
                                                }),
                                            placeholder: "5-25%"
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 466,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 464,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 400,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    onClick: ()=>setEditModalOpen(false),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 478,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: handleEditProcess,
                                    children: "Guardar Cambios"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 481,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 477,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 396,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 395,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
        lineNumber: 223,
        columnNumber: 5
    }, this);
}
_s(ProcessPanel, "+zNwdMIlHbyyuE2DDpv2jHhvjow=");
_c = ProcessPanel;
var _c;
__turbopack_context__.k.register(_c, "ProcessPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MemoryPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-client] (ecmascript)");
"use client";
;
;
;
function MemoryPanel({ state }) {
    if (!state) return null;
    // El tamaño total de memoria es fijo: 2MB
    const MEMORY_SIZE = 2 * 1024 * 1024; // 2MB
    const totalMem = MEMORY_SIZE;
    // Calcular memoria usada: suma de bloques ocupados
    const usedMem = state.memoria.reduce((acc, b)=>acc + (b.ocupado ? b.tamanio : 0), 0);
    // Calcular porcentaje de uso (asegurarse de que no exceda 100%)
    const usagePct = totalMem > 0 ? Math.min(usedMem / totalMem * 100, 100) : 0;
    // Calcular fragmentación usando los valores del estado
    const fragmentation = state.fragmentation || {
        internal: 0,
        external: 0
    };
    const internalFragKB = fragmentation.internal / 1024;
    const externalFragKB = fragmentation.external / 1024;
    const freeBlocks = state.memoria.filter((b)=>!b.ocupado).length;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border h-[400px] flex flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Gestión de Memoria"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 29,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground text-right",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Total: ",
                                    (totalMem / 1024).toFixed(0),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 31,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Uso: ",
                                    usagePct.toFixed(1),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 32,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Bloques Libres: ",
                                    freeBlocks
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 33,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 relative bg-muted rounded-lg overflow-hidden border border-border",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                    className: "h-full w-full",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap content-start p-1 gap-0.5",
                        children: state.memoria.map((bloque, idx)=>{
                            // Visual scaling: 2MB total. 
                            // Let's make width proportional to size relative to 32KB chunks?
                            // Or just a list of blocks? 
                            // A visual map is better.
                            // Let's use flex-grow based on size.
                            const sizeKB = bloque.tamanio / 1024;
                            // Min width for visibility
                            const flexGrow = sizeKB;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `
                    h-16 border rounded flex flex-col items-center justify-center text-[10px] relative overflow-hidden transition-all
                    ${bloque.ocupado ? "bg-blue-500/20 border-blue-500 text-blue-700" : "bg-green-500/10 border-green-500 text-green-700"}
                  `,
                                style: {
                                    width: `calc(${bloque.tamanio / totalMem * 100}% - 2px)`,
                                    minWidth: "40px"
                                },
                                title: `Addr: ${bloque.direccionInicio} - ${bloque.direccionFin} | Size: ${sizeKB}KB`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: [
                                            sizeKB,
                                            " KB"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 63,
                                        columnNumber: 19
                                    }, this),
                                    bloque.ocupado ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold",
                                        children: [
                                            "PID ",
                                            bloque.pid
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 65,
                                        columnNumber: 21
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "opacity-50",
                                        children: "Free"
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 67,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute bottom-0 right-1 text-[8px] opacity-50",
                                        children: [
                                            "0x",
                                            bloque.direccionInicio.toString(16).toUpperCase()
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 69,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, idx, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 51,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 39,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-3 gap-4 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Fragmentación Externa"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 81,
                                columnNumber: 11
                            }, this),
                            freeBlocks,
                            " bloques dispersos"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Estrategia"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 85,
                                columnNumber: 11
                            }, this),
                            "Buddy System / ",
                            state.memoryStrategy || "FirstFit"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 84,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Desperdicio (Interno)"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 89,
                                columnNumber: 12
                            }, this),
                            internalFragKB.toFixed(1),
                            " KB"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 88,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
_c = MemoryPanel;
var _c;
__turbopack_context__.k.register(_c, "MemoryPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SchedulerPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function SchedulerPanel({ state, simulator, onStateChange }) {
    _s();
    const [quantum, setQuantum] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(state.quantum);
    const changeScheduler = (scheduler)=>{
        simulator?.setScheduler(scheduler);
        onStateChange();
    };
    const toggleApropiativo = ()=>{
        simulator?.setApropiativo(!state.apropiativo);
        onStateChange();
    };
    const updateQuantum = (value)=>{
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue > 0) {
            setQuantum(numValue);
            simulator?.setQuantum(numValue);
            onStateChange();
        }
    };
    const changeMemoryStrategy = (strategy)=>{
        simulator?.setMemoryStrategy(strategy);
        onStateChange();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Scheduler"
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-semibold mb-2",
                                children: "Política Actual:"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-2 gap-2",
                                children: [
                                    "FCFS",
                                    "SJF",
                                    "RoundRobin",
                                    "Prioridades"
                                ].map((sched)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>changeScheduler(sched),
                                        variant: state.scheduler === sched ? "default" : "outline",
                                        size: "sm",
                                        className: "text-xs",
                                        children: sched
                                    }, sched, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 44,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    state.scheduler === "RoundRobin" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-semibold mb-2 block",
                                children: "Quantum:"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 59,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                type: "number",
                                min: "1",
                                max: "100",
                                value: quantum,
                                onChange: (e)=>updateQuantum(e.target.value),
                                className: "w-full",
                                placeholder: "Ingrese el quantum"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 60,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-semibold mb-2",
                                children: "Estrategia de Memoria:"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 73,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-3 gap-2",
                                children: [
                                    "FirstFit",
                                    "BestFit",
                                    "WorstFit"
                                ].map((strategy)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>changeMemoryStrategy(strategy),
                                        variant: state.memoryStrategy === strategy ? "default" : "outline",
                                        size: "sm",
                                        className: "text-xs",
                                        children: strategy
                                    }, strategy, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 76,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 74,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm",
                                children: "Modo Apropiativo"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: toggleApropiativo,
                                className: `w-12 h-6 rounded-full transition ${state.apropiativo ? "bg-green-600" : "bg-gray-400"}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `w-5 h-5 bg-white rounded-full transition transform ${state.apropiativo ? "translate-x-6" : "translate-x-1"}`
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                    lineNumber: 95,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 91,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 p-3 bg-muted rounded text-xs space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Procesos Total: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: state.procesos.length
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 105,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 104,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Cambios Contexto: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: state.cambiosContextoTotal
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 108,
                                        columnNumber: 31
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 107,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 103,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_s(SchedulerPanel, "UxRxDbifJ4xeBbha2E5IK06p+UQ=");
_c = SchedulerPanel;
var _c;
__turbopack_context__.k.register(_c, "SchedulerPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InterruptsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
"use client";
;
;
;
;
function InterruptsPanel({ state, simulator }) {
    if (!state) return null;
    // Find manual interrupts (Keyboard) that are waiting
    const manualInterrupt = state.interrupcionesActivas.find((i)=>i.esManual && i.estado === "active");
    const handleManualAction = (id, action)=>{
        simulator?.resolverInterrupcionManual(id, action);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border flex flex-col gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-start",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "text-lg font-bold",
                    children: "Interrupciones"
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            manualInterrupt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-yellow-500/20 border border-yellow-500 p-3 rounded-lg animate-pulse",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 mb-2 text-yellow-700 font-bold text-sm",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                className: "w-4 h-4"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 27,
                                columnNumber: 13
                            }, this),
                            "Interrupción de Teclado (PID ",
                            manualInterrupt.pidAsociado,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 26,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "default",
                                className: "w-full bg-green-600 hover:bg-green-700",
                                onClick: ()=>handleManualAction(manualInterrupt.id, "continuar"),
                                children: "Continuar"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 31,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "destructive",
                                className: "w-full",
                                onClick: ()=>handleManualAction(manualInterrupt.id, "cancelar"),
                                children: "Cancelar"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 39,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 30,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 25,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-semibold",
                        children: "Interrupciones Activas"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this),
                    state.interrupcionesActivas.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground italic",
                        children: "Ninguna interrupción activa"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 55,
                        columnNumber: 11
                    }, this) : state.interrupcionesActivas.map((irq)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs p-2 bg-background border border-border rounded flex justify-between items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-bold uppercase mr-2",
                                            children: irq.dispositivo
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 60,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-muted-foreground",
                                            children: [
                                                "PID ",
                                                irq.pidAsociado
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 61,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                    lineNumber: 59,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-16 h-1.5 bg-muted rounded-full overflow-hidden",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-full bg-blue-500",
                                                style: {
                                                    width: `${irq.tiempoRestante / irq.duracion * 100}%`
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                                lineNumber: 65,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 64,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "w-8 text-right",
                                            children: [
                                                irq.tiempoRestante,
                                                "ms"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 70,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                    lineNumber: 63,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, irq.id, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                            lineNumber: 58,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
_c = InterruptsPanel;
var _c;
__turbopack_context__.k.register(_c, "InterruptsPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DevicesPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
function DevicesPanel({ state }) {
    if (!state) return null;
    const devices = [
        "keyboard",
        "disk",
        "printer",
        "monitor",
        "network"
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Colas de Dispositivos (E/S)"
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 md:grid-cols-5 gap-3",
                children: devices.map((device)=>{
                    const queue = state.colasDispositivos[device] || [];
                    const active = state.interrupcionesActivas.find((i)=>i.dispositivo === device);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col h-48 bg-muted rounded border border-border overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-2 bg-card border-b border-border flex justify-between items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold capitalize text-sm",
                                        children: device
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 24,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        variant: active ? "default" : "secondary",
                                        className: "text-[10px]",
                                        children: active ? "BUSY" : "IDLE"
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 25,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 23,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-2 bg-blue-500/10 border-b border-border min-h-[50px] flex items-center justify-center",
                                children: active ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-bold text-blue-600",
                                            children: [
                                                "Procesando PID ",
                                                active.pidAsociado
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 34,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                "Restante: ",
                                                active.tiempoRestante,
                                                "ms"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 35,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 33,
                                    columnNumber: 19
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[10px] text-muted-foreground",
                                    children: "Esperando solicitud..."
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 38,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 31,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                                className: "flex-1 p-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: queue.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[10px] text-center text-muted-foreground py-2",
                                        children: "Cola vacía"
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 46,
                                        columnNumber: 21
                                    }, this) : queue.map((proc, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] p-1.5 bg-background rounded border border-border flex justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-mono",
                                                    children: [
                                                        "#",
                                                        idx + 1
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                                    lineNumber: 50,
                                                    columnNumber: 25
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold",
                                                    children: [
                                                        "PID ",
                                                        proc.pid
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                                    lineNumber: 51,
                                                    columnNumber: 25
                                                }, this)
                                            ]
                                        }, proc.pid, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 49,
                                            columnNumber: 23
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 44,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 43,
                                columnNumber: 15
                            }, this)
                        ]
                    }, device, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                        lineNumber: 22,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = DevicesPanel;
var _c;
__turbopack_context__.k.register(_c, "DevicesPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>StatsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
"use client";
;
;
function StatsPanel({ state }) {
    if (!state) return null;
    // El tamaño total de memoria es fijo: 2MB (2097152 bytes)
    const MEMORY_SIZE = 2 * 1024 * 1024; // 2MB = 2097152 bytes
    const totalMemory = MEMORY_SIZE;
    // Calcular memoria usada: suma de bloques ocupados usando el tamaño del bloque
    const usedMemory = state.memoria.reduce((sum, block)=>sum + (block.ocupado && block.tamanio ? block.tamanio : 0), 0);
    // Asegurar que usedMemory no exceda totalMemory
    const validUsedMemory = Math.min(usedMemory, totalMemory);
    // Calcular porcentaje de uso (asegurarse de que no exceda 100%)
    const memoryUsagePercent = totalMemory > 0 ? Math.min(Math.max(0, validUsedMemory / totalMemory * 100), 100) : 0;
    const freeBlocks = state.memoria.filter((b)=>!b.ocupado).length;
    const occupiedBlocks = state.memoria.filter((b)=>b.ocupado).length;
    // Calcular uso de CPU basado en procesos corriendo vs totales
    const totalProcesos = state.procesos.length;
    const procesosRunning = state.colaRunning ? 1 : 0;
    const cpuUsage = totalProcesos > 0 ? Math.min(procesosRunning / totalProcesos * 100, 100) : 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Estadísticas en Tiempo Real"
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-blue-400",
                                children: state.procesos.length
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Procesos Totales"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-green-400",
                                children: state.colaReady.length
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "En Ready"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 47,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-yellow-400",
                                children: state.colaTerminated.length
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 51,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Terminados"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 52,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 50,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-red-400",
                                children: state.cambiosContextoTotal
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 56,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Cambios Contexto"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 57,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-purple-400",
                                children: state.erroresTotal
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 61,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Errores"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 62,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 60,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-cyan-400",
                                children: state.interrupcionesTotal
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 66,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Interrupciones"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 67,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 65,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-2 gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-semibold mb-2",
                                children: "Uso de Memoria"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 74,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs mb-2",
                                children: [
                                    memoryUsagePercent.toFixed(1),
                                    "% (",
                                    (validUsedMemory / 1024).toFixed(1),
                                    "/",
                                    (totalMemory / 1024).toFixed(0),
                                    " KB)"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full bg-background rounded h-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-blue-500 h-full rounded transition-all",
                                    style: {
                                        width: `${Math.min(memoryUsagePercent, 100)}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                    lineNumber: 79,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 78,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-2",
                                children: [
                                    "Bloques: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-blue-600",
                                        children: [
                                            occupiedBlocks,
                                            " ocupados"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                        lineNumber: 85,
                                        columnNumber: 22
                                    }, this),
                                    " / ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-green-600",
                                        children: [
                                            freeBlocks,
                                            " libres"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                        lineNumber: 85,
                                        columnNumber: 89
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 84,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-semibold mb-2",
                                children: "Uso de CPU"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs mb-2",
                                children: [
                                    cpuUsage.toFixed(1),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 91,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full bg-background rounded h-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-green-500 h-full rounded transition-all",
                                    style: {
                                        width: `${Math.min(cpuUsage, 100)}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                    lineNumber: 93,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-2",
                                children: state.colaRunning ? `Ejecutando: PID ${state.colaRunning.pid}` : "CPU Ociosa"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 98,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-1",
                                children: [
                                    procesosRunning,
                                    " de ",
                                    totalProcesos,
                                    " procesos activos"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 101,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_c = StatsPanel;
var _c;
__turbopack_context__.k.register(_c, "StatsPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LogsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
function LogsPanel({ state }) {
    if (!state || !state.logs) return null;
    const getLogTypeColor = (tipo)=>{
        switch(tipo){
            case "context_switch":
                return "bg-blue-500/20 text-blue-700 border-blue-500";
            case "scheduler":
                return "bg-purple-500/20 text-purple-700 border-purple-500";
            case "interrupt":
                return "bg-yellow-500/20 text-yellow-700 border-yellow-500";
            case "process_state":
                return "bg-green-500/20 text-green-700 border-green-500";
            case "error":
                return "bg-red-500/20 text-red-700 border-red-500";
            case "memory":
                return "bg-cyan-500/20 text-cyan-700 border-cyan-500";
            case "io":
                return "bg-orange-500/20 text-orange-700 border-orange-500";
            default:
                return "bg-gray-500/20 text-gray-700 border-gray-500";
        }
    };
    const getLogTypeLabel = (tipo)=>{
        switch(tipo){
            case "context_switch":
                return "Cambio Contexto";
            case "scheduler":
                return "Planificador";
            case "interrupt":
                return "Interrupción";
            case "process_state":
                return "Estado Proceso";
            case "error":
                return "Error";
            case "memory":
                return "Memoria";
            case "io":
                return "I/O";
            default:
                return tipo;
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border h-[400px] flex flex-col overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4 flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Logs del Simulador"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground",
                        children: [
                            "Total: ",
                            state.logs.length,
                            " eventos"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 41,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                className: "flex-1 min-h-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2 pr-4",
                    children: state.logs.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-muted-foreground italic text-center py-8",
                        children: "No hay eventos registrados aún"
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 49,
                        columnNumber: 13
                    }, this) : state.logs.map((log)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `p-2 rounded border text-xs ${getLogTypeColor(log.tipo)}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between gap-2 mb-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    variant: "outline",
                                                    className: `text-[10px] ${getLogTypeColor(log.tipo)}`,
                                                    children: getLogTypeLabel(log.tipo)
                                                }, void 0, false, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                                    lineNumber: 60,
                                                    columnNumber: 21
                                                }, this),
                                                log.pid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-[10px]",
                                                    children: [
                                                        "PID ",
                                                        log.pid
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                                    lineNumber: 64,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                            lineNumber: 59,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] opacity-70",
                                            children: [
                                                "t=",
                                                log.tiempo
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                            lineNumber: 67,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                    lineNumber: 58,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-[11px] font-medium",
                                    children: log.mensaje
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                    lineNumber: 69,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, log.id, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                            lineNumber: 54,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c = LogsPanel;
var _c;
__turbopack_context__.k.register(_c, "LogsPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OSSimulatorComponent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/lib/os-simulator.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$process$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$memory$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$scheduler$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$interrupts$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$devices$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$stats$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$logs$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
function OSSimulatorComponent() {
    _s();
    const simulatorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [running, setRunning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [speed, setSpeed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(100);
    const [keyboardModalOpen, setKeyboardModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pendingKeyboardIrq, setPendingKeyboardIrq] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const intervalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OSSimulatorComponent.useEffect": ()=>{
            simulatorRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OSSimulator"]();
            simulatorRef.current.generarProcesosIniciales(5);
            setState(simulatorRef.current.getState());
        }
    }["OSSimulatorComponent.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OSSimulatorComponent.useEffect": ()=>{
            if (running && simulatorRef.current) {
                intervalRef.current = setInterval({
                    "OSSimulatorComponent.useEffect": ()=>{
                        if (!simulatorRef.current) return;
                        simulatorRef.current.ejecutarTick();
                        const newState = {
                            ...simulatorRef.current.getState()
                        };
                        setState(newState);
                        // Check for manual keyboard interrupts
                        const manualIrq = newState.interrupcionesActivas.find({
                            "OSSimulatorComponent.useEffect.manualIrq": (i)=>i.esManual && i.estado === "active"
                        }["OSSimulatorComponent.useEffect.manualIrq"]);
                        if (manualIrq && !keyboardModalOpen) {
                            setPendingKeyboardIrq(manualIrq.id);
                            setKeyboardModalOpen(true);
                            setRunning(false); // Pause for user input
                        }
                    }
                }["OSSimulatorComponent.useEffect"], Math.max(10, 200 - speed));
            } else if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            return ({
                "OSSimulatorComponent.useEffect": ()=>{
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            })["OSSimulatorComponent.useEffect"];
        }
    }["OSSimulatorComponent.useEffect"], [
        running,
        speed,
        keyboardModalOpen
    ]);
    const handleKeyboardAction = (action)=>{
        if (simulatorRef.current && pendingKeyboardIrq) {
            simulatorRef.current.resolverInterrupcionManual(pendingKeyboardIrq, action);
            setState({
                ...simulatorRef.current.getState()
            });
            setKeyboardModalOpen(false);
            setPendingKeyboardIrq(null);
            setRunning(true); // Resume
        }
    };
    const crearProceso = (tamanio, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable)=>{
        if (simulatorRef.current) {
            simulatorRef.current.crearProceso(tamanio, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable);
            setState({
                ...simulatorRef.current.getState()
            });
        }
    };
    const editarProceso = (pid, updates)=>{
        if (simulatorRef.current) {
            simulatorRef.current.editarProceso(pid, updates);
            setState({
                ...simulatorRef.current.getState()
            });
        }
    };
    const eliminarProceso = (pid)=>{
        if (simulatorRef.current) {
            simulatorRef.current.eliminarProceso(pid);
            setState({
                ...simulatorRef.current.getState()
            });
        }
    };
    if (!state) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4",
        children: "Inicializando..."
    }, void 0, false, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
        lineNumber: 108,
        columnNumber: 22
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full h-full bg-background text-foreground overflow-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sticky top-0 z-50 bg-card border-b border-border p-4 space-y-3 shadow-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-bold",
                                children: "Simulador de Procesos"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 115,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>setRunning(!running),
                                        variant: running ? "destructive" : "default",
                                        children: running ? "Pausar" : "Ejecutar"
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 117,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>{
                                            simulatorRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OSSimulator"]();
                                            simulatorRef.current.generarProcesosIniciales(5);
                                            setState(simulatorRef.current.getState());
                                            setRunning(false);
                                        },
                                        variant: "outline",
                                        children: "Reiniciar"
                                    }, void 0, false, {
                                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 120,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 116,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-medium",
                                children: "Velocidad:"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 135,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "range",
                                min: "0",
                                max: "190",
                                step: "5",
                                value: speed,
                                onChange: (e)=>setSpeed(Number(e.target.value)),
                                className: "w-48"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 136,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-muted-foreground w-20",
                                children: speed === 0 ? "Muy Lenta" : speed < 50 ? "Lenta" : speed < 100 ? "Media" : speed < 150 ? "Rápida" : "Muy Rápida"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 145,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 134,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 113,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-3 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lg:col-span-1",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$scheduler$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    state: state,
                                    simulator: simulatorRef.current,
                                    onStateChange: ()=>setState({
                                            ...simulatorRef.current.getState()
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 156,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 155,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lg:col-span-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$process$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    state: state,
                                    onCreate: crearProceso,
                                    onEdit: editarProceso,
                                    onDelete: eliminarProceso,
                                    simulator: simulatorRef.current
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 163,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 162,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 154,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$memory$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                state: state
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 175,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$interrupts$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                state: state,
                                simulator: simulatorRef.current
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 176,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 174,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$devices$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            state: state
                        }, void 0, false, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 181,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 180,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$stats$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                state: state
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 186,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$logs$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                state: state
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 187,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 185,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 152,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: keyboardModalOpen,
                onOpenChange: ()=>{},
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: "Interrupción de Teclado"
                            }, void 0, false, {
                                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 195,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 194,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "py-4",
                            children: "Un proceso ha solicitado entrada de teclado. ¿Desea continuar o cancelar la operación?"
                        }, void 0, false, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 197,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "destructive",
                                    onClick: ()=>handleKeyboardAction("cancelar"),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 201,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documentos$2f$UNI$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: ()=>handleKeyboardAction("continuar"),
                                    children: "Continuar"
                                }, void 0, false, {
                                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 204,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 200,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                    lineNumber: 193,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documentos/UNI/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
_s(OSSimulatorComponent, "ugH6IOUQMiiElL0ikd2JnGJrkLg=");
_c = OSSimulatorComponent;
var _c;
__turbopack_context__.k.register(_c, "OSSimulatorComponent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=Documentos_UNI_Proyecto-Sistemas-Operativos_29c50349._.js.map