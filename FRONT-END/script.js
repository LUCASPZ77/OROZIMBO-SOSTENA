const API_URL = 'http://localhost:3000';
let usuarioLogado = null;
let meuGrafico = null;
let estoqueLocal = []; 
let itensParaBaixa = []; // Lista temporária para a cozinha

// --- FUNÇÃO DE DATA E HORA ---

function atualizarDataVisor() {
    const agora = new Date();
    const opcoes = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const dataFormatada = agora.toLocaleDateString('pt-BR', opcoes);
    const elementoData = document.getElementById('data-atual');
    
    if (elementoData) {
        elementoData.innerText = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
    }

    // Se o diretor estiver logado, atualiza os dados automaticamente
    if (usuarioLogado && usuarioLogado.cargo === 'Diretor') {
        verGastoDoDia();
    }
}

// Inicializa a data e define o intervalo de atualização
atualizarDataVisor();
setInterval(atualizarDataVisor, 3600000);

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
        atualizarDataVisor(); 
        
        if (usuarioLogado.cargo === 'Cozinheira') {
            document.getElementById('cozinha-view').classList.remove('hidden');
            document.getElementById('user-display').innerText = usuarioLogado.nome;
            carregarSelectCozinha();
        } 
        else if (usuarioLogado.cargo === 'Diretor') {
            document.getElementById('diretor-view').classList.remove('hidden');
            document.getElementById('admin-display').innerText = usuarioLogado.nome;
            
            renderizarGrafico();
            verGastoDoDia();
            carregarSelectExclusao();
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

        select.innerHTML = estoqueLocal.length === 0 
            ? '<option value="">Nenhum item disponível</option>'
            : estoqueLocal.map(item => `<option value="${item.item}">${item.item}</option>`).join('');
        
        mostrarInfoExtra();
    } catch (error) {
        console.error("Erro ao carregar estoque:", error);
    }
}

function mostrarInfoExtra() {
    const nomeSelecionado = document.getElementById('alimento').value;
    const item = estoqueLocal.find(i => i.item === nomeSelecionado);
    
    if (item) {
        document.getElementById('display-atual').innerText = `${item.quantidade} ${item.unidade || 'kg'}`;
    }
}

function adicionarItemNaLista() {
    const itemNome = document.getElementById('alimento').value;
    const quantidade = document.getElementById('qtd').value;

    if (!itemNome || !quantidade || quantidade <= 0) {
        alert("Selecione o item e a quantidade corretamente.");
        return;
    }

    if (itensParaBaixa.some(i => i.itemNome === itemNome)) {
        alert("Este item já está na lista da refeição.");
        return;
    }

    itensParaBaixa.push({ itemNome, quantidade: Number(quantidade) });

    const listaUl = document.getElementById('lista-temporaria-itens');
    const li = document.createElement('li');
    li.style = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 8px 0; font-size: 0.9rem;";
    li.innerHTML = `
        <span>🍴 <b>${itemNome}</b> - ${quantidade}kg/un</span>
        <button onclick="removerDaListaTemporaria(this, '${itemNome}')" style="background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; padding:2px 10px; font-size:0.7rem;">Remover</button>
    `;
    listaUl.appendChild(li);

    document.getElementById('qtd').value = '';
}

function removerDaListaTemporaria(btn, nome) {
    itensParaBaixa = itensParaBaixa.filter(i => i.itemNome !== nome);
    btn.parentElement.remove();
}

async function enviarBaixaCompleta() {
    const prato = document.getElementById('prato-dia').value;
    const periodo = document.getElementById('periodo-refeicao').value;

    if (!prato) {
        alert("Por favor, informe o nome do Prato do Dia.");
        return;
    }

    if (itensParaBaixa.length === 0) {
        alert("Adicione pelo menos um alimento à lista.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/baixa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prato, 
                periodo, 
                itens: itensParaBaixa, 
                userId: usuarioLogado.id 
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert("✅ Registro concluído!");
            itensParaBaixa = [];
            document.getElementById('lista-temporaria-itens').innerHTML = '';
            document.getElementById('prato-dia').value = '';
            carregarSelectCozinha();
        } else {
            alert("Erro: " + data.error);
        }
    } catch (error) {
        alert("Erro na conexão com o servidor.");
    }
}

// --- FUNÇÕES DO DIRETOR ---

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

async function removerItemEstoque() {
    const item = document.getElementById('delete-alimento-select').value;
    if (!item || !confirm(`⚠️ Deseja apagar permanentemente o item "${item}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/estoque/${item}`, { method: 'DELETE' });
        if (response.ok) {
            alert("Item removido do sistema!");
            carregarSelectExclusao();
            renderizarGrafico();
            verGastoDoDia();
        }
    } catch (error) {
        alert("Erro ao conectar.");
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
            alert("✅ Estoque atualizado!");
            document.getElementById('add-nome').value = '';
            document.getElementById('add-qtd').value = '';
            document.getElementById('add-lote').value = '';
            document.getElementById('add-validade').value = '';
            renderizarGrafico();
            verGastoDoDia();
            carregarSelectExclusao();
        }
    } catch (error) {
        alert("Erro na conexão.");
    }
}

// FUNÇÃO ATUALIZADA: Exibe a data em cada registro individual
async function verGastoDoDia() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();
        const container = document.getElementById('lista-dia');
        
        if (!container) return;

        // Ordenar logs para mostrar os mais recentes primeiro
        logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        container.innerHTML = logs.length > 0 
            ? logs.map(g => `
                <div style="border-bottom: 1px solid #eee; padding: 10px 0; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: #2563eb; font-size: 0.75rem; font-weight: bold;">📅 ${g.data}</span><br>
                        <strong>🍴 ${g.prato} (${g.periodo})</strong><br>
                        <span style="color: #64748b;">👤 ${g.usuario} retirou</span> 
                        <b style="color: #e11d48;">${g.quantidade}kg</b> de ${g.item}
                    </div>
                    <button onclick="removerPratoRelatorio('${g.timestamp}')" 
                            style="background: none; border: none; cursor: pointer; color: #dc2626; font-size: 1.1rem;" 
                            title="Remover este registro">
                        🗑️
                    </button>
                </div>
            `).join('')
            : "<p style='color: #64748b;'>Nenhum histórico disponível.</p>";
    } catch (e) {
        console.error("Erro ao carregar gastos:", e);
    }
}

async function removerPratoRelatorio(timestamp) {
    if (!confirm("Deseja remover este registro do histórico de atividades?")) return;

    try {
        const response = await fetch(`${API_URL}/relatorios/${timestamp}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            verGastoDoDia(); 
            renderizarGrafico(); 
        } else {
            alert("Erro ao remover o registro.");
        }
    } catch (error) {
        alert("Erro de conexão com o servidor.");
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
                    label: 'Consumo Total (kg)',
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
        console.error("Erro ao gerar gráfico: ", error);
    }
}