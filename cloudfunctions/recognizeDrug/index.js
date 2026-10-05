//index.js
const cloud = require('wx-server-sdk')
const axios = require('axios')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileID } = event

  const res = await cloud.getTempFileURL({ fileList: [fileID] })
  const imageUrl = res.fileList[0].tempFileURL

  const apiKey = process.env.QWEN_API_KEY

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model: 'qwen-vl-ocr',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            {
              type: 'text',
              text: '请从这张药品包装图片中提取信息，以JSON格式返回，不要输出其他内容：{"drugName":"药品名称","expiryDate":"有效期截止日期(格式YYYY-MM-DD)","batchNumber":"批号","manufacturer":"生产厂家"}'
            }
          ]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 50000
      }
    )

    const aiText = response.data.choices[0].message.content
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { code: -1, message: '识别失败，请手动输入', raw: aiText }
    }

    const drugInfo = JSON.parse(jsonMatch[0])

    const expiry = new Date(drugInfo.expiryDate)
    const now = new Date()
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))

    let status
    if (daysLeft < 0) status = 'expired'
    else if (daysLeft <= 90) status = 'warning'
    else status = 'normal'

    return {
      code: 0,
      data: { ...drugInfo, daysLeft, status }
    }
  } catch (err) {
    console.error(err)
    return { code: -1, message: 'AI服务调用失败', error: err.message }
  }
}
