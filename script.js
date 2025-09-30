// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
// Estas son las URLs de publicación que has proporcionado.
const sheetURLs = {
    // URL de Hoja 1
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    // URL de BBDD PM 4 (Mantenemos la URL, pero la carga está comentada)
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// Mapas de datos globales para almacenar la información de las hojas
let equiposMap = new Map();
let problemsMap = new Map(); // Estará vacío temporalmente

// --- Elementos del DOM ---
const serieInput = document.getElementById('serie-input');
const validateButton = document.getElementById('validate-button');
const resultDiv = document.getElementById('result');
const problemsContainer = document.getElementById('problems-container');
const problemsListTitle = document.getElementById('problems-list-title');


// --- Funciones de Utilidad y Carga ---

const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const displayMessage = (message, isError = false) => {
    resultDiv.innerHTML = `<div class="result-item ${isError ? 'error-message' : ''}">${message}</div>`;
    problemsContainer.innerHTML = '';
    problemsListTitle.style.display = 'none';
};

/**
 * Obtiene el contenido CSV de una URL con tiempo de espera.
 */
const fetchSheet = async (url, sheetName) => {
    // --- TIMEOUT AUMENTADO A 30 SEGUNDOS ---
    const TIMEOUT_MS = 30000; 
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS); 
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: La hoja "${sheetName}" falló al cargar.`);
        }
        
        const text = await response.text();
        if (!text || text.length < 10) {
            throw new Error(`La hoja "${sheetName}" está vacía o no contiene datos válidos.`);
        }
        console.log(`[DIAGNÓSTICO] Hoja "${sheetName}" cargada exitosamente. Tamaño: ${text.length} caracteres.`);
        return text;
    } catch (error) {
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = `Tiempo de espera agotado (${TIMEOUT_MS/1000}s) al cargar "${sheetName}". La hoja es muy grande.`;
        } else if (error instanceof TypeError || error.name === 'TypeError') {
             errorMessage = `Error de conexión (CORS o URL mal formada) al intentar cargar "${sheetName}". Si usas file://, usa un servidor local.`;
        }
        console.error(`[ERROR FATAL DE CARGA] No se pudo obtener la hoja "${sheetName}":`, error);
        throw new Error(errorMessage); 
    }
};

/**
 * Analiza el contenido CSV y lo indexa en mapas, probando múltiples separadores.
 */
const loadSheetData = (csvText, sheetName) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return { data: new Map(), headers: [] }; 

    const possibleSeparators = [',', ';'];
    let finalData = { data: new Map(), headers: [] };
    
    const parseLine = (line, sep) => {
        const regex = new RegExp(`(?:[^"${sep}\\n]*|"(?:[^"]|"")*")*?(${sep}|$)`, 'g');
        const matches = line.match(regex);
        if (!matches) return [];
        return matches.map(match => {
            let field = match.endsWith(sep) ? match.slice(0, -sep.length) : match;
            return field.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        }).filter(field => field.length > 0 || line.includes(`""`));
    };

    const attemptParse = (separator) => {
        const data = new Map();
        const headers = parseLine(lines[0], separator).map(h => h.toLowerCase().trim());
        
        let serieIndex = -1;
        let n2Index = -1;
        
        // --- LÓGICA DE BÚSQUEDA DE ENCABEZADOS CLAVE ---
        if (sheetName === 'Hoja 1') {
            serieIndex = headers.indexOf('serie'); 
        } else if (sheetName === 'BBDD PM 4') {
            serieIndex = headers.indexOf('serie reportada');
            n2Index = headers.indexOf('nivel 2');
        }

        // Validación crítica de encabezados
        if (serieIndex === -1) return { valid: false, reason: `No se encontró el encabezado clave de serie.` }; 
        if (sheetName === 'BBDD PM 4' && n2Index === -1) return { valid: false, reason: `No se encontró el encabezado 'nivel 2'.` };

        let usefulRecords = 0;
        for (let i = 1; i < lines.length; i++) {
            const fields = parseLine(lines[i], separator);
            if (fields.length !== headers.length || fields.length === 0) continue; 

            const serieLimpia = sanitizeKey(fields[serieIndex]);

            if (serieLimpia.length > 0) {
                const record = {};
                headers.forEach((header, colIndex) => {
                    record[header] = fields[colIndex];
                });

                if (sheetName === 'Hoja 1') {
                    data.set(serieLimpia, record);
                } else if (sheetName === 'BBDD PM 4') {
                    if (!data.has(serieLimpia)) data.set(serieLimpia, []);
                    data.get(serieLimpia).push(record);
                }
                usefulRecords++;
            }
        }
        
        return { valid: data.size > 0, data, headers, usefulRecords, separator };
    };

    for (const sep of possibleSeparators) {
        const result = attemptParse(sep);
        if (result.valid) {
            finalData = { data: result.data, headers: result.headers };
            console.log(`[DIAGNÓSTICO] Separador efectivo para "${sheetName}": "${sep}". Series únicas: ${finalData.data.size}.`);
            return finalData; 
        }
    }

    const expectedHeader = (sheetName === 'Hoja 1' ? "'serie'" : "'serie reportada' y 'nivel 2'");
    throw new Error(`No se pudo interpretar el CSV de "${sheetName}". Error: Verifica que el encabezado ${expectedHeader} sea correcto.`);
};

