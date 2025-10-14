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

    // 📄 Carregar template
    const templatePath = path.join(__dirname, "templates", "modelo.pdf");
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];

    // 🖋️ Substituir textos básicos
    const drawText = (text, x, y, size = 11) => {
      page.drawText(text || "", { x, y, size, color: rgb(0, 0, 0) });
    };

    drawText(`Cliente: ${cliente}`, 50, 700);
    drawText(`Responsável: ${responsavel}`, 50, 680);
    drawText(`Forma de pagamento: ${forma_pagamento}`, 50, 660);
    drawText(`Prazo de produção: ${prazo_producao}`, 50, 640);
    drawText(`Frete: ${frete}`, 50, 620);

    // 🧾 Itens e valores (listas)
    const items = lista_itens ? lista_itens.split(",") : [];
    const valores = lista_valores ? lista_valores.split(",") : [];

    let baseY = 570;
    for (let i = 0; i < items.length; i++) {
      drawText(items[i], 60, baseY - i * 15);
      drawText(`R$ ${valores[i] || ""}`, 300, baseY - i * 15);
    }

    // 💰 Total
    drawText(`Total: R$ ${valor_total_proposta}`, 50, baseY - items.length * 20);

    // 🖼️ Inserir imagem
    if (req.file) {
      const imageBytes = req.file.buffer;
      const image = await pdfDoc.embedJpg(imageBytes);
      const { width, height } = image.scale(0.4);
      page.drawImage(image, { x: 320, y: 400, width, height });
    }

    // 💾 Retornar PDF final
    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).send("Erro ao gerar PDF.");
  }
});

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
