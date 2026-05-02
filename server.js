const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Asegurar que existe el directorio de uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Archivo para guardar usuarios
const USERS_FILE = path.join(__dirname, 'users.json');

// Inicializar archivo de usuarios si no existe
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// ============ FUNCIONES DE USUARIOS ============

function getUsers() {
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ============ RUTAS DE AUTENTICACIÓN ============

// Registro de usuario
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const users = getUsers();
    
    // Verificar si el email ya existe
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    // Verificar si el username ya existe
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    try {
        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Crear nuevo usuario
        const newUser = {
            id: crypto.randomBytes(16).toString('hex'),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers(users);
        
        // Crear carpeta para los archivos del usuario
        const userFolder = path.join(UPLOAD_DIR, newUser.id);
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder);
        }
        
        res.json({ success: true, message: 'Usuario creado exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    try {
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        
        // Generar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// Verificar token
app.post('/api/verify', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Token inválido' });
    }
});

// ============ RUTAS DE ARCHIVOS (LOCALES) ============

// Middleware para verificar token
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
}

// Configurar Multer para guardar archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userFolder = path.join(UPLOAD_DIR, req.user.id);
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }
        cb(null, userFolder);
    },
    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${randomName}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Subir archivo
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Archivo de metadatos del usuario
    const metadataFile = path.join(UPLOAD_DIR, req.user.id, 'metadata.json');
    let userFiles = [];
    
    if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile);
        userFiles = JSON.parse(data);
    }
    
    const fileMetadata = {
        id: path.parse(req.file.filename).name,
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
        date: new Date().toISOString()
    };
    
    userFiles.push(fileMetadata);
    fs.writeFileSync(metadataFile, JSON.stringify(userFiles, null, 2));
    
    // URL para acceder al archivo
    const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.user.id}/${req.file.filename}`;
    
    res.json({ success: true, url: fileUrl, file: fileMetadata });
});

// Servir archivos estáticos
app.get('/files/:userId/:filename', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.userId, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Obtener archivos del usuario
app.get('/api/my-files', authMiddleware, (req, res) => {
    const metadataFile = path.join(UPLOAD_DIR, req.user.id, 'metadata.json');
    
    if (!fs.existsSync(metadataFile)) {
        return res.json({ files: [] });
    }
    
    try {
        const data = fs.readFileSync(metadataFile);
        const files = JSON.parse(data);
        
        // Agregar URL a cada archivo
        const filesWithUrl = files.map(file => ({
            ...file,
            url: `${req.protocol}://${req.get('host')}/files/${req.user.id}/${file.filename}`
        }));
        
        res.json({ files: filesWithUrl });
    } catch (error) {
        res.json({ files: [] });
    }
});

// Eliminar archivo
app.delete('/api/delete/:fileId', authMiddleware, (req, res) => {
    const { fileId } = req.params;
    const metadataFile = path.join(UPLOAD_DIR, req.user.id, 'metadata.json');
    
    if (!fs.existsSync(metadataFile)) {
        return res.status(404).json({ error: 'No files found' });
    }
    
    try {
        const data = fs.readFileSync(metadataFile);
        let userFiles = JSON.parse(data);
        const fileToDelete = userFiles.find(f => f.id === fileId);
        
        if (!fileToDelete) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Eliminar archivo físico
        const filePath = path.join(UPLOAD_DIR, req.user.id, fileToDelete.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // Eliminar metadata
        userFiles = userFiles.filter(f => f.id !== fileId);
        fs.writeFileSync(metadataFile, JSON.stringify(userFiles, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error deleting file' });
    }
});

// Servir index.html para todas las rutas no API
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});