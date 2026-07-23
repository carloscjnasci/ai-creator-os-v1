// API utility functions placeholder

export async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error('Network error');
  }
  return res.json();
}