// --- Funciones de Búsqueda y UI ---

const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};

const getProblemsBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return problemsMap.get(key) || [];
};

const showLoading = (show) => {
    validateButton.disabled = show;
    validateButton.textContent = show ? 'Cargando Datos...' : 'Buscar Equipo';
};

/**
 * Renderiza los detalles del equipo y el conteo de incidentes.
 */
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

/**
 * Renderiza la tabla de conteo de problemas por Nivel 2.
 */
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

// --- Lógica Principal ---

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

        console.log(`[BÚSQUEDA EXITOSA] Serie "${serie}" - Registros en Historial: ${problems.length}`);
    } catch (error) {
        console.error("Error al realizar la consulta:", error);
        displayMessage(`Error al realizar la consulta: ${error.message}. Revisa la consola para más detalles.`, true);
    } finally {
        showLoading(false);
    }
};

/**
 * Carga todas las bases de datos al iniciar.
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos de equipos e historial. Por favor, espere...');

    try {
        // 1. Carga Hoja 1 (Equipos Base)
        const csv1 = await fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1');
        const data1 = loadSheetData(csv1, 'Hoja 1');
        equiposMap = data1.data;

        // --- BBDD PM 4 COMENTADA TEMPORALMENTE ---
        /*
        const csv2 = await fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4');
        const data2 = loadSheetData(csv2, 'BBDD PM 4');
        problemsMap = data2.data;
        */
        
        // Éxito PARCIAL
        if (equiposMap.size === 0) {
             throw new Error('Hoja 1: Se descargó, pero no se pudo procesar ningún registro válido. Revisa encabezado "serie".');
        }

        displayMessage(`✅ Datos de Equipos (Hoja 1) cargados con éxito (${equiposMap.size} series). BBDD PM 4 omitida. Ingrese un número de serie.`);
        console.log(`[ÉXITO PARCIAL] Solo Hoja 1 cargada. Series: ${equiposMap.size}`);
        
    } catch (error) {
        // Fallo crítico
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}.`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
        return; 
    } finally {
        // Habilita el botón solo si la carga de Hoja 1 fue exitosa
        if (equiposMap.size > 0) {
            validateButton.disabled = false;
            validateButton.textContent = 'Buscar Equipo';
        }
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

    console.log('[DIAGNÓSTICO] Iniciando la aplicación...');
    loadAllData();
};

window.onload = initialize;
window.onload = initialize;


