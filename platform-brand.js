function applyPlatformPalette(value) {
  const palette = ['forest','emerald','olive'].includes(value) ? value : 'forest';
  document.documentElement.dataset.platformPalette = palette;
  try { localStorage.setItem('platform.brandPalette',palette); } catch {}
}
try {
  applyPlatformPalette(localStorage.getItem('platform.brandPalette'));
} catch {
  document.documentElement.dataset.platformPalette = 'forest';
}
