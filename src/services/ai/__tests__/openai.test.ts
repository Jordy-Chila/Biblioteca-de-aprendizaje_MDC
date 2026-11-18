import { OpenAIProvider } from '../openaiProvider';

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => vi.unstubAllGlobals());

test('ChatGPT: valida la clave con una respuesta JSON', async () => {
  const f = reply(200, { choices: [{ message: { content: '{"ok": true}' }, finish_reason: 'stop' }] });
  vi.stubGlobal('fetch', f);
  await expect(new OpenAIProvider('clave-de-prueba', 'gpt-5-mini').test()).resolves.toBeUndefined();
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/chat/completions');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer clave-de-prueba');
  expect(JSON.parse(init.body as string)).toMatchObject({ model: 'gpt-5-mini', response_format: { type: 'json_object' } });
});

test('ChatGPT: errores legibles', async () => {
  vi.stubGlobal('fetch', reply(401, { error: { message: 'bad key' } }));
  await expect(new OpenAIProvider('x').test()).rejects.toThrow(/no es válida/);
  vi.stubGlobal('fetch', reply(429, { error: { code: 'insufficient_quota', message: 'quota' } }));
  await expect(new OpenAIProvider('x').test()).rejects.toThrow(/saldo/);
  vi.stubGlobal('fetch', reply(200, { choices: [{ message: { content: '{"otra": 1}' }, finish_reason: 'stop' }] }));
  await expect(new OpenAIProvider('x').test()).rejects.toThrow(/formato/);
});
