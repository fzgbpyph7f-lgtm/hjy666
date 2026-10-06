//index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const axios = require('axios')

// 正面提示词：提取药名、批准文号、厂家、规格
const PROMPT_FRONT = `你是药品包装识别助手。这是药盒的正面照片。只返回一个JSON对象（不要用markdown代码块包裹）：
{
  "drugName": "药品通用名（必填，如：阿莫西林胶囊）",
  "tradeName": "商品名，没有则null",
  "approvalNumber": "批准文号，如：国药准字H20033456，找不到则null",
  "manufacturer": "生产企业全称，找不到则null",
  "specification": "规格（如0.25g、10片/盒），找不到则null",
  "confidence": "high/medium/low"
}`

// 侧面提示词：提取生产日期、有效期
const PROMPT_SIDE = `你是药品包装识别助手。这是药盒的侧面/封口照片，请重点寻找钢印或喷码。只返回一个JSON对象（不要用markdown代码块包裹）：
{
  "productionDate": "生产日期，YYYY-MM-DD格式，找不到则null",
  "expiryDate": "有效期至，YYYY-MM-DD格式，找不到则null",
  "validityMonths": "有效期月数（数字），如36，找不到则null",
  "batchNumber": "生产批号，找不到则null",
  "confidence": "high/medium/low"
}
注意：如果印的是"有效期至2026/05"这种格式，expiryDate返回"2026-05-01"。`

exports.main = async (event) => {
  const { fileID, mode } = event
  if (!fileID) return { success: false, msg: '缺少图片fileID' }

  const prompt = mode === 'side' ? PROMPT_SIDE : PROMPT_FRONT

  try {
    const file = await cloud.downloadFile({ fileID })
    const base64 = file.fileContent.toString('base64')

    const resp = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: 'kimi-k2.6',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )

    const text = resp.data.choices[0].message.content
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, msg: '识别失败，未返回有效JSON', raw: text }
    }

    const data = JSON.parse(jsonMatch[0])
    return { success: true, mode: mode || 'front', data }

  } catch (err) {
    console.error('=== ERROR ===')
    console.error('message:', err.message)
    console.error('data:', JSON.stringify(err.response?.data, null, 2))
    return { success: false, msg: '识别失败: ' + (err.response?.data?.error?.message || err.message) }
  }
}