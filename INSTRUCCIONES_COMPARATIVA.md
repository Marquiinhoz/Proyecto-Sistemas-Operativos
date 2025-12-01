# 📊 Documentación del Botón "Comparativa"

## 🎯 Descripción General

El botón **Comparativa** permite ejecutar una comparación automática de las tres estrategias de asignación de memoria (FirstFit, BestFit, WorstFit) utilizando la configuración actual del simulador. Al hacer clic, se ejecutan 3 simulaciones independientes con la misma configuración inicial y se muestran métricas comparativas.

---

## 📁 Archivos Necesarios

### 1. **`lib/comparison-util.ts`** (NUEVO)
Este archivo contiene la lógica principal de comparación.

```typescript
import { OSSimulator } from "./os-simulator";
import type { OSState } from "./types";

export interface StrategyMetrics {
    strategy: "FirstFit" | "BestFit" | "WorstFit";
    fragExternal: number; // %
    fragInterna: number; // %
    huecos: number;
    rechazos: number;
    utilizacion: number; // %
    avgTurnaroundTime: number;
    avgWaitingTime: number;
    completedProcesses: number;
    totalTicks: number;
}

export interface ComparisonResult {
    strategies: StrategyMetrics[];
    bestPerformance: "FirstFit" | "BestFit" | "WorstFit";
    bestOptimization: "FirstFit" | "BestFit" | "WorstFit";
}

/**
 * Run 3 simulations with different memory strategies
 * using the same initial configuration
 */
export function runStrategyComparison(
    currentState: OSState,
    maxTicks: number = 200
): ComparisonResult {
    const strategies: ("FirstFit" | "BestFit" | "WorstFit")[] = [
        "FirstFit",
        "BestFit",
        "WorstFit"
    ];

    const results: StrategyMetrics[] = strategies.map(strategy => {
        // Create new simulator
        const simulator = new OSSimulator();

        // Configure scheduler
        simulator.setScheduler(currentState.scheduler);
        simulator.setApropiativo(currentState.apropiativo);
        simulator.setQuantum(currentState.quantum);

        // Set memory strategy
        simulator.setMemoryStrategy(strategy);

        // Create same processes as current state (only non-terminated)
        const activeProcesses = currentState.procesos.filter(p => p.estado !== 'terminated');
        activeProcesses.forEach(p => {
            simulator.crearProceso(
                p.tamanio,
                p.burstTime,
                p.prioridad,
                p.maxInterrupciones,
                p.porcentajeDatos,
                p.porcentajeVariable
            );
        });

        // Run simulation and track metrics during execution
        let ticksExecuted = 0;
        let maxOccupiedMemory = 0;
        let totalFragExternal = 0;
        let totalFragInternal = 0;
        let fragmentationSamples = 0;

        for (let i = 0; i < maxTicks; i++) {
            simulator.ejecutarTick();
            ticksExecuted++;

            // Collect metrics during execution
            const state = simulator.getState();
            const currentOccupied = state.memoria
                .filter(b => b.ocupado)
                .reduce((sum, b) => sum + b.tamanio, 0);

            maxOccupiedMemory = Math.max(maxOccupiedMemory, currentOccupied);

            // Sample fragmentation (only when there are active processes)
            if (state.procesos.filter(p => p.estado !== 'terminated').length > 0) {
                totalFragExternal += state.fragmentation.external;
                totalFragInternal += state.fragmentation.internal;
                fragmentationSamples++;
            }

            // Stop if all processes completed
            if (state.colaTerminated.length >= activeProcesses.length && activeProcesses.length > 0) {
                break;
            }
        }

        // Collect final metrics
        const finalState = simulator.getState();
        const totalMemory = 2 * 1024 * 1024; // 2MB

        // Use average fragmentation instead of final state
        const avgFragExternal = fragmentationSamples > 0 ? totalFragExternal / fragmentationSamples : finalState.fragmentation.external;
        const avgFragInternal = fragmentationSamples > 0 ? totalFragInternal / fragmentationSamples : finalState.fragmentation.internal;

        return {
            strategy,
            fragExternal: totalMemory > 0 ? (avgFragExternal / totalMemory) * 100 : 0,
            fragInterna: totalMemory > 0 ? (avgFragInternal / totalMemory) * 100 : 0,
            huecos: finalState.fragmentation.externalHoles,
            rechazos: finalState.fragmentation.rechazosFragmentacion,
            utilizacion: totalMemory > 0 ? (maxOccupiedMemory / totalMemory) * 100 : 0,
            avgTurnaroundTime: finalState.metrics.avgTurnaroundTime,
            avgWaitingTime: finalState.metrics.avgWaitingTime,
            completedProcesses: finalState.metrics.completedProcesses,
            totalTicks: ticksExecuted
        };
    });

    // Determine best strategy for performance (lower turnaround time is better)
    const bestPerformance = results.reduce((best, curr) => {
        // If no processes completed, can't determine
        if (curr.completedProcesses === 0 && best.completedProcesses === 0) return best;
        if (curr.completedProcesses === 0) return best;
        if (best.completedProcesses === 0) return curr;

        return curr.avgTurnaroundTime < best.avgTurnaroundTime ? curr : best;
    }).strategy;

    // Determine best strategy for optimization (lower total fragmentation is better)
    const bestOptimization = results.reduce((best, curr) => {
        const currFrag = curr.fragExternal + curr.fragInterna;
        const bestFrag = best.fragExternal + best.fragInterna;
        return currFrag < bestFrag ? curr : best;
    }).strategy;

    return {
        strategies: results,
        bestPerformance,
        bestOptimization
    };
}
```

