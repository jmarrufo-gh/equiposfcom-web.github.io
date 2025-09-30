// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
// **IMPORTANTE:** Reemplaza los valores de las URLs de publicación con los enlaces CSV de TUS Google Sheets.
const sheetURLs = {
    // Hoja 1: Base de Equipos (Debe ser el enlace CSV de tu hoja principal)
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?output=csv&gid=0',
    // BBDD PM 4: Historial de Problemas (Debe ser el enlace CSV de tu hoja de historial de problemas)
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?output=csv&gid=1086366835',
};

// Mapas de datos globales para almacenar la información de las hojas
let equiposMap = new Map(); // Para Hoja 1 (Detalles del equipo)
let problemsMap = new Map(); // Para BBDD PM 4 (Historial de problemas)

// --- Funciones de Utilidad ---

/**
 * Función de limpieza agresiva de la clave de búsqueda.
 * Elimina espacios, caracteres no alfanuméricos y convierte a mayúsculas.
 * @param {string} key - Clave de entrada (Serie).
 * @returns {string} - Clave limpia y en mayúsculas.
 */
const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    // Elimina espacios, comillas, tabulaciones y cualquier carácter que no sea letra o número
    return key.trim().replace(/['"/\t\r\n]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Función genérica para obtener el contenido CSV de una URL.
 * @param {string} url - La URL de publicación de Google Sheets (CSV).
 * @returns {Promise<string>} - Contenido del CSV como una cadena de texto.
 */
const fetchSheet = async (url, sheetName) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Error si el servidor responde pero el recurso no existe (ej: 404)
            throw new Error(`Error HTTP: ${response.status} - Verifica si la hoja está PUBLICADA correctamente como CSV.`);
        }
        return await response.text();
    } catch (error) {
        console.error(`[ERROR FATAL DE CARGA] No se pudo obtener la hoja "${sheetName}":`, error);
        displayMessage(`Fallo al cargar la hoja "${sheetName}". Verifica las URLs de publicación.`, true);
        throw error;
    }
};

/**
 * Analiza el contenido CSV y lo indexa en mapas para una búsqueda rápida.
 * Incluye lógica de recuperación de líneas para datos dañados.
 * @param {string} csvText - El contenido del archivo CSV.
 * @param {string} sheetName - Nombre de la hoja para diagnósticos.
 * @returns {Object} - Objeto con el índice de datos (Map) y los encabezados.
 */
