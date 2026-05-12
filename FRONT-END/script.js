const API_URL = 'http://localhost:3000';
let usuarioLogado = null;
let meuGrafico = null; // Guardará a instância do gráfico para podermos atualizá-lo

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
        
        // Esconde a tela de login
        document.getElementById('login-view').classList.add('hidden');
        
        if (usuarioLogado.cargo === 'Cozinheira') {
            document.getElementById('cozinha-view').classList.remove('hidden');
            document.getElementById('user-display').innerText = usuarioLogado.nome;
        } 
        else if (usuarioLogado.cargo === 'Diretor') {
            document.getElementById('diretor-view').classList.remove('hidden');
            document.getElementById('admin-display').innerText = usuarioLogado.nome;
            
            // Ao logar como diretor, já carrega os dados visuais
            renderizarGrafico();
            verGastoDoDia();
        }

    } catch (error) {
        alert("Erro: " + error.message);
    }
}

// --- FUNÇÕES DA COZINHEIRA ---

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
            msgElement.innerText = `✅ Estoque atualizado! Novo saldo: ${data.novoEstoque}kg`;
            document.getElementById('qtd').value = ''; 
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert("Erro na conexão com o servidor.");
    }
}

// --- FUNÇÕES DO DIRETOR ---

// 1. EDITAR ESTOQUE (Altera o valor diretamente no banco)
async function atualizarEstoqueBanco() {
    const itemNome = document.getElementById('edit-alimento').value;
    const novaQuantidade = document.getElementById('nova-qtd').value;

    if (!novaQuantidade || novaQuantidade < 0) {
        alert("Digite uma quantidade válida para atualizar.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/estoque`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemNome, novaQuantidade: Number(novaQuantidade) })
        });

        const data = await response.json();
        if (response.ok) {
            alert(`✅ Banco de Dados atualizado! ${itemNome} agora possui ${novaQuantidade}kg.`);
            document.getElementById('nova-qtd').value = '';
            
            // Atualiza o gráfico se ele estiver visível
            renderizarGrafico();
        } else {
            alert("Erro: " + data.error);
        }
    } catch (error) {
        alert("Erro ao conectar com o banco de dados.");
    }
}

// 2. CONSULTAR GASTO DO DIA
async function verGastoDoDia() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();
        const hoje = new Date().toLocaleDateString('pt-BR');
        
        // Filtra apenas o que aconteceu na data de hoje
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
        console.error("Erro ao carregar gastos do dia:", e);
    }
}

// 3. GRÁFICO DE GASTO SEMANAL (Utilizando Chart.js)
async function renderizarGrafico() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();

        // Totaliza os gastos por item para exibir no gráfico
        const resumo = { Arroz: 0, Feijão: 0 };
        logs.forEach(log => {
            if (resumo[log.item] !== undefined) {
                resumo[log.item] += Number(log.quantidade);
            }
        });

        const canvas = document.getElementById('graficoGastos');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Se o gráfico já existir, destrói para criar um novo (evita erros de renderização)
        if (meuGrafico) {
            meuGrafico.destroy();
        }

        // @ts-ignore - Chart vem da biblioteca externa CDN
        meuGrafico = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Arroz', 'Feijão'],
                datasets: [{
                    label: 'Consumo Acumulado (kg)',
                    data: [resumo.Arroz, resumo.Feijão],
                    backgroundColor: ['#2563eb', '#059669'],
                    borderColor: ['#1d4ed8', '#047857'],
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: 'Quilogramas (kg)' }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao gerar gráfico:", error);
    }
}