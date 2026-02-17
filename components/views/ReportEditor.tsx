import React, { useState } from "react";
import type {
  ReportData,
  PlantOverviewData,
  BuildingRoof,
  ElectricalFacilitiesData,
  DocumentCollectionData,
  Project,
} from "../../types";
import {
  enums,
  roofModuleConfig,
  electricalModuleConfig,
  subFacilityConfig,
  documentCollectionConfig,
} from "../../services/formConfigs";
import PlantOverview from "../editor/PlantOverview";
import BuildingRoofs from "../editor/BuildingRoofs";
import ElectricalFacilities from "../editor/ElectricalFacilities";
import DocumentCollection from "../editor/DocumentCollection";
import RoofSatelliteMap from "../editor/RoofSatelliteMap";
import Toast from "../common/Toast";
import TextInput from "../common/TextInput";
import GeneratedReportModal from "../common/GeneratedReportModal";
import {
  ChevronLeft,
  MoreHorizontal,
  FileText,
  Save,
  Building,
  Zap,
  ClipboardList,
  Edit,
  Spinner,
  Satellite,
} from "../icons";

interface ReportEditorProps {
  reportId: string;
  initialData: ReportData;
  onClose: () => void;
  onSave: (reportId: string, data: ReportData) => void;
  startInEditMode?: boolean;
  isMobileView: boolean;
  projectStatus: Project["status"];
  onUpdateProjectStatus: (projectId: string, status: Project["status"]) => void;
  onDeleteProject: (projectId: string) => void;
  projectSurveyDate?: string;
  projectSurveyors?: string;
  projectType?: Project["projectType"];
}

type ReportMeta = {
  surveyDate?: string;
  surveyors?: string;
  projectType?: Project["projectType"];
};

