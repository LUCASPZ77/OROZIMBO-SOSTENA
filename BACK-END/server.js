import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pastaFrontEnd = join(__dirname, '..', 'FRONT-END');

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const db = new Database('escola.db');

// 1. Criação das tabelas
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
        quantidade REAL,
        lote TEXT,
        validade TEXT,
        unidade TEXT DEFAULT 'kg'
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

// 2. Popular dados iniciais
const checkUsers = db.prepare('SELECT count(*) as count FROM usuarios').get();
if (checkUsers.count === 0) {
    db.prepare('INSERT INTO usuarios (nome, email, cargo) VALUES (?, ?, ?)').run('Admin', 'diretor@escola.com', 'Diretor');
    db.prepare('INSERT INTO usuarios (nome, email, cargo) VALUES (?, ?, ?)').run('Maria', 'cozinha@escola.com', 'Cozinheira');
    
    db.prepare('INSERT INTO estoque (item, quantidade, lote, validade) VALUES (?, ?, ?, ?)').run('Arroz', 50, 'ABC-123', '2026-12-01');
    db.prepare('INSERT INTO estoque (item, quantidade, lote, validade) VALUES (?, ?, ?, ?)').run('Feijão', 30, 'XYZ-987', '2026-11-15');
    console.log("🌱 Banco inicializado com sucesso.");
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(pastaFrontEnd));

// --- 3. ROTAS DE AUTENTICAÇÃO E RELATÓRIO ---

app.post('/login', (req, res) => {
    const { email, cargo } = req.body;
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND cargo = ?').get(email, cargo);
    user ? res.json(user) : res.status(401).json({ error: "Credenciais inválidas." });
});

app.get('/relatorios', (req, res) => {
    const logs = db.prepare('SELECT * FROM consumo_log ORDER BY id DESC').all();
    res.json(logs);
});

// --- 4. ROTAS DA COZINHEIRA ---

app.get('/lista-estoque', (req, res) => {
    // Retorna todos os itens para o diretor, mas você pode filtrar quantidade > 0 para a cozinha no front
    const itens = db.prepare('SELECT * FROM estoque').all();
    res.json(itens);
});

app.post('/baixa', (req, res) => {
    const { itemNome, quantidade, userId } = req.body;
    const user = db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(userId);
    const item = db.prepare('SELECT * FROM estoque WHERE item = ?').get(itemNome);

    if (!item || item.quantidade < quantidade) {
        return res.status(400).json({ error: "Estoque insuficiente ou item não encontrado!" });
    }

    const novaQtd = item.quantidade - Number(quantidade);
    db.prepare('UPDATE estoque SET quantidade = ? WHERE item = ?').run(novaQtd, itemNome);
    db.prepare('INSERT INTO consumo_log (item, quantidade, data, usuario, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(itemNome, Number(quantidade), new Date().toLocaleDateString('pt-BR'), user.nome, new Date().toISOString());

    res.json({ message: "Baixa registrada com sucesso!", novoEstoque: novaQtd });
});

// --- 5. ROTAS DO DIRETOR (GERENCIAMENTO) ---

// Adicionar ou Abastecer
app.post('/estoque/adicionar', (req, res) => {
    const { item, quantidade, lote, validade } = req.body;
    try {
        const itemExistente = db.prepare('SELECT id FROM estoque WHERE item = ?').get(item);
        if (itemExistente) {
            db.prepare('UPDATE estoque SET quantidade = quantidade + ?, lote = ?, validade = ? WHERE item = ?')
              .run(Number(quantidade), lote, validade, item);
            res.json({ message: "Estoque abastecido com sucesso!" });
        } else {
            db.prepare('INSERT INTO estoque (item, quantidade, lote, validade) VALUES (?, ?, ?, ?)')
              .run(item, Number(quantidade), lote, validade);
            res.json({ message: "Novo alimento cadastrado com sucesso!" });
        }
    } catch (error) {
        res.status(500).json({ error: "Erro ao processar entrada." });
    }
});

// NOVA FUNÇÃO: Remover item permanentemente
app.delete('/estoque/:item', (req, res) => {
    const itemNome = req.params.item;
    try {
        const resultado = db.prepare('DELETE FROM estoque WHERE item = ?').run(itemNome);
        if (resultado.changes > 0) {
            res.json({ message: `O item "${itemNome}" foi removido do sistema.` });
        } else {
            res.status(404).json({ error: "Item não encontrado para exclusão." });
        }
    } catch (error) {
        res.status(500).json({ error: "Erro interno ao tentar excluir item." });
    }
});

// Edição manual de quantidade
app.put('/estoque', (req, res) => {
    const { itemNome, novaQuantidade } = req.body;
    const info = db.prepare('UPDATE estoque SET quantidade = ? WHERE item = ?').run(Number(novaQuantidade), itemNome);
    info.changes > 0 ? res.json({ message: "Quantidade atualizada!" }) : res.status(404).json({ error: "Item não encontrado." });
});

app.get('/', (req, res) => res.sendFile(join(pastaFrontEnd, 'index.html')));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});