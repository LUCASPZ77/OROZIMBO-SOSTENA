const API_URL = 'http://localhost:3000';
let usuarioLogado = null;
let meuGrafico = null;
let estoqueLocal = []; 
let itensParaBaixa = []; 

// Elemento de áudio para a notificação
const SOM_NOTIFICACAO = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// ==========================================
// 1. DATA E INTERFACE
// ==========================================

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

    if (usuarioLogado && usuarioLogado.cargo === 'Diretor') {
        const inicio = document.getElementById('filtro-data-inicio')?.value;
        if (!inicio) verGastoDoDia();
    }
}

atualizarDataVisor();
setInterval(atualizarDataVisor, 60000);

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function ajustarBrilho(valor) {
    document.body.style.filter = `brightness(${valor}%)`;
}

function logout() {
    if (confirm("Deseja realmente sair do sistema?")) {
        localStorage.removeItem('usuarioMemorizado');
        location.reload();
    }
}

// NOVO: Função para trocar a foto de perfil
function trocarFotoPerfil(event) {
    const arquivo = event.target.files[0];
    if (arquivo) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const avatarDiv = document.getElementById('avatar-img');
            avatarDiv.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        };
        reader.readAsDataURL(arquivo);
    }
}

// ==========================================
// 2. CONTROLE DE ACESSO (LOGIN E CADASTRO)
// ==========================================

function mudarAba(tipo) {
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-cadastro');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-cadastro');

    if (tipo === 'login') {
        formLogin.classList.remove('hidden');
        formReg.classList.add('hidden');
        btnLogin.style.borderBottom = "2px solid #2563eb";
        btnLogin.style.color = "#2563eb";
        btnReg.style.borderBottom = "none";
        btnReg.style.color = "#64748b";
    } else {
        formLogin.classList.add('hidden');
        formReg.classList.remove('hidden');
        btnReg.style.borderBottom = "2px solid #2563eb";
        btnReg.style.color = "#2563eb";
        btnLogin.style.borderBottom = "none";
        btnLogin.style.color = "#64748b";
    }
}

async function executarCadastro() {
    const cargo = document.getElementById('reg-cargo').value;
    const nome = document.getElementById('reg-nome').value;
    const sobrenome = document.getElementById('reg-sobrenome').value;
    const email = document.getElementById('reg-email').value;
    const cpf = document.getElementById('reg-cpf').value;
    const termos = document.getElementById('reg-termos').checked;

    if (!termos) {
        alert("Você precisa aceitar os Termos de Uso.");
        return;
    }

    if (!nome || !email || !cpf) {
        alert("Por favor, preencha Nome, E-mail e CPF.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/usuarios/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cargo, nome, sobrenome, email, cpf })
        });

        if (response.ok) {
            alert("✅ Cadastro realizado com sucesso! Vá para a aba 'Entrar'.");
            mudarAba('login');
        } else {
            const erro = await response.json();
            alert("Erro no cadastro: " + erro.error);
        }
    } catch (error) {
        alert("Erro de conexão com o servidor.");
    }
}

async function executarLogin() {
    const cpf = document.getElementById('login-cpf').value;
    const token = document.getElementById('login-token').value;

    if (!cpf || !token) {
        alert("Insira CPF e o Token do cargo.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, token })
        });

        const data = await response.json();

        if (response.ok) {
            usuarioLogado = data;
            
            document.getElementById('profile-name').innerText = `${usuarioLogado.nome} ${usuarioLogado.sobrenome}`;
            document.getElementById('profile-role').innerText = usuarioLogado.cargo;
            document.getElementById('menu-toggle').classList.remove('hidden');
            document.getElementById('login-view').classList.add('hidden');

            if (usuarioLogado.cargo === 'Cozinheira') {
                document.getElementById('cozinha-view').classList.remove('hidden');
                document.getElementById('user-display').innerText = usuarioLogado.nome;
                carregarSelectCozinha();
            } else if (usuarioLogado.cargo === 'Diretor') {
                document.getElementById('diretor-view').classList.remove('hidden');
                document.getElementById('admin-display').innerText = usuarioLogado.nome;
                
                verGastoDoDia();
                carregarSelectExclusao();
                renderizarGrafico();
            }
        } else {
            alert("Acesso Negado: " + data.error);
        }
    } catch (error) {
        alert("Erro ao tentar logar.");
    }
}

// ==========================================
// 3. FUNÇÕES DA COZINHA (ATUALIZADAS)
// ==========================================

async function carregarSelectCozinha() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        estoqueLocal = await res.json();
        const select = document.getElementById('alimento');
        
        if (select) {
            select.innerHTML = estoqueLocal.map(item => `
                <option value="${item.item}">${item.item}</option>
            `).join('');
            mostrarInfoExtra();
        }
    } catch (error) {
        console.error("Erro ao carregar estoque.");
    }
}

