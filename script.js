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
            
            if (values.length > 2) { // Asegúrate de que la fila tenga al menos 3 columnas
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
        document.getElementById('result').textContent = 'Error: No se pudieron cargar los datos de validación.';
        document.getElementById('result').style.color = 'red';
    }
};

loadData();

document.getElementById('validate-button').addEventListener('click', () => {
    const input = document.getElementById('serie-input').value.trim().toUpperCase();
    const resultDiv = document.getElementById('result');

    if (input === '') {
        resultDiv.textContent = 'Por favor, ingresa un número de serie.';
        resultDiv.style.color = 'orange';
        return;
    }

    const data = dataMap.get(input);

    if (data) {
        let resultHTML = `<span style="color: green;">✅ La serie "${input}" es válida.</span><br><br>`;
        
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'serie' && value.trim() !== '') {
                resultHTML += `<strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}<br>`;
            }
        }
        
        resultDiv.innerHTML = resultHTML;
    } else {
        resultDiv.innerHTML = `<span style="color: red;">❌ La serie "${input}" no se encontró.</span>`;
    }
});
