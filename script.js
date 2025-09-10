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
            headers = lines[0].trim().split(',').map(header => header.trim().toLowerCase());
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(value => value.trim());
            
            if (values.length > 2 && values[2]) { 
                const serie = values[2].toUpperCase();
                
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
        
        // Construir el HTML priorizando el 'proyecto'
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'serie' && value && value.trim() !== '') {
                const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
                
                if (key === 'proyecto') { // Si es el proyecto, lo añadimos primero
                    resultHTML += `<div class="result-item highlight"><strong>${displayKey}:</strong> ${value}</div>`;
                }
            }
        }

        // Luego, añadir el resto de los datos (excepto el proyecto y la serie)
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'serie' && key !== 'proyecto' && value && value.trim() !== '') {
                const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
                resultHTML += `<div class="result-item"><strong>${displayKey}:</strong> ${value}</div>`;
            }
        }
        
        resultDiv.innerHTML = resultHTML;
    } else {
        resultDiv.innerHTML = `<p class="error-message">Serie "${input}" no encontrada.</p>`;
    }
});
