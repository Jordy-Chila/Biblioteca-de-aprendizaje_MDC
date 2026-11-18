import { z } from 'zod';
import { ClaudeError, LLMProvider, SYSTEM_PROMPT } from './claudeProvider';

export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';
export const OPENAI_MODELOS = [
  { id: 'gpt-5-mini', nombre: 'GPT-5 mini (recomendado, económico)' },
  { id: 'gpt-5', nombre: 'GPT-5 (más capaz)' },
  { id: 'gpt-4.1-mini', nombre: 'GPT-4.1 mini' },
  { id: 'gpt-4o-mini', nombre: 'GPT-4o mini' },
];

/**
 * ChatGPT (OpenAI) mediante la API de Chat Completions, llamada directamente desde el navegador
 * con la clave del propio usuario (solo en memoria). La respuesta se pide en JSON y se valida con zod.
 */
export class OpenAIProvider extends LLMProvider {
  id = 'openai' as const;
  nombre = 'ChatGPT';
  protected testTokens = 2000; // los modelos de razonamiento consumen tokens antes de responder

  constructor(private apiKey: string, private model = OPENAI_DEFAULT_MODEL) {
    super();
  }

  protected async call<T extends z.ZodType>(schema: T, user: string, maxTokens = 16000): Promise<z.infer<T>> {
    let res: Response;
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\nResponde ÚNICAMENTE con un objeto JSON válido que cumpla exactamente este esquema JSON (mismos nombres de campos):\n${jsonSchema}` },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch {
      throw new ClaudeError('No se pudo conectar con la API de OpenAI. Revisa tu conexión a internet.');
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    };
    if (!res.ok) {
      const msg = data.error?.message ?? res.statusText;
      if (res.status === 401) throw new ClaudeError('La clave de API de OpenAI no es válida o fue revocada.');
      if (res.status === 429) throw new ClaudeError(data.error?.code === 'insufficient_quota' ? 'Tu cuenta de OpenAI no tiene saldo o crédito disponible. Añade un método de pago en platform.openai.com.' : 'Se alcanzó el límite de uso de la API de OpenAI. Espera un momento e inténtalo de nuevo.');
      if (res.status === 404) throw new ClaudeError(`El modelo «${this.model}» no está disponible para tu cuenta de OpenAI.`);
      throw new ClaudeError(`Error de la API de OpenAI (${res.status}): ${msg}`);
    }
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new ClaudeError('El modelo declinó responder a esta petición.');
    if (choice?.finish_reason === 'length') throw new ClaudeError('La respuesta fue demasiado larga y quedó incompleta. Prueba con un tema más concreto.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(choice?.message?.content ?? '');
    } catch {
      throw new ClaudeError('La respuesta de la IA no tenía el formato esperado.');
    }
    const r = schema.safeParse(parsed);
    if (!r.success) throw new ClaudeError('La respuesta de la IA no cumplía el formato esperado. Inténtalo de nuevo.');
    return r.data as z.infer<T>;
  }
}
