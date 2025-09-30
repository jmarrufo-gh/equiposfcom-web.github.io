// script.js (VERSIÓN FINAL Y COMPLETA - SIN PAPAPARSE - CRUCE DE DATOS EN BUSCAR)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // URL DE HOJA 1 (CORRECTA CSV)
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    
    // URL DE BBDD PM 4 (CORREGIDA CSV)
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// Mapas de datos globales (Solo Hoja 1 se carga al inicio)
let equiposMap = new Map();

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

const showLoading = (show, message = 'Cargando Datos...') => {
    validateButton.disabled = show;
    validateButton.textContent = show ? message : 'Buscar Equipo';
};

const fetchSheet = async (url, sheetName) => {
    const TIMEOUT_MS = 60000; 
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
        throw new Error(`Error de conexión (CORS o URL mal formada) al intentar cargar "${sheetName}". ${errorMessage}.`); 
    }
};

/**
 * Función manual para parsear CSV (Sin PapaParse).
 * Asume el delimitador por defecto (coma) si no se especifica.
 */
const parseCSV = (csvText) => {
    // *** CLAVE DE CORRECCIÓN: USAR EL DELIMITADOR DE COMA POR DEFECTO ***
    // Si la hoja contiene comas en las celdas, este es el punto de error.
    const DELIMITER = ','; 
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { data: [], headers: [] };

    const headers = lines[0].split(DELIMITER).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // Intentamos un split simple, lo que puede fallar con celdas que contienen comas.
        const values = lines[i].split(DELIMITER); 
        
        // La validación simple de longitud puede descartar filas rotas por comas internas
        if (values.length !== headers.length) continue; 

        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index].trim(); 
        });
        data.push(obj);
    }
    return { data, headers };
};


// --- Lógica de Procesamiento y Cruce ---

const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};


const getProblemsBySerieAndCount = (serie, problemsData, serieHeader, nivelHeader) => {
    const problemCounts = new Map();
    let totalProblems = 0;

    for (const item of problemsData) {
        // Cruce: Hoja 1 (serie saneada) vs BBDD PM 4 (columna SERIE REPORTADA)
        const reportedSerie = sanitizeKey(item[serieHeader]);

        if (reportedSerie === serie) {
            totalProblems++;
            const nivel2 = item[nivelHeader] ? item[nivelHeader].trim() : 'SIN NIVEL 2';

            if (problemCounts.has(nivel2)) {
                problemCounts.set(nivel2, problemCounts.get(nivel2) + 1);
            } else {
                problemCounts.set(nivel2, 1);
            }
        }
    }
    return { problemCounts, totalProblems };
};


// --- Funciones de Renderizado ---