const loadSheetData = (csvText, sheetName) => {
    const data = new Map();
    const lines = csvText.split('\n');
    let headers = [];
    let serieIndex = -1;
    let n2Index = -1;

    // Detectar separador (CSV puede usar coma o punto y coma)
    const firstDataLine = lines[1] || '';
    const separator = firstDataLine.includes(';') && !firstDataLine.includes(',') ? ';' : ',';
    
    // Función de parsing de línea CSV simple
    const parseLine = (line, sep) => {
        // Expresión regular para dividir la línea, respetando el contenido entre comillas.
        const regex = new RegExp(`(?:"(?:[^"]|"")*"|[^${sep}\\n]*)(?:${sep}|\\n|$)`, 'g');
        const matches = line.match(regex);
        if (!matches) return [];
        
        return matches.map(match => {
            let field = match.endsWith(sep) ? match.slice(0, -1) : match;
            field = field.replace(/^"|"$/g, '').replace(/""/g, '"');
            return field.trim();
        });
    };

    // 1. Procesar encabezados
    if (lines.length > 0) {
        headers = parseLine(lines[0], separator).map(h => h.toLowerCase().trim());
        
        // Determinar el índice de la serie según el nombre de la hoja
        if (sheetName === 'Hoja 1') {
            // Nombre de columna esperado en la Hoja 1
            serieIndex = headers.indexOf('serie del equipo'); 
        } else if (sheetName === 'BBDD PM 4') {
            // Nombre de columna esperado en la BBDD PM 4
            serieIndex = headers.indexOf('serie reportada');
            n2Index = headers.indexOf('nivel 2');
        }

        // Diagnóstico crítico
        console.log(`--- DIAGNÓSTICO DE COLUMNAS: ${sheetName} ---`);
        console.log(`[DIAGNÓSTICO CRÍTICO - COLUMNA SERIE] Nombre detectado: '${headers[serieIndex]}' (Índice: ${serieIndex}).`);
        if (sheetName === 'BBDD PM 4') {
            console.log(`[DIAGNÓSTICO CRÍTICO - COLUMNA NIVEL 2] Nombre detectado: '${headers[n2Index]}' (Índice: ${n2Index}).`);
        }
    }

    if (serieIndex === -1) {
        console.error(`[ERROR CRÍTICO] Columna de Serie no encontrada en ${sheetName}. Verifica los encabezados.`);
        return { data: new Map(), headers: [] };
    }
    
    // 2. Procesar datos con recuperación de líneas
    const expectedCols = headers.length;
    let usefulRecords = 0;
    let skippedCorruptedLines = 0;
    let linesToProcess = [...lines]; // Copia de las líneas
    linesToProcess.shift(); // Quitar encabezados

    let i = 0;
    while (i < linesToProcess.length) {
        let currentLine = linesToProcess[i];
        let fields = parseLine(currentLine, separator);
        
        // Lógica de recuperación de líneas rotas (cosido)
        while (fields.length < expectedCols && i + 1 < linesToProcess.length) {
            currentLine += '\n' + linesToProcess[i + 1]; // Añade la siguiente línea
            fields = parseLine(currentLine, separator);
            skippedCorruptedLines++;
            i++; // Saltar la línea que acabamos de coser
        }

        if (fields.length === expectedCols) {
            const serieOriginal = fields[serieIndex];
            const serieLimpia = sanitizeKey(serieOriginal);

            if (serieLimpia.length > 0) {
                // Diagnóstico para las primeras 5 filas
                if (usefulRecords < 5) {
                    console.log(`[DIAGNÓSTICO CRÍTICO - SERIE CARGADA] Fila ${usefulRecords + 1}: Original='${serieOriginal}' -> Limpia='${serieLimpia}'`);
                }

                const record = {};
                headers.forEach((header, colIndex) => {
                    record[header] = fields[colIndex];
                });

                if (sheetName === 'Hoja 1') {
                    // Hoja 1: Mapear por serie (un equipo por serie)
                    data.set(serieLimpia, record);
                } else if (sheetName === 'BBDD PM 4') {
                    // BBDD PM 4: Mapear por serie, almacenando un array de problemas
                    if (!data.has(serieLimpia)) {
                        data.set(serieLimpia, []);
                    }
                    data.get(serieLimpia).push(record);
                }
                usefulRecords++;
            } else {
                console.warn(`[DIAGNÓSTICO BBDD PM 4] Fila omitida. Columna de serie vacía o nula después de la limpieza.`, fields);
            }
        } else if (i < linesToProcess.length) {
             // Esto ocurre si la última línea no pudo coserse completamente o si el CSV está muy mal.
             console.warn(`[ADVERTENCIA] Fila omitida debido a formato incorrecto o incompleto (Campos: ${fields.length} vs Esperado: ${expectedCols}).`, currentLine);
        }
        i++; // Pasar a la siguiente línea
    }
    
    console.log(`--- RESULTADOS FINALES DEL PROCESAMIENTO ${sheetName} ---`);
    console.log(`Filas de datos procesadas con SERIE válida (Total de Registros Útiles): ${usefulRecords}`);
    if (sheetName === 'BBDD PM 4') {
        console.log(`Líneas cosidas (recuperadas de CSV roto): ${skippedCorruptedLines}`);
    }
    console.log(`Series únicas (SERIE CRUCE) encontradas: ${data.size}`);
    console.log(`-----------------------------------------------`);

    return { data, headers };
};


// --- Funciones de Búsqueda (API de la Aplicación) ---

