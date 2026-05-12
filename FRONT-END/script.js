const API_URL = 'http://localhost:3000';
let usuarioLogado = null;
let meuGrafico = null;
let estoqueLocal = []; 

// --- FUNÇÃO DE AUTENTICAÇÃO ---

async function logar() {
    const email = document.getElementById('email').value;
    const cargo = document.getElementById('cargo').value;
    const termos = document.getElementById('termos').checked;

    if (!termos) {
        alert("Você precisa aceitar os Termos de Uso.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, cargo })
        });

        if (!response.ok) throw new Error("Acesso negado. Verifique suas credenciais.");

        usuarioLogado = await response.json();
        
        document.getElementById('login-view').classList.add('hidden');
        
        if (usuarioLogado.cargo === 'Cozinheira') {
            document.getElementById('cozinha-view').classList.remove('hidden');
            document.getElementById('user-display').innerText = usuarioLogado.nome;
            carregarSelectCozinha();
        } 
        else if (usuarioLogado.cargo === 'Diretor') {
            document.getElementById('diretor-view').classList.remove('hidden');
            document.getElementById('admin-display').innerText = usuarioLogado.nome;
            
            // Inicializa dados do Diretor
            renderizarGrafico();
            verGastoDoDia();
            carregarSelectExclusao(); // Carrega a lista para deletar itens
        }

    } catch (error) {
        alert("Erro: " + error.message);
    }
}

// --- FUNÇÕES DA COZINHEIRA ---

async function carregarSelectCozinha() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        estoqueLocal = await res.json();
        
        const select = document.getElementById('alimento');
        if (!select) return;

        if (estoqueLocal.length === 0) {
            select.innerHTML = '<option value="">Nenhum item disponível</option>';
            return;
        }

        select.innerHTML = estoqueLocal.map(item => 
            `<option value="${item.item}">${item.item}</option>`
        ).join('');
        
        mostrarInfoExtra();
    } catch (error) {
        console.error("Erro ao carregar estoque:", error);
    }
}

function mostrarInfoExtra() {
    const nomeSelecionado = document.getElementById('alimento').value;
    const item = estoqueLocal.find(i => i.item === nomeSelecionado);
    
    if (item) {
        document.getElementById('display-lote').innerText = item.lote || 'N/A';
        document.getElementById('display-validade').innerText = item.validade || 'N/A';
        document.getElementById('display-atual').innerText = `${item.quantidade} ${item.unidade || 'kg'}`;
    }
}

async function enviarBaixa() {
    const itemNome = document.getElementById('alimento').value;
    const quantidade = document.getElementById('qtd').value;
    const msgElement = document.getElementById('msg');

    if (!quantidade || quantidade <= 0) {
        alert("Insira uma quantidade válida.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/baixa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itemNome, 
                quantidade: Number(quantidade), 
                userId: usuarioLogado.id 
            })
        });

        const data = await response.json();

        if (response.ok) {
            msgElement.innerText = `✅ Baixa confirmada!`;
            document.getElementById('qtd').value = ''; 
            await carregarSelectCozinha();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert("Erro na conexão com o servidor.");
    }
}

// --- FUNÇÕES DO DIRETOR ---

// Função para popular o select de exclusão
async function carregarSelectExclusao() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        const itens = await res.json();
        const select = document.getElementById('delete-alimento-select');
        
        if (select) {
            select.innerHTML = '<option value="">Selecione para excluir...</option>' + 
                itens.map(i => `<option value="${i.item}">${i.item}</option>`).join('');
        }
    } catch (error) {
        console.error("Erro ao carregar lista de exclusão");
    }
}

// NOVA FUNÇÃO: Remover item do banco
async function removerItemEstoque() {
    const item = document.getElementById('delete-alimento-select').value;

    if (!item) {
        alert("Selecione um alimento para excluir.");
        return;
    }

    if (!confirm(`⚠️ ATENÇÃO: Deseja apagar permanentemente o item "${item}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/estoque/${item}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            // Atualiza todas as listas e o gráfico
            carregarSelectExclusao();
            renderizarGrafico();
            verGastoDoDia();
        } else {
            alert("Erro: " + data.error);
        }
    } catch (error) {
        alert("Erro ao conectar com o servidor.");
    }
}

async function adicionarNovoEstoque() {
    const item = document.getElementById('add-nome').value;
    const quantidade = document.getElementById('add-qtd').value;
    const lote = document.getElementById('add-lote').value;
    const validade = document.getElementById('add-validade').value;

    if (!item || !quantidade || !lote || !validade) {
        alert("Preencha todos os campos.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/estoque/adicionar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, quantidade, lote, validade })
        });

        if (response.ok) {
            alert("✅ Sucesso!");
            document.getElementById('add-nome').value = '';
            document.getElementById('add-qtd').value = '';
            document.getElementById('add-lote').value = '';
            document.getElementById('add-validade').value = '';
            
            renderizarGrafico();
            verGastoDoDia();
            carregarSelectExclusao(); // Atualiza o select de deletar
        }
    } catch (error) {
        alert("Erro na conexão.");
    }
}

async function verGastoDoDia() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();
        const hoje = new Date().toLocaleDateString('pt-BR');
        
        const gastosHoje = logs.filter(log => log.data === hoje);
        const container = document.getElementById('lista-dia');
        
        if (!container) return;

        container.innerHTML = gastosHoje.length > 0 
            ? gastosHoje.map(g => `
                <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
                    <strong>🕒 ${g.usuario}</strong> retirou 
                    <span style="color: #e11d48; font-weight: bold;">${g.quantidade}kg</span> 
                    de <b>${g.item}</b>
                </div>
            `).join('')
            : "<p style='color: #64748b;'>Nenhum gasto registrado hoje.</p>";
    } catch (e) {
        console.error("Erro ao carregar gastos:", e);
    }
}

async function renderizarGrafico() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();

        const resumo = {};
        logs.forEach(log => {
            resumo[log.item] = (resumo[log.item] || 0) + Number(log.quantidade);
        });

        const canvas = document.getElementById('graficoGastos');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (meuGrafico) meuGrafico.destroy();

        meuGrafico = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(resumo),
                datasets: [{
                    label: 'Consumo Acumulado (kg)',
                    data: Object.values(resumo),
                    backgroundColor: '#2563eb',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    } catch (error) {
        console.error("Erro ao gerar gráfico:", error);
    }
}