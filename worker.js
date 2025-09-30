// worker.js (VERSION FINAL Y AUTÓNOMA)

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// --- Funciones de Utilidad y Carga ---

const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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
        throw new Error(`Fallo en ${sheetName}: ${errorMessage}`); 
    }
};

const loadSheetData = (csvText, sheetName) => {
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
            serieIndex = headers.indexOf('serie'); // Buscamos 'serie' en minúsculas
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


// --- MANEJO DE MENSAJES DEL WORKER (Entrada/Salida) ---
self.onmessage = async (e) => {
    const { sheetName } = e.data; 
    
    try {
        const csvText = await fetchSheet(sheetURLs[sheetName], sheetName);
        const dataMap = loadSheetData(csvText, sheetName);
        
        self.postMessage({ status: 'success', sheetName, data: dataMap });
    } catch (error) {
        self.postMessage({ status: 'error', sheetName, message: error.message });
    }
};
