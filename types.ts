export interface Project {
  id: string;
  name: string;
  location: string;
  /** 踏勘项目状态：踏勘中 / 已完成 */
  status: "editing" | "completed";
  /** 踏勘日期（YYYY-MM-DD） */
  surveyDate?: string;
  /** 踏勘人员，例如“张三, 李四” */
  surveyors?: string;
  /** 项目类型：光伏 / 储能 / 光储 / 其他 */
  projectType?: "pv" | "storage" | "pv_storage" | "other";
  /** 创建者邮箱（管理员列表接口返回） */
  ownerEmail?: string;
}

export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
}

export interface TrafficInfo {
  condition: "basic" | "limited";
  description: string;
  map: string | null;
}

export interface RiskZoneInfo {
  types: string[];
  customTypes: string[];
  description: string;
  photos: string[];
}

export interface PowerInfo {
  usagePeriod:
    | "single_rest_daytime"
    | "full_day_balanced"
    | "double_rest_nighttime"
    | "";
  priceType: "industrial" | "general_industrial" | "other" | "";
  voltage: "10kv" | "35kv" | "110kv" | "0.4kv" | "";
  timeOfUsePrice: boolean;
  billStatus: "full" | "partial" | "pending" | "none";
  loadCurveStatus: "full" | "partial" | "pending" | "none";
  licenseStatus: "full" | "partial" | "pending" | "none";
}

export interface PropertyInfo {
  landCertStatus: "full" | "partial" | "pending" | "none";
  propertyCertStatus: "full" | "partial" | "pending" | "none";
  ownerType: "self_owned" | "rented" | "other" | "";
}

export interface PlantOverviewData {
  address: string;
  coordinates: { lat: number; lng: number } | null;
  overviewPhotos: string[];
  layoutMap: string | null;
  satelliteImage: string | null; // User uploaded satellite/layout image
  traffic: TrafficInfo;
  riskZone: RiskZoneInfo;
  powerInfo: PowerInfo;
  propertyInfo: PropertyInfo;
}

export interface BuildingRoof {
  id: string;
  // Basic Info
  name: string;
  area: number;
  type: string;
  capacity: number;
  birdView: string | null;
  orientation: string;
  // Coordinates for custom map marking
  // lng = Left % (X axis), lat = Top % (Y axis)
  coordinates: { lat: number; lng: number } | null;
  // Roof Surface
  utilization: string;
  obstacleTypes: string[];
  obstacleImage: string | null;
  pollutionLevel: string;
  pollutionImage: string | null;
  // Internal Structure
  structureType: string;
  structureImage: string | null;
  abnormalTypes: string[];
  abnormalImage: string | null;
  abnormalDescription: string;
  // Surrounding
  surroundingDescription: string;
  surroundingImage: string | null;
}

export interface SubFacility {
  id: string;
  name: string;
  roomImage: string | null;
  transformerImage: string | null;
  singleLineImage: string | null;
  panelImage: string | null;
  meterImage: string | null;
  envImage: string | null;
}

export interface ElectricalFacilitiesData {
  // Site Photos
  siteRoomImage: string | null;
  siteTransformerImage: string | null;
  siteSingleLineImage: string | null;
  siteEnvImage: string | null;
  // Sub-facilities
  subFacilities: SubFacility[];
  // Distribution Info
  incomingVoltage: string;
  meteringVoltage: string;
  switchStationLevel: string;
  transformerInfoJson: string;
  transformerDistImage: string | null;
  // Grid Info
  gridMode: string;
  gridCabinetLocation: string;
  cableLayingMethods: string[];
  cablePathDescription: string;
  gridLevel: string;
  gridSchemeDescription: string;
  gridAttention: string;
}

export type DocumentStatus = "full" | "partial" | "pending" | "none";

export interface DocumentCollectionData {
  [key: string]: DocumentStatus;
}

export interface ReportData {
  reportId: string;
  projectName: string;
  location: string;
  plantOverview: PlantOverviewData;
  buildingRoofs: BuildingRoof[];
  electricalFacilities: ElectricalFacilitiesData;
  documentCollection: DocumentCollectionData;
}

