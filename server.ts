import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Server-side Gemini 4 Argon High-Thinking Physics & Optics Analysis Endpoint
  app.post("/api/optics-explain", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(503).json({
          error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const { lensType, focalLength, sourceX, screenX, beamMode, rayTilt, rayHeight, question } = req.body;

      const systemPrompt = `Bạn là chuyên gia Vật lý Quang học thực nghiệm. Hãy phân tích ngắn gọn, súc tích và chính xác (tối đa 4 câu) về trạng thái đường truyền tia sáng hiện tại trên bàn thí nghiệm quang học 3D. Giải thích rõ hiện tượng hội tụ hoặc phân kỳ, vị trí tiêu điểm F', và tính chất chùm tia ló.`;

      const userPrompt = question
        ? `Trạng thái thí nghiệm: Thấu kính ${lensType === "converging" ? "Hội tụ" : "Phân kỳ"} (f = ${focalLength} cm), nguồn sáng cách thấu kính d = ${Math.abs(sourceX)} cm, màn hứng cách thấu kính ${ screenX } cm, chế độ chiếu: ${beamMode}, độ cao tia y = ${rayHeight} cm, góc nghiêng = ${rayTilt} độ.\nCâu hỏi: ${question}`
        : `Phân tích trạng thái hiện tại: Thấu kính ${lensType === "converging" ? "Hội tụ" : "Phân kỳ"} có tiêu cự f = ${focalLength} cm, nguồn sáng ở khoảng cách d = ${Math.abs(sourceX)} cm, màn hứng ở ${screenX} cm, chế độ ${beamMode}, độ cao tia y = ${rayHeight} cm, góc nghiêng = ${rayTilt} độ.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-argon",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({
        explanation: response.text || "Không có phản hồi từ mô hình.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Lỗi máy chủ khi phân tích quang học.";
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
