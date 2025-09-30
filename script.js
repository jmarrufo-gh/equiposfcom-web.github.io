// script.js (SOLO LAS SECCIONES MODIFICADAS)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // Hoja 1 sigue aquí para la carga directa en el hilo principal
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    // La BBDD PM 4 no es necesaria aquí, pero se deja para referencia
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// Mapas de datos globales
let equiposMap = new Map();
let problemsMap = new Map(); 

// Inicializa el Web Worker
const problemWorker = new Worker('worker.js'); // <-- Nuevo
let workerLoadPromise = null; // Para manejar la promesa de carga del worker

// --- Funciones de Utilidad (MANTENEMOS SOLO displayMessage y showLoading) ---
// *************************************************************
// * ELIMINA LAS FUNCIONES sanitizeKey, fetchSheet, loadSheetData *
// * MÁNTENLAS EN worker.js, PERO QUÍTALAS DE AQUÍ.             *
// *************************************************************


// --- Función fetchSheet y loadSheetData simplificadas para Hoja 1 ---
// Usaremos una versión simplificada de fetch y load SOLO para Hoja 1.
const sanitizeKey = (key) => { /* ... */ }; // Copia la función de worker.js
const fetchSheet = async (url, sheetName) => { /* ... */ }; // Copia la función de worker.js
const loadSheetData = (csvText, sheetName) => { /* ... */ }; // Copia la función de worker.js


/**
 * Carga todas las bases de datos al iniciar.
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos de equipos e historial. Esto puede tardar...');

    try {
        // 1. Carga Hoja 1 (Equipos Base) - Carga rápida
        const csv1 = await fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1');
        const data1 = loadSheetData(csv1, 'Hoja 1');
        equiposMap = data1.data;
        
        if (equiposMap.size === 0) {
             throw new Error('Hoja 1: No se pudo procesar ningún registro válido.');
        }

        // 2. Carga BBDD PM 4 (Historial de Problemas) - USANDO WEB WORKER
        const workerPromise = new Promise((resolve, reject) => {
            problemWorker.onmessage = (e) => {
                if (e.data.status === 'success') {
                    problemsMap = e.data.data;
                    resolve(e.data.data.size);
                } else {
                    reject(new Error(`Fallo de Worker: ${e.data.message}`));
                }
            };
            problemWorker.onerror = (e) => {
                reject(new Error(`Error de Worker no manejado: ${e.message}`));
            };
            
            // Inicia la tarea en el Worker
            problemWorker.postMessage({ sheetName: 'BBDD PM 4' });
        });
        
        const problemsCount = await workerPromise;

        // Éxito total
        displayMessage(`✅ Datos cargados con éxito. Equipos (${equiposMap.size} series), Problemas (${problemsCount} series).`);
        
    } catch (error) {
        // Maneja cualquier fallo (Hoja 1 o Worker)
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. **Intenta nuevamente.**`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
    } finally {
        if (equiposMap.size > 0) {
            validateButton.disabled = false;
            validateButton.textContent = 'Buscar Equipo';
        }
    }
};

// ... (El resto del código de inicialización: initialize, window.onload, etc. es el mismo) ...