---

### 2. **`components/panels/strategy-comparison.tsx`** (NUEVO)
Este archivo contiene el componente React que muestra el modal de comparación.

**Ver el archivo completo:** `components/panels/strategy-comparison.tsx`

**Características principales:**
- Muestra un loading state mientras ejecuta las simulaciones
- Despliega una tabla comparativa con todas las métricas
- Identifica automáticamente la mejor estrategia en cada categoría
- Muestra gráficos de barras para fragmentación y utilización
- Presenta conclusiones basadas en los resultados

---

## 🔧 Modificaciones en `components/os-simulator.tsx`

### 1. Agregar import (línea ~17):
```typescript
import StrategyComparison from "./panels/strategy-comparison"
```

### 2. Agregar estados (después de línea 28):
```typescript
const [comparisonModalOpen, setComparisonModalOpen] = useState(false)
const [resetModalOpen, setResetModalOpen] = useState(false)
const [processCount, setProcessCount] = useState(5)
```

### 3. Cambiar el botón "Reiniciar" (línea ~206-216):
```typescript
<Button
  onClick={() => setResetModalOpen(true)}
  variant="outline"
>
  Reiniciar
</Button>
```

### 4. Agregar el botón "Comparativa" (después del botón Import, línea ~229):
```typescript
<Button
  onClick={() => setComparisonModalOpen(true)}
  variant="outline"
  size="sm"
  title="Ver comparativa de estrategias de memoria"
  className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500"
>
  📊 Comparativa
</Button>
```

### 5. Agregar el modal de Reset (antes del cierre final, ~línea 343):
```typescript
{/* Reset Modal */}
<Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Reiniciar Simulación</DialogTitle>
    </DialogHeader>
    <div className="py-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Esto reiniciará el simulador y generará procesos aleatorios.
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          ¿Cuántos procesos desea generar?
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={processCount}
          onChange={(e) => setProcessCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
          className="w-full px-3 py-2 border rounded-md"
        />
        <p className="text-xs text-muted-foreground">
          Rango: 1-20 procesos
        </p>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setResetModalOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={() => {
        simulatorRef.current = new OSSimulator()
        simulatorRef.current.generarProcesosIniciales(processCount)
        setState(simulatorRef.current.getState())
        setRunning(false)
        setResetModalOpen(false)
      }}>
        Reiniciar con {processCount} proceso{processCount !== 1 ? 's' : ''}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 6. Agregar el modal de Comparativa (después del modal Reset, ~línea 387):
```typescript
{/* Strategy Comparison Modal */}
<StrategyComparison 
  open={comparisonModalOpen}
  onClose={() => setComparisonModalOpen(false)}
  currentState={state}
