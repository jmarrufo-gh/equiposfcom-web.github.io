// script.js (VERSIÓN FINAL DE AISLAMIENTO: SÓLO CARGA HOJA 1)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // URL DE HOJA 1 (CORREGIDA A CSV)
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    
    // URL DE BBDD PM 4 (CORREGIDA A CSV, PERO IGNORADA EN LA CARGA INICIAL)
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
        // Mensaje de error detallado para diagnosticar CORS/URL
        throw new Error(`Error de conexión (CORS o URL mal formada) al intentar cargar "${sheetName}". ${errorMessage}. **VERIFICA:** URL de Google Sheets y que uses un servidor local (o GitHub Pages, si tienes CORS activado).`); 
    }
};

// --- Funciones de Búsqueda y Renderizado ---

const getEquipoBySerie = (serie) => {
    const key = sanitizeKey(serie);
    return equiposMap.get(key) || null;
};
const getProblemsBySerie = (serie) => {
    // Siempre devuelve vacío en esta versión de aislamiento
    return []; 
};

const renderEquipoDetails = (equipo, problemCount) => {
    // Usamos nombres de columna flexibles para PapaParse
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
            <span style="color: red; font-weight: bold;">OMITIDOS (Prueba de carga)</span>
        </div>
    `;
    resultDiv.innerHTML = html;
};

// La tabla de problemas siempre estará vacía en esta versión
const renderProblemsTable = (problems) => {
    problemsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color-medium); padding: 30px;">Historial de problemas omitido en esta prueba de carga.</div>';
    problemsListTitle.style.display = 'none';
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
 * Carga y Parsea solo la Hoja 1 con PapaParse.
 */
const loadAllData = async () => {
    displayMessage('Cargando y analizando Hoja 1 (Base de Equipos).');
    showLoading(true);

    try {
        // 1. DESCARGA - SOLO HOJA 1
        const [csv1] = await Promise.all([
            fetchSheet(sheetURLs['Hoja 1'], 'Hoja 1'),
            // **BBDD PM 4 OMITIDA PARA EVITAR CONGELAMIENTO**
        ]);
        
        // 2. PARSING de Hoja 1 con PapaParse
        const result1 = PapaParse.parse(csv1, { header: true, skipEmptyLines: true });
        
        // --- CONVERSIÓN DE DATOS ---
        
        // Hoja 1
        equiposMap = new Map();
        result1.data.forEach(item => {
            const serieLimpia = sanitizeKey(item['serie'] || item['Serie']); 
            if (serieLimpia.length > 0) equiposMap.set(serieLimpia, item);
        });

        // BBDD PM 4 (Inicializada vacía)
        problemsMap = new Map(); 

        if (equiposMap.size === 0) {
            throw new Error('Hoja 1: No se pudo procesar ningún registro válido. Verifica encabezados (columna "serie").');
        }

        displayMessage(`✅ ÉXITO. Datos de EQUIPOS cargados (${equiposMap.size} series). Historial de Problemas OMITIDO. Inicia la búsqueda.`);
        
    } catch (error) {
        console.error('[ERROR CRÍTICO] Fallo al cargar los datos:', error);
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

// --- Inicialización ---

const initialize = () => {
    // Verificar que PapaParse esté cargado
    if (typeof PapaParse === 'undefined') {
        displayMessage('Error Fatal: La librería PapaParse no se cargó. Verifica index.html (carga local).', true);
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


