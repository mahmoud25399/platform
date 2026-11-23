function taskAttribute(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function prepareHomeworkImage(file) {
  let payload = file;
  if (file.type === 'image/jpeg' && file.size > 1200000 && typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (compressed && compressed.size < file.size) payload = compressed;
    } catch { /* Use the original image if decoding is unsupported. */ }
    finally { if (bitmap) bitmap.close(); }
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذرت قراءة الصورة. اختر الملف مرة أخرى.'));
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(payload);
  });
  return {name:file.name, mimeType:payload.type, data};
}
