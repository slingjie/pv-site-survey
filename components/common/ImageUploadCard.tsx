import React from "react";
import { UploadCloud } from "../icons";

interface ImageUploadCardProps {
  title: string;
  onUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreviewExample?: () => void;
  onClick?: () => void; // Added for previewing
  image?: string | null;
  disabled?: boolean;
}

const ImageUploadCard: React.FC<ImageUploadCardProps> = ({
  title,
  onUpload,
  onPreviewExample,
  onClick,
  image,
  disabled = false,
}) => {
  // 预览能力与是否允许编辑（disabled）解耦：查看模式下仍然允许点开大图
  const canPreview = !!image && !!onClick;
  const isTrulyDisabled = disabled && !canPreview;

  return (
    <div
      onClick={canPreview ? onClick : undefined}
      className={`relative p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg text-center h-32 flex flex-col justify-center items-center text-gray-500 transition ${
        isTrulyDisabled
          ? "cursor-not-allowed bg-gray-50"
          : image
            ? "cursor-pointer hover:border-yellow-500"
            : "cursor-pointer hover:border-yellow-500 hover:text-yellow-600"
      }`}
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="max-h-full max-w-full object-contain rounded"
        />
      ) : (
        <>
          <UploadCloud size={24} className="mb-2" />
          <span className="text-sm font-medium">{title || "上传/拍照"}</span>
        </>
      )}
      {!image && (
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onChange={onUpload}
          accept="image/*"
          disabled={disabled}
        />
      )}
      {onPreviewExample && !disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreviewExample();
          }}
          className="absolute top-2 right-2 text-xs text-blue-600 hover:underline"
        >
          示例
        </button>
      )}
    </div>
  );
};

export default ImageUploadCard;
