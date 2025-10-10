const express = require("express");
const multer = require("multer");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

// form de teste rápido (sem front)
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

// upload em memória
const upload = multer({ storage: multer.memoryStorage() });

// helper: encaixa imagem num retângulo (mantém proporção)
function fitImage(box, imgW, imgH) {
  const boxR = box.width / box.height;
  const imgR = imgW / imgH;
  let w, h;
  if (imgR > boxR) { w = box.width; h = w / imgR; } else { h = box.height; w = h * imgR; }
  const x = box.x + (box.width - w) / 2;
  const y = box.y + (box.height - h) / 2;
  return { x, y, width: w, height: h };
}

app.post("/propostas", upload.single("imagem1"), async (req, res) => {
  try {
    const { cliente, descricao, quantidade, precoUnitario } = req.body;
    const file = req.file;

    // carrega seu template
    const templatePath = path.join(process.cwd(), "templates", "modelo.pdf"); // garanta templates/modelo.pdf
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPage(0);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const color = rgb(0, 0, 0);

    // posições iniciais — ajustamos depois
    page.drawText(`Cliente: ${cliente}`,     { x: 80, y: 700, size: 12, font, color });
    page.drawText(`Descrição: ${descricao}`, { x: 80, y: 680, size: 12, font, color });
    page.drawText(`Quantidade: ${quantidade}`, { x: 80, y: 660, size: 12, font, color });
    page.drawText(`Preço unitário: R$ ${Number(precoUnitario).toFixed(2)}`, { x: 80, y: 640, size: 12, font, color });

    // imagem
    if (file?.buffer) {
      let img;
      try { img = await pdfDoc.embedPng(file.buffer); }
      catch { img = await pdfDoc.embedJpg(file.buffer); }

      const dims = img.scale(1);
      const box = { x: 350, y: 520, width: 180, height: 180 }; // “quadro” da imagem
      const pos = fitImage(box, dims.width, dims.height);

      page.drawImage(img, { x: pos.x, y: pos.y, width: pos.width, height: pos.height });
    }

    const out = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="proposta.pdf"');
    res.send(Buffer.from(out));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Falha ao gerar PDF" });
  }
});

app.get("/", (req, res) => res.send("API de Propostas funcionando 🚀"));
app.listen(port, "0.0.0.0", () => console.log("Rodando na porta " + port));