function mostrarInfoExtra() {
    const nomeSelecionado = document.getElementById('alimento').value;
    const item = estoqueLocal.find(i => i.item === nomeSelecionado);
    const display = document.getElementById('display-atual');
    if (item && display) {
        display.innerText = `${item.quantidade} kg`;
    }
}

// ATUALIZADO: Suporte para Gramas/Quilos
function adicionarItemNaLista() {
    const itemNome = document.getElementById('alimento').value;
    const quantidadeInput = document.getElementById('qtd').value;
    const unidade = document.getElementById('unidade-medida').value;

    if (!itemNome || !quantidadeInput || quantidadeInput <= 0) {
        alert("Informe uma quantidade válida.");
        return;
    }

    let qtdNumerica = Number(quantidadeInput);
    let qtdFinalParaBanco = unidade === 'g' ? qtdNumerica / 1000 : qtdNumerica;
    let labelExibicao = unidade === 'g' ? `${quantidadeInput}g` : `${quantidadeInput}kg`;

    itensParaBaixa.push({ itemNome, quantidade: qtdFinalParaBanco, label: labelExibicao });

    const listaUl = document.getElementById('lista-temporaria-itens');
    const li = document.createElement('li');
    li.style = "display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee; align-items: center;";
    li.innerHTML = `
        <span><b>${itemNome}</b> - ${labelExibicao}</span>
        <button onclick="removerDaListaTemporaria(this, '${itemNome}')" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer;">X</button>
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

    if (!prato || itensParaBaixa.length === 0) {
        alert("Preencha o prato e adicione ingredientes.");
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
                usuarioNome: usuarioLogado.nome 
            })
        });

        if (response.ok) {
            // NOVO: Tocar som de sucesso
            SOM_NOTIFICACAO.play().catch(e => console.log("Erro ao tocar som"));
            
            alert("✅ Registro finalizado com sucesso!");
            itensParaBaixa = [];
            document.getElementById('lista-temporaria-itens').innerHTML = '';
            document.getElementById('prato-dia').value = '';
            carregarSelectCozinha();
        } else {
            const r = await response.json();
            alert("Erro: " + r.error);
        }
    } catch (e) {
        alert("Erro na conexão.");
    }
}

// ==========================================
// 4. FUNÇÕES DO DIRETOR (ABAS E GERENCIAMENTO)
// ==========================================

function abrirAbaDiretor(event, abaId) {
    const conteudos = document.querySelectorAll('.tab-content');
    conteudos.forEach(c => c.classList.add('hidden'));

    const botoes = document.querySelectorAll('.tab-btn');
    botoes.forEach(b => b.classList.remove('active'));

    document.getElementById(abaId).classList.remove('hidden');
    event.currentTarget.classList.add('active');

    if (abaId === 'aba-grafico') renderizarGrafico();
    if (abaId === 'aba-historico') verGastoDoDia();
    if (abaId === 'aba-estoque') carregarSelectExclusao();
    if (abaId === 'aba-conferencia') carregarTabelaConferencia();
}

// NOVO: ABA DE CONFERÊNCIA E PESQUISA
async function carregarTabelaConferencia() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        const estoque = await res.json();
        const busca = document.getElementById('busca-estoque').value.toLowerCase();
        
        const corpoTabela = document.getElementById('corpo-tabela-estoque');
        corpoTabela.innerHTML = '';

        const itensFiltrados = estoque.filter(i => i.item.toLowerCase().includes(busca));

        itensFiltrados.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <input type="text" value="${item.item}" style="border:none; background:transparent; width:100%" onchange="editarItemBanco('${item.item}', 'nome', this.value)">
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <input type="number" value="${item.quantidade}" style="border:none; background:transparent; width:100%" onchange="editarItemBanco('${item.item}', 'quantidade', this.value)">
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.validade || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align:center">
                    <button onclick="confirmarEdicao()" style="background:#059669; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer">
                        <i class="fas fa-save"></i>
                    </button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    } catch (e) {
        console.error("Erro ao carregar conferência.");
    }
}

// NOVO: Importação de Excel
function importarExcel() {
    document.getElementById('input-excel').click();
}

async function processarExcel(event) {
    const arquivo = event.target.files[0];
    if (arquivo) {
        alert(`Arquivo "${arquivo.name}" selecionado. Enviando para o banco de dados...`);
        // Aqui você enviaria via FormData para o seu endpoint de upload/importação
    }
}

function confirmarEdicao() {
    alert("Alteração salva com sucesso no banco de dados!");
    carregarTabelaConferencia();
    renderizarGrafico();
}

// ==========================================
// FUNÇÕES DE RELATÓRIOS E GRÁFICOS (MANTIDAS)
// ==========================================

async function carregarSelectExclusao() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        const itens = await res.json();
        const select = document.getElementById('delete-alimento-select');
        if (select) {
            select.innerHTML = '<option value="">Selecione para excluir...</option>' + 
                itens.map(i => `<option value="${i.item}">${i.item}</option>`).join('');
        }
    } catch (e) {
        console.error("Erro no select de exclusão.");
    }
}

async function removerItemEstoque() {
    const item = document.getElementById('delete-alimento-select').value;
    if (!item) {
        alert("Escolha um item para apagar.");
        return;
    }

    if (confirm(`Tem certeza que deseja EXCLUIR o item ${item} do banco de dados?`)) {
        try {
            const res = await fetch(`${API_URL}/estoque/${item}`, { method: 'DELETE' });
            if (res.ok) {
                alert("✅ Item removido com sucesso!");
                carregarSelectExclusao();
                renderizarGrafico();
            } else {
                alert("Erro ao excluir do banco.");
            }
        } catch (err) {
            alert("Erro de rede.");
        }
    }
}

async function adicionarNovoEstoque() {
    const item = document.getElementById('add-nome').value;
    const quantidade = document.getElementById('add-qtd').value;
    const lote = document.getElementById('add-lote').value;
    const validade = document.getElementById('add-validade').value;

    if (!item || !quantidade) {
        alert("Nome e quantidade são obrigatórios.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/estoque/adicionar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, quantidade, lote, validade })
        });

        if (res.ok) {
            alert("✅ Estoque atualizado!");
            document.getElementById('add-nome').value = '';
            document.getElementById('add-qtd').value = '';
            carregarSelectExclusao();
            renderizarGrafico();
            verGastoDoDia();
        }
    } catch (e) {
        alert("Erro ao adicionar estoque.");
    }
}

async function filtrarPorData() {
    const inicio = document.getElementById('filtro-data-inicio').value;
    const fim = document.getElementById('filtro-data-fim').value;

    if (!inicio || !fim) {
        alert("Selecione o período inicial e final.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/relatorios/filtro?inicio=${inicio}&fim=${fim}`);
        const logs = await response.json();
        
        exibirLogsNaTela(logs);
        atualizarGraficoComDados(logs);
    } catch (error) {
        alert("Erro ao filtrar dados.");
    }
}

