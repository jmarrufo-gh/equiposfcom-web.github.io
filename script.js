// script.js (VERSION FINAL DE INTERFAZ)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS (Solo para referencia) ---
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
let dataWorker = null; 

// --- Funciones de Utilidad de la UI ---
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
        const listener = (e) => {
            if (e.data.sheetName !== sheetName) return; 
            
            dataWorker.removeEventListener('message', listener); 

            if (e.data.status === 'success') {
                resolve(e.data.data);
            } else {
                reject(new Error(e.data.message));
            }
        };

        dataWorker.addEventListener('message', listener);
        dataWorker.postMessage({ sheetName });
    });
};

// --- Funciones de Búsqueda y Renderizado (Se mantienen iguales) ---
const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};
const getProblemsBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return problemsMap.get(key) || [];
};
const renderEquipoDetails = (equipo, problemCount) => {
    const tipo = equipo['tipo'] || 'N/A';
    const modelo = equipo['modelo'] || 'N/A';
    const proyecto = equipo['proyecto'] || 'N/A';
    const usuarioactual = equipo['usuario actual'] || 'N/A';
    const serie = equipo['serie'] || 'N/A'; 

    const html = `
        <div class="result-item main-serie">
            <strong>NÚMERO DE SERIE CONSULTADO</strong>
            <span>${serie}</span>
        </div>
        <div class="result-item highlight"><strong>Tipo:</strong> <span>${tipo}</span></div>
        <div class="result-item highlight"><strong>Modelo:</strong> <span>${modelo}</span></div>
        <div class="result-item"><strong>Proyecto:</strong> <span>${proyecto}</span></div>
        <div class="result-item"><strong>Usuario Asignado:</strong> <span>${usuarioactual}</span></div>
        <div class="result-item total-incidents">
            <strong>REGISTROS DE PROBLEMAS (BBDD PM 4):</strong>
            <span>${problemCount}</span>
        </div>
    `;
    resultDiv.innerHTML = html;
};

const renderProblemsTable = (problems) => {
    if (problems.length === 0) {
        problemsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color-medium); padding: 30px;">No se encontró historial de problemas para este equipo.</div>';
        problemsListTitle.style.display = 'none';
        return;
    }
    
    problemsListTitle.style.display = 'block';

    const problemCounts = problems.reduce((acc, p) => {
        const n2 = p['nivel 2'] && p['nivel 2'].trim() !== '' ? p['nivel 2'].trim().toUpperCase() : 'SIN CLASIFICAR (N2)';
        acc[n2] = (acc[n2] || 0) + 1;
        return acc;
    }, {});

    let tableHtml = '<table class="count-table">';
    tableHtml += '<thead><tr><th>Tipo de Problema (Nivel 2)</th><th>Conteo</th></tr></thead>';
    tableHtml += '<tbody>';

    const sortedCounts = Object.entries(problemCounts).sort(([, a], [, b]) => b - a);
    
    sortedCounts.forEach(([n2, count]) => {
        tableHtml += `<tr><td>${n2}</td><td>${count}</td></tr>`;
    });

    tableHtml += '</tbody></table>';
    problemsContainer.innerHTML = tableHtml;
};


// --- Lógica Principal de Búsqueda ---

const handleSearch = async () => {
    const serie = serieInput.value.trim();

    if (serie.length < 5) {
        displayMessage('Por favor, ingresa un número de serie válido (mínimo 5 caracteres).', true);
        return;
    }

    showLoading(true);
    displayMessage('<div style="text-align:center;">Realizando búsqueda en bases de datos...</div>');

    try {
        const equipo = getEquipoBySerie(serie);
        if (!equipo) {
            displayMessage(`⚠️ Serie "${serie}" no encontrada en la Base de Equipos (Hoja 1). Verifica que la serie exista.`, true);
            return;
        }

        const problems = getProblemsBySerie(serie);
        
        renderEquipoDetails(equipo, problems.length);
        renderProblemsTable(problems);

    } catch (error) {
        console.error("Error al realizar la consulta:", error);
        displayMessage(`Error al realizar la consulta: ${error.message}. Revisa la consola para más detalles.`, true);
    } finally {
        showLoading(false);
    }
};

/**
 * Carga todas las bases de datos al iniciar. (Totalmente Asíncrona)
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos (Ejecución Asíncrona). Esto puede tardar...');

    try {
        // --- PRUEBA DE AISLAMIENTO: Carga solo Hoja 1 ---
        const [equiposData] = await Promise.all([
            createWorkerPromise('Hoja 1'),
            // createWorkerPromise('BBDD PM 4') // COMENTADA: Descomenta si la Hoja 1 carga bien
        ]);

        equiposMap = equiposData;
        // Dejamos problemsMap vacío para la prueba
        problemsMap = new Map(); 

        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: Se descargó, pero no contiene registros válidos. Verifica encabezado "serie".');
        }

        // Éxito parcial para la prueba
        displayMessage(`✅ Datos cargados con éxito. EQUIPOS (${equiposMap.size} series). Problemas OMITIDOS. Ingresa una serie para probar.`);
        
    } catch (error) {
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. **VERIFICA:** URLs de Google Sheets y Consola (F12).`, true);
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
    try {
        // RUTA ABSOLUTA: Se utiliza para evitar problemas de ruta en servidores (como GitHub Pages)
        // Si tu proyecto está en la raíz, usa '/worker.js'.
        dataWorker = new Worker('/worker.js'); 
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

    loadAllData();
};

window.onload = initialize;
