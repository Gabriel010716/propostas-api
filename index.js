const express = require("express");
const multer = require("multer");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// formulário de teste
app.get("/teste", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; padding:20px">
        <h2>Gerar Proposta (teste)</h2>
        <form method="POST" action="/propostas" enctype="multipart/form-data">
          <div>Cliente: <input name="cliente" required /></div>
          <div>Descrição: <input name="descricao" required /></div>
          <div>Quantidade: <input name="quantidade" type="number" required /></div>
          <div>Preço unitário: <input name="precoUnitario" type="number" step="0.01" required /></div>
          <div>Imagem do produto: <input name="imagem1" type="file" accept="image/*" required /></div>
          <button type="submit" style="margin-top:10px">Gerar PDF</button>
        </form>
      </body>
    </html>
  `);
});

app.get("/", (req, res) => {
  res.send("API de Propostas funcionando 🚀");
});

// Upload em memória (sem gravar no disco)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper: encaixa a imagem dentro de um quadro, preservando proporção
 * Retorna {width, height, x, y} calculados
 */
function fitImage(box, imgWidth, imgHeight) {
  const boxRatio = box.width / box.height;
  const imgRatio = imgWidth / imgHeight;

  let width, height;
  if (imgRatio > boxRatio) {
    // imagem é mais “larga” => limita pela largura
    width = box.width;
    height = width / imgRatio;
  } else {
    // imagem é mais “alta” => limita pela altura
    height = box.height;
    width = height * imgRatio;
  }
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  return { width, height, x, y };
}

/**
 * POST /propostas
 * Campos: cliente, descricao, quantidade, precoUnitario
 * Arquivo: imagem1 (multipart/form-data)
 * Retorna: PDF preenchido
 */
app.post("/propostas", upload.single("imagem1"), async (req, res) => {
  try {
    const { cliente, descricao, quantidade, precoUnitario } = req.body;
    const arquivoImagem = req.file; // buffer em memória

    // carrega template
    const templatePath = path.join(__dirname, "templates", "modelo.pdf");
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // (opcional) fontes
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const color = rgb(0, 0, 0);

    // usamos a primeira página do template
    const page = pdfDoc.getPage(0);

    // ====== POSIÇÕES DOS CAMPOS ======
    // Ajuste essas coordenadas (x, y) e tamanhos conforme seu modelo
    // Sistema de coordenadas do pdf-lib: (0,0) é canto inferior esquerdo.
    // Dica: comece chutando, gera o PDF e ajusta fino.
    const campos = {
      cliente: { x: 80, y: 700, size: 12 },
      descricao: { x: 80, y: 680, size: 12 },
      quantidade: { x: 80, y: 660, size: 12 },
      precoUnitario: { x: 80, y: 640, size: 12 },
      // quadro da imagem (onde ela deve aparecer)
      imagem1Box: { x: 350, y: 520, width: 180, height: 180 }
    };

    // escreve textos
    page.drawText(`Cliente: ${cliente}`, { x: campos.cliente.x, y: campos.cliente.y, size: campos.cliente.size, font, color });
    page.drawText(`Descrição: ${descricao}`, { x: campos.descricao.x, y: campos.descricao.y, size: campos.descricao.size, font, color });
    page.drawText(`Quantidade: ${quantidade}`, { x: campos.quantidade.x, y: campos.quantidade.y, size: campos.quantidade.size, font, color });
    page.drawText(`Preço unitário: R$ ${Number(precoUnitario).toFixed(2)}`, { x: campos.precoUnitario.x, y: campos.precoUnitario.y, size: campos.precoUnitario.size, font, color });

    // insere imagem (se veio)
    if (arquivoImagem && arquivoImagem.buffer) {
      const bytes = arquivoImagem.buffer;

      // tenta como PNG, se falhar tenta JPEG
      let embedded, imgDims;
      try {
        embedded = await pdfDoc.embedPng(bytes);
      } catch {
        embedded = await pdfDoc.embedJpg(bytes);
      }
      imgDims = embedded.scale(1); // largura/altura original

      // calcula melhor encaixe no retângulo (mantém aspecto)
      const fit = fitImage(campos.imagem1Box, imgDims.width, imgDims.height);

      page.drawImage(embedded, {
        x: fit.x,
        y: fit.y,
        width: fit.width,
        height: fit.height
      });
    }

    // finaliza e devolve
    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="proposta.pdf"');
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao gerar PDF" });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
