// script.js (VERSIÓN FINAL CON PAPAPARSE DINÁMICO)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // URL DE HOJA 1 (CARGA INICIAL, CON MÉTODO MANUAL)
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    
    // URL DE BBDD PM 4 (CARGA DINÁMICA CON PAPAPARSE)
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

// --- Funciones de Utilidad de UI y Descarga (Solo para Hoja 1) ---

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
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}.`);
        }
        return await response.text();
    } catch (error) {
        throw new Error(`Error de conexión al intentar cargar "${sheetName}". ${error.message}.`); 
    }
};

/**
 * Función manual para parsear CSV (Solo para Hoja 1).
 */
const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { data: [], headers: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue; 
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index].trim(); 
        });
        data.push(obj);
    }
    return { data, headers };
};

const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};

// --- Lógica de Cruce (Sin cambios) ---

const getProblemsBySerieAndCount = (serie, problemsData, serieHeader, nivelHeader) => {
    const problemCounts = new Map();
    let totalProblems = 0;

    for (const item of problemsData) {
        // Cruce: Hoja 1 (serie saneada) vs BBDD PM 4 (columna SERIE REPORTADA)
        const reportedSerie = sanitizeKey(item[serieHeader]);

        if (reportedSerie === serie) {
            totalProblems++;
            // El mapeo de PapaParse garantiza que las claves son correctas
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


// --- Funciones de Renderizado (Sin cambios) ---

const renderEquipoDetails = (equipo, totalProblems) => {
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

    const sortedCounts = [...problemCounts.entries()].sort((a, b) => b[1] - a[1]);

    for (const [nivel, count] of sortedCounts) {
        tableHtml += `<tr><td>${nivel}</td><td>${count}</td></tr>`;
    }

    tableHtml += `</tbody></table>`;
    problemsContainer.innerHTML = tableHtml;
};


// --- Lógica Principal de Carga y Búsqueda ---

/**
 * Carga solo la Hoja 1 al inicio usando el parser manual.
 */
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


/**
 * Maneja la búsqueda, usando PapaParse para la BBDD PM 4 dinámicamente.
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
    
    // 2. Iniciar búsqueda de BBDD PM 4 (PapaParse)
    showLoading(true, 'Cargando BBDD de Problemas... (Puede tardar/congelarse)');
    
    try {
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParse no está cargado. Revisa que el tag <script> esté en index.html');
        }

        const pm4Data = await new Promise((resolve, reject) => {
            Papa.parse(sheetURLs['BBDD PM 4'], {
                download: true,       // Le dice a PapaParse que descargue el archivo
                header: true,         // Usa la primera fila como encabezado de objeto
                skipEmptyLines: true, // Evita problemas con filas vacías
                complete: (results) => {
                    if (results.errors.length) {
                        // PapaParse detectó errores de formato irrecuperables
                        const errorMsg = results.errors.map(e => `${e.code}: ${e.message}`).join('; ');
                        reject(new Error(`Errores de formato CSV en BBDD PM 4: ${errorMsg}`));
                        return;
                    }
                    resolve(results.data);
                },
                error: (err) => {
                    reject(new Error(`Error de descarga de PapaParse: ${err.message}`));
                }
            });
        });

        // 3. Procesar datos de PapaParse
        const problemsData = pm4Data;
        
        // PapaParse automáticamente usa los encabezados. Buscamos las claves:
        const pmSerieHeader = Object.keys(problemsData[0]).find(h => h.toLowerCase().includes('serie reportada')); 
        const pmNivel2Header = Object.keys(problemsData[0]).find(h => h.toLowerCase().includes('nivel 2')); 

        if (!pmSerieHeader || !pmNivel2Header) {
             throw new Error('BBDD PM 4: PapaParse no encontró las columnas "SERIE REPORTADA" o "NIVEL 2".');
        }

        // 4. Cruce y Conteo
        const saneadoSerie = sanitizeKey(serie);
        const { problemCounts, totalProblems } = getProblemsBySerieAndCount(
            saneadoSerie, 
            problemsData, 
            pmSerieHeader, 
            pmNivel2Header
        );

        // 5. Renderizar Resultados
        renderEquipoDetails(equipo, totalProblems);
        renderProblemsTable(problemCounts, totalProblems);

    } catch (error) {
        console.error("Error al buscar en BBDD PM 4:", error);
        renderEquipoDetails(equipo, 0); 
        problemsContainer.innerHTML = `<div class="error-message">⚠️ Error al procesar BBDD PM 4: ${error.message}. La Hoja 1 se cargó correctamente.</div>`;
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

