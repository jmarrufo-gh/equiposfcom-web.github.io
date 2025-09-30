// script.js (FINAL)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = { 
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv', 
};

// Mapas de datos globales
let equiposMap = new Map();
let problemsMap = new Map(); 

// Elementos del DOM
const serieInput = document.getElementById('serie-input');
const validateButton = document.getElementById('validate-button');
const resultDiv = document.getElementById('result');
const problemsContainer = document.getElementById('problems-container');
const problemsListTitle = document.getElementById('problems-list-title');

// Inicializa el Web Worker
let dataWorker = null; // Se inicializará en window.onload

// --- Funciones de Utilidad ---

// Estas utilidades son solo para la interfaz, el worker tiene sus propias copias
const sanitizeKey = (key) => { if (typeof key !== 'string') return ''; return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); };
const displayMessage = (message, isError = false) => {
    resultDiv.innerHTML = `<div class="result-item ${isError ? 'error-message' : ''}">${message}</div>`;
    problemsContainer.innerHTML = '';
    problemsListTitle.style.display = 'none';
};
const showLoading = (show) => {
    validateButton.disabled = show;
    validateButton.textContent = show ? 'Cargando Datos...' : 'Buscar Equipo';
};

// --- Lógica del Worker (Comunicación) ---

const createWorkerPromise = (sheetName) => {
    return new Promise((resolve, reject) => {
        // Listener que se ejecuta cuando el Worker responde
        const listener = (e) => {
            if (e.data.sheetName !== sheetName) return; 
            
            // MUY IMPORTANTE: Desconecta el listener para evitar conflictos
            dataWorker.removeEventListener('message', listener); 

            if (e.data.status === 'success') {
                resolve(e.data.data);
            } else {
                reject(new Error(`Fallo en ${sheetName}: ${e.data.message}`));
            }
        };

        dataWorker.addEventListener('message', listener);
        
        // Inicia la tarea en el Worker
        dataWorker.postMessage({ sheetName });
    });
};

// --- Lógica Principal ---

const getEquipoBySerie = (serie) => { /* ... */ }; // (El resto de funciones de búsqueda son las mismas)
const getProblemsBySerie = (serie) => { /* ... */ };
const renderEquipoDetails = (equipo, problemCount) => { /* ... */ };
const renderProblemsTable = (problems) => { /* ... */ };
const handleSearch = async () => { /* ... */ };


/**
 * Carga todas las bases de datos al iniciar. (Totalmente Asíncrona)
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos (Ejecución Asíncrona). Esto puede tardar...');

    try {
        // Carga y procesamiento de Hoja 1 y BBDD PM 4 en paralelo
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
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. Verifica la Consola (F12) para detalles.`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
    } finally {
        if (equiposMap.size > 0) {
            validateButton.disabled = false;
            validateButton.textContent = 'Buscar Equipo';
        }
    }
};

// --- Inicialización ---

const initialize = () => {
    // 1. Inicializa el Worker AHORA
    try {
        dataWorker = new Worker('worker.js');
    } catch(e) {
        displayMessage(`FATAL: No se pudo crear el Worker. Asegúrate que 'worker.js' existe y que estás usando Live Server.`, true);
        validateButton.textContent = 'Error FATAL';
        validateButton.disabled = true;
        console.error(e);
        return;
    }
    
    validateButton.textContent = 'Inicializando...';
    validateButton.disabled = true;

    validateButton.addEventListener('click', handleSearch);
    serieInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !validateButton.disabled) {
            handleSearch();
        }
    });

    console.log('[DIAGNÓSTICO] Iniciando la aplicación...');
    loadAllData();
};

window.onload = initialize;

