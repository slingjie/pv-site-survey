import React, { useEffect, useState, useRef } from "react";
import { X } from "../icons";

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageUrl,
  onClose,
}) => {
  // 缩放与拖拽仅作用于预览视图，不修改任何业务数据
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setZoom((prev) => {
      const next = prev * factor;
      return Math.min(4, Math.max(0.5, next));
    });
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setOffset({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy,
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
      <button
        className="absolute top-4 right-4 text-white p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 transition"
        onClick={onClose}
      >
        <X size={24} />
      </button>
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-black bg-opacity-60 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image itself
      >
        <div
          className="relative flex items-center justify-center w-full h-full cursor-grab"
          style={{
            cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
          }}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
        >
          <img
            src={imageUrl}
            alt="Preview"
            className="select-none pointer-events-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
