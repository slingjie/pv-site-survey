// 通用图片压缩工具：在浏览器端将原始图片压缩为较小的 DataURL
// 通过限制最长边尺寸和 JPEG 质量，显著降低体积，减轻接口与数据库压力

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1，越小压缩率越高
}

/**
 * 将 File 对象压缩为 DataURL（Base64），用于表单内嵌图片存储
 */
export const compressImageFile = (
  file: File,
  options: CompressImageOptions = {},
): Promise<string> => {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.7 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) {
        reject(new Error("图片读取失败"));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // 按最长边等比缩放，避免过大的原始分辨率
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        const targetWidth = width * scale;
        const targetHeight = height * scale;

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // 无法获取 2D 上下文时退回原图
          resolve(base64);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const mimeType =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        // 解码失败则退回原图
        resolve(base64);
      };

      img.src = base64;
    };

    reader.onerror = () => {
      reject(new Error("图片文件读取失败"));
    };

    reader.readAsDataURL(file);
  });
};

