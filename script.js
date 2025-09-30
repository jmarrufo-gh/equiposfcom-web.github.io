// script.js (VERSIÓN FINAL CON PAPAPARSE)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // ASEGÚRATE DE QUE ESTAS URLs SON CORRECTAS
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

// --- Funciones de Utilidad de UI y Descarga ---

const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const displayMessage = (message, isError = false) => {
    resultDiv.innerHTML = `<div class="result-item ${isError ? 'error-message' : ''}">${message}</div>`;
    problemsContainer.innerHTML = '';
    problemsListTitle.style.display = 'none';
};

const showLoading = (show) => {
    validateButton.disabled = show;
    validateButton.textContent = show ? 'Cargando Datos...' : 'Buscar Equipo';
};

const fetchSheet = async (url, sheetName) => {
    const TIMEOUT_MS = 60000; // 60 segundos
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS); 
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}.`);
        }
        
        const text = await response.text();
        if (!text || text.length < 10) {
            throw new Error(`La hoja está vacía o no contiene datos válidos.`);
        }
        return text;
    } catch (error) {
        let errorMessage = error.message || 'Error desconocido.';
        if (error.name === 'AbortError') {
             errorMessage = `Tiempo de espera agotado (${TIMEOUT_MS/1000}s).`;
        }
        throw new Error(`Error de conexión (CORS o URL mal formada) al intentar cargar "${sheetName}". Error: ${errorMessage}`); 
    }
};

// --- Funciones de Búsqueda y Renderizado ---

const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};
const getProblemsBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return problemsMap.get(key) || [];
};

const renderEquipoDetails = (equipo, problemCount) => {
    // Se asume que PapaParse hace los encabezados minúsculas/sin espacios
    const tipo = equipo['tipo'] || equipo['Tipo'] || 'N/A';
    const modelo = equipo['modelo'] || equipo['Modelo'] || 'N/A';
    const proyecto = equipo['proyecto'] || equipo['Proyecto'] || 'N/A';
    const usuarioactual = equipo['usuario actual'] || equipo['Usuario Actual'] || 'N/A';
    const serie = equipo['serie'] || equipo['Serie'] || 'N/A'; 

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
        // Asumimos que los encabezados son 'nivel 2' o 'Nivel 2'
        const n2 = p['nivel 2'] || p['Nivel 2'] || 'SIN CLASIFICAR (N2)';
        const n2Clean = n2.trim().toUpperCase();
        acc[n2Clean] = (acc[n2Clean] || 0) + 1;
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

// --- Lógica Principal de Carga y Búsqueda ---

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
 * Carga y Parsea todas las bases de datos con PapaParse.
 */
const loadAllData = async () => {
    displayMessage('Cargando y analizando la base de datos de equipos e historial. Esto puede tardar unos segundos...');
    showLoading(true);

    try {
        // 1. DESCARGA SIMULTÁNEA
        const [csv1, csv2] = await Promise.all([
            fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1'),
            fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4')
        ]);
        
        // 2. PARSING con PapaParse
        const result1 = PapaParse.parse(csv1, { header: true, skipEmptyLines: true });
        const result2 = PapaParse.parse(csv2, { header: true, skipEmptyLines: true });

        // --- CONVERSIÓN DE DATOS (PapaParse suele mantener mayúsculas/minúsculas) ---
        
        // Hoja 1 (Buscamos 'serie' o 'Serie')
        equiposMap = new Map();
        result1.data.forEach(item => {
            const serieLimpia = sanitizeKey(item['serie'] || item['Serie']); 
            if (serieLimpia.length > 0) equiposMap.set(serieLimpia, item);
        });

        // BBDD PM 4 (Buscamos 'serie reportada' o 'Serie Reportada')
        problemsMap = new Map();
        result2.data.forEach(item => {
            const serieLimpia = sanitizeKey(item['serie reportada'] || item['Serie Reportada']);
            if (serieLimpia.length > 0) {
                if (!problemsMap.has(serieLimpia)) problemsMap.set(serieLimpia, []);
                problemsMap.get(serieLimpia).push(item);
            }
        });
        
        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: No se pudo procesar ningún registro válido.');
        }

        displayMessage(`✅ ÉXITO con PapaParse. Equipos (${equiposMap.size} series), Problemas (${problemsMap.size} series). Ingrese un número de serie.`);
        
    } catch (error) {
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. Verifica la Consola (F12) para más detalles.`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
    } finally {
        // Permitir búsqueda si Hoja 1 cargó
        if (equiposMap.size > 0) {
            validateButton.disabled = false;
            validateButton.textContent = 'Buscar Equipo';
        }
    }
};

// --- Inicialización ---

const initialize = () => {
    // Fallo de carga de PapaParse es un error crítico.
    if (typeof PapaParse === 'undefined') {
        displayMessage('Error Fatal: La librería PapaParse no se cargó. Verifica index.html.', true);
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


