import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

// Configuração do upload (imagem)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🧠 Rota principal que gera o PDF
app.post("/gerar-pdf", upload.single("imagem_produto"), async (req, res) => {
  try {
    // 📥 Dados recebidos do vendedor
    const {
      cliente,
      responsavel,
      forma_pagamento,
      prazo_producao,
      frete,
      lista_itens,
      lista_valores,
      valor_total_proposta,
    } = req.body;

    // 📄 Carregar template do PDF
    const templatePath = path.join(__dirname, "templates", "modelo.pdf");
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];

    // 🖋️ Função auxiliar para desenhar texto
    const drawText = (text, x, y, size = 11) => {
      page.drawText(text || "", { x, y, size, color: rgb(0, 0, 0) });
    };

    // 🧾 Inserir informações básicas
    drawText(`Cliente: ${cliente}`, 50, 700);
    drawText(`Responsável: ${responsavel}`, 50, 680);
    drawText(`Forma de pagamento: ${forma_pagamento}`, 50, 660);
    drawText(`Prazo de produção: ${prazo_producao}`, 50, 640);
    drawText(`Frete: ${frete}`, 50, 620);

    // 📋 Itens e valores (listas)
    const items = lista_itens ? lista_itens.split(",") : [];
    const valores = lista_valores ? lista_valores.split(",") : [];

    let baseY = 570;
    for (let i = 0; i < items.length; i++) {
      drawText(items[i], 60, baseY - i * 15);
      drawText(`R$ ${valores[i] || ""}`, 300, baseY - i * 15);
    }

    // 💰 Total
    drawText(`Total: R$ ${valor_total_proposta}`, 50, baseY - items.length * 20);

    // 🖼️ Inserir imagem do produto (se enviada)
    if (req.file) {
      const imageBytes = req.file.buffer;
      const image = await pdfDoc.embedJpg(imageBytes);
      const { width, height } = image.scale(0.4);
      page.drawImage(image, { x: 320, y: 400, width, height });
    }

    // 💾 Retornar PDF gerado
    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).send("Erro ao gerar PDF.");
  }
});

// 🌐 Página simples para testes
app.get("/teste", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; margin: 40px;">
        <h1>Gerar Proposta (teste)</h1>
        <form action="/gerar-pdf" method="POST" enctype="multipart/form-data">
          <label>Cliente:</label><br/>
          <input type="text" name="cliente"/><br/><br/>

          <label>Responsável:</label><br/>
          <input type="text" name="responsavel"/><br/><br/>

          <label>Forma de pagamento:</label><br/>
          <input type="text" name="forma_pagamento"/><br/><br/>

          <label>Prazo de produção:</label><br/>
          <input type="text" name="prazo_producao"/><br/><br/>

          <label>Frete:</label><br/>
          <input type="text" name="frete"/><br/><br/>

          <label>Itens (separados por vírgula):</label><br/>
          <input type="text" name="lista_itens"/><br/><br/>

          <label>Valores (separados por vírgula):</label><br/>
          <input type="text" name="lista_valores"/><br/><br/>

          <label>Valor total da proposta:</label><br/>
          <input type="text" name="valor_total_proposta"/><br/><br/>

          <label>Imagem do produto:</label><br/>
          <input type="file" name="imagem_produto"/><br/><br/>

          <button type="submit">Gerar PDF</button>
        </form>
      </body>
    </html>
  `);
});

// 🚀 Inicializar servidor
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
