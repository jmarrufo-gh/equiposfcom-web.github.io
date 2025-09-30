// script.js (VERSIÓN FINAL CON GRÁFICOS EN LA TABLA Y EN EL TOTAL)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // URL DE HOJA 1 (CARGA INICIAL, CON MÉTODO MANUAL)
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    
    // URL DE BBDD PM 4 (CARGA DINÁMICA)
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
        
        let text = await response.text();
        
        if (!text || text.length < 10) {
            throw new Error(`La hoja está vacía o no contiene datos válidos.`);
        }
        
        // ******************************************************************
        // *** PASO DE ESTANDARIZACIÓN CRÍTICA ***
        // 1. Reemplaza todos los saltos de línea de Windows/Mac (\r\n y \r) con el estándar de Unix (\n).
        text = text.replace(/\r\n|\r/g, '\n'); 

        // 2. Limpieza de saltos de línea/caracteres especiales DENTRO de las celdas con comillas (para el parser regex).
        if (sheetName === 'BBDD PM 4') {
             text = text.replace(/"([^"]*)"/g, (match, p1) => {
                 // Reemplaza saltos de línea internos con espacio para evitar que rompa el parser regex
                 return `"${p1.replace(/\n/g, ' ').replace(/\t/g, ' ')}"`;
            });
            // Elimina caracteres no imprimibles (ya se hizo antes, pero lo dejamos por seguridad)
            text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
        }
        // ******************************************************************

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
 * Función robusta para parsear CSV (usando Regex). Se beneficia de la estandarización de filas.
 */
