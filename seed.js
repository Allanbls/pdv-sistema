const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const db = new Database(path.join(__dirname, 'pdv_local.db'));

// 1. Aplica a estrutura das tabelas
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
}

// 2. Limpa os dados antigos para recriar uma base completa
db.exec(`
    DELETE FROM fiado_movimentacoes;
    DELETE FROM itens_venda;
    DELETE FROM vendas;
    DELETE FROM clientes;
    DELETE FROM produtos;
`);

// 3. Catálogo de Produtos
const produtos = [
  { id: "101", name: "Arroz Tio João Tipo 1 5kg", price: 29.90, unit: "pct", code: "ARRTJ05" },
  { id: "102", name: "Arroz Camil Tipo 1 5kg", price: 28.90, unit: "pct", code: "ARRCM05" },
  { id: "103", name: "Feijão Carioca Camil 1kg", price: 8.99, unit: "pct", code: "FEIJCAR" },
  { id: "104", name: "Feijão Preto Camil 1kg", price: 9.49, unit: "pct", code: "FEIJPRE" },
  { id: "105", name: "Açúcar Refinado União 1kg", price: 4.99, unit: "pct", code: "ACUUN01" },
  { id: "106", name: "Café Pilão 500g", price: 22.90, unit: "pct", code: "CAFPIL" },
  { id: "107", name: "Óleo de Soja Liza 900ml", price: 7.49, unit: "gf", code: "OLEOLIZ" },
  { id: "108", name: "Coca-Cola 2L", price: 10.99, unit: "gf", code: "COCA2L" },
  { id: "109", name: "Cerveja Heineken Long Neck 330ml", price: 6.49, unit: "un", code: "CERHEIN" },
  { id: "110", name: "Leite UHT Integral Italac 1L", price: 5.49, unit: "cx", code: "LEIITA" }
];

const insertProduto = db.prepare(`
    INSERT INTO produtos (id, codigo, nome, preco, unidade, estoque)
    VALUES (?, ?, ?, ?, ?, 100)
`);

for (const p of produtos) {
    insertProduto.run(p.id, p.code, p.name, p.price, p.unit);
}

// 4. Clientes Fictícios para Apresentação
const clientes = [
    { id: randomUUID(), nome: "Carlos Eduardo Silva", telefone: "11988776655", debito: 185.50, data: "2026-10-10 14:20:00" },
    { id: randomUUID(), nome: "Maria Aparecida Santos", telefone: "11977665544", debito: 320.00, data: "2026-10-12 10:15:00" },
    { id: randomUUID(), nome: "João Pedro Oliveira", telefone: "11966554433", debito: 94.20, data: "2026-10-15 18:30:00" },
    { id: randomUUID(), nome: "Ana Paula Rodrigues", telefone: "11955443322", debito: 450.80, data: "2026-10-08 09:45:00" },
    { id: randomUUID(), nome: "Lucas Mendes Ferreira", telefone: "11944332211", debito: 65.00, data: "2026-10-18 16:10:00" },
    { id: randomUUID(), nome: "Fernanda Lima Castro", telefone: "11933221100", debito: 210.90, data: "2026-10-19 11:25:00" },
    { id: randomUUID(), nome: "Roberto Alves Costa", telefone: "11922110099", debito: 130.40, data: "2026-10-20 17:50:00" },
    { id: randomUUID(), nome: "Juliana Barbosa Souza", telefone: "11911009988", debito: 520.00, data: "2026-10-05 13:00:00" },
    { id: randomUUID(), nome: "Marcelo Henrique Dias", telefone: "11900998877", debito: 42.10, data: "2026-10-21 08:40:00" },
    { id: randomUUID(), nome: "Patricia Ribeiro Gomes", telefone: "11981817171", debito: 178.30, data: "2026-10-14 19:15:00" }
];

const insertCliente = db.prepare('INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)');
const insertVenda = db.prepare('INSERT INTO vendas (id, data_hora, valor_total, forma_pagamento, cliente_id, sincronizado) VALUES (?, ?, ?, ?, ?, 1)');
const insertFiado = db.prepare('INSERT INTO fiado_movimentacoes (id, cliente_id, tipo, valor, venda_id, data_hora, sincronizado) VALUES (?, ?, ?, ?, ?, ?, 1)');

db.transaction(() => {
    for (const c of clientes) {
        insertCliente.run(c.id, c.nome, c.telefone);
        
        const vendaId = randomUUID();
        insertVenda.run(vendaId, c.data, c.debito, 'fiado', c.id);
        insertFiado.run(randomUUID(), c.id, 'debito', c.debito, vendaId, c.data);
    }

    // Inserção de vendas variadas (dinheiro, pix, cartões) para popular os gráficos de vendas
    const formas = ['dinheiro', 'pix', 'credito', 'debito'];
    for (let i = 0; i < 20; i++) {
        const vId = randomUUID();
        const forma = formas[i % formas.length];
        const valor = Number((Math.random() * 80 + 15).toFixed(2));
        insertVenda.run(vId, '2026-10-23 10:00:00', valor, forma, null);
    }
})();

console.log('Sucesso: Banco de dados populado com 10 clientes fiados e histórico de vendas!');