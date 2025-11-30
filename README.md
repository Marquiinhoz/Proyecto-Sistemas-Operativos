# Proyecto de Sistemas Operativos – Simulador de Procesos

## Descripción

El **Simulador de Procesos** es un proyecto desarrollado para emular el comportamiento de un sistema operativo en cuanto a la **gestión de procesos, memoria y dispositivos de entrada/salida (E/S)**. Permite crear, ejecutar y administrar procesos, controlar la memoria mediante bloques segmentados, simular interrupciones y mostrar estadísticas en tiempo real.

El proyecto está diseñado con **arquitectura modular**, lo que facilita su mantenimiento y la extensión de funcionalidades, y está desarrollado principalmente con **JavaScript, TypeScript y CSS**.

---

## Funcionalidades

* **Gestión de Procesos:**

  * Administración de 5 estados de proceso: `new`, `ready`, `running`, `blocked`, `terminated`.
  * Scheduler configurable con políticas **FCFS, SJF, Round Robin y por prioridades**.
  * Módulo dispatcher para cambios de contexto y manejo de preemption.
  * Registro de errores y estadísticas de procesos.

* **Gestión de Memoria:**

  * Asignación de memoria a procesos completos antes de ejecutarse.
  * Soporte para **stack y heap**.
  * Estrategias de asignación: **FirstFit, BestFit, WorstFit**.
  * Sistema de memoria tipo **Buddy System**, bloques de 32KB a 2MB.
  * Visualización en tiempo real de memoria usada, bloques libres y ocupados.

* **Gestión de E/S:**

  * Simulación de dispositivos: teclado, disco, impresora, monitor y network.
  * Generación y manejo de interrupciones de forma aleatoria o manual.
  * Control del estado del proceso según la actividad de E/S.

* **Interfaz:**

  * Panel de procesos y logs en tiempo real.
  * Estadísticas de memoria, CPU y eventos.
  * Botones para **crear, editar y eliminar procesos**.

---

## Requisitos del Sistema

* Node.js v18 o superior
* npm o pnpm
* Navegador moderno (Chrome, Edge, Firefox) para la interfaz web

---

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/Marquiinhoz/Proyecto-Sistemas-Operativos.git
```

2. Ingresa al directorio del proyecto:

```bash
cd Proyecto-Sistemas-Operativos
```

3. Instala las dependencias:

```bash
npm install
# o si usas pnpm
pnpm install
```

4. Compila y ejecuta la aplicación en modo desarrollo:

```bash
npm run dev
# o
pnpm dev
```

5. Abre tu navegador y visita:

```
http://localhost:3000
```

---

## Uso del Simulador

* **Crear un proceso:**

  * Ingresar parámetros: tamaño del programa, porcentaje de datos y memoria variable, tiempo estimado de CPU (burst time).

* **Editar un proceso:**

  * Seleccionar el proceso en la lista y modificar sus parámetros.

* **Eliminar un proceso:**

  * Seleccionar el proceso y hacer clic en eliminar.

* **Visualización de estadísticas:**

  * Monitor en tiempo real de memoria usada, bloques libres/ocupados y estado de cada proceso.
  * Logs de interrupciones y eventos de E/S.

* **Simulación:**

  * Ejecuta los procesos secuencialmente o aleatoriamente.
  * Configura políticas de planificación desde la interfaz.

---

## Estructura del Proyecto

```
/app            # Archivos principales de la aplicación
/components     # Componentes reutilizables de la interfaz
/hooks          # Hooks personalizados de React/Next.js
/lib            # Librerías y utilidades
/public         # Recursos estáticos (imágenes, CSS)
/styles         # Archivos de estilo global y módulos CSS
```

---

## Contribuciones

Para contribuir al proyecto:

1. Haz un fork del repositorio.
2. Crea una rama con tu feature:

```bash
git checkout -b feature/nombre-feature
```

3. Realiza tus cambios y haz commit:

```bash
git commit -m "Descripción de los cambios"
```

4. Sube tu rama:

```bash
git push origin feature/nombre-feature
```

5. Abre un Pull Request en GitHub.

---

## Licencia

Este proyecto es **libre para uso académico**. Consulta con el equipo si deseas usarlo con fines comerciales.
