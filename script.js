// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
// **IMPORTANTE:** Estas son las URLs de publicación que has proporcionado.
// Verifica que ambas URLs estén publicadas correctamente como CSV y sean accesibles públicamente.
const sheetURLs = {
    // URL de Hoja 1
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    // URL de BBDD PM 4
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// Mapas de datos globales para almacenar la información de las hojas
let equiposMap = new Map();
let problemsMap = new Map();

// --- Elementos del DOM ---
const serieInput = document.getElementById('serie-input');
const validateButton = document.getElementById('validate-button');
const resultDiv = document.getElementById('result');
const problemsContainer = document.getElementById('problems-container');
const problemsListTitle = document.getElementById('problems-list-title');


// --- Funciones de Utilidad y Carga ---

/**
 * Limpieza agresiva de la clave de búsqueda.
 * @param {string} key - Clave de entrada (Serie).
 * @returns {string} - Clave limpia y en mayúsculas.
 */
const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    // Elimina caracteres no alfanuméricos y convierte a mayúsculas.
    return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Muestra mensajes en el área de resultados.
 * @param {string} message - Mensaje HTML o texto.
 * @param {boolean} isError - Aplica estilo de error si es true.
 */
const displayMessage = (message, isError = false) => {
    resultDiv.innerHTML = `<div class="result-item ${isError ? 'error-message' : ''}">${message}</div>`;
    problemsContainer.innerHTML = '';
    problemsListTitle.style.display = 'none';
};

/**
 * Obtiene el contenido CSV de una URL con tiempo de espera.
 * @param {string} url - La URL de publicación de Google Sheets (CSV).
 * @param {string} sheetName - Nombre de la hoja para diagnósticos.
 * @returns {Promise<string>} - Contenido del CSV como texto.
 */
const fetchSheet = async (url, sheetName) => {
    const TIMEOUT_MS = 10000; // 10 segundos
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
            errorMessage = `Tiempo de espera agotado al cargar "${sheetName}". Error de red o URL lenta.`;
        } else if (error instanceof TypeError) {
             errorMessage = `Error de conexión (CORS o URL mal formada) al intentar cargar "${sheetName}". Si usas file://, usa un servidor local.`;
        }
        console.error(`[ERROR FATAL DE CARGA] No se pudo obtener la hoja "${sheetName}":`, error);
        // El error se lanza para ser capturado en loadAllData y mostrar el mensaje de fallo crítico
        throw new Error(errorMessage); 
    }
};

/**
 * Analiza el contenido CSV y lo indexa en mapas.
 */
const loadSheetData = (csvText, sheetName) => {
    const data = new Map();
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { data: new Map(), headers: [] };

    // Detectar separador (la mayoría de las publicaciones de GS usan coma o punto y coma)
    const separator = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';

    // Función simple para parsear la línea (mejorada para manejo básico de comillas)
    const parseLine = (line) => {
        const regex = new RegExp(`(?:[^"${separator}\\n]*|"(?:[^"]|"")*")*?(${separator}|$)`, 'g');
        const matches = line.match(regex);
        if (!matches) return [];
        return matches.map(match => {
            let field = match.endsWith(separator) ? match.slice(0, -separator.length) : match;
            return field.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        }).filter(field => field.length > 0 || line.includes(`""`));
    };
    
    // Procesar encabezados
    let headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
    
    let serieIndex = -1;
    let n2Index = -1;

    // --- CÓDIGO CORREGIDO PARA EL ENCABEZADO 'SERIE' EN HOJA 1 ---
    if (sheetName === 'Hoja 1') {
        // Ahora busca el encabezado 'serie'
        serieIndex = headers.indexOf('serie'); 
    } else if (sheetName === 'BBDD PM 4') {
        // Mantiene la búsqueda de 'serie reportada' para BBDD PM 4
        serieIndex = headers.indexOf('serie reportada');
        n2Index = headers.indexOf('nivel 2');
    }
    // --- FIN DEL CÓDIGO CORREGIDO ---

    if (serieIndex === -1) {
        const expectedHeader = (sheetName === 'Hoja 1' ? "'serie'" : "'serie reportada'");
        console.error(`[ERROR CRÍTICO] Columna clave (${expectedHeader}) no encontrada en "${sheetName}".`);
        // Lanza un error personalizado para el diagnóstico final
        throw new Error(`Columna clave (${expectedHeader}) no encontrada en la hoja "${sheetName}". Verifica que el encabezado de la primera fila sea correcto.`);
    }

    // Procesar datos
    let usefulRecords = 0;
    for (let i = 1; i < lines.length; i++) {
        const fields = parseLine(lines[i]);
        if (fields.length !== headers.length) {
            continue; 
        }

        const serieOriginal = fields[serieIndex];
        const serieLimpia = sanitizeKey(serieOriginal);

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

    console.log(`[RESULTADOS] "${sheetName}" - Registros útiles: ${usefulRecords}, Series únicas: ${data.size}`);
    return { data, headers };
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
    // Las claves deben coincidir con los encabezados de tu Hoja 1, en minúsculas.
    const tipo = equipo['tipo'] || 'N/A';
    const modelo = equipo['modelo'] || 'N/A';
    const proyecto = equipo['proyecto'] || 'N/A';
    const usuarioactual = equipo['usuario actual'] || 'N/A';
    // --- CLAVE CORREGIDA AQUÍ: usando 'serie' ---
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
        // La clave para agrupar sigue siendo 'nivel 2'.
        const n2 = p['nivel 2'] && p['nivel 2'].trim() !== '' ? p['nivel 2'].trim().toUpperCase() : 'SIN CLASIFICAR (N2)';
        acc[n2] = (acc[n2] || 0) + 1;
        return acc;
    }, {});

    let tableHtml = '<table class="count-table">';
    tableHtml += '<thead><tr><th>Tipo de Problema (Nivel 2)</th><th>Conteo</th></tr></thead>';
    tableHtml += '<tbody>';

    // Ordenar por conteo de forma descendente
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
        
        // Renderiza el detalle del equipo (Hoja 1) y el conteo de problemas (BBDD PM 4)
        renderEquipoDetails(equipo, problems.length);
        
        // Renderiza la tabla de problemas (BBDD PM 4)
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

        // 2. Carga BBDD PM 4 (Historial de Problemas)
        const csv2 = await fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4');
        const data2 = loadSheetData(csv2, 'BBDD PM 4');
        problemsMap = data2.data;

        if (equiposMap.size === 0) {
            // Este error ya no debería ocurrir si el encabezado es correcto.
            throw new Error('No se encontraron datos válidos en Hoja 1. Esto puede ser por un error en el archivo CSV.');
        }

        // Éxito
        displayMessage(`✅ Datos cargados con éxito. Bases cargadas: Equipos (${equiposMap.size} series), Problemas (${problemsMap.size} series). Ingrese un número de serie y presione "Buscar Equipo".`);
        console.log(`[ÉXITO] Datos cargados - Series de equipo: ${equiposMap.size}, Series con problemas: ${problemsMap.size}`);
        
    } catch (error) {
        // Fallo crítico
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. **VERIFICA:** Servidor Local (CORS), URL de Google Sheets y encabezados.`, true);
        validateButton.textContent = 'Error de Carga';
        validateButton.disabled = true; 
        return; 
    } finally {
        // Habilita el botón solo si la carga fue exitosa
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

