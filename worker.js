// worker.js

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// --- Funciones de Utilidad y Carga (Iguales a las de tu script.js) ---

const sanitizeKey = (key) => {
    if (typeof key !== 'string') return '';
    return key.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const fetchSheet = async (url, sheetName) => {
    const TIMEOUT_MS = 30000; 
    try {
        // La lógica de fetch es la misma
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
        throw new Error(`Fallo en descarga de ${sheetName}: ${error.message}`); 
    }
};

const loadSheetData = (csvText, sheetName) => {
    // ESTA ES LA FUNCIÓN QUE CAUSABA EL CONGELAMIENTO
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error('No hay suficientes datos para procesar.');

    const possibleSeparators = [',', ';'];
    
    // ... (El resto de la lógica interna de parseLine y attemptParse, que es idéntica a tu código más reciente) ...

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
        
        if (sheetName === 'Hoja 1') {
            serieIndex = headers.indexOf('serie'); 
        } else if (sheetName === 'BBDD PM 4') {
            serieIndex = headers.indexOf('serie reportada');
            n2Index = headers.indexOf('nivel 2');
        }

        if (serieIndex === -1) return { valid: false }; 
        if (sheetName === 'BBDD PM 4' && n2Index === -1) return { valid: false }; 

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
        const result = attemptParse(sep);
        if (result.valid) {
            return result.data; 
        }
    }

    throw new Error(`No se pudo interpretar el CSV de "${sheetName}".`);
};

// --- MANEJO DE MENSAJES DEL WORKER ---
self.onmessage = async (e) => {
    const { sheetName } = e.data;

    if (sheetName === 'BBDD PM 4') {
        try {
            const csvText = await fetchSheet(sheetURLs[sheetName], sheetName);
            const problemsMap = loadSheetData(csvText, sheetName);
            
            // Envía el resultado al hilo principal (script.js)
            self.postMessage({ status: 'success', sheetName, data: problemsMap });
        } catch (error) {
            // Envía el error al hilo principal
            self.postMessage({ status: 'error', sheetName, message: error.message });
        }
    }
};