/>
```

---

## 🧠 Lógica del Funcionamiento

### Flujo de Ejecución:

1. **Usuario hace clic en "📊 Comparativa"**
   - Se abre el modal `StrategyComparison`
   - El estado `comparisonModalOpen` se establece en `true`

2. **El componente ejecuta automáticamente**
   - Se detecta que el modal está abierto con `useEffect`
   - Se ejecuta `runStrategyComparison(currentState, 200)`
   - Muestra un loading spinner mientras procesa

3. **`runStrategyComparison` hace lo siguiente:**
   - Crea 3 simuladores independientes (uno por estrategia)
   - Configura cada uno con la misma configuración de scheduler
   - Copia los procesos activos del estado actual
   - Ejecuta cada simulador por hasta 200 ticks
   - Recolecta métricas durante la ejecución:
     - Fragmentación externa e interna (promedio)
     - Utilización de memoria (máximo alcanzado)
     - Tiempos de turnaround y espera
     - Procesos completados
     - Rechazos por fragmentación
   - Determina la mejor estrategia para:
     - **Performance**: menor tiempo de turnaround
     - **Optimización**: menor fragmentación total

4. **Muestra los resultados**
   - Tabla comparativa con todas las métricas
   - Marcadores "✓ Mejor" en las métricas ganadoras
   - Gráficos de barras para visualización
   - Conclusiones automáticas

---

## 📊 Métricas Calculadas

| Métrica | Descripción | Fórmula |
|---------|-------------|---------|
| **Fragmentación Externa** | Memoria libre pero no utilizable | `(avgFragExternal / totalMemory) * 100` |
| **Fragmentación Interna** | Memoria asignada pero no usada | `(avgFragInternal / totalMemory) * 100` |
| **Huecos Dispersos** | Cantidad de bloques libres separados | `finalState.fragmentation.externalHoles` |
| **Rechazos** | Procesos rechazados por fragmentación | `finalState.fragmentation.rechazosFragmentacion` |
| **Utilización** | Máximo de memoria ocupada | `(maxOccupiedMemory / totalMemory) * 100` |
| **Turnaround** | Tiempo promedio desde llegada hasta finalización | `finalState.metrics.avgTurnaroundTime` |
| **Espera** | Tiempo promedio en estado ready | `finalState.metrics.avgWaitingTime` |

---

## ✅ Checklist de Implementación

- [ ] Crear archivo `lib/comparison-util.ts`
- [ ] Crear archivo `components/panels/strategy-comparison.tsx`
- [ ] Agregar import en `os-simulator.tsx`
- [ ] Agregar estados en `os-simulator.tsx`
- [ ] Modificar botón Reiniciar
- [ ] Agregar botón Comparativa
- [ ] Agregar modal Reset
- [ ] Agregar modal Comparativa
- [ ] Verificar que el simulador tenga el método `setMemoryStrategy()`
- [ ] Probar con diferentes configuraciones

---

## 🎨 Estilo del Botón

El botón tiene un estilo especial con gradiente verde-azul:
```typescript
className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500"
```

---

## 🔍 Notas Importantes

1. **Dependencias del simulador**: El simulador debe tener implementados:
   - `setScheduler()`
   - `setApropiativo()`
   - `setQuantum()`
   - `setMemoryStrategy()`
   - `crearProceso()`
   - `ejecutarTick()`
   - `getState()`

2. **Performance**: La comparación ejecuta 3 simulaciones completas, lo que puede tardar unos segundos. Por eso se usa `setTimeout` para no bloquear la UI.

3. **Métricas promedio**: La fragmentación se calcula como promedio durante toda la ejecución, no solo al final, para obtener resultados más representativos.

4. **Simulaciones independientes**: Cada estrategia ejecuta su propia simulación completamente independiente, garantizando resultados justos.

---

## 🚀 Ejemplo de Uso

```typescript
// El usuario hace clic en "📊 Comparativa"
onClick={() => setComparisonModalOpen(true)}

// Se abre el modal y ejecuta automáticamente:
const result = runStrategyComparison(currentState, 200);

// Resultado:
{
  strategies: [
    { strategy: "FirstFit", fragExternal: 5.2, fragInterna: 2.1, ... },
    { strategy: "BestFit", fragExternal: 3.8, fragInterna: 2.5, ... },
    { strategy: "WorstFit", fragExternal: 6.1, fragInterna: 1.9, ... }
  ],
  bestPerformance: "BestFit",
  bestOptimization: "BestFit"
}
```

---

**¡Listo!** Con esta documentación tu colaborador debería poder implementar la funcionalidad completa del botón Comparativa. 🎉
