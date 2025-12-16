// api/birthday-image.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: 'sk-73f2f2064dc44d89b4c1e3d646b40571',
  baseURL:
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const DASHSCOPE_IMAGE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const apiKey = 'sk-73f2f2064dc44d89b4c1e3d646b40571';

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
//     const textPrompt = `
// 你是一名插画师，需要为同济大学校园模拟游戏《梁乔的学期》绘制一张“生日结局”的插画。

// 下面是游戏生成的「生日结局」剧情（Markdown）：
// ${birthdayMarkdown}


// 画面要求要点（用于你理解，不要原样输出）：
// 1. 场景：同济大学嘉定校区的某个地点，例如寝室小聚、嘉定图书馆楼下夜宵、满天星小餐馆等，从文本中挑最重要或最有氛围感的一个。
// 2. 角色：主角梁乔（软件工程学生，戴眼镜），可以略带“卷又有点脱发危机”的气质；再选少数几位最亲近的朋友或恋爱对象在旁边庆祝生日。
// 3. 氛围：温暖的生日聚会，有蛋糕、蜡烛、等细节，感觉有点累但被治愈。
// 4. 画风：清爽写实的日式校园插画 / 轻小说封面风格，色彩偏暖。
// 5. 画面中不要出现任何文字（不要写 Happy Birthday 等）。

// `;

const textPrompt = `
你是一名插画师，需要为校园模拟游戏《尚丙奇的学期》绘制一张“生日结局”的插画。

下面是游戏生成的「生日结局」剧情（Markdown）：
${birthdayMarkdown}

画面要求要点（用于你理解，不要原样输出）：
1. 场景：美国读研环境中的一个具体地点，从文本中挑最重要或最有氛围感的一个来画——例如：大学图书馆自习区/实验室夜灯下、校园草坪夜聊、中餐馆小聚、租房小客厅的简易生日布置等。场景要有“异国感但真实克制”，不要旅游风。
2. 角色：
   - 主角：尚丙奇（软件工程背景的研究生，戴眼镜，可有一点疲惫但精神被点亮的气质）。
   - 配角：选择 2～4 位与主角关系最亲近的老朋友出现（根据文本出现的人来定）。允许有“线上祝福”的表现方式：比如手机视频通话画面/平板放在桌上/手机亮屏群聊刷屏，但画面里不要出现可读文字。
3. 氛围：温暖、被惦记、被接住的生日。主角可能刚从学习/实验/加班里抽身出来，略累，但被朋友们的出现与祝福治愈。要有蛋糕、蜡烛、外卖袋/一次性餐具/小礼物等生活细节。
4. 关系基调：没有恋爱线，以友情与室友/兄弟情为核心；可以有轻松搞笑的瞬间（比如朋友夸张表情/手势），但整体要温柔。
5. 画风：清爽写实的日式校园插画 / 轻小说封面风格，构图干净，色彩偏暖，光线柔和（夜灯/暖光/烛光皆可）。
6. 重要限制：画面中不要出现任何文字（不要写 Happy Birthday、不要出现可读的聊天内容、招牌文字也尽量避免）。
`;



    // 2. 用图像模型生成图片
    const dashscopeRes = await fetch(DASHSCOPE_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "qwen-image-plus", // 或 "qwen-image"，文档里推荐 plus :contentReference[oaicite:1]{index=1}
        input: {
          messages: [
            {
              role: "user",
              content: [{ text: textPrompt }],
            },
          ],
        },
        parameters: {
          size: "1328*1328", // 官方默认尺寸之一
          prompt_extend: true,
          watermark: false,
        },
      }),
    });

    if (!dashscopeRes.ok) {
      const text = await dashscopeRes.text().catch(() => "");
      return res.status(500).json({
        error: "DashScope image API error",
        status: dashscopeRes.status,
        body: text,
      });
    }

    const data = await dashscopeRes.json();

    // 按官方响应结构取出图片 URL :contentReference[oaicite:2]{index=2}
    const imageUrl =
      data?.output?.choices?.[0]?.message?.content?.[0]?.image;

    if (!imageUrl) {
      return res.status(500).json({
        error: "No image URL in DashScope response",
        raw: data,
      });
    }

    // 直接把可访问的 URL 返回前端，用 <img src={imageUrl}> 即可
    return res.status(200).json({ imageUrl });

    
  } catch (e: any) {
    console.error("Error in /api/birthday-image:", e);
    res.status(500).json({ error: e.message || "Internal Server Error" });
  }
}
