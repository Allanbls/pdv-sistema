PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    unidade TEXT DEFAULT 'un',
    estoque INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendas (
    id TEXT PRIMARY KEY,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    valor_total REAL NOT NULL,
    forma_pagamento TEXT NOT NULL,
    cliente_id TEXT,
    sincronizado INTEGER DEFAULT 0,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS itens_venda (
    id TEXT PRIMARY KEY,
    venda_id TEXT NOT NULL,
    produto_id TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS fiado_movimentacoes (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('debito', 'abatimento', 'quitacao')),
    valor REAL NOT NULL,
    venda_id TEXT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    sincronizado INTEGER DEFAULT 0,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
);