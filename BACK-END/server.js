import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3'; // Certifique-se de instalar: npm install better-sqlite3

const __dirname = dirname(fileURLToPath(import.meta.url));
const pastaFrontEnd = join(__dirname, '..', 'FRONT-END');

// --- CONFIGURAÇÃO DO BANCO DE DADOS SQLITE ---
const db = new Database('escola.db');

// Criar as tabelas se elas não existirem
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT UNIQUE,
        cargo TEXT
    );

    CREATE TABLE IF NOT EXISTS estoque (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT UNIQUE,
        quantidade REAL
    );

    CREATE TABLE IF NOT EXISTS consumo_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT,
        quantidade REAL,
        data TEXT,
        usuario TEXT,
        timestamp TEXT
    );
`);

// Popular o banco pela primeira vez se estiver vazio
const checkUsers = db.prepare('SELECT count(*) as count FROM usuarios').get();
if (checkUsers.count === 0) {
    db.prepare('INSERT INTO usuarios (nome, email, cargo) VALUES (?, ?, ?)').run('Admin', 'diretor@escola.com', 'Diretor');
    db.prepare('INSERT INTO usuarios (nome, email, cargo) VALUES (?, ?, ?)').run('Maria', 'cozinha@escola.com', 'Cozinheira');
    
    db.prepare('INSERT INTO estoque (item, quantidade) VALUES (?, ?)').run('Arroz', 50);
    db.prepare('INSERT INTO estoque (item, quantidade) VALUES (?, ?)').run('Feijão', 30);
    console.log("🌱 Banco inicializado com dados padrão.");
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(pastaFrontEnd));

// --- ROTAS DE LOGIN E BUSCA ---

app.post('/login', (req, res) => {
    const { email, cargo } = req.body;
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND cargo = ?').get(email, cargo);
    
    if (user) {
        res.json(user);
    } else {
        res.status(401).json({ error: "Credenciais inválidas." });
    }
});

app.get('/relatorios', (req, res) => {
    const logs = db.prepare('SELECT * FROM consumo_log ORDER BY id DESC').all();
    res.json(logs);
});

// --- ROTAS OPERACIONAIS (COZINHEIRA) ---

app.post('/baixa', (req, res) => {
    const { itemNome, quantidade, userId } = req.body;
    
    const user = db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(userId);
    const item = db.prepare('SELECT quantidade FROM estoque WHERE item = ?').get(itemNome);

    if (!item || item.quantidade < quantidade) {
        return res.status(400).json({ error: "Estoque insuficiente!" });
    }

    const novaQtd = item.quantidade - Number(quantidade);
    
    // Atualiza o estoque e registra o log em uma "transação" simples
    const updateEstoque = db.prepare('UPDATE estoque SET quantidade = ? WHERE item = ?');
    const insertLog = db.prepare('INSERT INTO consumo_log (item, quantidade, data, usuario, timestamp) VALUES (?, ?, ?, ?, ?)');

    updateEstoque.run(novaQtd, itemNome);
    insertLog.run(
        itemNome, 
        Number(quantidade), 
        new Date().toLocaleDateString('pt-BR'), 
        user.nome, 
        new Date().toISOString()
    );

    res.json({ message: "Baixa registrada!", novoEstoque: novaQtd });
});

// --- ROTAS ADMINISTRATIVAS (DIRETOR) ---

app.put('/estoque', (req, res) => {
    const { itemNome, novaQuantidade } = req.body;
    
    const info = db.prepare('UPDATE estoque SET quantidade = ? WHERE item = ?').run(Number(novaQuantidade), itemNome);
    
    if (info.changes > 0) {
        console.log(`🛠️ SQLITE: Estoque de ${itemNome} alterado para ${novaQuantidade}`);
        res.json({ message: "Banco de dados atualizado!", novoTotal: novaQuantidade });
    } else {
        res.status(404).json({ error: "Alimento não encontrado." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(join(pastaFrontEnd, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
    ==========================================
    🚀 SERVIDOR SQLITE RODANDO: http://localhost:${PORT}
    📂 ARQUIVO DE BANCO: escola.db
    ==========================================
    `);
});