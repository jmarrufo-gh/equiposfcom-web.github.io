// La URL de tu hoja de cálculo no cambia. Es la misma que ya usaste.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCZ0aHZlTcVbl13k7sBYGWh1JQr9KVzzaTT08GLbNKMD6Uy8hCmtb2mS_ehnSAJwegxVWt4E80rSrr/pub?output=csv';

// Usamos un objeto Map para almacenar los datos.
// La clave será la serie y el valor será un objeto con el resto de los datos.
const dataMap = new Map();
let headers = [];

// Función para parsear el CSV y guardar los datos
const loadData = async () => {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error('Error al cargar la hoja de cálculo.');
        }
        const data = await response.text();
        const lines = data.split('\n');

        // La primera línea son los encabezados (headers)
        if (lines.length > 0) {
            headers = lines[0].trim().split(',').map(header => header.trim().toLowerCase());
        }

        // Procesar las demás líneas (los datos)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split(',').map(value => value.trim());
                const serie = values[0].toUpperCase();

                // Crear un objeto para cada fila con los datos completos
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = values[index];
                });

                dataMap.set(serie, rowData);
            }
        }
        console.log(`Se cargaron ${dataMap.size} series con datos adicionales.`);

    } catch (error) {
        console.error('Hubo un problema al cargar los datos:', error);
        document.getElementById('result').textContent = 'Error: No se pudieron cargar los datos de validación.';
        document.getElementById('result').style.color = 'red';
    }
};

// Cargar los datos al iniciar la página
loadData();

document.getElementById('validate-button').addEventListener('click', () => {
    const input = document.getElementById('serie-input').value.trim().toUpperCase();
    const resultDiv = document.getElementById('result');

    if (input === '') {
        resultDiv.textContent = 'Por favor, ingresa un número de serie.';
        resultDiv.style.color = 'orange';
        return;
    }

    // Buscar la serie en el Map
    const data = dataMap.get(input);

    if (data) {
        // Si se encuentra, construir el mensaje con la información completa
        let resultHTML = `<span style="color: green;">✅ La serie "${input}" es válida.</span><br><br>`;
        
        // Iterar sobre los datos y mostrarlos
        for (const [key, value] of Object.entries(data)) {
            // Ignorar la serie en el listado, ya que ya se mostró
            if (key !== 'serie') {
                resultHTML += `<strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}<br>`;
            }
        }
        
        resultDiv.innerHTML = resultHTML;
    } else {
        // Si no se encuentra, mostrar el mensaje de error
        resultDiv.innerHTML = `<span style="color: red;">❌ La serie "${input}" no se encontró.</span>`;
    }
});