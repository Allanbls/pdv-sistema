const fs = require('fs');
const path = require('path');

const libsDir = path.join(__dirname, 'public', 'libs');
if (!fs.existsSync(libsDir)) {
    fs.mkdirSync(libsDir, { recursive: true });
}

const arquivos = [
    {
        url: 'https://cdn.tailwindcss.com',
        dest: path.join(libsDir, 'tailwind.js')
    },
    {
        url: 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js',
        dest: path.join(libsDir, 'phosphor.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        dest: path.join(libsDir, 'chart.min.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js',
        dest: path.join(libsDir, 'chartjs-datalabels.min.js')
    },
    {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
        dest: path.join(libsDir, 'qrcode.min.js')
    }
];

async function baixar(item) {
    const res = await fetch(item.url, { redirect: 'follow' });
    if (!res.ok) {
        throw new Error(`Falha no download (${res.status} ${res.statusText})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(item.dest, buffer);
}

(async () => {
    console.log('Baixando bibliotecas para funcionamento 100% offline...\n');
    for (const item of arquivos) {
        try {
            await baixar(item);
            console.log(`✓ Baixado: ${path.basename(item.dest)}`);
        } catch (err) {
            console.error(`✗ Erro ao baixar ${path.basename(item.dest)}:`, err.message);
        }
    }
    console.log('\nConcluído! Todas as dependências visuais estão salvas em public/libs/');
})();