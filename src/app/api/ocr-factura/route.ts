import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY no configurada' }, { status: 500 })

  const { imageBase64, mimeType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `Analiza esta factura o boleta de compra. Extrae SOLO los productos/items comprados.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "proveedor": "nombre del proveedor o tienda (string o null)",
  "fecha": "fecha de la factura en formato YYYY-MM-DD (string o null)",
  "items": [
    {
      "nombre": "nombre del producto",
      "cantidad": 1,
      "precio_unitario": 0
    }
  ]
}

Reglas:
- cantidad siempre es número positivo
- precio_unitario es el precio por unidad en pesos chilenos (número entero, sin símbolos)
- Si no puedes leer algún campo, usa null para strings o 0 para números
- Si el precio es total y la cantidad es 1, precio_unitario = precio total
- Incluye TODOS los productos visibles en la factura`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType ?? 'image/jpeg', data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
    })

    const text = response.text?.trim() ?? ''
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e) {
    console.error('Gemini error:', e)
    return NextResponse.json({ error: 'No se pudo leer la factura. Intenta con una foto más clara.' }, { status: 422 })
  }
}
