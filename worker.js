// worker.js

// --- CONFIGURACIÓN DE ACCESO A GOOGLE SHEETS ---
const sheetURLs = {
    // AÑADIMOS HOJA 1
    'Hoja 1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=0&single=true&output=csv',
    'BBDD PM 4': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?gid=1086366835&single=true&output=csv',
};

// ... (todas las funciones: sanitizeKey, fetchSheet, loadSheetData, parseLine, attemptParse son las mismas) ...

// --- MANEJO DE MENSAJES DEL WORKER ---
self.onmessage = async (e) => {
    const { sheetName } = e.data; // Recibe qué hoja debe cargar
    
    try {
        const csvText = await fetchSheet(sheetURLs[sheetName], sheetName);
        const dataMap = loadSheetData(csvText, sheetName);
        
        // Envía el resultado al hilo principal (script.js)
        self.postMessage({ status: 'success', sheetName, data: dataMap });
    } catch (error) {
        // Envía el error al hilo principal
        self.postMessage({ status: 'error', sheetName, message: error.message });
    }
};
