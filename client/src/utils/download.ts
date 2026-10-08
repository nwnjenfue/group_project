import api from '../api/axios';

export async function errorMessage(error: any, fallback: string): Promise<string> {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message || fallback; } catch { return fallback; }
  }
  if (data?.message) return data.message;
  if (error.code === 'ECONNABORTED') return 'Сервер не успел ответить. Проверьте, появился ли результат, прежде чем повторить действие.';
  if (!error.response) return 'Нет связи с сервером. Проверьте подключение и повторите попытку.';
  return fallback;
}

export async function downloadReport(kind: 'pdf' | 'excel' | 'selected', importId: string, ids: string[] = [], filters: Record<string,string> = {}) {
  const options = { responseType: 'blob' as const, timeout: 120000, params: { ...filters, importId } };
  const response = kind === 'selected'
    ? await api.post('/pdf/generate/selected', { ids, importId }, options)
    : await api.get(kind === 'excel' ? '/export/excel' : '/pdf/generate', options);
  const blob = response.data;
  if (!(blob instanceof Blob) || !blob.size) throw new Error('Сервер вернул пустой файл.');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `efot-${kind === 'selected' ? 'selected' : 'report'}-${new Date().toISOString().slice(0,10)}.${kind === 'excel' ? 'xlsx' : 'pdf'}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to start reading the Blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