// --- Local HTML Report Generator ---
const generateHtmlReport = (data: ReportData, meta?: ReportMeta): string => {
  const getEnumLabel = (enumKey: keyof typeof enums, value: string) => {
    if (!enumKey) return value;
    const enumList = enums[enumKey] || [];
    const found = enumList.find((item) => item.value === value);
    return found ? found.label : value;
  };

  const renderField = (
    label: string,
    value: any,
    type: "text" | "enum" | "chips" | "image" | "textarea" | "number" = "text",
    enumKey?: keyof typeof enums,
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `<p><strong>${label}:</strong> <span class="value-empty">未提供</span></p>`;
    }
    let renderedValue = "";
    switch (type) {
      case "image":
        renderedValue = `<img src="${value}" alt="${label}" class="report-image">`;
        break;
      case "enum":
        renderedValue = getEnumLabel(enumKey!, value as string);
        break;
      case "chips":
        renderedValue = (value as string[])
          .map((v) => getEnumLabel(enumKey!, v))
          .join("、");
        break;
      case "textarea":
        renderedValue = `<div class="textarea-value">${(value as string).replace(/\n/g, "<br>")}</div>`;
        break;
      default:
        renderedValue = value.toString();
    }
    if (type === "image") {
      return `<div><p><strong>${label}:</strong></p>${renderedValue}</div>`;
    }
    return `<p><strong>${label}:</strong> ${renderedValue}</p>`;
  };

  const renderSection = (config: any, data: any) => {
    if (!config || !config.fields) return "";
    return config.fields
      .map((field: any) => {
        const value = data[field.key];
        return renderField(field.label, value, field.type, field.enumKey);
      })
      .join("");
  };

  const docItems = documentCollectionConfig.sections.flatMap((s) => s.items);

  // 收资清单分组渲染：按状态聚合，减少逐条罗列的冗长感
  const renderDocumentSummary = (data: ReportData): string => {
    const groups: Record<string, string[]> = {};

    docItems.forEach((item) => {
      const rawStatus = data.documentCollection[item.key];
      const label = getEnumLabel("DOCUMENT_STATUS", rawStatus as string);
      if (!label) return;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item.label);
    });

    const order = ["齐全", "部分", "待收", "无法提供"];

    return order
      .map((statusLabel) => {
        const items = groups[statusLabel];
        if (!items || items.length === 0) return "";
        return `<p><strong>${statusLabel}:</strong> ${items.join("、")}</p>`;
      })
      .join("");
  };

  // 卫星分布叠加层渲染：在底图上根据坐标展示屋顶标记
  const renderSatelliteOverlay = (
    plant: PlantOverviewData,
    roofs: BuildingRoof[],
  ): string => {
    if (!plant.satelliteImage) return "";
    const roofsWithCoords = roofs.filter((r) => r.coordinates);
    if (roofsWithCoords.length === 0) return "";

    const markers = roofsWithCoords
      .map((roof) => {
        const coords = roof.coordinates!;
        return `<div class="satellite-marker" style="left: ${coords.lng}%; top: ${coords.lat}%;">
          <div class="satellite-marker-dot"></div>
          <div class="satellite-marker-label">${roof.name}</div>
        </div>`;
      })
      .join("");

    return `
      <h3>卫星分布标记示意</h3>
      <div class="satellite-map-wrapper">
        <img src="${plant.satelliteImage}" alt="卫星分布底图" class="satellite-map-image" />
        <div class="satellite-map-layer">
          ${markers}
        </div>
      </div>
    `;
  };

  let html = `
    <style>
      .report-container { font-family: sans-serif; color: #333; padding: 20px; }
      .report-container h1 { font-size: 24px; font-weight: bold; color: #111; border-bottom: 2px solid #f0b90b; padding-bottom: 10px; margin-bottom: 20px; }
      .report-container h2 { font-size: 20px; font-weight: bold; color: #222; background-color: #f7f7f7; padding: 10px; border-left: 4px solid #f0b90b; margin-top: 30px; margin-bottom: 15px; }
      .report-container h3 { font-size: 16px; font-weight: bold; color: #333; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
      .report-container p { font-size: 14px; line-height: 1.6; margin-bottom: 10px; }
      .report-container strong { color: #555; }
      .report-container .value-empty { color: #999; font-style: italic; }
      .report-container .textarea-value { background-color: #f9f9f9; border: 1px solid #eee; padding: 8px; border-radius: 4px; white-space: pre-wrap; }
      .report-container .report-image { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #ddd; margin-top: 8px; }
      .roof-section { margin-bottom: 25px; padding: 15px; border: 1px solid #eee; border-radius: 8px; }
      .cover-summary { margin-top: 16px; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb; padding: 12px 16px; }
      .cover-summary-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; }
      .cover-summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .cover-summary-table td { padding: 4px 0; vertical-align: top; }
      .cover-summary-label { width: 80px; color: #6b7280; white-space: nowrap; }
      .cover-summary-value { color: #111827; }
      .satellite-map-wrapper { position: relative; display: inline-block; max-width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; background-color: #f9fafb; margin-top: 10px; }
      .satellite-map-image { display: block; max-width: 100%; height: auto; }
      .satellite-map-layer { position: absolute; inset: 0; pointer-events: none; }
      .satellite-marker { position: absolute; transform: translate(-15%, -20%); text-align: center; }
      .satellite-marker-dot { width: 12px; height: 12px; border-radius: 9999px; background-color: #f97316; border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.4); margin-bottom: 2px; }
      .satellite-marker-label { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 12px; background-color: rgba(255,255,255,0.96); border: 1px solid #fed7aa; color: #7c2d12; white-space: nowrap; }
    </style>
    <div class="report-container">
      <h1>勘探报告: ${data.projectName}</h1>
      <p><strong>项目地点:</strong> ${data.location}</p>
      ${
        meta
          ? `
      <div class="cover-summary">
        <div class="cover-summary-title">项目信息摘要</div>
        <table class="cover-summary-table">
          <tr>
            <td class="cover-summary-label">踏勘日期：</td>
            <td class="cover-summary-value">${meta.surveyDate || "未提供"}</td>
          </tr>
          <tr>
            <td class="cover-summary-label">踏勘人员：</td>
            <td class="cover-summary-value">${meta.surveyors || "未提供"}</td>
          </tr>
          <tr>
            <td class="cover-summary-label">项目类型：</td>
            <td class="cover-summary-value">${
              meta.projectType === "pv"
                ? "光伏"
                : meta.projectType === "storage"
                  ? "储能"
                  : meta.projectType === "pv_storage"
                    ? "光储一体"
                    : meta.projectType
                      ? "其他"
                      : "未提供"
            }</td>
          </tr>
        </table>
      </div>`
          : ""
      }

      <h2>一、厂区概况</h2>
      ${renderField("工厂地址", data.plantOverview.address)}
      ${data.plantOverview.coordinates ? renderField("地理坐标", `经度 ${data.plantOverview.coordinates.lng.toFixed(5)}, 纬度 ${data.plantOverview.coordinates.lat.toFixed(5)}`) : ""}
      ${renderField("厂区鸟瞰图", data.plantOverview.layoutMap, "image")}
      ${renderField("房屋位置分布图", data.plantOverview.overviewPhotos[0] || null, "image")}
      <h3>位置交通</h3>
      ${renderField("交通条件", data.plantOverview.traffic.condition, "enum", "TRAFFIC_CONDITION")}
      ${renderField("交通情况说明", data.plantOverview.traffic.description, "textarea")}
      ${renderField("位置分布图（交通）", data.plantOverview.traffic.map, "image")}
      <h3>风险区域</h3>
      ${renderField("风险类型", data.plantOverview.riskZone.types, "chips", "RISK_TYPE")}
      ${renderField("风险说明", data.plantOverview.riskZone.description, "textarea")}
      ${data.plantOverview.riskZone.photos.length > 0 ? renderField("风险区域照片", data.plantOverview.riskZone.photos[0], "image") : ""}
      <h3>用电信息</h3>
      ${renderField("用电时段", data.plantOverview.powerInfo.usagePeriod, "enum", "POWER_USAGE_PERIOD")}
      ${renderField("电价类型", data.plantOverview.powerInfo.priceType, "enum", "POWER_PRICE_TYPE")}
      ${renderField("电压等级", data.plantOverview.powerInfo.voltage, "enum", "ELECTRICAL_VOLTAGE")}
      ${renderField("分时电价", data.plantOverview.powerInfo.timeOfUsePrice ? "是" : "否")}
      <h3>产权信息</h3>
      ${renderField("业主性质", data.plantOverview.propertyInfo.ownerType, "enum", "OWNER_TYPE")}

      <h2>二、建筑屋面</h2>
      ${data.buildingRoofs
        .map(
          (roof) => `
        <div class="roof-section">
          <h3>屋顶: ${roof.name}</h3>
          ${renderSection(
            roofModuleConfig.sections.find((s) => s.key === "basicInfo"),
            roof,
          )}
          <h4>屋顶屋面</h4>
          ${renderSection(
            roofModuleConfig.sections.find((s) => s.key === "surface"),
            roof,
          )}
          <h4>内部结构</h4>
          ${renderSection(
            roofModuleConfig.sections.find((s) => s.key === "internal"),
            roof,
          )}
          <h4>房屋周边</h4>
          ${renderSection(
            roofModuleConfig.sections.find((s) => s.key === "surroundings"),
            roof,
          )}
          ${roof.coordinates ? `<p><strong>卫星定位:</strong> X:${roof.coordinates.lng.toFixed(1)}%, Y:${roof.coordinates.lat.toFixed(1)}%</p>` : ""}
        </div>
      `,
        )
        .join("")}

      <h2>三、卫星分布</h2>
      ${renderField("卫星底图", data.plantOverview.satelliteImage, "image")}
      ${renderSatelliteOverlay(data.plantOverview, data.buildingRoofs)}

      <h2>四、电气设施</h2>
      <h3>现场照片</h3>
      ${renderSection(
        electricalModuleConfig.sections.find((s) => s.key === "sitePhotos"),
        data.electricalFacilities,
      )}
      <h3>配电信息</h3>
      ${renderSection(
        electricalModuleConfig.sections.find(
          (s) => s.key === "distributionInfo",
        ),
        data.electricalFacilities,
      )}
      <h3>并网信息</h3>
      ${renderSection(
        electricalModuleConfig.sections.find((s) => s.key === "gridInfo"),
        data.electricalFacilities,
      )}
      ${
        data.electricalFacilities.subFacilities.length > 0
          ? `
        <h3>分项设施详情</h3>
        ${data.electricalFacilities.subFacilities
          .map(
            (sf) => `
          <div class="roof-section">
             <h4>${sf.name}</h4>
             ${renderSection(subFacilityConfig, sf)}
          </div>
        `,
          )
          .join("")}
      `
          : ""
      }

      <h2>五、收资清单</h2>
      ${renderDocumentSummary(data)}
    </div>
  `;
  return html;
};

