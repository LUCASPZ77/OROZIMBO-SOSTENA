import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pastaFrontEnd = join(__dirname, '..', 'FRONT-END');

const db = new Database('escola.db');

// --- 1. CONFIGURAÇÃO DO BANCO DE DADOS ---
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        sobrenome TEXT,
        email TEXT UNIQUE,
        cpf TEXT UNIQUE,
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
        prato TEXT,
        periodo TEXT,
        timestamp TEXT
    );
`);

const TOKENS_MESTRES = {
    'Diretor': 'DIR-2026-MASTER',
    'Cozinheira': 'COZ-2026-SCHOOL'
};

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(pastaFrontEnd));

// --- 3. ROTAS DE USUÁRIOS ---

app.post('/usuarios/registrar', (req, res) => {
    const { nome, sobrenome, email, cpf, cargo } = req.body;
    try {
        const insert = db.prepare(`
            INSERT INTO usuarios (nome, sobrenome, email, cpf, cargo) 
            VALUES (?, ?, ?, ?, ?)
        `).run(nome, sobrenome, email, cpf, cargo);
        res.json({ message: "Usuário cadastrado com sucesso!", id: insert.lastInsertRowid });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: "Este CPF ou E-mail já está cadastrado." });
        } else {
            res.status(500).json({ error: "Erro no servidor: " + error.message });
        }
    }
});

app.post('/login', (req, res) => {
    const { cpf, token } = req.body;
    try {
        const user = db.prepare('SELECT * FROM usuarios WHERE cpf = ?').get(cpf);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        const tokenCorreto = TOKENS_MESTRES[user.cargo];
        if (token !== tokenCorreto) return res.status(401).json({ error: "Token inválido!" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Erro ao processar login." });
    }
});

// --- 4. RELATÓRIOS, HISTÓRICO E NOVA FUNÇÃO DE FILTRO ---

// ROTA ATUALIZADA: Pega tudo por padrão
app.get('/relatorios', (req, res) => {
    const logs = db.prepare('SELECT * FROM consumo_log ORDER BY id DESC').all();
    res.json(logs);
});

// >>> NOVA FUNÇÃO: Rota para filtrar por data (Semana, Mês ou Dia) <<<
app.get('/relatorios/filtro', (req, res) => {
    const { inicio, fim } = req.query; 
    try {
        // Busca logs que estão entre a data de início e fim
        const logs = db.prepare(`
            SELECT * FROM consumo_log 
            WHERE data BETWEEN ? AND ? 
            ORDER BY id DESC
        `).all(inicio, fim);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: "Erro ao filtrar histórico." });
    }
});

app.delete('/relatorios/:timestamp', (req, res) => {
    const { timestamp } = req.params;
    try {
        const resultado = db.prepare('DELETE FROM consumo_log WHERE timestamp = ?').run(timestamp);
        resultado.changes > 0 
            ? res.json({ message: "Registro removido." }) 
            : res.status(404).json({ error: "Não encontrado." });
    } catch (error) {
        res.status(500).json({ error: "Erro ao excluir." });
    }
});

// --- 5. OPERAÇÕES DA COZINHA (ESTOQUE) ---

app.get('/lista-estoque', (req, res) => {
    const itens = db.prepare('SELECT * FROM estoque WHERE quantidade > 0').all();
    res.json(itens);
});

app.post('/baixa', (req, res) => {
    const { prato, periodo, itens, usuarioNome } = req.body;
    if (!itens || itens.length === 0) return res.status(400).json({ error: "Lista vazia!" });

    // Pegamos a data atual no formato YYYY-MM-DD para o filtro funcionar 100%
    const dataHoje = new Date().toISOString().split('T')[0];

    const realizarBaixa = db.transaction((lista) => {
        for (const r of lista) {
            const estoqueAtual = db.prepare('SELECT quantidade FROM estoque WHERE item = ?').get(r.itemNome);
            if (!estoqueAtual || estoqueAtual.quantidade < r.quantidade) {
                throw new Error(`Estoque insuficiente: ${r.itemNome}`);
            }
            const novaQtd = estoqueAtual.quantidade - Number(r.quantidade);
            db.prepare('UPDATE estoque SET quantidade = ? WHERE item = ?').run(novaQtd, r.itemNome);

            db.prepare(`
                INSERT INTO consumo_log (item, quantidade, data, usuario, prato, periodo, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                r.itemNome, 
                Number(r.quantidade), 
                dataHoje, // Gravando YYYY-MM-DD
                usuarioNome, 
                prato, 
                periodo, 
                new Date().toISOString()
            );
        }
    });

    try {
        realizarBaixa(itens);
        res.json({ message: "Estoque atualizado!" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- 6. OPERAÇÕES DO DIRETOR ---

app.post('/estoque/adicionar', (req, res) => {
    const { item, quantidade, lote, validade } = req.body;
    try {
        const itemExistente = db.prepare('SELECT id FROM estoque WHERE item = ?').get(item);
        if (itemExistente) {
            db.prepare('UPDATE estoque SET quantidade = quantidade + ?, lote = ?, validade = ? WHERE item = ?')
              .run(Number(quantidade), lote, validade, item);
        } else {
            db.prepare('INSERT INTO estoque (item, quantidade, lote, validade) VALUES (?, ?, ?, ?)')
              .run(item, Number(quantidade), lote, validade);
        }
        res.json({ message: "Estoque atualizado!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao adicionar." });
    }
});

app.delete('/estoque/:item', (req, res) => {
    try {
        db.prepare('DELETE FROM estoque WHERE item = ?').run(req.params.item);
        res.json({ message: "Item removido." });
    } catch (error) {
        res.status(500).json({ error: "Erro ao excluir." });
    }
});

app.get('/', (req, res) => res.sendFile(join(pastaFrontEnd, 'index.html')));

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));