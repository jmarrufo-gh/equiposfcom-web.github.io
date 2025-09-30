// script.js (VERSIÓN SÍNCRONA: TODO EN UN SOLO HILO)

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

// --- Funciones de Utilidad y Carga (Ahora dentro del script.js) ---

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
        return text;
    } catch (error) {
        let errorMessage = error.message || 'Error desconocido.';
        if (error.name === 'AbortError') {
             errorMessage = `Tiempo de espera agotado (${TIMEOUT_MS/1000}s).`;
        }
        throw new Error(`Fallo en descarga de ${sheetName}: ${errorMessage}`); 
    }
};

const loadSheetData = (csvText, sheetName) => {
    // ESTA ES LA FUNCIÓN QUE BLOQUEA EL HILO PRINCIPAL
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error('No hay suficientes datos para procesar.');

    const possibleSeparators = [',', ';'];
    
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
            serieIndex = headers.indexOf('serie'); // Buscamos 'serie'
        } else if (sheetName === 'BBDD PM 4') {
            serieIndex = headers.indexOf('serie reportada');
            n2Index = headers.indexOf('nivel 2');
        }

        if (serieIndex === -1) {
             throw new Error(`Error de formato: No se encontró el encabezado clave de serie en "${sheetName}".`);
        }
        if (sheetName === 'BBDD PM 4' && n2Index === -1) {
             throw new Error(`Error de formato: No se encontró el encabezado 'nivel 2' en "${sheetName}".`);
        }

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
            }
        }
        
        return { valid: data.size > 0, data };
    };

    for (const sep of possibleSeparators) {
        try {
            const result = attemptParse(sep);
             if (result.valid) {
                 return result.data; 
             }
        } catch (e) {
            if (e.message.startsWith('Error de formato')) throw e;
        }
    }

    throw new Error(`No se encontraron datos válidos en ${sheetName}. Verifica los encabezados y el contenido.`);
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
 * Carga todas las bases de datos al iniciar. (Síncrona)
 */
const loadAllData = async () => {
    showLoading(true);
    displayMessage('Cargando la base de datos de equipos e historial. La página se congelará unos segundos (o minutos)...');

    try {
        // 1. DESCARGA SIMULTÁNEA
        const [csv1, csv2] = await Promise.all([
            fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1'),
            fetchSheet(sheetURLs['BBDD PM 4'], 'BBDD PM 4')
        ]);
        
        // El PARSING (análisis) de estas dos líneas BLOQUEARÁ el navegador.
        // 2. PARSING BLOQUEANTE DE HOJA 1
        const data1 = loadSheetData(csv1, 'Hoja 1');
        equiposMap = data1;

        // 3. PARSING BLOQUEANTE DE BBDD PM 4
        const data2 = loadSheetData(csv2, 'BBDD PM 4');
        problemsMap = data2;
        
        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: No se pudo procesar ningún registro válido.');
        }

        displayMessage(`✅ Datos cargados con éxito. Equipos (${equiposMap.size} series), Problemas (${problemsMap.size} series). Ingrese un número de serie.`);
        
    } catch (error) {
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
        displayMessage(`⚠️ Fallo crítico al cargar los datos: ${error.message}. Verifica la Consola (F12) para detalles del colapso.`, true);
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

