module.exports = [
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/process-manager.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
            maxInterrupciones: maxInterrupcionesSolicitadas ?? Math.floor(Math.random() * 16) + 5,
            errores: 0,
            cambiosContexto: 0,
            porcentajeProcesado: 0,
            ioType: null,
            ioTimeRemaining: 0,
            // Metrics fields
            tiempoInicio: -1,
            tiempoFinal: -1,
            tiempoEsperaEnReady: 0
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
    terminarProceso(proceso, tiempoSimulacion, memoria) {
        proceso.tiempoFinal = tiempoSimulacion;
        proceso.tiempoTurnaround = tiempoSimulacion - proceso.tiempoLlegada;
        proceso.estado = "terminated";
        this.colaTerminated.push(proceso);
        memoria.liberarMemoria(proceso.pid);
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
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/memory-manager.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
        let externalHoles = 0;
        let largestHole = 0;
        this.memoria.forEach((b)=>{
            if (!b.ocupado) {
                external += b.tamanio;
                externalHoles++;
                if (b.tamanio > largestHole) {
                    largestHole = b.tamanio;
                }
            } else if (b.pid !== null) {
                const p = procesos.find((proc)=>proc.pid === b.pid);
                if (p) {
                    internal += b.tamanio - p.tamanio;
                }
            }
        });
        return {
            internal,
            external,
            externalHoles,
            largestHole
        };
    }
    /**
   * Compactar memoria: mueve todos los bloques ocupados al inicio
   * y combina todos los espacios libres en un solo bloque contiguo
   */ compactarMemoria() {
        // Separar bloques ocupados y libres
        const ocupados = this.memoria.filter((b)=>b.ocupado);
        if (ocupados.length === 0) {
            return {
                success: true,
                message: "No hay bloques ocupados para compactar"
            };
        }
        // Ordenar bloques ocupados por dirección para mantener orden
        ocupados.sort((a, b)=>a.direccionInicio - b.direccionInicio);
        // Reconstruir memoria con bloques compactados
        const nuevaMemoria = [];
        let offset = 0;
        // Colocar bloques ocupados al inicio
        ocupados.forEach((bloque)=>{
            const nuevoBloque = {
                ...bloque,
                direccionInicio: offset,
                direccionFin: offset + bloque.tamanio
            };
            nuevaMemoria.push(nuevoBloque);
            // Actualizar dirBase del proceso
            // (será manejado por el proceso después)
            offset += bloque.tamanio;
        });
        // Crear un solo bloque libre con el espacio restante
        if (offset < this.MEMORY_SIZE) {
            nuevaMemoria.push({
                direccionInicio: offset,
                direccionFin: this.MEMORY_SIZE,
                tamanio: this.MEMORY_SIZE - offset,
                pid: null,
                ocupado: false,
                esBuddy: false
            });
        }
        this.memoria = nuevaMemoria;
        return {
            success: true,
            message: `Memoria compactada: ${ocupados.length} bloques reorganizados`
        };
    }
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/io-manager.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
        // We can scale it: larger burst = longer I/O? Or inverse?
        // Let's assume proportional.
        const factor = Math.min(proceso.burstTime / 20, 1); // Normalize roughly
        const duracion = Math.floor(Math.random() * 10) + 5 + Math.floor(factor * 5); // Base 5-15 + up to 5 based on burst
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
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/scheduler.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Scheduler",
    ()=>Scheduler
]);
class Scheduler {
    colaReady;
    algorithm = "FCFS";
    apropiativo = false;
    quantum = 5;
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
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/dispatcher.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
            proceso.tiempoInicio = tiempoSimulacion; // Track first execution time
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
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/os-simulator.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OSSimulator",
    ()=>OSSimulator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$process$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/process-manager.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$memory$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/memory-manager.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$io$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/io-manager.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scheduler$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/scheduler.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$dispatcher$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/dispatcher.ts [app-ssr] (ecmascript)");
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
    // Module 2: Gantt Chart
    ganttChart = [];
    MAX_GANTT_ENTRIES = 1000;
    // Module 1: Metrics tracking
    idleTime = 0;
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
    constructor(){
        this.processManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$process$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ProcessManager"]();
        this.memoryManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$memory$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MemoryManager"]();
        this.ioManager = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$io$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["IOManager"]();
        this.scheduler = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scheduler$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Scheduler"]();
        this.dispatcher = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$dispatcher$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dispatcher"]();
    }
    getState() {
        const metrics = this.calculateMetrics();
        const deadlockStatus = this.detectDeadlock();
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
            ].reverse(),
            metrics,
            ganttChart: this.ganttChart,
            deadlockStatus
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
            const next = this.scheduler.getNext();
            if (next) {
                this.dispatcher.dispatch(next, this.tiempoSimulacion);
                this.agregarLog("context_switch", `Cambio de contexto: PID ${next.pid} ahora en ejecución`, next.pid);
                this.agregarLog("scheduler", `Planificador seleccionó PID ${next.pid} (${this.scheduler.getAlgorithm()})`, next.pid);
                // Module 2: Track context switch in Gantt
                this.addGanttEntry({
                    tiempo: this.tiempoSimulacion,
                    pid: next.pid,
                    tipo: "context_switch"
                });
            } else {
                // CPU is idle
                this.idleTime++;
                // Module 2: Track idle in Gantt
                this.addGanttEntry({
                    tiempo: this.tiempoSimulacion,
                    pid: null,
                    tipo: "idle"
                });
            }
        } else {
            const running = this.dispatcher.getRunning();
            // Module 2: Track execution in Gantt
            this.addGanttEntry({
                tiempo: this.tiempoSimulacion,
                pid: running.pid,
                tipo: "execute"
            });
            // Random Error (0.5%)
            if (Math.random() < 0.005) {
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
        // Update waiting time and ready time (for aging)
        this.scheduler.getQueue().forEach((p)=>{
            p.tiempoEspera++;
            p.tiempoEsperaEnReady++;
        });
        // Module 4: Apply aging if using Priority scheduler
        if (this.scheduler.getAlgorithm() === "Prioridades") {
            this.applyAging();
        }
    }
    // Module 2: Add entry to Gantt chart
    addGanttEntry(entry) {
        this.ganttChart.push(entry);
        // Keep only last MAX_GANTT_ENTRIES to prevent memory issues
        if (this.ganttChart.length > this.MAX_GANTT_ENTRIES) {
            this.ganttChart.shift();
        }
    }
    // Module 4: Apply aging to processes in ready queue
    applyAging() {
        const STARVATION_THRESHOLD = 10; // ticks without execution
        const readyQueue = this.scheduler.getQueue();
        readyQueue.forEach((p)=>{
            if (p.tiempoEsperaEnReady >= STARVATION_THRESHOLD) {
                // Decrease priority (lower number = higher priority)
                if (p.prioridad > 0) {
                    p.prioridad--;
                    p.tiempoEsperaEnReady = 0; // Reset counter after aging
                    this.agregarLog("scheduler", `Aging aplicado a PID ${p.pid}: prioridad aumentada a ${p.prioridad}`, p.pid);
                }
            }
        });
    }
    crearProceso(size, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable) {
        const proceso = this.processManager.crearProceso(this.tiempoSimulacion, size, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable);
        this.agregarLog("process_state", `Nuevo proceso creado: PID ${proceso.pid}`, proceso.pid);
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
    // Module 1: Calculate simulation metrics
    calculateMetrics() {
        const completedProcesses = this.processManager.getTerminated();
        const totalProcesses = this.processManager.getAll().length;
        const completedCount = completedProcesses.length;
        if (completedCount === 0) {
            return {
                avgWaitingTime: 0,
                avgTurnaroundTime: 0,
                avgResponseTime: 0,
                throughput: 0,
                cpuUtilization: 0,
                totalProcesses,
                completedProcesses: 0,
                idleTime: this.idleTime
            };
        }
        // Calculate averages
        const totalWaitingTime = completedProcesses.reduce((sum, p)=>sum + p.tiempoEspera, 0);
        const totalTurnaroundTime = completedProcesses.reduce((sum, p)=>sum + p.tiempoTurnaround, 0);
        const totalResponseTime = completedProcesses.reduce((sum, p)=>sum + (p.tiempoRespuesta >= 0 ? p.tiempoRespuesta : 0), 0);
        const avgWaitingTime = totalWaitingTime / completedCount;
        const avgTurnaroundTime = totalTurnaroundTime / completedCount;
        const avgResponseTime = totalResponseTime / completedCount;
        // Throughput: processes completed per unit time
        const throughput = this.tiempoSimulacion > 0 ? completedCount / this.tiempoSimulacion : 0;
        // CPU Utilization: % time CPU was not idle
        const cpuUtilization = this.tiempoSimulacion > 0 ? (this.tiempoSimulacion - this.idleTime) / this.tiempoSimulacion * 100 : 0;
        return {
            avgWaitingTime,
            avgTurnaroundTime,
            avgResponseTime,
            throughput,
            cpuUtilization,
            totalProcesses,
            completedProcesses: completedCount,
            idleTime: this.idleTime
        };
    }
    // Module 4: Detect deadlock (simplified version)
    detectDeadlock() {
        // Simple deadlock detection: check if all processes are blocked waiting for I/O
        // and no I/O operations are completing
        const allProcesses = this.processManager.getAll();
        const blockedProcesses = allProcesses.filter((p)=>p.estado === 'blocked');
        // Basic deadlock: all non-terminated processes are blocked and there are no active interrupts finishing soon
        const nonTerminated = allProcesses.filter((p)=>p.estado !== 'terminated');
        const allBlocked = nonTerminated.length > 0 && blockedProcesses.length === nonTerminated.length;
        if (allBlocked && nonTerminated.length > 1) {
            return {
                detected: true,
                affectedProcesses: blockedProcesses.map((p)=>p.pid),
                cycle: `Todos los procesos (${blockedProcesses.map((p)=>`P${p.pid}`).join(', ')}) están bloqueados esperando I/O`,
                timestamp: this.tiempoSimulacion
            };
        }
        return {
            detected: false,
            affectedProcesses: [],
            cycle: "",
            timestamp: 0
        };
    }
    // Module 3: Compact memory
    compactarMemoria() {
        const result = this.memoryManager.compactarMemoria();
        if (result.success) {
            // Update dirBase for all processes after compaction
            const allProcesses = this.processManager.getAll();
            const memoryBlocks = this.memoryManager.getMemoryState();
            memoryBlocks.forEach((block)=>{
                if (block.ocupado && block.pid !== null) {
                    const proceso = allProcesses.find((p)=>p.pid === block.pid);
                    if (proceso) {
                        proceso.dirBase = block.direccionInicio;
                        // Recalculate pointers
                        const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
                        proceso.heapPointer = proceso.dirBase + dataSize;
                        proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;
                    }
                }
            });
            this.agregarLog("memory", result.message);
        }
        return result;
    }
    // Module 5: Clear logs
    clearLogs() {
        this.logs = [];
        this.agregarLog("scheduler", "Logs limpiados");
    }
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/scenario-manager.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScenarioManager",
    ()=>ScenarioManager
]);
class ScenarioManager {
    static VERSION = "1.0.0";
    /**
     * Export current simulation state as a scenario
     */ static exportScenario(state) {
        // Extract process configurations from current processes
        const processConfigs = state.procesos.filter((p)=>p.estado !== 'terminated') // Only export active processes
        .map((p)=>({
                tamanio: p.tamanio,
                burstTime: p.burstTime,
                prioridad: p.prioridad,
                maxInterrupciones: p.maxInterrupciones,
                porcentajeDatos: p.porcentajeDatos,
                porcentajeVariable: p.porcentajeVariable
            }));
        return {
            version: this.VERSION,
            timestamp: Date.now(),
            scheduler: {
                algorithm: state.scheduler,
                apropiativo: state.apropiativo,
                quantum: state.quantum
            },
            memoryStrategy: state.memoryStrategy,
            processes: processConfigs
        };
    }
    /**
     * Download scenario as JSON file
     */ static downloadScenario(scenario, filename) {
        const json = JSON.stringify(scenario, null, 2);
        const blob = new Blob([
            json
        ], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `os-scenario-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    /**
     * Validate scenario structure
     */ static validateScenario(scenario) {
        if (!scenario || typeof scenario !== 'object') {
            return {
                valid: false,
                error: 'Escenario inválido: no es un objeto JSON'
            };
        }
        if (!scenario.version) {
            return {
                valid: false,
                error: 'Escenario inválido: falta versión'
            };
        }
        if (!scenario.scheduler || !scenario.scheduler.algorithm) {
            return {
                valid: false,
                error: 'Escenario inválido: falta configuración de scheduler'
            };
        }
        const validAlgorithms = [
            'FCFS',
            'SJF',
            'RoundRobin',
            'Prioridades'
        ];
        if (!validAlgorithms.includes(scenario.scheduler.algorithm)) {
            return {
                valid: false,
                error: `Algoritmo inválido: ${scenario.scheduler.algorithm}`
            };
        }
        if (!scenario.memoryStrategy) {
            return {
                valid: false,
                error: 'Escenario inválido: falta estrategia de memoria'
            };
        }
        const validStrategies = [
            'FirstFit',
            'BestFit',
            'WorstFit'
        ];
        if (!validStrategies.includes(scenario.memoryStrategy)) {
            return {
                valid: false,
                error: `Estrategia de memoria inválida: ${scenario.memoryStrategy}`
            };
        }
        if (!Array.isArray(scenario.processes)) {
            return {
                valid: false,
                error: 'Escenario inválido: procesos debe ser un array'
            };
        }
        // Validate each process
        for(let i = 0; i < scenario.processes.length; i++){
            const p = scenario.processes[i];
            if (!p.tamanio || !p.burstTime || p.prioridad === undefined) {
                return {
                    valid: false,
                    error: `Proceso ${i}: faltan campos requeridos`
                };
            }
            if (p.tamanio < 32 * 1024 || p.tamanio > 2 * 1024 * 1024) {
                return {
                    valid: false,
                    error: `Proceso ${i}: tamaño fuera de rango (32KB - 2MB)`
                };
            }
            if (p.burstTime < 1 || p.burstTime > 100) {
                return {
                    valid: false,
                    error: `Proceso ${i}: burstTime fuera de rango (1-100)`
                };
            }
        }
        return {
            valid: true
        };
    }
    /**
     * Load scenario from JSON file
     */ static async loadScenarioFromFile() {
        return new Promise((resolve)=>{
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e)=>{
                const file = e.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                try {
                    const text = await file.text();
                    const scenario = JSON.parse(text);
                    const validation = this.validateScenario(scenario);
                    if (!validation.valid) {
                        alert(`Error al cargar escenario: ${validation.error}`);
                        resolve(null);
                        return;
                    }
                    resolve(scenario);
                } catch (error) {
                    alert(`Error al parsear archivo: ${error}`);
                    resolve(null);
                }
            };
            input.click();
        });
    }
    /**
     * Export logs to CSV format
     */ static exportLogs(logs) {
        const headers = [
            'ID',
            'Tiempo',
            'Tipo',
            'PID',
            'Mensaje'
        ];
        const rows = logs.map((log)=>[
                log.id,
                log.tiempo,
                log.tipo,
                log.pid || '',
                `"${log.mensaje.replace(/"/g, '""')}"` // Escape quotes
            ]);
        const csv = [
            headers.join(','),
            ...rows.map((row)=>row.join(','))
        ].join('\n');
        const blob = new Blob([
            csv
        ], {
            type: 'text/csv;charset=utf-8;'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `os-logs-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
;
;
function Card({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
function CardHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
function CardTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('leading-none font-semibold', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 33,
        columnNumber: 5
    }, this);
}
function CardDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground text-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
function CardAction({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-action",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
function CardContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('px-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
function CardFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex items-center px-6 [.border-t]:pt-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScrollArea",
    ()=>ScrollArea,
    "ScrollBar",
    ()=>ScrollBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-scroll-area/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function ScrollArea({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "scroll-area",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('relative', className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Viewport"], {
                "data-slot": "scroll-area-viewport",
                className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScrollBar, {}, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Corner"], {}, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
function ScrollBar({ className, orientation = 'vertical', ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollAreaScrollbar"], {
        "data-slot": "scroll-area-scrollbar",
        orientation: orientation,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex touch-none p-px transition-colors select-none', orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent', orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollAreaThumb"], {
            "data-slot": "scroll-area-thumb",
            className: "bg-border relative flex-1 rounded-full"
        }, void 0, false, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge,
    "badgeVariants",
    ()=>badgeVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-slot/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/class-variance-authority/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
;
;
;
;
const badgeVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cva"])('inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden', {
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
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Slot"] : 'span';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "badge",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])(badgeVariants({
            variant
        }), className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/badge.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button,
    "buttonVariants",
    ()=>buttonVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-slot/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/class-variance-authority/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", {
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
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Slot"] : 'button';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/progress.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Progress",
    ()=>Progress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-progress/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function Progress({ className, value, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "progress",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$progress$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Indicator"], {
            "data-slot": "progress-indicator",
            className: "bg-primary h-full w-full flex-1 transition-all",
            style: {
                transform: `translateX(-${100 - (value || 0)}%)`
            }
        }, void 0, false, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/progress.tsx",
            lineNumber: 22,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/progress.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-dialog/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as XIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function Dialog({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "dialog",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
function DialogTrigger({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "dialog-trigger",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
function DialogPortal({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Portal"], {
        "data-slot": "dialog-portal",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
function DialogClose({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Close"], {
        "data-slot": "dialog-close",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 30,
        columnNumber: 10
    }, this);
}
function DialogOverlay({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Overlay"], {
        "data-slot": "dialog-overlay",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        "data-slot": "dialog-portal",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Content"], {
                "data-slot": "dialog-content",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg', className),
                ...props,
                children: [
                    children,
                    showCloseButton && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Close"], {
                        "data-slot": "dialog-close",
                        className: "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__XIcon$3e$__["XIcon"], {}, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                                lineNumber: 74,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                                lineNumber: 75,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                        lineNumber: 70,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
function DialogHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex flex-col gap-2 text-center sm:text-left', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
function DialogFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "dialog-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 95,
        columnNumber: 5
    }, this);
}
function DialogTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Title"], {
        "data-slot": "dialog-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('text-lg leading-none font-semibold', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
function DialogDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Description"], {
        "data-slot": "dialog-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground text-sm', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx",
        lineNumber: 124,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
;
;
function Input({ className, type, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        type: type,
        "data-slot": "input",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/input.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/label.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Label",
    ()=>Label
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$label$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-label/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function Label({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$label$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/label.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-select/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/check.js [app-ssr] (ecmascript) <export default as CheckIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-ssr] (ecmascript) <export default as ChevronDownIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/chevron-up.js [app-ssr] (ecmascript) <export default as ChevronUpIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function Select({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "select",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
function SelectGroup({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Group"], {
        "data-slot": "select-group",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
function SelectValue({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Value"], {
        "data-slot": "select-value",
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
function SelectTrigger({ className, size = 'default', children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Trigger"], {
        "data-slot": "select-trigger",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className),
        ...props,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Icon"], {
                asChild: true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {
                    className: "size-4 opacity-50"
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
function SelectContent({ className, children, position = 'popper', ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Portal"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Content"], {
            "data-slot": "select-content",
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md', position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1', className),
            position: position,
            ...props,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollUpButton, {}, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 72,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Viewport"], {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'),
                    children: children
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 73,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollDownButton, {}, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 82,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 61,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, this);
}
function SelectLabel({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
        "data-slot": "select-label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('text-muted-foreground px-2 py-1.5 text-xs', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 93,
        columnNumber: 5
    }, this);
}
function SelectItem({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Item"], {
        "data-slot": "select-item",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "absolute right-2 flex size-3.5 items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ItemIndicator"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__["CheckIcon"], {
                        className: "size-4"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                        lineNumber: 117,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                    lineNumber: 116,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 115,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ItemText"], {
                children: children
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 107,
        columnNumber: 5
    }, this);
}
function SelectSeparator({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Separator"], {
        "data-slot": "select-separator",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('bg-border pointer-events-none -mx-1 my-1 h-px', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 130,
        columnNumber: 5
    }, this);
}
function SelectScrollUpButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollUpButton"], {
        "data-slot": "select-scroll-up-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex cursor-default items-center justify-center py-1', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__["ChevronUpIcon"], {
            className: "size-4"
        }, void 0, false, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 151,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
function SelectScrollDownButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollDownButton"], {
        "data-slot": "select-scroll-down-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('flex cursor-default items-center justify-center py-1', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {
            className: "size-4"
        }, void 0, false, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
            lineNumber: 169,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ProcessPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$progress$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/progress.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/label.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/select.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/plus.js [app-ssr] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$pen$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/square-pen.js [app-ssr] (ecmascript) <export default as Edit>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-ssr] (ecmascript) <export default as Trash2>");
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
    const [modalOpen, setModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [editModalOpen, setEditModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [editingPid, setEditingPid] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        nombre: "",
        tamanio: "",
        burst: "",
        prioridad: "",
        dispositivoIO: "",
        maxInterrupciones: "",
        porcentajeDatos: "",
        porcentajeVariable: ""
    });
    const [editFormData, setEditFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 h-[500px] flex flex-col border-border overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4 flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Gestión de Procesos"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 121,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                            size: "sm",
                            onClick: ()=>setModalOpen(true),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                    className: "w-4 h-4 mr-1"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 124,
                                    columnNumber: 13
                                }, this),
                                " Nuevo Proceso"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 123,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 122,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-5 gap-2 mb-2 text-xs font-semibold text-muted-foreground text-center flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "PID / Estado"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Memoria"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 131,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "CPU / Tiempos"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 132,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Contadores"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 133,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Segmentos"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                        lineNumber: 134,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollArea"], {
                className: "flex-1 min-h-0 overflow-y-auto",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2 pr-4",
                    children: state.procesos.map((proc)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `p-3 rounded-lg border ${proc.estado === "running" ? "border-green-500 bg-green-500/10" : "border-border bg-card"}`,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-5 gap-2 text-xs items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "font-bold text-lg",
                                                        children: [
                                                            "#",
                                                            proc.pid
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 150,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Badge"], {
                                                        variant: "outline",
                                                        className: `${getStatusColor(proc.estado)} text-white border-none`,
                                                        children: proc.estado.toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 151,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 149,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-1 mt-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        size: "sm",
                                                        variant: "ghost",
                                                        className: "h-6 w-6 p-0",
                                                        onClick: ()=>handleEditClick(proc.pid),
                                                        title: "Editar proceso",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$pen$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit$3e$__["Edit"], {
                                                            className: "w-3 h-3"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 163,
                                                            columnNumber: 23
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 156,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        size: "sm",
                                                        variant: "ghost",
                                                        className: "h-6 w-6 p-0 text-red-500 hover:text-red-700",
                                                        onClick: ()=>handleDeleteClick(proc.pid),
                                                        title: "Eliminar proceso",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                            className: "w-3 h-3"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 172,
                                                            columnNumber: 23
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 165,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 155,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[10px] text-muted-foreground",
                                                children: [
                                                    "Prioridad: ",
                                                    proc.prioridad
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 175,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                        lineNumber: 148,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    "Size: ",
                                                    (proc.tamanio / 1024).toFixed(0),
                                                    " KB"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 182,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[10px] text-muted-foreground",
                                                children: [
                                                    "Base: ",
                                                    proc.dirBase === -1 ? "Pend." : `0x${proc.dirBase.toString(16).toUpperCase()}`
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 183,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                        lineNumber: 181,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-1 w-full",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex justify-between text-[10px]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            "PC: ",
                                                            proc.programCounter
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 191,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            proc.porcentajeProcesado.toFixed(0),
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 192,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 190,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$progress$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Progress"], {
                                                value: proc.porcentajeProcesado,
                                                className: "h-1.5"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 194,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[10px] text-muted-foreground mt-1",
                                                children: [
                                                    "Burst: ",
                                                    proc.burstTime,
                                                    " | Rest: ",
                                                    proc.tiempoRestante
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 195,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                        lineNumber: 189,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    "Wait: ",
                                                    proc.tiempoEspera
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 202,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    "Turn: ",
                                                    proc.tiempoTurnaround
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 203,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    "Ctx: ",
                                                    proc.cambiosContexto
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 204,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    "I/O: ",
                                                    proc.interrupciones
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 205,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-red-500",
                                                children: [
                                                    "Err: ",
                                                    proc.errores
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 206,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                        lineNumber: 201,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-1 text-[10px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex justify-between",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            "Data: ",
                                                            proc.porcentajeDatos,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 212,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            "Var: ",
                                                            proc.porcentajeVariable,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 213,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 211,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "w-full bg-muted h-1.5 rounded-full overflow-hidden flex",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "bg-blue-400 h-full",
                                                        style: {
                                                            width: `${proc.porcentajeDatos}%`
                                                        },
                                                        title: "Data"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 216,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "bg-yellow-400 h-full",
                                                        style: {
                                                            width: `${proc.porcentajeVariable}%`
                                                        },
                                                        title: "Variable"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 217,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "bg-gray-300 h-full flex-1",
                                                        title: "Code/Stack"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 218,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 215,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex justify-between text-[9px] text-muted-foreground mt-0.5",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            "SP: ",
                                                            proc.stackPointer
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 221,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: [
                                                            "HP: ",
                                                            proc.heapPointer
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 222,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                lineNumber: 220,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                        lineNumber: 210,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 146,
                                columnNumber: 15
                            }, this)
                        }, proc.pid, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 140,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 138,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dialog"], {
                open: modalOpen,
                onOpenChange: setModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md max-h-[90vh] overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: "Crear Nuevo Proceso"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 235,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 234,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4 py-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "nombre",
                                            children: "Nombre del Proceso"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 239,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
                                            id: "nombre",
                                            value: formData.nombre,
                                            onChange: (e)=>setFormData({
                                                    ...formData,
                                                    nombre: e.target.value
                                                }),
                                            placeholder: "Nombre (opcional)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 240,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 238,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "tamanio",
                                            children: "Tamaño (KB)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 248,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 249,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "Se ajustará a la potencia de 2 más cercana"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 258,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 247,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "burst",
                                            children: "Burst Time"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 263,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 264,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 262,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "prioridad",
                                            children: "Prioridad"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 275,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 276,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 274,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "dispositivoIO",
                                            children: "Tipo de Dispositivo I/O"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 287,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Select"], {
                                            value: formData.dispositivoIO,
                                            onValueChange: (value)=>setFormData({
                                                    ...formData,
                                                    dispositivoIO: value
                                                }),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectValue"], {
                                                        placeholder: "Seleccionar dispositivo"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                        lineNumber: 293,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 292,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectContent"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "disk",
                                                            children: "Disk"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 296,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "printer",
                                                            children: "Printer"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 297,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "monitor",
                                                            children: "Monitor"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 298,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "network",
                                                            children: "Network"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 299,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                            value: "keyboard",
                                                            children: "Keyboard"
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                            lineNumber: 300,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                                    lineNumber: 295,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 288,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "El dispositivo se asignará aleatoriamente si no se especifica"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 303,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 286,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "maxInterrupciones",
                                            children: "Máximo de Interrupciones"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 308,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 309,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 307,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "porcentajeDatos",
                                            children: "Porcentaje de Datos (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 320,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 321,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 319,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "porcentajeVariable",
                                            children: "Porcentaje Variable (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 332,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 333,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 331,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 237,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    onClick: ()=>setModalOpen(false),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 345,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: handleCreateProcess,
                                    children: "Crear Proceso"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 348,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 344,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 233,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 232,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dialog"], {
                open: editModalOpen,
                onOpenChange: setEditModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md max-h-[90vh] overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: [
                                    "Editar Proceso PID ",
                                    editingPid
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                lineNumber: 359,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 358,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4 py-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-tamanio",
                                            children: "Tamaño (KB)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 363,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 364,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mt-1",
                                            children: "Se ajustará a la potencia de 2 más cercana"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 373,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 362,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-burst",
                                            children: "Burst Time"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 378,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 379,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 377,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-prioridad",
                                            children: "Prioridad"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 390,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 391,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 389,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-maxInterrupciones",
                                            children: "Máximo de Interrupciones"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 402,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 403,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 401,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-porcentajeDatos",
                                            children: "Porcentaje de Datos (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 414,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 415,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 413,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "edit-porcentajeVariable",
                                            children: "Porcentaje Variable (%)"
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 426,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
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
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                            lineNumber: 427,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 425,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 361,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    onClick: ()=>setEditModalOpen(false),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 439,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: handleEditProcess,
                                    children: "Guardar Cambios"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                                    lineNumber: 442,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                            lineNumber: 438,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                    lineNumber: 357,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
                lineNumber: 356,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx",
        lineNumber: 119,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MemoryPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-ssr] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
function MemoryPanel({ state, simulator }) {
    if (!state) return null;
    const [isCompacting, setIsCompacting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
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
        external: 0,
        externalHoles: 0,
        largestHole: 0
    };
    const internalFragKB = fragmentation.internal / 1024;
    const externalFragKB = fragmentation.external / 1024;
    const externalFragPct = totalMem > 0 ? fragmentation.external / totalMem * 100 : 0;
    const freeBlocks = state.memoria.filter((b)=>!b.ocupado).length;
    // High fragmentation warning threshold
    const isHighFragmentation = externalFragPct > 30 && fragmentation.externalHoles > 2;
    const handleCompaction = async ()=>{
        if (!simulator) return;
        setIsCompacting(true);
        try {
            simulator.compactarMemoria();
        } finally{
            setTimeout(()=>setIsCompacting(false), 500);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border h-[400px] flex flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Gestión de Memoria"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 47,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground text-right",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            "Total: ",
                                            (totalMem / 1024).toFixed(0),
                                            " KB"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 50,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            "Uso: ",
                                            usagePct.toFixed(1),
                                            "%"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 51,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            "Bloques Libres: ",
                                            freeBlocks
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 52,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this),
                            simulator && fragmentation.externalHoles > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "outline",
                                className: "h-8 text-xs",
                                onClick: handleCompaction,
                                disabled: isCompacting,
                                children: isCompacting ? "Compactando..." : "Compactar"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 55,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this),
            isHighFragmentation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 p-2 bg-yellow-500/10 border border-yellow-500 rounded flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                        className: "h-4 w-4 text-yellow-500"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 71,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs text-yellow-700",
                        children: [
                            "Alta fragmentación externa detectada (",
                            externalFragKB.toFixed(1),
                            " KB en ",
                            fragmentation.externalHoles,
                            " huecos)"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 72,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 70,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 relative bg-muted rounded-lg overflow-hidden border border-border",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollArea"], {
                    className: "h-full w-full",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap content-start p-1 gap-0.5",
                        children: state.memoria.map((bloque, idx)=>{
                            const sizeKB = bloque.tamanio / 1024;
                            // Identify unusable small holes (< 32KB and free)
                            const isUnusableHole = !bloque.ocupado && bloque.tamanio < 32 * 1024;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `
                    h-16 border rounded flex flex-col items-center justify-center text-[10px] relative overflow-hidden transition-all
                    ${bloque.ocupado ? "bg-blue-500/20 border-blue-500 text-blue-700" : isUnusableHole ? "bg-red-500/20 border-red-500 text-red-700 animate-pulse" : "bg-green-500/10 border-green-500 text-green-700"}
                  `,
                                style: {
                                    width: `calc(${bloque.tamanio / totalMem * 100}% - 2px)`,
                                    minWidth: "40px"
                                },
                                title: `Addr: ${bloque.direccionInicio} - ${bloque.direccionFin} | Size: ${sizeKB}KB${isUnusableHole ? " (Muy pequeño)" : ""}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: [
                                            sizeKB,
                                            " KB"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 104,
                                        columnNumber: 19
                                    }, this),
                                    bloque.ocupado ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold",
                                        children: [
                                            "PID ",
                                            bloque.pid
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 106,
                                        columnNumber: 21
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "opacity-50",
                                        children: isUnusableHole ? "Hueco" : "Free"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 108,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute bottom-0 right-1 text-[8px] opacity-50",
                                        children: [
                                            "0x",
                                            bloque.direccionInicio.toString(16).toUpperCase()
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                        lineNumber: 112,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, idx, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 87,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 80,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                    lineNumber: 79,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-3 gap-4 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Fragmentación Externa"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 124,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    externalFragKB.toFixed(1),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 125,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] opacity-70",
                                children: [
                                    fragmentation.externalHoles,
                                    " huecos"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 126,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 123,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Hueco Más Grande"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 129,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    (fragmentation.largestHole / 1024).toFixed(1),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 130,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold block mb-1",
                                children: "Frag. Interna"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 133,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    internalFragKB.toFixed(1),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                                lineNumber: 134,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                        lineNumber: 132,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
                lineNumber: 122,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx",
        lineNumber: 45,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SchedulerPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/input.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function SchedulerPanel({ state, simulator, onStateChange }) {
    const [quantum, setQuantum] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(state.quantum);
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Scheduler"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-semibold mb-2",
                                children: "Política Actual:"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-2 gap-2",
                                children: [
                                    "FCFS",
                                    "SJF",
                                    "RoundRobin",
                                    "Prioridades"
                                ].map((sched)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>changeScheduler(sched),
                                        variant: state.scheduler === sched ? "default" : "outline",
                                        size: "sm",
                                        className: "text-xs",
                                        children: sched
                                    }, sched, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 44,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    state.scheduler === "RoundRobin" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-semibold mb-2 block",
                                children: "Quantum:"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 59,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Input"], {
                                type: "number",
                                min: "1",
                                max: "100",
                                value: quantum,
                                onChange: (e)=>updateQuantum(e.target.value),
                                className: "w-full",
                                placeholder: "Ingrese el quantum"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 60,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-semibold mb-2",
                                children: "Estrategia de Memoria:"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 73,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-3 gap-2",
                                children: [
                                    "FirstFit",
                                    "BestFit",
                                    "WorstFit"
                                ].map((strategy)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>changeMemoryStrategy(strategy),
                                        variant: state.memoryStrategy === strategy ? "default" : "outline",
                                        size: "sm",
                                        className: "text-xs",
                                        children: strategy
                                    }, strategy, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 76,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 74,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between p-2 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm",
                                children: "Modo Apropiativo"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: toggleApropiativo,
                                className: `w-12 h-6 rounded-full transition ${state.apropiativo ? "bg-green-600" : "bg-gray-400"}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `w-5 h-5 bg-white rounded-full transition transform ${state.apropiativo ? "translate-x-6" : "translate-x-1"}`
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                    lineNumber: 95,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 91,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 p-3 bg-muted rounded text-xs space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Procesos Total: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: state.procesos.length
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 105,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 104,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    "Cambios Contexto: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-bold",
                                        children: state.cambiosContextoTotal
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                        lineNumber: 108,
                                        columnNumber: 31
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                                lineNumber: 107,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                        lineNumber: 103,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InterruptsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-ssr] (ecmascript) <export default as AlertCircle>");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border flex flex-col gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-start",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "text-lg font-bold",
                    children: "Interrupciones"
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            manualInterrupt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-yellow-500/20 border border-yellow-500 p-3 rounded-lg animate-pulse",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 mb-2 text-yellow-700 font-bold text-sm",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                className: "w-4 h-4"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 27,
                                columnNumber: 13
                            }, this),
                            "Interrupción de Teclado (PID ",
                            manualInterrupt.pidAsociado,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 26,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "default",
                                className: "w-full bg-green-600 hover:bg-green-700",
                                onClick: ()=>handleManualAction(manualInterrupt.id, "continuar"),
                                children: "Continuar"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 31,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "destructive",
                                className: "w-full",
                                onClick: ()=>handleManualAction(manualInterrupt.id, "cancelar"),
                                children: "Cancelar"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                lineNumber: 39,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 30,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 25,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-semibold",
                        children: "Interrupciones Activas"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this),
                    state.interrupcionesActivas.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground italic",
                        children: "Ninguna interrupción activa"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                        lineNumber: 55,
                        columnNumber: 11
                    }, this) : state.interrupcionesActivas.map((irq)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs p-2 bg-background border border-border rounded flex justify-between items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-bold uppercase mr-2",
                                            children: irq.dispositivo
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 60,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-muted-foreground",
                                            children: [
                                                "PID ",
                                                irq.pidAsociado
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 61,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                    lineNumber: 59,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-16 h-1.5 bg-muted rounded-full overflow-hidden",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-full bg-blue-500",
                                                style: {
                                                    width: `${irq.tiempoRestante / irq.duracion * 100}%`
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                                lineNumber: 65,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 64,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "w-8 text-right",
                                            children: [
                                                irq.tiempoRestante,
                                                "ms"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                            lineNumber: 70,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                                    lineNumber: 63,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, irq.id, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                            lineNumber: 58,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DevicesPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Colas de Dispositivos (E/S)"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 md:grid-cols-5 gap-3",
                children: devices.map((device)=>{
                    const queue = state.colasDispositivos[device] || [];
                    const active = state.interrupcionesActivas.find((i)=>i.dispositivo === device);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col h-48 bg-muted rounded border border-border overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-2 bg-card border-b border-border flex justify-between items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold capitalize text-sm",
                                        children: device
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 24,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Badge"], {
                                        variant: active ? "default" : "secondary",
                                        className: "text-[10px]",
                                        children: active ? "BUSY" : "IDLE"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 25,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 23,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-2 bg-blue-500/10 border-b border-border min-h-[50px] flex items-center justify-center",
                                children: active ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-bold text-blue-600",
                                            children: [
                                                "Procesando PID ",
                                                active.pidAsociado
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 34,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                "Restante: ",
                                                active.tiempoRestante,
                                                "ms"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 35,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 33,
                                    columnNumber: 19
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[10px] text-muted-foreground",
                                    children: "Esperando solicitud..."
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 38,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 31,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollArea"], {
                                className: "flex-1 p-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: queue.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[10px] text-center text-muted-foreground py-2",
                                        children: "Cola vacía"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                        lineNumber: 46,
                                        columnNumber: 21
                                    }, this) : queue.map((proc, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] p-1.5 bg-background rounded border border-border flex justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-mono",
                                                    children: [
                                                        "#",
                                                        idx + 1
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                                    lineNumber: 50,
                                                    columnNumber: 25
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold",
                                                    children: [
                                                        "PID ",
                                                        proc.pid
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                                    lineNumber: 51,
                                                    columnNumber: 25
                                                }, this)
                                            ]
                                        }, proc.pid, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                            lineNumber: 49,
                                            columnNumber: 23
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                    lineNumber: 44,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                                lineNumber: 43,
                                columnNumber: 15
                            }, this)
                        ]
                    }, device, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                        lineNumber: 22,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>StatsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Estadísticas en Tiempo Real"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-blue-400",
                                children: state.procesos.length
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Procesos Totales"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-green-400",
                                children: state.colaReady.length
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "En Ready"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 47,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-yellow-400",
                                children: state.colaTerminated.length
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 51,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Terminados"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 52,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 50,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-red-400",
                                children: state.cambiosContextoTotal
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 56,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Cambios Contexto"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 57,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-purple-400",
                                children: state.erroresTotal
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 61,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Errores"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 62,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 60,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-cyan-400",
                                children: state.interrupcionesTotal
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 66,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Interrupciones"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 67,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 65,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid grid-cols-2 gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-semibold mb-2",
                                children: "Uso de Memoria"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 74,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full bg-background rounded h-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-blue-500 h-full rounded transition-all",
                                    style: {
                                        width: `${Math.min(memoryUsagePercent, 100)}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                    lineNumber: 79,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 78,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-2",
                                children: [
                                    "Bloques: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-blue-600",
                                        children: [
                                            occupiedBlocks,
                                            " ocupados"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                        lineNumber: 85,
                                        columnNumber: 22
                                    }, this),
                                    " / ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-green-600",
                                        children: [
                                            freeBlocks,
                                            " libres"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                        lineNumber: 85,
                                        columnNumber: 89
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 84,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-semibold mb-2",
                                children: "Uso de CPU"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs mb-2",
                                children: [
                                    cpuUsage.toFixed(1),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 91,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full bg-background rounded h-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-green-500 h-full rounded transition-all",
                                    style: {
                                        width: `${Math.min(cpuUsage, 100)}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                    lineNumber: 93,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-2",
                                children: state.colaRunning ? `Ejecutando: PID ${state.colaRunning.pid}` : "CPU Ociosa"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 98,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground mt-1",
                                children: [
                                    procesosRunning,
                                    " de ",
                                    totalProcesos,
                                    " procesos activos"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                                lineNumber: 101,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/checkbox.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Checkbox",
    ()=>Checkbox
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$checkbox$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/@radix-ui/react-checkbox/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/check.js [app-ssr] (ecmascript) <export default as CheckIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/utils.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function Checkbox({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$checkbox$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "checkbox",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])('peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50', className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$checkbox$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Indicator"], {
            "data-slot": "checkbox-indicator",
            className: "flex items-center justify-center text-current transition-none",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__["CheckIcon"], {
                className: "size-3.5"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/checkbox.tsx",
                lineNumber: 26,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/checkbox.tsx",
            lineNumber: 22,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/checkbox.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LogsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/badge.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$checkbox$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/checkbox.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
function LogsPanel({ state, simulator }) {
    if (!state || !state.logs) return null;
    // Filter state
    const [filters, setFilters] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        error: true,
        context_switch: true,
        process_state: true,
        io: true,
        memory: true,
        scheduler: true,
        interrupt: true
    });
    const toggleFilter = (tipo)=>{
        setFilters((prev)=>({
                ...prev,
                [tipo]: !prev[tipo]
            }));
    };
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
    // Filter logs based on selected filters
    const filteredLogs = state.logs.filter((log)=>filters[log.tipo]);
    // Count logs by type
    const logCounts = state.logs.reduce((acc, log)=>{
        acc[log.tipo] = (acc[log.tipo] || 0) + 1;
        return acc;
    }, {});
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border h-[500px] flex flex-col overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-3 flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Logs del Simulador"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: [
                                    filteredLogs.length,
                                    "/",
                                    state.logs.length,
                                    " eventos"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                lineNumber: 69,
                                columnNumber: 11
                            }, this),
                            simulator && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                size: "sm",
                                variant: "outline",
                                className: "h-6 text-xs",
                                onClick: ()=>simulator.clearLogs(),
                                children: "Limpiar"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                lineNumber: 73,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 pb-3 border-b border-border flex-shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs font-semibold mb-2 text-muted-foreground",
                        children: "Filtros:"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-2 md:grid-cols-4 gap-2",
                        children: Object.entries(filters).map(([tipo, enabled])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$checkbox$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Checkbox"], {
                                        id: `filter-${tipo}`,
                                        checked: enabled,
                                        onCheckedChange: ()=>toggleFilter(tipo)
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                        lineNumber: 91,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: `filter-${tipo}`,
                                        className: "text-[10px] cursor-pointer select-none",
                                        children: [
                                            getLogTypeLabel(tipo),
                                            " (",
                                            logCounts[tipo] || 0,
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                        lineNumber: 96,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, tipo, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                lineNumber: 90,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 88,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollArea"], {
                className: "flex-1 min-h-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2 pr-4",
                    children: filteredLogs.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-muted-foreground italic text-center py-8",
                        children: state.logs.length === 0 ? "No hay eventos registrados aún" : "No hay eventos que coincidan con los filtros seleccionados"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                        lineNumber: 110,
                        columnNumber: 13
                    }, this) : filteredLogs.map((log)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `p-2 rounded border text-xs ${getLogTypeColor(log.tipo)}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between gap-2 mb-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Badge"], {
                                                    variant: "outline",
                                                    className: `text-[10px] ${getLogTypeColor(log.tipo)}`,
                                                    children: getLogTypeLabel(log.tipo)
                                                }, void 0, false, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 21
                                                }, this),
                                                log.pid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-[10px]",
                                                    children: [
                                                        "PID ",
                                                        log.pid
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                                    lineNumber: 127,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                            lineNumber: 122,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] opacity-70",
                                            children: [
                                                "t=",
                                                log.tiempo
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                            lineNumber: 130,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                    lineNumber: 121,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-[11px] font-medium",
                                    children: log.mensaje
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                                    lineNumber: 132,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, log.id, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                            lineNumber: 117,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                    lineNumber: 108,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MetricsDashboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function MetricsDashboard({ metrics }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-lg font-bold mb-4",
                children: "Métricas de Rendimiento"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 13,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-blue-400",
                                children: metrics.avgWaitingTime.toFixed(2)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 18,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Tiempo Espera Promedio"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 21,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-muted-foreground mt-1",
                                children: "(ticks)"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 22,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 17,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-green-400",
                                children: metrics.avgTurnaroundTime.toFixed(2)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 29,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Tiempo Retorno Promedio"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 32,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-muted-foreground mt-1",
                                children: "(ticks)"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 33,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 28,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-purple-400",
                                children: metrics.avgResponseTime.toFixed(2)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 40,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Tiempo Respuesta Promedio"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 43,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-muted-foreground mt-1",
                                children: "(ticks)"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 44,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 39,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-orange-400",
                                children: metrics.throughput.toFixed(4)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 51,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Throughput"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 54,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-muted-foreground mt-1",
                                children: "(procesos/tick)"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 55,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 50,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 15,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-3 bg-muted rounded mb-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between items-center mb-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-semibold",
                                children: "Uso de CPU"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 64,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-bold text-cyan-400",
                                children: [
                                    metrics.cpuUtilization.toFixed(1),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 65,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 63,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-full bg-background rounded h-3",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded transition-all",
                            style: {
                                width: `${Math.min(metrics.cpuUtilization, 100)}%`
                            }
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                            lineNumber: 70,
                            columnNumber: 21
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 69,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground mt-2",
                        children: [
                            "Tiempo activo: ",
                            metrics.completedProcesses > 0 ? metrics.totalProcesses - metrics.idleTime : 0,
                            " ticks | Tiempo ocioso: ",
                            metrics.idleTime,
                            " ticks"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 75,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 62,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xl font-bold text-yellow-400",
                                children: metrics.completedProcesses
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 84,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Procesos Completados"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 87,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 83,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3 bg-muted rounded text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xl font-bold text-red-400",
                                children: metrics.totalProcesses - metrics.completedProcesses
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 91,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground",
                                children: "Procesos Activos"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 94,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 90,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 82,
                columnNumber: 13
            }, this),
            metrics.completedProcesses > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 p-3 bg-muted/50 rounded border border-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs font-semibold mb-1 text-muted-foreground",
                        children: "Fórmulas:"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 101,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[10px] text-muted-foreground space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "• Tiempo Espera = T_inicio - T_llegada - T_burst"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 103,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "• Tiempo Retorno = T_final - T_llegada"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 104,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "• Tiempo Respuesta = Primera ejecución en CPU"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 105,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "• Throughput = Procesos completados / Tiempo total"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 106,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: "• Uso CPU = (Tiempo total - Tiempo ocioso) / Tiempo total"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                                lineNumber: 107,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                        lineNumber: 102,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 100,
                columnNumber: 17
            }, this),
            metrics.completedProcesses === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 text-center text-sm text-muted-foreground italic",
                children: "Las métricas se calcularán cuando los procesos comiencen a completarse"
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
                lineNumber: 113,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx",
        lineNumber: 12,
        columnNumber: 9
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>GanttChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/scroll-area.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function GanttChart({ ganttChart, procesos }) {
    const scrollRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Auto-scroll to the end when new entries are added
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [
        ganttChart.length
    ]);
    // Generate color for each PID
    const getColorForPid = (pid)=>{
        if (pid === null) return "bg-gray-700"; // IDLE
        const colors = [
            "bg-blue-500",
            "bg-green-500",
            "bg-yellow-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-indigo-500",
            "bg-red-500",
            "bg-teal-500",
            "bg-orange-500",
            "bg-cyan-500"
        ];
        return colors[pid % colors.length];
    };
    const getBorderColorForPid = (pid)=>{
        if (pid === null) return "border-gray-500";
        const colors = [
            "border-blue-600",
            "border-green-600",
            "border-yellow-600",
            "border-purple-600",
            "border-pink-600",
            "border-indigo-600",
            "border-red-600",
            "border-teal-600",
            "border-orange-600",
            "border-cyan-600"
        ];
        return colors[pid % colors.length];
    };
    // Get unique PIDs for legend
    const uniquePids = Array.from(new Set(ganttChart.filter((e)=>e.pid !== null).map((e)=>e.pid)));
    // Group consecutive entries with same PID for better visualization
    const groupedEntries = [];
    ganttChart.forEach((entry, idx)=>{
        const last = groupedEntries[groupedEntries.length - 1];
        if (last && last.pid === entry.pid && last.tipo === entry.tipo) {
            last.end = entry.tiempo;
        } else {
            groupedEntries.push({
                pid: entry.pid,
                tipo: entry.tipo,
                start: entry.tiempo,
                end: entry.tiempo
            });
        }
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "p-4 border border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-bold",
                        children: "Diagrama de Gantt"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 82,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-muted-foreground",
                        children: [
                            ganttChart.length,
                            " eventos"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 83,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                lineNumber: 81,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex flex-wrap gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-3 h-3 bg-gray-700 rounded border border-gray-500"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                lineNumber: 91,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] text-muted-foreground",
                                children: "IDLE"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                lineNumber: 92,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 90,
                        columnNumber: 17
                    }, this),
                    uniquePids.slice(0, 10).map((pid)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `w-3 h-3 ${getColorForPid(pid)} rounded ${getBorderColorForPid(pid)} border`
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                    lineNumber: 96,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[10px] text-muted-foreground",
                                    children: [
                                        "P",
                                        pid
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                    lineNumber: 97,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, pid, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                            lineNumber: 95,
                            columnNumber: 21
                        }, this)),
                    uniquePids.length > 10 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[10px] text-muted-foreground italic",
                        children: [
                            "+",
                            uniquePids.length - 10,
                            " más"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 101,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                lineNumber: 89,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScrollArea"], {
                className: "w-full",
                ref: scrollRef,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "min-w-max pb-2",
                    children: ganttChart.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-muted-foreground italic text-center py-8",
                        children: "El diagrama de Gantt aparecerá cuando inicie la simulación"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 109,
                        columnNumber: 25
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-0.5 min-h-[60px]",
                        children: groupedEntries.map((group, idx)=>{
                            const width = Math.max((group.end - group.start + 1) * 8, 8); // 8px per tick minimum
                            const isContextSwitch = group.tipo === "context_switch";
                            const isIdle = group.pid === null;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `
                      ${getColorForPid(group.pid)} 
                      ${getBorderColorForPid(group.pid)}
                      ${isContextSwitch ? 'border-2 border-white' : 'border'}
                      ${isIdle ? 'opacity-40' : 'opacity-90'}
                      transition-all
                      flex items-center justify-center
                      relative group/item
                      h-12
                    `,
                                style: {
                                    width: `${width}px`,
                                    minWidth: '4px'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute bottom-full mb-1 hidden group-hover/item:block z-10 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap",
                                        children: [
                                            isIdle ? "CPU IDLE" : `P${group.pid}`,
                                            isContextSwitch && " (Context Switch)",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[9px] opacity-75",
                                                children: [
                                                    "t=",
                                                    group.start,
                                                    group.end !== group.start && `-${group.end}`
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                                lineNumber: 138,
                                                columnNumber: 45
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                        lineNumber: 135,
                                        columnNumber: 41
                                    }, this),
                                    width > 20 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[9px] font-bold text-white drop-shadow",
                                        children: isIdle ? "·" : `P${group.pid}`
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                        lineNumber: 145,
                                        columnNumber: 45
                                    }, this)
                                ]
                            }, idx, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                                lineNumber: 120,
                                columnNumber: 37
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 113,
                        columnNumber: 25
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                    lineNumber: 107,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                lineNumber: 106,
                columnNumber: 13
            }, this),
            ganttChart.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 flex items-center gap-2 text-[10px] text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Tiempo:"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 160,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "0"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 161,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1 border-t border-dashed border-muted-foreground/30"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 162,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: ganttChart[ganttChart.length - 1]?.tiempo || 0
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                        lineNumber: 163,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
                lineNumber: 159,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx",
        lineNumber: 80,
        columnNumber: 9
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DeadlockAlert
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-ssr] (ecmascript) <export default as AlertTriangle>");
"use client";
;
;
;
;
function DeadlockAlert({ deadlockInfo, onResolve, onClose }) {
    if (!deadlockInfo.detected) return null;
    const handleCancelProcess = ()=>{
        // Cancel the first affected process
        if (deadlockInfo.affectedProcesses.length > 0) {
            onResolve("cancel_process", deadlockInfo.affectedProcesses[0]);
        }
    };
    const handleIgnore = ()=>{
        onResolve("ignore");
        onClose();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dialog"], {
        open: deadlockInfo.detected,
        onOpenChange: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "sm:max-w-[500px]",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                    className: "h-6 w-6 text-red-500"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 34,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    className: "text-red-600",
                                    children: "⚠️ Deadlock Detectado"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 35,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 33,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogDescription"], {
                            children: "Se ha detectado un deadlock en el sistema. Todos los procesos activos están bloqueados esperando por recursos."
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 37,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                    lineNumber: 32,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "py-4 space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm font-semibold mb-2",
                                    children: "Descripción del Deadlock:"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 45,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm text-muted-foreground",
                                    children: deadlockInfo.cycle
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 46,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 44,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm font-semibold mb-2",
                                    children: "Procesos Afectados:"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 53,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-2",
                                    children: deadlockInfo.affectedProcesses.map((pid)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium",
                                            children: [
                                                "PID ",
                                                pid
                                            ]
                                        }, pid, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                            lineNumber: 56,
                                            columnNumber: 33
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 54,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 52,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs text-muted-foreground",
                            children: [
                                "Detectado en: Tick ",
                                deadlockInfo.timestamp
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 67,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-3 bg-muted rounded",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm font-semibold mb-2",
                                    children: "Opciones de Resolución:"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 73,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "text-sm text-muted-foreground space-y-1 list-disc list-inside",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                    children: "Cancelar Proceso:"
                                                }, void 0, false, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                                    lineNumber: 75,
                                                    columnNumber: 33
                                                }, this),
                                                " Termina PID ",
                                                deadlockInfo.affectedProcesses[0],
                                                " para liberar recursos"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                            lineNumber: 75,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                    children: "Ignorar:"
                                                }, void 0, false, {
                                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                                    lineNumber: 76,
                                                    columnNumber: 33
                                                }, this),
                                                " Continuar simulación (algunos procesos pueden quedar bloqueados indefinidamente)"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                            lineNumber: 76,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                                    lineNumber: 74,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 72,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                    lineNumber: 42,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogFooter"], {
                    className: "flex gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                            variant: "outline",
                            onClick: handleIgnore,
                            children: "Ignorar y Continuar"
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 82,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                            variant: "destructive",
                            onClick: handleCancelProcess,
                            children: [
                                "Cancelar PID ",
                                deadlockInfo.affectedProcesses[0]
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                            lineNumber: 88,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
                    lineNumber: 81,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
            lineNumber: 31,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx",
        lineNumber: 30,
        columnNumber: 9
    }, this);
}
}),
"[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OSSimulatorComponent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/os-simulator.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scenario$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/lib/scenario-manager.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$process$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/process-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$memory$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/memory-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$scheduler$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/scheduler-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$interrupts$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/interrupts-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$devices$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/devices-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$stats$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/stats-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$logs$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/logs-panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$metrics$2d$dashboard$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/metrics-dashboard.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$gantt$2d$chart$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/gantt-chart.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$deadlock$2d$alert$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/panels/deadlock-alert.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/ui/dialog.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/download.js [app-ssr] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__ = __turbopack_context__.i("[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/node_modules/lucide-react/dist/esm/icons/upload.js [app-ssr] (ecmascript) <export default as Upload>");
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
;
;
;
;
;
function OSSimulatorComponent() {
    const simulatorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [running, setRunning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [speed, setSpeed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(100);
    const [keyboardModalOpen, setKeyboardModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pendingKeyboardIrq, setPendingKeyboardIrq] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [deadlockDetected, setDeadlockDetected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const intervalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        simulatorRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["OSSimulator"]();
        simulatorRef.current.generarProcesosIniciales(5);
        setState(simulatorRef.current.getState());
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (running && simulatorRef.current) {
            intervalRef.current = setInterval(()=>{
                if (!simulatorRef.current) return;
                simulatorRef.current.ejecutarTick();
                const newState = {
                    ...simulatorRef.current.getState()
                };
                setState(newState);
                // Check for deadlock
                if (newState.deadlockStatus?.detected && !deadlockDetected) {
                    setDeadlockDetected(true);
                    setRunning(false); // Pause simulation
                }
                // Check for manual keyboard interrupts
                const manualIrq = newState.interrupcionesActivas.find((i)=>i.esManual && i.estado === "active");
                if (manualIrq && !keyboardModalOpen) {
                    setPendingKeyboardIrq(manualIrq.id);
                    setKeyboardModalOpen(true);
                    setRunning(false); // Pause for user input
                }
            }, Math.max(10, 200 - speed));
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return ()=>{
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [
        running,
        speed,
        keyboardModalOpen,
        deadlockDetected
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
    // Export scenario
    const handleExportScenario = ()=>{
        if (simulatorRef.current) {
            const currentState = simulatorRef.current.getState();
            const scenario = __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scenario$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScenarioManager"].exportScenario(currentState);
            __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scenario$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScenarioManager"].downloadScenario(scenario);
        }
    };
    // Import scenario
    const handleImportScenario = async ()=>{
        const scenario = await __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scenario$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScenarioManager"].loadScenarioFromFile();
        if (!scenario || !simulatorRef.current) return;
        // Reset simulator
        simulatorRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["OSSimulator"]();
        // Apply scheduler configuration
        simulatorRef.current.setScheduler(scenario.scheduler.algorithm);
        simulatorRef.current.setApropiativo(scenario.scheduler.apropiativo);
        simulatorRef.current.setQuantum(scenario.scheduler.quantum);
        simulatorRef.current.setMemoryStrategy(scenario.memoryStrategy);
        // Create processes from scenario
        scenario.processes.forEach((pConfig)=>{
            simulatorRef.current.crearProceso(pConfig.tamanio, pConfig.burstTime, pConfig.prioridad, pConfig.maxInterrupciones, pConfig.porcentajeDatos, pConfig.porcentajeVariable);
        });
        setState(simulatorRef.current.getState());
        setRunning(false);
    };
    // Export logs
    const handleExportLogs = ()=>{
        if (state?.logs) {
            __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$scenario$2d$manager$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ScenarioManager"].exportLogs(state.logs);
        }
    };
    // Handle deadlock resolution
    const handleDeadlockResolve = (action, pid)=>{
        if (action === "cancel_process" && pid && simulatorRef.current) {
            simulatorRef.current.eliminarProceso(pid);
            setState({
                ...simulatorRef.current.getState()
            });
        }
        setDeadlockDetected(false);
    };
    if (!state) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4",
        children: "Inicializando..."
    }, void 0, false, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
        lineNumber: 175,
        columnNumber: 22
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full h-full bg-background text-foreground overflow-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sticky top-0 z-50 bg-card border-b border-border p-4 space-y-3 shadow-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-bold",
                                children: "Simulador de Procesos"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 182,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>setRunning(!running),
                                        variant: running ? "destructive" : "default",
                                        children: running ? "Pausar" : "Ejecutar"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 184,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>{
                                            if (simulatorRef.current) {
                                                simulatorRef.current.ejecutarTick();
                                                setState({
                                                    ...simulatorRef.current.getState()
                                                });
                                            }
                                        },
                                        variant: "outline",
                                        size: "sm",
                                        title: "Ejecutar un solo tick de simulación",
                                        disabled: running,
                                        children: "▶ Ejecutar 1 Tick"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 187,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>{
                                            simulatorRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$lib$2f$os$2d$simulator$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["OSSimulator"]();
                                            simulatorRef.current.generarProcesosIniciales(5);
                                            setState(simulatorRef.current.getState());
                                            setRunning(false);
                                        },
                                        variant: "outline",
                                        children: "Reiniciar"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 201,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: handleExportScenario,
                                        variant: "outline",
                                        size: "sm",
                                        title: "Exportar configuración actual",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                className: "h-4 w-4 mr-1"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                                lineNumber: 218,
                                                columnNumber: 15
                                            }, this),
                                            "Exportar"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 212,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: handleImportScenario,
                                        variant: "outline",
                                        size: "sm",
                                        title: "Importar configuración desde archivo",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"], {
                                                className: "h-4 w-4 mr-1"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                                lineNumber: 227,
                                                columnNumber: 15
                                            }, this),
                                            "Importar"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                        lineNumber: 221,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 183,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 181,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-medium",
                                children: "Velocidad:"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 234,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "range",
                                min: "0",
                                max: "190",
                                step: "5",
                                value: speed,
                                onChange: (e)=>setSpeed(Number(e.target.value)),
                                className: "w-48"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 235,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-muted-foreground w-20",
                                children: speed === 0 ? "Muy Lenta" : speed < 50 ? "Lenta" : speed < 100 ? "Media" : speed < 150 ? "Rápida" : "Muy Rápida"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 244,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 180,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-3 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lg:col-span-1",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$scheduler$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    state: state,
                                    simulator: simulatorRef.current,
                                    onStateChange: ()=>setState({
                                            ...simulatorRef.current.getState()
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 255,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lg:col-span-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$process$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    state: state,
                                    onCreate: crearProceso,
                                    onEdit: editarProceso,
                                    onDelete: eliminarProceso,
                                    simulator: simulatorRef.current
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 262,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 261,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 253,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$metrics$2d$dashboard$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            metrics: state.metrics
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 274,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 273,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$gantt$2d$chart$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            ganttChart: state.ganttChart,
                            procesos: state.procesos
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 279,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 278,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$memory$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                state: state,
                                simulator: simulatorRef.current
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 284,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$interrupts$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                state: state,
                                simulator: simulatorRef.current
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 285,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 283,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$devices$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            state: state
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 290,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 289,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$stats$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                state: state
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 295,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$logs$2d$panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                state: state,
                                simulator: simulatorRef.current
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 296,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 251,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dialog"], {
                open: keyboardModalOpen,
                onOpenChange: ()=>{},
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogContent"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                children: "Interrupción de Teclado"
                            }, void 0, false, {
                                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                lineNumber: 304,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 303,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "py-4",
                            children: "Un proceso ha solicitado entrada de teclado. ¿Desea continuar o cancelar la operación?"
                        }, void 0, false, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 306,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "destructive",
                                    onClick: ()=>handleKeyboardAction("cancelar"),
                                    children: "Cancelar"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 310,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: ()=>handleKeyboardAction("continuar"),
                                    children: "Continuar"
                                }, void 0, false, {
                                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                                    lineNumber: 313,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                            lineNumber: 309,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                    lineNumber: 302,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 301,
                columnNumber: 7
            }, this),
            state?.deadlockStatus && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$UNI$2f$Sistemas__Operativos$2f$Proyecto__Final$2f$Proyecto$2d$Sistemas$2d$Operativos$2f$components$2f$panels$2f$deadlock$2d$alert$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                deadlockInfo: state.deadlockStatus,
                onResolve: handleDeadlockResolve,
                onClose: ()=>setDeadlockDetected(false)
            }, void 0, false, {
                fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
                lineNumber: 322,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Desktop/UNI/Sistemas Operativos/Proyecto Final/Proyecto-Sistemas-Operativos/components/os-simulator.tsx",
        lineNumber: 178,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=3d860_UNI_Sistemas%20Operativos_Proyecto%20Final_Proyecto-Sistemas-Operativos_5206501b._.js.map