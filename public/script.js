let dropArea = document.getElementById('drop-area');
let progressBar = document.getElementById('progress-bar');
let resultArea = document.getElementById('result-area');
let fileList = document.getElementById('file-list');

// Evitar comportamientos por defecto para drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Resaltar área al arrastrar
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropArea.classList.add('highlight');
}

function unhighlight(e) {
    dropArea.classList.remove('highlight');
}

// Manejar archivos soltados
dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    ([...files]).forEach(uploadFile);
}

function uploadFile(file) {
    let url = '/upload';
    let formData = new FormData();
    formData.append('file', file);

    progressBar.style.display = 'block';

    let xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    // Track upload progress
    xhr.upload.addEventListener("progress", function(e) {
        if (e.lengthComputable) {
            let percentComplete = (e.loaded / e.total) * 100;
            progressBar.value = percentComplete;
        }
    }, false);

    xhr.onload = function() {
        if (xhr.status === 200) {
            let data = JSON.parse(xhr.responseText);
            if (data.url) {
                addFileResult(file.name, data.url);
            } else {
                alert('Error al subir el archivo ' + file.name);
            }
        } else {
            alert('Error al subir el archivo ' + file.name);
        }
        
        // Hide progress bar if all files are likely done (simplification)
        setTimeout(() => {
            progressBar.style.display = 'none';
            progressBar.value = 0;
        }, 1000);
    };

    xhr.onerror = function() {
        alert('Error en la conexión al subir ' + file.name);
        progressBar.style.display = 'none';
    };

    xhr.send(formData);
}

function addFileResult(fileName, url) {
    resultArea.classList.remove('hidden');
    
    let item = document.createElement('div');
    item.className = 'link-container';
    item.innerHTML = `
        <input type="text" value="${url}" readonly>
        <button onclick="copyToClipboard(this)">Copiar</button>
    `;
    
    let title = document.createElement('p');
    title.innerText = fileName;
    title.style.margin = '10px 0 5px 0';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'left';

    fileList.appendChild(title);
    fileList.appendChild(item);
}

function copyToClipboard(btn) {
    let input = btn.previousElementSibling;
    input.select();
    document.execCommand('copy');
    btn.innerText = '¡Copiado!';
    setTimeout(() => {
        btn.innerText = 'Copiar';
    }, 2000);
}
