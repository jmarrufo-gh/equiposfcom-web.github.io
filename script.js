// --- MOCK DATA PARA DEMOSTRACIÓN ---
// Contiene la lógica que simula la búsqueda en las dos hojas de Google Sheets (Hoja 1 y BBDD PM 4).
// Utiliza estas series para probar: '5CG9426Q2D' o 'TESTPROBLEMS'
const mockEquipos = [
    { tipo: 'Notebook', modelo: 'HP EliteBook 830 G6', serie: '5CG9426Q2D', proyecto: 'PJUD 4-2', usuarioactual: 'Hector Viveros' },
    { tipo: 'Notebook', modelo: 'HP ProBook 450 G5', serie: '5CG2011J7K', proyecto: 'PJUD 4-2', usuarioactual: 'Javiera Lagos' },
    { tipo: 'Notebook', modelo: 'Dell Latitude 5420', serie: 'FFF8962K7P', proyecto: 'PJUD 5', usuarioactual: 'Yocelin Fuentes' },
    { tipo: 'Notebook', modelo: 'Lenovo ThinkPad X1', serie: 'HHT7893X1A', proyecto: 'PJUD 5', usuarioactual: 'Camila Riquelme' },
    // Serie especial para probar la tabla de historial
    { tipo: 'Desktop', modelo: 'HP ProDesk 600 G6', serie: 'TESTPROBLEMS', proyecto: 'PJUD 4-2', usuarioactual: 'Usuario de Pruebas' },
];

const mockProblems = [
    // Problemas para 'TESTPROBLEMS'
    { serie: 'TESTPROBLEMS', problema: 'Error de Pantalla', n2: 'HARDWARE-DISPLAY' },
    { serie: 'TESTPROBLEMS', problema: 'Fallo de Disco', n2: 'HARDWARE-STORAGE' },
    { serie: 'TESTPROBLEMS', problema: 'Problemas de red', n2: 'SOFTWARE-NETWORK' },
    { serie: 'TESTPROBLEMS', problema: 'Error de Pantalla', n2: 'HARDWARE-DISPLAY' },
    { serie: 'TESTPROBLEMS', problema: 'Actualización pendiente', n2: 'SOFTWARE-UPDATE' },
    { serie: 'TESTPROBLEMS', problema: 'Error de Pantalla', n2: 'HARDWARE-DISPLAY' }, // 6 registros
    // Otros problemas
    { serie: '5CG9426Q2D', problema: 'No enciende', n2: 'HARDWARE-POWER' },
    { serie: '5CG9426Q2D', problema: 'Reinstalación de OS', n2: 'SOFTWARE-OS' },
    { serie: 'FFF8962K7P', problema: 'Lento', n2: 'PERFORMANCE' },
    { serie: '5CG2011J7K', problema: 'Bloqueo de usuario', n2: 'SECURITY-LOCK' },
    { serie: '5CG2011J7K', problema: 'Falla intermitente de batería', n2: 'HARDWARE-POWER' },
];

/**
 * Simula la búsqueda de un equipo por su número de serie en la Hoja 1.
 * @param {string} serie - Número de serie a buscar.
 * @returns {Promise<Object|null>} - Retorna los datos del equipo o null si no se encuentra.
 */
const getEquipoBySerie = (serie) => {
    const normalizedSerie = serie.toUpperCase();
    return new Promise(resolve => {
        setTimeout(() => {
            // Encuentra el equipo en la lista simulada
            resolve(mockEquipos.find(equipo => equipo.serie.toUpperCase() === normalizedSerie) || null);
        }, 500); // Simular latencia de 0.5 segundos
    });
};

/**
 * Simula la búsqueda de problemas por número de serie en la BBDD PM 4.
 * @param {string} serie - Número de serie a buscar.
 * @returns {Promise<Array<Object>>} - Retorna una lista de problemas.
 */
const getProblemsBySerie = (serie) => {
    const normalizedSerie = serie.toUpperCase();
    return new Promise(resolve => {
        setTimeout(() => {
            // Filtra los problemas por la serie consultada
            resolve(mockProblems.filter(p => p.serie.toUpperCase() === normalizedSerie));
        }, 700); // Simular latencia de 0.7 segundos
    });
};
// --- FIN MOCK DATA Y SIMULACIÓN ---


// --- Constantes y Elementos del DOM ---
const serieInput = document.getElementById('serie-input');
const validateButton = document.getElementById('validate-button');
const resultDiv = document.getElementById('result');
const problemsContainer = document.getElementById('problems-container');
const problemsListTitle = document.getElementById('problems-list-title');
const initialMessage = document.getElementById('initial-message');

// --- Funciones de Utilidad y UI ---

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
    const html = `
        <div class="result-item main-serie">
            <strong>NÚMERO DE SERIE CONSULTADO</strong>
            <span>${equipo.serie}</span>
        </div>
        <div class="result-item highlight"><strong>Tipo:</strong> <span>${equipo.tipo || 'N/A'}</span></div>
        <div class="result-item highlight"><strong>Modelo:</strong> <span>${equipo.modelo || 'N/A'}</span></div>
        <div class="result-item"><strong>Proyecto:</strong> <span>${equipo.proyecto || 'N/A'}</span></div>
        <div class="result-item"><strong>Usuario Asignado:</strong> <span>${equipo.usuarioactual || 'N/A'}</span></div>
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
        // Usa 'SIN CLASIFICAR (N2)' si el campo n2 está vacío
        const key = p.n2 || 'SIN CLASIFICAR (N2)'; 
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
    displayMessage('<div style="text-align:center;">Cargando datos. Por favor, espere...</div>');
    problemsListTitle.style.display = 'none';

    try {
        // Simulación de consulta a Hoja 1
        const equipo = await getEquipoBySerie(serie);

        if (!equipo) {
            displayMessage(`Serie "${serie}" no encontrada en la Base de Equipos (Hoja 1).`, true);
            return;
        }

        // Simulación de consulta a BBDD PM 4
        const problems = await getProblemsBySerie(serie);
        
        // Renderizar resultados
        renderEquipoDetails(equipo, problems.length);
        problemsListTitle.style.display = 'block';
        renderProblemsTable(problems);

    } catch (error) {
        // Manejo de errores generales de la promesa
        console.error("Error al realizar la consulta:", error);
        displayMessage('Error al realizar la consulta. Revisa la consola para más detalles.', true);
    } finally {
        // Habilitar botón al finalizar la operación
        validateButton.disabled = false;
        validateButton.textContent = 'Buscar Equipo';
    }
};


// --- Inicialización y Event Listeners ---

const initialize = () => {
    // Esconder el mensaje inicial de carga del DOM si existe
    if (initialMessage) {
        initialMessage.style.display = 'none'; 
    }
    
    // Configurar el botón de búsqueda
    validateButton.textContent = 'Buscar Equipo';
    validateButton.disabled = false;

    // Listener para el botón de búsqueda
    validateButton.addEventListener('click', handleSearch);

    // Listener para la tecla Enter en el input
    serieInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Mensaje de inicio en el área de resultados
    displayMessage('<div style="text-align: center; color: var(--text-color-medium); padding: 20px;">Ingrese un número de serie y presione "Buscar Equipo".</div>');
    problemsListTitle.style.display = 'none';
};

// Esperar que la página cargue completamente para inicializar la aplicación
window.onload = initialize;
