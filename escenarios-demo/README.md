# ESCENARIOS DE DEMOSTRACIÓN
**Simulador de Procesos - Sistema Operativo**

Esta carpeta contiene **7 escenarios predefinidos** listos para importar y demostrar diferentes aspectos del simulador.

---

## 📁 LISTA DE ESCENARIOS

### 1️⃣ **01-fragmentacion-alta.json**
**Propósito**: Demostrar fragmentación de memoria  
**Configuración**:
- Scheduler: Round Robin (quantum=2)
- Memoria: WorstFit ⚠️
- Procesos: 6 de tamaños variables (32KB - 512KB)

**Qué observar**:
- Alta fragmentación externa
- Contador de "Rechazos por fragmentación" incrementa
- Huecos rojos pulsantes (<32KB)
- Necesidad de compactación

---

### 2️⃣ **02-deadlock.json**
**Propósito**: Provocar deadlock  
**Configuración**:
- Scheduler: Round Robin (quantum=3)
- Memoria: FirstFit
- Procesos: 3 procesos grandes que compiten por recursos

**Qué observar**:
- Simulación se pausa automáticamente
- Modal de "Deadlock Detectado" aparece
- Ciclo de dependencias mostrado
- Opción de cancelar proceso o ignorar

---

### 3️⃣ 4️⃣ 5️⃣ **Comparativa de Estrategias**
**Archivos**:
- `03-comparativa-firstfit.json`
- `04-comparativa-bestfit.json`
- `05-comparativa-worstfit.json`

**Propósito**: Comparar las 3 estrategias de asignación  
**Configuración**:
- **MISMOS procesos** en los 3 archivos
- Solo cambia la estrategia de memoria

**Cómo usar**:
1. Importa FirstFit → Ejecuta → Anota métricas de fragmentación
2. Reinicia → Importa BestFit → Ejecuta → Compara
3. Reinicia → Importa WorstFit → Ejecuta → Compara

**Qué observar**:
- Fragmentación interna/externa diferente
- Rechazos por fragmentación
- Eficiencia de uso de memoria

---

### 6️⃣ **06-scheduler-prioridades.json**
**Propósito**: Demostrar scheduling por prioridades  
**Configuración**:
- Scheduler: Prioridades (apropiativo)
- Procesos: 5 con prioridades variadas (0=alta, 3=baja)

**Qué observar**:
- Procesos de alta prioridad ejecutan primero
- Preemption cuando llega proceso más prioritario
- Aging implementado (previene starvation)

---

### 7️⃣ **07-scheduler-sjf.json**
**Propósito**: Demostrar Shortest Job First  
**Configuración**:
- Scheduler: SJF (NO apropiativo)
- Procesos: Burst times variables (5-18 ticks)

**Qué observar**:
- Procesos cortos ejecutan primero
- Minimiza tiempo de espera promedio
- Puede causar starvation en procesos largos

---

## 🎯 CÓMO USAR

### Durante la Presentación:

1. **Abrir el simulador** en http://localhost:3000

2. **Click en "Importar"** (botón con icono ⬆️)

3. **Seleccionar archivo JSON** de esta carpeta

4. **Click "Ejecutar"** para iniciar la simulación

5. **Pausar** cuando quieras explicar algo

6. **Observar** las métricas y visualizaciones

7. **Reiniciar** y cargar otro escenario

---

## 💡 CASOS DE USO SUGERIDOS

### Presentación General
```
1. Importar 01-fragmentacion-alta.json
   → Explicar cómo funciona el Buddy System
   → Mostrar compactación

2. Importar 06-scheduler-prioridades.json
   → Explicar Round Robin vs Prioridades
   → Mostrar aging

3. Importar 02-deadlock.json
   → Explicar deadlock detection
   → Resolver deadlock
```

### Demo Específica de Memoria
```
1. Importar 03-comparativa-firstfit.json
   → Ejecutar completamente
   → Capturar métricas de fragmentación

2. Reiniciar → Importar 04-comparativa-bestfit.json
   → Ejecutar completamente
   → Comparar fragmentación (debería ser menor)

3. Reiniciar → Importar 05-comparativa-worstfit.json
   → Ejecutar completamente
   → Mostrar que tiene más fragmentación
```

---

## 📊 MÉTRICAS A DESTACAR

En cada demo, señala:

1. **Panel de Memoria**:
   - Fragmentación externa/interna
   - Huecos dispersos
   - Rechazos por fragmentación ⭐

2. **Dashboard de Métricas**:
   - Tiempo de espera promedio
   - Throughput
   - CPU Utilization

3. **Diagrama de Gantt**:
   - Cambios de contexto
   - Tiempos de idle

4. **Diagrama de Estados**:
   - Transiciones de procesos
   - PIDs en cada estado

---

## ✏️ PERSONALIZAR ESCENARIOS

Puedes editar los JSON manualmente:

```json
{
  "scheduler": {
    "algorithm": "FCFS" | "SJF" | "RoundRobin" | "Prioridades",
    "apropiativo": true | false,
    "quantum": 1-10
  },
  "memoryStrategy": "FirstFit" | "BestFit" | "WorstFit",
  "processes": [
    {
      "tamanio": 32768-524288,     // Potencia de 2
      "burstTime": 5-20,
      "prioridad": 0-3,
      "maxInterrupciones": 5-20,
      "porcentajeDatos": 10-40,
      "porcentajeVariable": 5-25
    }
  ]
}
```

---

**Creado**: Noviembre 2025  
**Versión**: 1.0  
**Proyecto**: Simulador de Sistema Operativo