const parseCSV = (csvText) => {
    // Dividir el texto en líneas limpias (Ahora usando solo '\n' gracias a la estandarización)
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { data: [], headers: [] };

    // Regex para dividir una línea CSV, manejando comas dentro de comillas
    const CSV_SPLIT_REGEX = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    // Obtener y limpiar encabezados (remueve comillas si las hay)
    const headers = lines[0].split(CSV_SPLIT_REGEX).map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // Dividir la línea usando la regex
        const values = lines[i].split(CSV_SPLIT_REGEX);
        
        if (values.length !== headers.length) continue; 

        const obj = {};
        
        headers.forEach((header, index) => {
            let value = values[index] ? values[index].trim() : '';
            
            // Eliminar comillas dobles que rodean el valor (si existen)
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            // Reparar comillas dobles escapadas dentro de las celdas ("" -> ")
            value = value.replace(/""/g, '"');
            
            obj[header] = value;
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


// --- Funciones de Renderizado (MODIFICADA para usar el Gráfico Total) ---

const renderEquipoDetails = (equipo, totalProblems) => {
    const tipo = equipo['Tipo'] || equipo['tipo'] || 'N/A';
    const modelo = equipo['Modelo'] || equipo['modelo'] || 'N/A';
    const proyecto = equipo['Proyecto'] || equipo['proyecto'] || 'N/A';
    const usuarioactual = equipo['Usuario Actual'] || equipo['usuario actual'] || 'N/A';
    const serie = equipo['Serie'] || equipo['serie'] || 'N/A'; 
   
    // --- Lógica para el Gráfico Total de Problemas ---
    const MAX_PROBLEMS_FOR_BAR = 10; // 10 problemas llenan el 100% de la barra visual
    const percentage = Math.min(100, (totalProblems / MAX_PROBLEMS_FOR_BAR) * 100);
    const isNoIncidents = totalProblems === 0 ? 'no-incidents' : '';
   
    // Mensaje para el tooltip
    const tooltipText = `${totalProblems} Registro(s) en total.`;
    const displayText = `${totalProblems} ${totalProblems === 1 ? 'REGISTRO' : 'REGISTROS'}`;

    const html = `
        <div class="result-item main-serie">
            <strong>NÚMERO DE SERIE CONSULTADO</strong>
            <span>${serie}</span>
        </div>
        <div class="result-item highlight"><strong>Tipo:</strong> <span>${tipo}</span></div>
        <div class="result-item highlight"><strong>Modelo:</strong> <span>${modelo}</span></div>
        <div class="result-item"><strong>Proyecto:</strong> <span>${proyecto}</span></div>
        <div class="result-item"><strong>Usuario Asignado:</strong> <span>${usuarioactual}</span></div>
        
                <div class="incidents-graph-container ${isNoIncidents}">
            <strong>REGISTROS DE PROBLEMAS (BBDD PM 4)</strong>
            <div class="tooltip">${tooltipText}</div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                <div class="progress-bar-text">${displayText}</div>
            </div>
        </div>
            `;
    resultDiv.innerHTML = html;
};


// --- Funciones de Renderizado (MODIFICADA para usar Gráficos en la Tabla) ---

const renderProblemsTable = (problemCounts, totalProblems) => {
    problemsListTitle.style.display = 'block';

    if (totalProblems === 0) {
        problemsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color-medium); padding: 15px;">No se encontraron registros de problemas para esta serie.</div>';
        return;
    }

    // Calcular el recuento máximo para establecer la escala visual
    const maxCount = Math.max(...[...problemCounts.values()]);

    let tableHtml = `<table class="count-table">
                        <thead>
                            <tr>
                                <th>NIVEL 2 (Tipo de Problema)</th>
                                <th>Recuento (Gráfico)</th>
                            </tr>
                        </thead>
                        <tbody>`;

    const sortedCounts = [...problemCounts.entries()].sort((a, b) => b[1] - a[1]);

    for (const [nivel, count] of sortedCounts) {
        // Calcular el ancho de la barra (porcentaje basado en el recuento máximo)
        const percentage = (count / maxCount) * 100;
        
        // Crear la celda con el gráfico de barra y el tooltip (usando 'title')
        const graphCell = `
            <td class="graph-cell">
                <div class="problem-graph-wrapper">
                    <div class="problem-graph-bar" style="width: ${percentage}%;"></div>
                    <span class="problem-count-text" title="Total de incidentes: ${count}">${count}</span>
                </div>
            </td>
        `;

        tableHtml += `<tr><td>${nivel}</td>${graphCell}</tr>`;
    }

    tableHtml += `</tbody></table>`;
    problemsContainer.innerHTML = tableHtml;
};


// --- Lógica Principal de Carga y Búsqueda ---

const loadInitialData = async () => {
    displayMessage('Cargando y analizando Hoja 1 (Base de Equipos).');
    showLoading(true, 'Cargando Estructura...');

    try {
        const csv1 = await fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1');
        const result1 = parseCSV(csv1); 
        
        equiposMap = new Map();
        
        const headers = result1.headers || [];
        const serieHeader = headers.find(h => h.toLowerCase().includes('serie') || h.toLowerCase().includes('serial'));

        if (!serieHeader) {
            throw new Error('Hoja 1: No se encontró la columna de serie.');
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


const handleSearch = async () => {
    const serie = serieInput.value.trim();
    if (serie.length < 5) {
        displayMessage('Por favor, ingresa un número de serie válido (mínimo 5 caracteres).', true);
        return;
    }
    
    const equipo = getEquipoBySerie(serie);
    if (!equipo) {
        displayMessage(`⚠️ Serie "${serie}" no encontrada en la Base de Equipos (Hoja 1). Verifica la serie.`, true);
        return;
    }
    
    showLoading(true, 'Cargando BBDD de Problemas... (Puede tardar/congelarse)');
    
    try {
        const csv2 = await fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4'); // Usa el fetchSheet con estandarización
        const result2 = parseCSV(csv2); 
        
        const headers2 = result2.headers || [];
        const pmSerieHeader = headers2.find(h => h.toLowerCase().includes('serie reportada')); 
        const pmNivel2Header = headers2.find(h => h.toLowerCase().includes('nivel 2')); 

        if (!pmSerieHeader || !pmNivel2Header) {
             throw new Error('BBDD PM 4: Faltan las columnas "SERIE REPORTADA" o "NIVEL 2".');
        }

        const saneadoSerie = sanitizeKey(serie);
        const { problemCounts, totalProblems } = getProblemsBySerieAndCount(
            saneadoSerie, 
            result2.data, 
            pmSerieHeader, 
            pmNivel2Header
        );

        renderEquipoDetails(equipo, totalProblems);
        renderProblemsTable(problemCounts, totalProblems);

    } catch (error) {
        console.error("Error al buscar en BBDD PM 4:", error);
        renderEquipoDetails(equipo, 0); 
        problemsContainer.innerHTML = `<div class="error-message">⚠️ Error al cargar BBDD PM 4: ${error.message}. La Hoja 1 se cargó correctamente.</div>`;
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

    loadInitialData(); 
};

window.onload = initialize;