/**
 * Busca un equipo por su número de serie en la Hoja 1 (equiposMap).
 * @param {string} serie - Número de serie a buscar.
 * @returns {Object|null} - Retorna los datos del equipo o null si no se encuentra.
 */
const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};

/**
 * Busca problemas por número de serie en la BBDD PM 4 (problemsMap).
 * @param {string} serie - Número de serie a buscar.
 * @returns {Array<Object>} - Retorna una lista de problemas (registros).
 */
const getProblemsBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return problemsMap.get(key) || [];
};


// --- Constantes y Elementos del DOM ---
const serieInput = document.getElementById('serie-input');
const validateButton = document.getElementById('validate-button');
const resultDiv = document.getElementById('result');
const problemsContainer = document.getElementById('problems-container');
const problemsListTitle = document.getElementById('problems-list-title');
const initialMessage = document.getElementById('initial-message'); // Este elemento no se usa, pero lo mantengo por si lo tienes en el HTML
const loadingOverlay = document.getElementById('loading-overlay');


// --- Funciones de UI y Renderizado ---

const showLoading = (show) => {
    if (loadingOverlay) {
        // Asegúrate de tener un div con id="loading-overlay" en tu HTML si quieres usar esto
        // Por ahora, solo controlamos el botón y un mensaje inicial.
        // loadingOverlay.style.display = show ? 'flex' : 'none'; 
        validateButton.disabled = show;
        validateButton.textContent = show ? 'Cargando Datos...' : 'Buscar Equipo';
    }
};

/**
 * Muestra mensajes en el área de resultados principal.
 * @param {string} message - El mensaje HTML o texto a mostrar.
 * @param {boolean} isError - Si es true, aplica el estilo de mensaje de error.
 */
const displayMessage = (message, isError = false) => {
    resultDiv.innerHTML = `<div class="result-item ${isError ? 'error-message' : ''}">${message}</div>`;
    problemsContainer.innerHTML = '';
    problemsListTitle.style.display = 'none';
};

/**
 * Renderiza la información principal del equipo y el conteo total de incidentes.
 * @param {Object} equipo - El objeto con los datos del equipo (Hoja 1).
 * @param {number} problemCount - El número total de incidentes encontrados (BBDD PM 4).
 */
