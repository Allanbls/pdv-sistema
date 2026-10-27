const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve os arquivos da interface gráfica localizada em /public
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o banco local
const db = new Database(path.join(__dirname, 'pdv_local.db'));

// ================= ROTAS DE PRODUTOS =================
app.get('/api/produtos', (req, res) => {
    try {
        const rows = db.prepare('SELECT id, codigo, nome, preco, unidade, estoque FROM produtos ORDER BY nome ASC').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= ROTAS DE CLIENTES & FIADO =================
app.get('/api/clientes', (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.nome, 
                c.telefone,
                COALESCE((SELECT SUM(CASE WHEN tipo = 'debito' THEN valor ELSE -valor END) FROM fiado_movimentacoes WHERE cliente_id = c.id), 0) AS debitAmount,
                COALESCE((SELECT MIN(strftime('%d/%m/%Y', data_hora)) FROM fiado_movimentacoes WHERE cliente_id = c.id AND tipo = 'debito'), '-') AS oldDate,
                COALESCE((SELECT MAX(strftime('%d/%m/%Y', data_hora)) FROM fiado_movimentacoes WHERE cliente_id = c.id), '-') AS lastDate,
                (SELECT COUNT(id) FROM vendas WHERE cliente_id = c.id) AS purchasesCount,
                COALESCE((SELECT SUM(iv.quantidade) FROM itens_venda iv JOIN vendas v ON iv.venda_id = v.id WHERE v.cliente_id = c.id), 0) AS itemsCount
            FROM clientes c
            ORDER BY debitAmount DESC
        `;
        const rows = db.prepare(query).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROTA PARA RESUMO REAL DE VENDAS E CAIXA
app.get('/api/relatorio/resumo', (req, res) => {
    try {
        const resumoVendas = db.prepare(`
            SELECT 
                COALESCE(SUM(valor_total), 0) AS totalVendas,
                COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor_total ELSE 0 END), 0) AS totalDinheiro,
                COALESCE(SUM(CASE WHEN forma_pagamento = 'pix' THEN valor_total ELSE 0 END), 0) AS totalPix,
                COALESCE(SUM(CASE WHEN forma_pagamento = 'credito' THEN valor_total ELSE 0 END), 0) AS totalCredito,
                COALESCE(SUM(CASE WHEN forma_pagamento = 'debito' THEN valor_total ELSE 0 END), 0) AS totalDebito,
                COALESCE(SUM(CASE WHEN forma_pagamento = 'fiado' THEN valor_total ELSE 0 END), 0) AS totalFiado
            FROM vendas
        `).get();

        res.json(resumoVendas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clientes', (req, res) => {
    const { nome, telefone } = req.body;
    const id = randomUUID();
    try {
        db.prepare('INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)').run(id, nome, telefone || '');
        res.status(201).json({ id, nome, telefone, debitAmount: 0 });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ================= REGISTRO DE VENDA (TRANSAÇÃO ATÔMICA) =================
app.post('/api/vendas', (req, res) => {
    const { total, formaPagamento, clienteId, itens } = req.body;

    const processarTransacao = db.transaction(() => {
        const vendaId = randomUUID();

        db.prepare(`
            INSERT INTO vendas (id, valor_total, forma_pagamento, cliente_id, sincronizado)
            VALUES (?, ?, ?, ?, 0)
        `).run(vendaId, total, formaPagamento, clienteId || null);

        const stmtItem = db.prepare(`
            INSERT INTO itens_venda (id, venda_id, produto_id, quantidade, preco_unitario, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const stmtEstoque = db.prepare(`
            UPDATE produtos SET estoque = estoque - ? WHERE id = ?
        `);

        for (const item of itens) {
            const subtotal = item.price * item.qtd;
            stmtItem.run(randomUUID(), vendaId, String(item.id), item.qtd, item.price, subtotal);
            stmtEstoque.run(item.qtd, String(item.id));
        }

        if (formaPagamento === 'fiado' && clienteId) {
            db.prepare(`
                INSERT INTO fiado_movimentacoes (id, cliente_id, tipo, valor, venda_id, sincronizado)
                VALUES (?, ?, 'debito', ?, ?, 0)
            `).run(randomUUID(), clienteId, total, vendaId);
        }

        return vendaId;
    });

    try {
        const idVenda = processarTransacao();
        res.status(201).json({ success: true, vendaId: idVenda });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao registrar venda: ' + err.message });
    }
});

// ================= LIQUIDAÇÃO DE FIADO =================
app.post('/api/clientes/:id/abater', (req, res) => {
    const { id } = req.params;
    const { valor } = req.body;
    try {
        db.prepare(`
            INSERT INTO fiado_movimentacoes (id, cliente_id, tipo, valor, sincronizado)
            VALUES (?, ?, 'abatimento', ?, 0)
        `).run(randomUUID(), id, valor);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/clientes/:id/quitar', (req, res) => {
    const { id } = req.params;
    try {
        const saldo = db.prepare(`
            SELECT COALESCE(SUM(CASE WHEN tipo = 'debito' THEN valor ELSE -valor END), 0) AS total
            FROM fiado_movimentacoes WHERE cliente_id = ?
        `).get(id);

        if (saldo.total > 0) {
            db.prepare(`
                INSERT INTO fiado_movimentacoes (id, cliente_id, tipo, valor, sincronizado)
                VALUES (?, ?, 'quitacao', ?, 0)
            `).run(randomUUID(), id, saldo.total);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ================= WHATSAPP (SEGUNDO PLANO) =================
app.post('/api/whatsapp/cobrar', async (req, res) => {
    const { telefone, mensagem } = req.body;
    console.log(`[WhatsApp Local] Disparo em background para ${telefone}: "${mensagem}"`);
    res.json({ success: true });
});

// Porta local padrão
const PORT = 3000;
app.listen(PORT, () => {
    console.log('==================================================');
    console.log(`PDV Caixa Ativo em: http://localhost:3000`);
    console.log('==================================================');
});