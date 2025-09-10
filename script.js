const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?output=csv';

const dataMap = new Map();
let headers = [];

const loadData = async () => {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error(`Error: No se pudo acceder a la URL. Estado: ${response.status}`);
        }
        const data = await response.text();
        const lines = data.split('\n').filter(line => line.trim() !== '');

        if (lines.length > 0) {
            // Limpia y convierte a minúsculas los encabezados
            headers = lines[0].trim().split(',').map(header => header.trim().toLowerCase());
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(value => value.trim());
            
            // Asegúrate de que la fila tenga suficientes columnas para la serie (índice 2)
            if (values.length > 2 && values[2]) { 
                const serie = values[2].toUpperCase(); // La tercera columna es la serie (índice 2)
                
                if (serie) {
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = values[index];
                    });
                    dataMap.set(serie, rowData);
                }
            }
        }
        console.log(`Se cargaron ${dataMap.size} series con datos adicionales.`);
    } catch (error) {
        console.error('Hubo un problema al cargar los datos:', error);
        document.getElementById('result').innerHTML = `<p class="error-message">Error al cargar datos de validación.</p>`;
    }
};

loadData();

document.getElementById('validate-button').addEventListener('click', () => {
    const input = document.getElementById('serie-input').value.trim().toUpperCase();
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = ''; // Limpiar resultados anteriores

    if (input === '') {
        resultDiv.innerHTML = `<p class="error-message">Por favor, ingresa un número de serie.</p>`;
        return;
    }

    const data = dataMap.get(input);

    if (data) {
        let resultHTML = '';
        
        // Mostrar la serie en sí primero, si lo deseas, pero el requisito era no mostrar "es válida"
        // Si quieres que la serie aparezca como un dato más, puedes hacerlo aquí
        // resultHTML += `<div class="result-item"><strong>Serie:</strong> ${input}</div>`;

        // Iterar sobre los datos y mostrarlos
        for (const [key, value] of Object.entries(data)) {
            // Evitar mostrar la serie dos veces y ocultar campos vacíos
            if (key !== 'serie' && value && value.trim() !== '') {
                const displayKey = key.charAt(0).toUpperCase() + key.slice(1); // Capitalizar la clave
                
                if (key === 'proyecto') { // Resaltar el Proyecto
                    resultHTML += `<div class="result-item highlight"><strong>${displayKey}:</strong> ${value}</div>`;
                } else {
                    resultHTML += `<div class="result-item"><strong>${displayKey}:</strong> ${value}</div>`;
                }
            }
        }
        
        resultDiv.innerHTML = resultHTML;
    } else {
        resultDiv.innerHTML = `<p class="error-message">Serie "${input}" no encontrada.</p>`;
    }
});