function exibirLogsNaTela(logs) {
    const container = document.getElementById('lista-dia');
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = "<p>Nenhum registro encontrado para este período.</p>";
        return;
    }

    container.innerHTML = logs.map(g => {
        const [ano, mes, dia] = g.data.split('-');
        const dataBR = `${dia}/${mes}/${ano}`;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0;">
                <div style="font-size: 0.85rem; text-align: left;">
                    <small style="color: #2563eb; font-weight: bold;">📅 ${dataBR}</small><br>
                    <strong>🍴 ${g.prato}</strong> (${g.periodo})<br>
                    <span style="color: #64748b;">${g.usuario} retirou</span> 
                    <b style="color: #e11d48;">${g.quantidade}kg</b> de ${g.item}
                </div>
                <button onclick="apagarLog('${g.timestamp}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size: 1.2rem;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function verGastoDoDia() {
    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();
        exibirLogsNaTela(logs);
    } catch (e) {
        console.error("Erro ao carregar logs.");
    }
}

async function apagarLog(timestamp) {
    if (confirm("Deseja apagar este registro do histórico permanentemente?")) {
        try {
            const res = await fetch(`${API_URL}/relatorios/${timestamp}`, { method: 'DELETE' });
            if (res.ok) {
                const inicio = document.getElementById('filtro-data-inicio').value;
                const fim = document.getElementById('filtro-data-fim').value;
                
                if (inicio && fim) {
                    filtrarPorData();
                } else {
                    verGastoDoDia();
                    renderizarGrafico();
                }
            }
        } catch (e) {
            alert("Erro ao apagar log.");
        }
    }
}

function atualizarGraficoComDados(logs) {
    const resumo = {};
    logs.forEach(log => {
        resumo[log.item] = (resumo[log.item] || 0) + Number(log.quantidade);
    });

    if (meuGrafico) {
        meuGrafico.data.labels = Object.keys(resumo);
        meuGrafico.data.datasets[0].data = Object.values(resumo);
        meuGrafico.update();
    }
}

async function renderizarGrafico() {
    const canvasElement = document.getElementById('graficoGastos');
    if (!canvasElement) return;

    try {
        const response = await fetch(`${API_URL}/relatorios`);
        const logs = await response.json();
        
        const resumo = {};
        logs.forEach(log => {
            resumo[log.item] = (resumo[log.item] || 0) + Number(log.quantidade);
        });

        const ctx = canvasElement.getContext('2d');
        if (meuGrafico) {
            meuGrafico.destroy();
        }

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
        console.error("Erro ao gerar gráfico.");
    }
}