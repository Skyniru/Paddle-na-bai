export async function readGroupPhoto(file: File): Promise<string> {
  if (
    !file.size ||
    file.size > 2 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("Choose a JPG, PNG, or WebP photo under 2 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(Error("Could not read the photo. Try another image."));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () =>
      reject(Error("This image could not be opened. Choose another photo."));
    image.src = source;
  });
  return source;
}
