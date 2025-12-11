// api/birthday-image.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: 'sk-73f2f2064dc44d89b4c1e3d646b40571',
  baseURL:
    process.env.QWEN_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // === CORS 处理：所有请求一上来就先加头 ===
  // 开发期可以用 *，生产环境建议改成你的前端域名
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // 预检请求，直接 200 返回即可
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // 只允许 POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { birthdayMarkdown } = req.body as { birthdayMarkdown?: string };

    if (!birthdayMarkdown || typeof birthdayMarkdown !== "string") {
      res.status(400).json({ error: "birthdayMarkdown is required" });
      return;
    }

    // 1. 用 qwen3-max 生成图像 prompt
    const textPrompt = `
你是一名插画师，需要为同济大学校园模拟游戏《梁乔的学期》绘制一张“生日结局”的插画。

下面是游戏生成的「生日结局」剧情（Markdown）：
${birthdayMarkdown}

请根据这段文字，设计一幅画面，并用一小段英文或中英文混合的描述来概括，供图像生成模型使用。

画面要求要点（用于你理解，不要原样输出）：
1. 场景：同济大学嘉定校区的某个地点，例如寝室小聚、嘉定图书馆楼下夜宵、新天地小餐馆、友谊广场等，从文本中挑最重要或最有氛围感的一个。
2. 角色：主角梁乔（软件工程学生），可以略带“卷又有点脱发危机”的气质；再选少数几位最亲近的朋友或恋爱对象在旁边庆祝生日。
3. 氛围：温暖的生日聚会，有蛋糕、蜡烛、外卖、电脑、书本等细节，感觉有点累但被治愈。
4. 画风：清爽写实的日式校园插画 / 轻小说封面风格，色彩偏暖。
5. 画面中不要出现任何文字（不要写 Happy Birthday 等）。

请输出一段给图像模型看的 prompt，要求：
- 简洁、具体，有场景 + 角色 + 氛围 + 画风
- 只输出这一段描述，不要任何解释性句子或多余文本。`;

    const textCompletion = await openai.chat.completions.create({
      model: "qwen3-max",
      messages: [
        {
          role: "system",
          content:
            "你是专业插画师助理，只负责把中文需求转换成简洁的图像描述 prompt。不要多说话。",
        },
        { role: "user", content: textPrompt },
      ],
      temperature: 0.7,
    });

    const imagePrompt =
      textCompletion.choices[0]?.message?.content?.trim() ||
      "Birthday party of a Chinese CS student at Tongji University Jiading campus, warm anime illustration.";

    // 2. 用图像模型生成图片
    const imageResp = await openai.images.generate({
      model: process.env.QWEN_IMAGE_MODEL || "qwen-vl-plus", // 按你在百炼里的模型名改
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    });

    const url = imageResp.data?.[0]?.url;
    if (!url) {
      res.status(500).json({ error: "No image URL returned from Qwen image" });
      return;
    }

    res.status(200).json({
      imageUrl: url,
      prompt: imagePrompt,
    });
  } catch (e: any) {
    console.error("Error in /api/birthday-image:", e);
    res.status(500).json({ error: e.message || "Internal Server Error" });
  }
}
