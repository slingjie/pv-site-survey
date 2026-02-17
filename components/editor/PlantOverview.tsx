import React, { useState } from "react";
import type { PlantOverviewData } from "../../types";
import FormField from "../common/FormField";
import TextInput from "../common/TextInput";
import TextArea from "../common/TextArea";
import ImageUploadCard from "../common/ImageUploadCard";
import RadioGroup from "../common/RadioGroup";
import Chip from "../common/Chip";
import PickerField from "../common/PickerField";
import BottomSheetPicker from "../common/BottomSheetPicker";
import ImagePreviewModal from "../common/ImagePreviewModal";
import { MapPin, Spinner } from "../icons";
import { compressImageFile } from "../common/imageUtils";

// AMap configuration constants
const AMAP_KEY = "fdb2b37ff8261340c57d9c94b07bd1f7";
const AMAP_SECURITY_CODE = "baa61fb38f7d1856fd100cf284f6d35c";

// Interface for Place result item (mapped from AMap result)
interface Place {
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface PlantOverviewProps {
  data: PlantOverviewData;
  onDataChange: (updatedData: PlantOverviewData) => void;
  isEditing: boolean;
}

// --- Singleton AMap Loader ---
let aMapLoaderPromise: Promise<any> | null = null;

const loadAMap = (): Promise<any> => {
  if (aMapLoaderPromise) return aMapLoaderPromise;

  aMapLoaderPromise = new Promise((resolve, reject) => {
    if ((window as any).AMap) {
      resolve((window as any).AMap);
      return;
    }

    // Set security config BEFORE loading script
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    // Define a unique callback name
    const callbackName = "_amap_init_callback";
    (window as any)[callbackName] = () => {
      // Clean up
      delete (window as any)[callbackName];
      resolve((window as any).AMap);
    };

    const script = document.createElement("script");
    // Add callback parameter to the URL
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=${callbackName}`;
    script.async = true;
    script.onerror = (error) => {
      aMapLoaderPromise = null; // Reset promise on failure so we can try again
      reject(new Error("高德地图脚本加载失败"));
    };
    document.head.appendChild(script);
  });

  return aMapLoaderPromise;
};

const PlantOverview: React.FC<PlantOverviewProps> = ({
  data,
  onDataChange,
  isEditing,
}) => {
  const [activeSubPage, setActiveSubPage] = useState("location");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  const subPages = [
    { id: "location", label: "地理位置" },
    { id: "traffic", label: "位置交通" },
    { id: "risk", label: "风险区域" },
    { id: "power", label: "用电信息" },
    { id: "property", label: "产权信息" },
  ];

  const riskTypes = [
    { value: "toxic", label: "有毒有害" },
    { value: "flammable", label: "易燃易爆" },
    { value: "pollution", label: "高污染" },
    { value: "high_temp", label: "高温" },
    { value: "disaster", label: "自然灾害" },
  ];

  const handleFieldChange = <K extends keyof PlantOverviewData>(
    key: K,
    value: PlantOverviewData[K],
  ) => {
    onDataChange({ ...data, [key]: value });
  };

  const handleNestedChange = <
    K extends keyof PlantOverviewData,
    SK extends keyof PlantOverviewData[K],
  >(
    group: K,
    key: SK,
    value: PlantOverviewData[K][SK],
  ) => {
    onDataChange({
      ...data,
      [group]: {
        ...(data[group] as object),
        [key]: value,
      },
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    updater: (base64: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      updater(compressed);
    } catch (err) {
      console.error("图片压缩失败，回退为原图：", err);
      const reader = new FileReader();
      reader.onload = (event) => {
        updater(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRiskTypeToggle = (type: string) => {
    const currentTypes = data.riskZone.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    handleNestedChange("riskZone", "types", newTypes);
  };

  const useMockDataFallback = () => {
    console.warn("AMap load failed or timed out. Using mock data fallback.");
    // Mock coordinates (e.g., Center of Hangzhou)
    const mockLat = 30.27415;
    const mockLng = 120.15515;

    handleFieldChange("coordinates", { lat: mockLat, lng: mockLng });

    const mockPois: Place[] = [
      {
        name: "模拟: 未来科技产业园",
        vicinity: "科技大道888号",
        geometry: { location: { lat: 30.27415, lng: 120.15515 } },
      },
      {
        name: "模拟: 创新智造中心",
        vicinity: "工业路66号",
        geometry: { location: { lat: 30.27515, lng: 120.15615 } },
      },
      {
        name: "模拟: 高新开发区管委会",
        vicinity: "开发大道1号",
        geometry: { location: { lat: 30.27615, lng: 120.15715 } },
      },
      {
        name: "模拟: 智慧物流园",
        vicinity: "物流支路12号",
        geometry: { location: { lat: 30.27715, lng: 120.15815 } },
      },
    ];

    setNearbyPlaces(mockPois);
    setShowPlacePicker(true);
    setIsLocating(false);

    // Optional: Show a toast or small alert that we are using mock data
    // alert('无法连接地图服务，已切换至模拟数据模式。');
  };

  const handleLocateClick = async () => {
    setIsLocating(true);

    try {
      // 1. Load AMap with timeout protection for the script loading itself
      const scriptLoadPromise = loadAMap();
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("地图加载超时")), 5000), // Shortened to 5s for quicker fallback
      );

      const AMap = await Promise.race([scriptLoadPromise, timeoutPromise]);

      // 2. Load Plugins
      // Use Promise to wrap plugin loading callback
      await new Promise<void>((resolve, reject) => {
        if (!AMap.plugin) {
          reject(new Error("AMap.plugin missing"));
          return;
        }
        AMap.plugin(["AMap.Geolocation", "AMap.PlaceSearch"], () => {
          resolve();
        });
      });

      // 3. Execute Geolocation
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 8000,
        zoomToAccuracy: true,
        needAddress: true,
      });

      geolocation.getCurrentPosition(function (status: string, result: any) {
        if (status === "complete") {
          const lat = result.position.lat;
          const lng = result.position.lng;
          const formattedAddress = result.formattedAddress;

          // Immediately update basic coordinates and address
          handleFieldChange("coordinates", { lat, lng });
          // If we have an address string, update it (will be overwritten if user picks a specific POI)
          if (formattedAddress) {
            handleFieldChange("address", formattedAddress);
          }

          // 4. Search for Nearby Places (POIs)
          const placeSearch = new AMap.PlaceSearch({
            type: "公司企业|产业园区|商务写字楼|工厂",
            pageSize: 20,
            pageIndex: 1,
            extensions: "base",
          });

          placeSearch.searchNearBy(
            "",
            [lng, lat],
            500,
            function (status: string, data: any) {
              if (status === "complete" && data.poiList && data.poiList.pois) {
                const pois = data.poiList.pois.map((poi: any) => ({
                  name: poi.name,
                  vicinity: poi.address,
                  geometry: {
                    location: {
                      lat: poi.location.lat,
                      lng: poi.location.lng,
                    },
                  },
                }));

                setNearbyPlaces(pois);
                setShowPlacePicker(true);
              } else {
                console.warn("AMap PlaceSearch found no results.");
                // If no results, just stop locating, user has coords.
              }
              setIsLocating(false);
            },
          );
        } else {
          console.error("AMap Geolocation Error:", result);
          // Fallback if geolocation fails specifically
          useMockDataFallback();
        }
      });
    } catch (error: any) {
      console.error("Failed to load AMap or Locate:", error);
      // Fallback for any script/load/timeout errors
      useMockDataFallback();
    }
  };

  const handlePlaceSelect = (place: Place) => {
    // Atomic update: set both address and coordinates at once
    onDataChange({
      ...data,
      address: place.vicinity
        ? `${place.name} (${place.vicinity})`
        : place.name,
      coordinates: place.geometry.location,
    });
    setShowPlacePicker(false);
  };

  const renderSubPage = () => {
    switch (activeSubPage) {
      case "location":
        return (
          <div className="space-y-6">
            <div className="p-4 bg-white rounded-lg shadow">
              <h3 className="text-base font-medium mb-4 text-gray-800">
                地理位置
              </h3>
              <FormField label="工厂地址" required>
                <div className="flex space-x-2">
                  <TextInput
                    value={data.address}
                    onChange={(e) =>
                      handleFieldChange("address", e.target.value)
                    }
                    placeholder="请输入或点击右侧按钮定位"
                    disabled={!isEditing}
                  />
                  <button
                    onClick={handleLocateClick}
                    className="flex-shrink-0 w-24 h-12 px-3 bg-yellow-100 text-yellow-700 rounded-lg flex items-center justify-center space-x-1 text-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                    disabled={!isEditing || isLocating}
                  >
                    {isLocating ? (
                      <>
                        <Spinner size={16} className="animate-spin" />
                        <span>定位中...</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={16} />
                        <span>定位</span>
                      </>
                    )}
                  </button>
                </div>
                {data.coordinates && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    已定位: 经度 {data.coordinates.lng.toFixed(6)}, 纬度{" "}
                    {data.coordinates.lat.toFixed(6)}
                  </p>
                )}
              </FormField>
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <h3 className="text-base font-medium mb-4 text-gray-800">
                图纸资料
              </h3>
              <FormField label="厂区鸟瞰图">
                <ImageUploadCard
                  title="上传厂区鸟瞰图"
                  image={data.layoutMap}
                  onClick={() =>
                    data.layoutMap && setPreviewImage(data.layoutMap)
                  }
                  onUpload={(e) =>
                    handleImageUpload(e, (val) =>
                      handleFieldChange("layoutMap", val),
                    )
                  }
                  onPreviewExample={() => alert("显示示例图片")}
                  disabled={!isEditing}
                />
              </FormField>
              <FormField label="房屋位置分布图">
                <ImageUploadCard
                  title="上传房屋位置分布图"
                  image={data.overviewPhotos[0] || null}
                  onClick={() =>
                    data.overviewPhotos[0] &&
                    setPreviewImage(data.overviewPhotos[0])
                  }
                  onUpload={(e) =>
                    handleImageUpload(e, (val) =>
                      handleFieldChange("overviewPhotos", val ? [val] : []),
                    )
                  }
                  onPreviewExample={() => alert("显示示例图片")}
                  disabled={!isEditing}
                />
              </FormField>
            </div>
          </div>
        );
      case "traffic":
        return (
          <div className="p-4 bg-white rounded-lg shadow space-y-4">
            <h3 className="text-base font-medium mb-4 text-gray-800">
              交通条件
            </h3>
            <FormField label="交通条件">
              <RadioGroup
                name="trafficCondition"
                options={[
                  { value: "basic", label: "基本满足" },
                  { value: "limited", label: "受限" },
                ]}
                selected={data.traffic.condition}
                onChange={(val) =>
                  handleNestedChange("traffic", "condition", val)
                }
                disabled={!isEditing}
              />
            </FormField>
            <FormField label="交通情况说明">
              <TextArea
                value={data.traffic.description}
                onChange={(e) =>
                  handleNestedChange("traffic", "description", e.target.value)
                }
                placeholder="说明设备及材料运输的交通情况"
                disabled={!isEditing}
              />
            </FormField>
            <FormField label="位置分布图（交通）">
              <ImageUploadCard
                title="上传有标记的交通图"
                image={data.traffic.map}
                onClick={() =>
                  data.traffic.map && setPreviewImage(data.traffic.map)
                }
                onUpload={(e) =>
                  handleImageUpload(e, (val) =>
                    handleNestedChange("traffic", "map", val),
                  )
                }
                onPreviewExample={() => alert("显示示例图片")}
                disabled={!isEditing}
              />
            </FormField>
          </div>
        );
      case "risk":
        return (
          <div className="p-4 bg-white rounded-lg shadow space-y-4">
            <h3 className="text-base font-medium mb-4 text-gray-800">
              风险区域
            </h3>
            <FormField label="风险类型">
              <div className="flex flex-wrap gap-2">
                {riskTypes.map((type) => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    selected={data.riskZone.types.includes(type.value)}
                    onClick={() => handleRiskTypeToggle(type.value)}
                    disabled={!isEditing}
                  />
                ))}
                <Chip
                  label="添加"
                  canAdd
                  onClick={() => alert("添加自定义风险")}
                  disabled={!isEditing}
                />
              </div>
            </FormField>
            <FormField label="风险说明">
              <TextArea
                value={data.riskZone.description}
                onChange={(e) =>
                  handleNestedChange("riskZone", "description", e.target.value)
                }
                placeholder="请说明风险区域情况"
                disabled={!isEditing}
              />
            </FormField>
            <FormField label="风险区域照片">
              <ImageUploadCard
                title="上传风险区域照片"
                image={data.riskZone.photos[0] || null}
                onClick={() =>
                  data.riskZone.photos[0] &&
                  setPreviewImage(data.riskZone.photos[0])
                }
                onUpload={(e) =>
                  handleImageUpload(e, (val) =>
                    handleNestedChange("riskZone", "photos", val ? [val] : []),
                  )
                }
                disabled={!isEditing}
              />
            </FormField>
          </div>
        );
      case "power":
        return (
          <div className="p-4 bg-white rounded-lg shadow space-y-4">
            <h3 className="text-base font-medium mb-4 text-gray-800">
              用电信息
            </h3>
            <PickerField
              label="用电时段"
              value={data.powerInfo.usagePeriod}
              placeholder="请选择用电时段"
              options={[
                {
                  value: "single_rest_daytime",
                  label: "单休 / 日间用电时段多",
                },
                { value: "full_day_balanced", label: "全天用电均衡" },
                {
                  value: "double_rest_nighttime",
                  label: "双休 / 夜间用电时段多",
                },
              ]}
              onSelect={(val) =>
                handleNestedChange("powerInfo", "usagePeriod", val)
              }
              disabled={!isEditing}
            />
            <PickerField
              label="电价类型"
              value={data.powerInfo.priceType}
              placeholder="请选择电价类型"
              options={[
                { value: "industrial", label: "工商业" },
                { value: "general_industrial", label: "一般工商业" },
                { value: "other", label: "其他" },
              ]}
              onSelect={(val) =>
                handleNestedChange("powerInfo", "priceType", val)
              }
              disabled={!isEditing}
            />
            <PickerField
              label="电压等级"
              value={data.powerInfo.voltage}
              placeholder="请选择电压等级"
              options={["10kv", "35kv", "110kv", "0.4kv"]}
              onSelect={(val) =>
                handleNestedChange("powerInfo", "voltage", val)
              }
              disabled={!isEditing}
            />
            <FormField label="分时电价">
              <RadioGroup
                name="timeOfUsePrice"
                options={[
                  { value: true, label: "是" },
                  { value: false, label: "否" },
                ]}
                selected={data.powerInfo.timeOfUsePrice}
                onChange={(val) =>
                  handleNestedChange("powerInfo", "timeOfUsePrice", val)
                }
                disabled={!isEditing}
              />
            </FormField>
          </div>
        );
      case "property":
        return (
          <div className="p-4 bg-white rounded-lg shadow space-y-4">
            <h3 className="text-base font-medium mb-4 text-gray-800">
              产权信息
            </h3>
            <PickerField
              label="业主性质"
              value={data.propertyInfo.ownerType}
              placeholder="请选择业主性质"
              options={[
                { value: "self_owned", label: "自有" },
                { value: "rented", label: "租赁" },
                { value: "other", label: "其他" },
              ]}
              onSelect={(val) =>
                handleNestedChange("propertyInfo", "ownerType", val)
              }
              disabled={!isEditing}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-24 flex-shrink-0 bg-white border-r border-gray-200">
        {subPages.map((page) => (
          <button
            key={page.id}
            onClick={() => setActiveSubPage(page.id)}
            className={`w-full h-16 flex items-center justify-center text-xs font-medium border-l-4 transition ${
              activeSubPage === page.id
                ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                : "border-transparent text-gray-600 hover:bg-gray-50"
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
        {renderSubPage()}
      </div>
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
      {showPlacePicker && (
        <BottomSheetPicker
          title="选择附近的地点"
          options={nearbyPlaces.map((place) => ({
            value: place,
            label: `${place.name} (${place.vicinity})`,
          }))}
          selectedValue={null}
          onSelect={handlePlaceSelect}
          onClose={() => setShowPlacePicker(false)}
        />
      )}
    </div>
  );
};

export default PlantOverview;