const ReportEditor: React.FC<ReportEditorProps> = ({
  reportId,
  initialData,
  onClose,
  onSave,
  startInEditMode = false,
  isMobileView,
  projectStatus,
  onUpdateProjectStatus,
  onDeleteProject,
  projectSurveyDate,
  projectSurveyors,
  projectType,
}) => {
  const [currentPage, setCurrentPage] = useState("plantOverview");
  const [reportData, setReportData] = useState<ReportData>(initialData);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isEditing, setIsEditing] = useState(startInEditMode);

  // State for report generation
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReportContent, setGeneratedReportContent] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: "plantOverview", label: "厂区概况", icon: Building },
    { id: "buildingRoofs", label: "建筑屋面", icon: Building },
    { id: "satellite", label: "卫星分布", icon: Satellite },
    { id: "electricalFacilities", label: "电气设施", icon: Zap },
    { id: "documentCollection", label: "收资清单", icon: ClipboardList },
  ];

  const handleSave = () => {
    onSave(reportId, reportData);
    setShowSaveToast(true);
    setIsEditing(false);
  };

  const handleGenerateReport = () => {
    setIsGeneratingReport(true);
    try {
      const reportHtml = generateHtmlReport(reportData, {
        surveyDate: projectSurveyDate,
        surveyors: projectSurveyors,
        projectType,
      });
      setGeneratedReportContent(reportHtml);
      setShowReportModal(true);
    } catch (error) {
      console.error("Error generating local report:", error);
      alert("报告生成失败，请检查数据。");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleHeaderChange = (
    field: "projectName" | "location",
    value: string,
  ) => {
    setReportData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlantOverviewChange = (updatedData: PlantOverviewData) => {
    setReportData((prev) => ({ ...prev, plantOverview: updatedData }));
  };

  const handleBuildingRoofsChange = (updatedData: BuildingRoof[]) => {
    setReportData((prev) => ({ ...prev, buildingRoofs: updatedData }));
  };

  // Updated to handle percentage coordinates (0-100)
  const handleRoofCoordinatesChange = (
    roofId: string,
    lat: number,
    lng: number,
  ) => {
    const updatedRoofs = reportData.buildingRoofs.map((roof) => {
      if (roof.id === roofId) {
        // If lat/lng are 0/0 (or explicitly cleared), we treat it as clear
        if (lat === 0 && lng === 0) return { ...roof, coordinates: null };
        return { ...roof, coordinates: { lat, lng } };
      }
      return roof;
    });
    setReportData((prev) => ({ ...prev, buildingRoofs: updatedRoofs }));
  };

  const handleElectricalFacilitiesChange = (
    updatedData: ElectricalFacilitiesData,
  ) => {
    setReportData((prev) => ({ ...prev, electricalFacilities: updatedData }));
  };

  const handleDocumentCollectionChange = (
    updatedData: DocumentCollectionData,
  ) => {
    setReportData((prev) => ({ ...prev, documentCollection: updatedData }));
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "plantOverview":
        return (
          <PlantOverview
            data={reportData.plantOverview}
            onDataChange={handlePlantOverviewChange}
            isEditing={isEditing}
          />
        );
      case "buildingRoofs":
        return (
          <BuildingRoofs
            data={reportData.buildingRoofs}
            onDataChange={handleBuildingRoofsChange}
            isEditing={isEditing}
          />
        );
      case "satellite":
        return (
          <RoofSatelliteMap
            satelliteImage={reportData.plantOverview.satelliteImage}
            onSatelliteImageChange={(base64) =>
              handlePlantOverviewChange({
                ...reportData.plantOverview,
                satelliteImage: base64,
              })
            }
            roofs={reportData.buildingRoofs}
            onRoofCoordinatesChange={handleRoofCoordinatesChange}
            isEditing={isEditing}
          />
        );
      case "electricalFacilities":
        return (
          <ElectricalFacilities
            data={reportData.electricalFacilities}
            onDataChange={handleElectricalFacilitiesChange}
            isEditing={isEditing}
          />
        );
      case "documentCollection":
        return (
          <DocumentCollection
            data={reportData.documentCollection}
            onDataChange={handleDocumentCollectionChange}
            isEditing={isEditing}
          />
        );
      default:
        return null;
    }
  };

  // Layout Classes
  const containerClass = isMobileView
    ? "flex flex-col h-full"
    : "flex flex-row h-full bg-gray-100";

  const sidebarClass = isMobileView
    ? "hidden"
    : "w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0";

  const contentClass = isMobileView
    ? "flex-1 overflow-hidden flex flex-col bg-white"
    : "flex-1 overflow-hidden flex flex-col bg-gray-100 p-4"; // Add padding for desktop feel

  const headerClass = isMobileView
    ? "flex-shrink-0 bg-white shadow-sm z-10"
    : "flex-shrink-0 bg-white shadow-sm z-10 rounded-t-xl"; // 桌面端使用卡片圆角头部

  const pageContainerClass = isMobileView
    ? "flex-1 overflow-y-auto bg-gray-100 px-3 pb-3"
    : "flex-1 overflow-y-auto bg-white shadow rounded-xl p-4"; // 桌面端内容区域使用卡片效果

  const toggleProjectStatus = () => {
    const nextStatus: Project["status"] =
      projectStatus === "completed" ? "editing" : "completed";
    onUpdateProjectStatus(reportId, nextStatus);
    setShowMoreMenu(false);
  };

  const handleDeleteFromEditor = () => {
    setShowMoreMenu(false);
    onDeleteProject(reportId);
  };

  return (
    <div className={containerClass}>
      {/* Desktop Sidebar Navigation */}
      {!isMobileView && (
        <div className={sidebarClass}>
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <span className="font-bold text-lg text-gray-800">勘探工具箱</span>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentPage(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  currentPage === tab.id
                    ? "bg-yellow-50 text-yellow-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex items-center text-gray-500 hover:text-gray-800 transition"
            >
              <ChevronLeft size={20} className="mr-2" /> 返回首页
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={contentClass}>
        <header className={headerClass}>
          <div className="h-12 flex items-center justify-between px-4">
            {isMobileView && (
              <button className="p-2 text-gray-600" onClick={onClose}>
                <ChevronLeft size={24} />
              </button>
            )}
            <h1 className="text-lg font-medium">踏勘报告</h1>
            <div className="relative">
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                onClick={() => setShowMoreMenu((prev) => !prev)}
              >
                <MoreHorizontal size={24} />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm py-1">
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-700"
                    onClick={toggleProjectStatus}
                  >
                    {projectStatus === "completed"
                      ? "标记为踏勘中"
                      : "标记为已完成"}
                  </button>
                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-600"
                    onClick={handleDeleteFromEditor}
                  >
                    删除项目
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-3 border-b border-gray-200 space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <label className="text-gray-500 w-16 flex-shrink-0">
                项目名称:
              </label>
              {isEditing ? (
                <div className="flex-1">
                  <TextInput
                    value={reportData.projectName}
                    onChange={(e) =>
                      handleHeaderChange("projectName", e.target.value)
                    }
                    placeholder="请输入项目名称"
                  />
                </div>
              ) : (
                <span className="font-medium text-gray-800">
                  {reportData.projectName}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <label className="text-gray-500 w-16 flex-shrink-0">
                所在地区:
              </label>
              {isEditing ? (
                <div className="flex-1">
                  <TextInput
                    value={reportData.location}
                    onChange={(e) =>
                      handleHeaderChange("location", e.target.value)
                    }
                    placeholder="请输入所在地区"
                  />
                </div>
              ) : (
                <span className="font-medium text-blue-600">
                  {reportData.location}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Tab Navigation (only visible in mobile view) */}
        {isMobileView && (
          <nav className="flex-shrink-0 flex justify-around bg-white border-b border-gray-200 overflow-x-auto">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentPage(tab.id)}
                className={`flex-1 min-w-[64px] h-14 flex flex-col items-center justify-center text-xs font-medium transition relative ${
                  currentPage === tab.id
                    ? "text-yellow-600"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <tab.icon size={20} className="mb-1" />
                <span className="whitespace-nowrap">{tab.label}</span>
                {currentPage === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></div>
                )}
              </button>
            ))}
          </nav>
        )}

        <main className={pageContainerClass}>{renderCurrentPage()}</main>

        <footer
          className={`safe-area-bottom flex-shrink-0 p-4 bg-white border-t border-gray-200 grid grid-cols-2 gap-4 ${!isMobileView ? "rounded-b-xl" : ""}`}
        >
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="h-12 w-full rounded-full border-2 border-yellow-500 text-yellow-600 font-medium text-base flex items-center justify-center space-x-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
          >
            {isGeneratingReport ? (
              <>
                <Spinner size={18} className="animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <FileText size={18} />
                <span>生成报告</span>
              </>
            )}
          </button>
          {isEditing ? (
            <button
              onClick={handleSave}
              className="h-12 w-full rounded-full bg-yellow-500 text-gray-900 font-medium text-base flex items-center justify-center space-x-2 shadow"
            >
              <Save size={18} />
              <span>保存</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="h-12 w-full rounded-full bg-yellow-500 text-gray-900 font-medium text-base flex items-center justify-center space-x-2 shadow"
            >
              <Edit size={18} />
              <span>编辑</span>
            </button>
          )}
        </footer>
      </div>

      <Toast
        message="保存成功"
        show={showSaveToast}
        onClose={() => setShowSaveToast(false)}
      />

      {showReportModal && (
        <GeneratedReportModal
          reportContent={generatedReportContent}
          onClose={() => setShowReportModal(false)}
          rawReportData={reportData}
          isMobileView={isMobileView}
        />
      )}
    </div>
  );
};

export default ReportEditor;
