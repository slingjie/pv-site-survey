import React, { useState, useRef } from "react";
import type { BuildingRoof } from "../../types";
import { MapPin, UploadCloud, X, ChevronLeft, ChevronRight } from "../icons";
import { compressImageFile } from "../common/imageUtils";

interface RoofSatelliteMapProps {
  satelliteImage: string | null;
  onSatelliteImageChange: (base64: string | null) => void;
  roofs: BuildingRoof[];
  // lng = X (Left %), lat = Y (Top %)
  onRoofCoordinatesChange: (roofId: string, lat: number, lng: number) => void;
  /** 是否处于编辑模式，查看模式下禁止修改 */
  isEditing: boolean;
}

const RoofSatelliteMap: React.FC<RoofSatelliteMapProps> = ({
  satelliteImage,
  onSatelliteImageChange,
  roofs,
  onRoofCoordinatesChange,
  isEditing,
}) => {
  const [activeRoofId, setActiveRoofId] = useState<string | null>(
    roofs[0]?.id || null,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // 仅影响查看体验的缩放与拖拽状态（不修改任何数据）
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    // 查看模式禁止上传或更换底图
    if (!isEditing) return;

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      onSatelliteImageChange(compressed);
    } catch (err) {
      console.error("卫星图压缩失败，回退为原图：", err);
      const reader = new FileReader();
      reader.onload = (event) => {
        onSatelliteImageChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 查看模式下支持滚轮缩放
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isEditing || !satelliteImage) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setZoom((prev) => {
      const next = prev * factor;
      return Math.min(3, Math.max(0.5, next));
    });
  };

  // 查看模式下支持鼠标拖拽平移
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing || !satelliteImage) return;
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

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 查看模式禁止在图上标记
    if (!isEditing) return;

    if (!activeRoofId || !satelliteImage) {
      if (!activeRoofId) alert("请先在左侧选择一个屋顶");
      return;
    }

    // Calculate percentage coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    // lng = x%, lat = y%
    onRoofCoordinatesChange(activeRoofId, yPercent, xPercent);
  };

  const activeRoof = roofs.find((r) => r.id === activeRoofId);

  return (
    <div className="flex h-full relative bg-gray-100">
      {/* Left Sidebar (Roof List) 可折叠 */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg transition-all duration-300 ${
          isSidebarCollapsed ? "w-9" : "w-48"
        }`}
      >
        <div className="flex items-center justify-between px-2 py-2 md:px-3 md:py-3 border-b border-gray-200 bg-gray-50">
          {!isSidebarCollapsed && (
            <div className="mr-1">
              <h3 className="font-medium text-gray-700 text-sm">屋顶列表</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                先选屋顶，再在右侧图片上点击标记位置。
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 flex-shrink-0"
            title={isSidebarCollapsed ? "展开屋顶列表" : "折叠屋顶列表"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>

        {!isSidebarCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {roofs.map((roof) => (
                <button
                  key={roof.id}
                  onClick={() => setActiveRoofId(roof.id)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition flex justify-between items-center ${
                    activeRoofId === roof.id
                      ? "bg-yellow-100 border border-yellow-400 text-yellow-800"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate mr-2">{roof.name}</span>
                  {roof.coordinates && (
                    <MapPin
                      size={14}
                      className="text-green-600 flex-shrink-0"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-2 border-t border-gray-200 space-y-2">
              {activeRoof && activeRoof.coordinates && (
                <button
                  onClick={() => {
                    if (!isEditing) return;
                    onRoofCoordinatesChange(activeRoof.id, 0, 0);
                  }}
                  disabled={!isEditing}
                  className={`w-full py-2 text-xs rounded border ${
                    isEditing
                      ? "text-red-500 hover:bg-red-50 border-red-200"
                      : "text-red-300 border-red-100 cursor-not-allowed bg-gray-50"
                  }`}
                >
                  清除当前标记
                </button>
              )}
              {satelliteImage && (
                <button
                  onClick={() => {
                    if (!isEditing) return;
                    if (
                      confirm(
                        "确定要移除底图吗？这将保留标记点但移除背景。",
                      )
                    ) {
                      onSatelliteImageChange(null);
                    }
                  }}
                  disabled={!isEditing}
                  className={`w-full py-2 text-xs rounded border ${
                    isEditing
                      ? "text-gray-500 hover:bg-gray-100 border-gray-200"
                      : "text-gray-300 border-gray-100 cursor-not-allowed bg-gray-50"
                  }`}
                >
                  移除底图
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {!satelliteImage ? (
          // Empty State / Upload Area
          <div
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-gray-50 text-gray-500 relative w-full max-w-lg h-64 transition ${
              isEditing
                ? "border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 cursor-pointer"
                : "border-gray-200 cursor-default opacity-80"
            }`}
          >
            <UploadCloud size={48} className="mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">
              {isEditing ? "上传卫星图或总平图" : "查看模式下无法上传或编辑"}
            </h3>
            <p className="text-sm text-center max-w-xs">
              {isEditing
                ? "请上传无人机航拍图、Google Earth 截图或厂区总平图作为底图。"
                : "切换到编辑模式后，可上传底图并标记屋顶位置。"}
            </p>
            <input
              type="file"
              accept="image/*"
              className={`absolute inset-0 opacity-0 ${isEditing ? "cursor-pointer" : "cursor-default"}`}
              disabled={!isEditing}
              onChange={handleImageUpload}
            />
          </div>
        ) : (
          // Image Container（支持查看模式缩放与拖拽）
          <div className="relative shadow-2xl border border-gray-200 bg-white inline-block overflow-hidden">
            <div
              className="relative"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                cursor:
                  satelliteImage && !isEditing
                    ? isPanning
                      ? "grabbing"
                      : "grab"
                    : undefined,
              }}
              onWheel={handleWheel}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
            >
              <img
                src={satelliteImage}
                alt="Satellite Base"
                className="max-w-full max-h-[80vh] object-contain block select-none"
                draggable={false}
              />

              {/* Interactive Overlay Layer */}
              <div
                className={`absolute inset-0 ${isEditing ? "cursor-crosshair" : "cursor-default pointer-events-none"}`}
                onClick={handleMapClick}
              >
                {/* Markers */}
                {roofs.map((roof) => {
                  if (!roof.coordinates) return null;
                  const isActive = roof.id === activeRoofId;
                  return (
                    <div
                      key={roof.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                      style={{
                        left: `${roof.coordinates.lng}%`,
                        top: `${roof.coordinates.lat}%`,
                      }}
                    >
                      <MapPin
                        size={isActive ? 32 : 24}
                        className={`drop-shadow-md ${isActive ? "text-red-500" : "text-yellow-500"}`}
                        fill="currentColor"
                      />
                      <span
                        className={`mt-1 px-1.5 py-0.5 bg-white/90 text-xs font-bold rounded border shadow-sm whitespace-nowrap ${isActive ? "border-red-500 text-red-600 z-20" : "border-gray-300 text-gray-700 z-10"}`}
                      >
                        {roof.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Helper Hint */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded shadow text-sm text-gray-800 z-10 pointer-events-none">
          当前选中:{" "}
          <span className="font-bold text-yellow-600">
            {activeRoof ? activeRoof.name : "无"}
          </span>
          {activeRoof?.coordinates ? (
            <span className="text-green-600 ml-2">(已标记)</span>
          ) : (
            <span className="text-gray-500 ml-2">(点击图片标记)</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoofSatelliteMap;