const renderEquipoDetails = (equipo, problemCount) => {
    // Normalizar nombres de columnas de Hoja 1
    const tipo = equipo['tipo'] || 'N/A';
    const modelo = equipo['modelo'] || 'N/A';
    const proyecto = equipo['proyecto'] || 'N/A';
    // Columna 'usuario actual' de Hoja 1
    const usuarioactual = equipo['usuario actual'] || 'N/A'; 
    const serie = equipo['serie del equipo'] || 'N/A';

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
 * Renderiza la tabla de conteo de problemas agrupados por Nivel 2.
 * @param {Array<Object>} problems - La lista completa de registros de problemas.
 */
const renderProblemsTable = (problems) => {
    if (problems.length === 0) {
        problemsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color-medium); padding: 30px;">No se encontró historial de problemas para este equipo.</div>';
        return;
    }

    // 1. Contar ocurrencias por tipo de problema N2
    const problemCounts = problems.reduce((acc, p) => {
        // Usar 'nivel 2' (columna V) para el cruce
        const n2 = p['nivel 2']; 
        // Usa 'SIN CLASIFICAR (N2)' si el campo n2 está vacío
        const key = n2 && n2.trim() !== '' ? n2.trim().toUpperCase() : 'SIN CLASIFICAR (N2)'; 
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // 2. Crear la tabla HTML
    let tableHtml = '<table class="count-table">';
    tableHtml += '<thead><tr><th>Tipo de Problema (Nivel 2)</th><th>Conteo</th></tr></thead>';
    tableHtml += '<tbody>';

    // 3. Ordenar los problemas por conteo (descendente)
    const sortedCounts = Object.entries(problemCounts).sort(([, a], [, b]) => b - a);

    sortedCounts.forEach(([n2, count]) => {
        tableHtml += `
            <tr>
                <td>${n2}</td>
                <td>${count}</td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';
    problemsContainer.innerHTML = tableHtml;
};


// --- Lógica Principal del Buscador ---

/**
 * Función principal que se ejecuta al presionar Buscar o Enter.
 */
const handleSearch = async () => {
    const serie = serieInput.value.trim().toUpperCase();
    
    // Validación de entrada mínima
    if (serie.length < 5) {
        displayMessage('Por favor, ingresa un número de serie válido (mínimo 5 caracteres).', true);
        return;
    }

    // Deshabilitar botón y mostrar carga
    validateButton.disabled = true;
    validateButton.textContent = 'Buscando...';
    displayMessage('<div style="text-align:center;">Realizando búsqueda en bases de datos...</div>');
    problemsListTitle.style.display = 'none';

    try {
        // 1. Consulta a Hoja 1
        const equipo = getEquipoBySerie(serie);

        if (!equipo) {
            displayMessage(`Serie "${serie}" no encontrada en la Base de Equipos (Hoja 1).`, true);
            return;
        }

        // 2. Consulta a BBDD PM 4
        const problems = getProblemsBySerie(serie);
        
        // 3. Renderizar resultados
        renderEquipoDetails(equipo, problems.length);
        problemsListTitle.style.display = 'block';
        renderProblemsTable(problems);
        
        console.log(`[BÚSQUEDA EXITOSA] Serie "${serie}" - Registros en Historial: ${problems.length}`);

    } catch (error) {
        console.error("Error al realizar la consulta:", error);
        displayMessage('Error al realizar la consulta. Revisa la consola para más detalles.', true);
    } finally {
        validateButton.disabled = false;
        validateButton.textContent = 'Buscar Equipo';
    }
};

/**
 * Carga todas las bases de datos de Google Sheets al iniciar la aplicación.
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos de equipos e historial. Por favor, espere...');
    
    try {
        // Carga Hoja 1 (Detalles)
        const csv1 = await fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1');
        const data1 = loadSheetData(csv1, 'Hoja 1');
        equiposMap = data1.data;

        // Carga BBDD PM 4 (Historial)
        const csv2 = await fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4');
        const data2 = loadSheetData(csv2, 'BBDD PM 4');
        problemsMap = data2.data;

        displayMessage('<div style="text-align: center; color: var(--text-color-medium); padding: 20px;">Datos cargados con éxito. Ingrese un número de serie y presione "Buscar Equipo".</div>');
        console.log(`[ÉXITO] Todas las bases de datos cargadas y listas para la consulta. Series de equipo cargadas: ${equiposMap.size}`);

    } catch (e) {
        // El error ya se muestra en fetchSheet, solo detenemos el proceso
        console.error("Fallo la carga de datos inicial. La aplicación no puede funcionar.", e);
        // Mensaje de error más específico para el usuario
        displayMessage('⚠️ **FALLO CRÍTICO DE CONEXIÓN**. La aplicación no pudo cargar los datos. Por favor, verifica que tus hojas de Google estén **PUBLICADAS como CSV** y que las URLs en el `script.js` sean correctas.', true);
        validateButton.textContent = 'Error de Carga';
    } finally {
        showLoading(false);
        // Si la carga falla, el botón de búsqueda sigue deshabilitado por el mensaje de error.
        if (equiposMap.size > 0) {
             validateButton.disabled = false;
             validateButton.textContent = 'Buscar Equipo';
        }
    }
}


// --- Inicialización y Event Listeners ---

const initialize = () => {
    // Configurar el botón de búsqueda
    validateButton.textContent = 'Buscar Equipo';
    validateButton.disabled = true; // Deshabilitado hasta que se carguen los datos

    // Listener para el botón de búsqueda
    validateButton.addEventListener('click', handleSearch);

    // Listener para la tecla Enter en el input
    serieInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !validateButton.disabled) {
            handleSearch();
        }
    });

    // Iniciar la carga de datos al cargar la ventana
    loadAllData();
};

// Esperar que la página cargue completamente para inicializar la aplicación
window.onload = initialize;
