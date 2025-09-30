// script.js

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
// Las URLs solo se necesitan para la inicialización del Worker, pero las mantenemos aquí para claridad.
const sheetURLs = { 
    'Hoja 1': '...', 
    'BBDD PM 4': '...', 
};

// ... (Mapas, elementos DOM, y utilidades) ...

// Inicializa el Web Worker UNA SOLA VEZ
const dataWorker = new Worker('worker.js'); // Renombrado a dataWorker

// --- Funciones auxiliares para el Worker ---
const createWorkerPromise = (sheetName) => {
    return new Promise((resolve, reject) => {
        // Listener temporal para la respuesta específica de esta hoja
        const listener = (e) => {
            if (e.data.sheetName !== sheetName) return; // Ignora respuestas de otras hojas
            
            dataWorker.removeEventListener('message', listener); // Elimina el listener después de usarlo

            if (e.data.status === 'success') {
                resolve(e.data.data);
            } else {
                reject(new Error(`Fallo en ${sheetName}: ${e.data.message}`));
            }
        };

        dataWorker.addEventListener('message', listener);
        
        // Envía la petición al Worker
        dataWorker.postMessage({ sheetName });
    });
};


/**
 * Carga todas las bases de datos al iniciar. (Totalmente Asíncrona)
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos (Ejecución Asíncrona). Esto puede tardar...');

    try {
        // Carga y procesamiento de Hoja 1 y BBDD PM 4 en paralelo en el Worker
        const [equiposData, problemsData] = await Promise.all([
            createWorkerPromise('Hoja 1'),
            createWorkerPromise('BBDD PM 4')
        ]);

        equiposMap = equiposData;
        problemsMap = problemsData;

        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: Se descargó, pero no contiene registros válidos. Verifica encabezado "serie".');
        }

        // Éxito total
        displayMessage(`✅ Datos cargados con éxito. Equipos (${equiposMap.size} series), Problemas (${problemsMap.size} series).`);
        
    } catch (error) {
        // Fallo crítico
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}.`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
    } finally {
        if (equiposMap.size > 0) {
            validateButton.disabled = false;
            validateButton.textContent = 'Buscar Equipo';
        }
    }
};

// ... (El resto del código es el mismo) ...