const renderEquipoDetails = (equipo, totalProblems) => {
    // Usamos nombres de columna flexibles para CSV
    const tipo = equipo['Tipo'] || equipo['tipo'] || 'N/A';
    const modelo = equipo['Modelo'] || equipo['modelo'] || 'N/A';
    const proyecto = equipo['Proyecto'] || equipo['proyecto'] || 'N/A';
    const usuarioactual = equipo['Usuario Actual'] || equipo['usuario actual'] || 'N/A';
    const serie = equipo['Serie'] || equipo['serie'] || 'N/A'; 

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
            <span style="color: ${totalProblems > 0 ? 'var(--primary-color)' : 'var(--text-color-medium)'}; font-weight: bold;">${totalProblems} Registro(s)</span>
        </div>
    `;
    resultDiv.innerHTML = html;
};

const renderProblemsTable = (problemCounts, totalProblems) => {
    problemsListTitle.style.display = 'block';

    if (totalProblems === 0) {
        problemsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color-medium); padding: 15px;">No se encontraron registros de problemas para esta serie.</div>';
        return;
    }

    let tableHtml = `<table class="count-table">
                        <thead>
                            <tr>
                                <th>NIVEL 2 (Tipo de Problema)</th>
                                <th>Recuento</th>
                            </tr>
                        </thead>
                        <tbody>`;

    // Ordenar los problemas por recuento (descendente)
    const sortedCounts = [...problemCounts.entries()].sort((a, b) => b[1] - a[1]);

    for (const [nivel, count] of sortedCounts) {
        tableHtml += `<tr><td>${nivel}</td><td>${count}</td></tr>`;
    }

    tableHtml += `</tbody></table>`;
    problemsContainer.innerHTML = tableHtml;
};


// --- Lógica Principal de Carga y Búsqueda ---

/**
 * Carga solo la Hoja 1 al inicio para inicializar equiposMap.
 */
const loadInitialData = async () => {
    displayMessage('Cargando y analizando Hoja 1 (Base de Equipos).');
    showLoading(true, 'Cargando Estructura...');

    try {
        const csv1 = await fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1');
        const result1 = parseCSV(csv1); 
        
        equiposMap = new Map();
        
        // Lógica Súper-Flexible para encontrar el encabezado de serie en Hoja 1
        const headers = result1.headers || [];
        const serieHeader = headers.find(h => h.toLowerCase().includes('serie') || h.toLowerCase().includes('serial'));

        if (!serieHeader) {
            throw new Error('Hoja 1: No se encontró la columna de serie. Revisa que el encabezado contenga "serie" o "serial".');
        }

        result1.data.forEach(item => {
            const serieLimpia = sanitizeKey(item[serieHeader]); 
            if (serieLimpia.length > 0) equiposMap.set(serieLimpia, item);
        });
        
        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: No se pudo procesar ningún registro válido.');
        }

        displayMessage(`✅ ÉXITO. Datos de EQUIPOS cargados (${equiposMap.size} series). Ingresa una serie para buscar.`);
        
    } catch (error) {
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos iniciales:', error);
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


/**
 * Maneja la búsqueda, descargando y procesando la BBDD PM 4 dinámicamente.
 */
const handleSearch = async () => {
    const serie = serieInput.value.trim();
    if (serie.length < 5) {
        displayMessage('Por favor, ingresa un número de serie válido (mínimo 5 caracteres).', true);
        return;
    }
    
    // 1. Obtener datos de Hoja 1 (Ya cargados)
    const equipo = getEquipoBySerie(serie);
    if (!equipo) {
        displayMessage(`⚠️ Serie "${serie}" no encontrada en la Base de Equipos (Hoja 1). Verifica la serie.`, true);
        return;
    }
    
    // 2. Iniciar búsqueda de BBDD PM 4
    showLoading(true, 'Cargando BBDD de Problemas... (Puede tardar/congelarse)');
    
    try {
        // --- PROCESO DINÁMICO DE BBDD PM 4 ---
        
        // a) Descarga (Punto de posible CORS/Red)
        const csv2 = await fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4');
        
        // b) Parseo (Punto de posible Congelamiento/Stack Overflow si es muy grande)
        const result2 = parseCSV(csv2);
        
        // c) Definición de encabezados de BBDD PM 4
        const headers2 = result2.headers || [];
        // CRUCE: Hoja 1 -> BBDD PM 4 ("SERIE REPORTADA")
        const pmSerieHeader = headers2.find(h => h.toLowerCase().includes('serie reportada')); 
        // GRÁFICO: BBDD PM 4 ("NIVEL 2")
        const pmNivel2Header = headers2.find(h => h.toLowerCase().includes('nivel 2')); 

        if (!pmSerieHeader || !pmNivel2Header) {
             throw new Error('BBDD PM 4: Faltan las columnas "SERIE REPORTADA" o "NIVEL 2".');
        }

        // d) Cruce y Conteo
        const saneadoSerie = sanitizeKey(serie);
        const { problemCounts, totalProblems } = getProblemsBySerieAndCount(
            saneadoSerie, 
            result2.data, 
            pmSerieHeader, 
            pmNivel2Header
        );

        // 3. Renderizar Resultados
        renderEquipoDetails(equipo, totalProblems);
        renderProblemsTable(problemCounts, totalProblems);

    } catch (error) {
        console.error("Error al buscar en BBDD PM 4:", error);
        // Mostrar Hoja 1, pero reportar fallo de BBDD PM 4
        renderEquipoDetails(equipo, 0); 
        problemsContainer.innerHTML = `<div class="error-message">⚠️ Error al cargar la BBDD PM 4: ${error.message}. La Hoja 1 se cargó correctamente.</div>`;
        problemsListTitle.style.display = 'block';
    } finally {
        showLoading(false);
    }
};

// --- Inicialización ---

const initialize = () => {
    validateButton.textContent = 'Inicializando...';
    validateButton.disabled = true;

    validateButton.addEventListener('click', handleSearch);
    serieInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !validateButton.disabled) {
            handleSearch();
        }
    });

    loadInitialData(); // Solo carga Hoja 1 al inicio
};

window.onload = initialize;
