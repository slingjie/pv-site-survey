// All enums and form configurations for the application

export const enums = {
  // Roof Enums
  ROOF_TYPE: [
    { value: "color_steel_tile", label: "彩钢瓦" },
    { value: "concrete", label: "混凝土" },
    { value: "other", label: "其他" },
  ],
  ROOF_ORIENTATION: [
    { value: "south", label: "正南" },
    { value: "southeast", label: "东南" },
    { value: "southwest", label: "西南" },
    { value: "east", label: "正东" },
    { value: "west", label: "正西" },
    { value: "other", label: "其他" },
  ],
  ROOF_UTILIZATION: [
    { value: "few_obstacles", label: "少量遮挡" },
    { value: "many_obstacles", label: "较多遮挡" },
    { value: "none", label: "无遮挡" },
  ],
  ROOF_OBSTACLE_TYPE: [
    { value: "vent", label: "通风口" },
    { value: "skylight", label: "采光窗" },
    { value: "water_tank", label: "水箱" },
    { value: "daughter_wall", label: "女儿墙" },
  ],
  ROOF_POLLUTION_LEVEL: [
    { value: "general", label: "一般" },
    { value: "severe", label: "严重" },
    { value: "none", label: "无" },
  ],
  ROOF_STRUCTURE_TYPE: [
    { value: "steel_structure", label: "钢结构" },
    { value: "concrete", label: "混凝土" },
    { value: "other", label: "其他" },
  ],
  ROOF_ABNORMAL_TYPE: [
    { value: "leak", label: "漏水" },
    { value: "crack", label: "开裂" },
    { value: "rust", label: "生锈" },
  ],
  // Electrical Enums
  ELECTRICAL_VOLTAGE: [
    { value: "10kv", label: "10kV" },
    { value: "35kv", label: "35kV" },
    { value: "110kv", label: "110kV" },
    { value: "0.4kv", label: "0.4kV" },
    { value: "other", label: "其他" },
  ],
  GRID_MODE: [
    { value: "full_on_grid", label: "全额上网" },
    { value: "self_use_surplus_on_grid", label: "自发自用，余电上网" },
    { value: "self_use_no_on_grid", label: "自发自用，不上网" },
  ],
  CABLE_LAYING_METHOD: [
    { value: "bridge", label: "桥架" },
    { value: "cable_duct", label: "电缆沟" },
    { value: "direct_burial", label: "直埋" },
    { value: "pipe", label: "穿管" },
  ],
  // Plant Overview Enums
  TRAFFIC_CONDITION: [
    { value: "basic", label: "基本满足" },
    { value: "limited", label: "受限" },
  ],
  RISK_TYPE: [
    { value: "toxic", label: "有毒有害" },
    { value: "flammable", label: "易燃易爆" },
    { value: "pollution", label: "高污染" },
    { value: "high_temp", label: "高温" },
    { value: "disaster", label: "自然灾害" },
  ],
  POWER_USAGE_PERIOD: [
    { value: "single_rest_daytime", label: "单休 / 日间用电时段多" },
    { value: "full_day_balanced", label: "全天用电均衡" },
    { value: "double_rest_nighttime", label: "双休 / 夜间用电时段多" },
  ],
  POWER_PRICE_TYPE: [
    { value: "industrial", label: "工商业" },
    { value: "general_industrial", label: "一般工商业" },
    { value: "other", label: "其他" },
  ],
  OWNER_TYPE: [
    { value: "self_owned", label: "自有" },
    { value: "rented", label: "租赁" },
    { value: "other", label: "其他" },
  ],
  DOCUMENT_STATUS: [
    { value: "full", label: "齐全" },
    { value: "partial", label: "部分" },
    { value: "pending", label: "待收" },
    { value: "none", label: "无法提供" },
  ],
};

export const roofModuleConfig = {
  sections: [
    {
      key: "basicInfo",
      title: "基础信息",
      fields: [
        { key: "name", label: "屋顶名称", type: "text", required: true },
        { key: "area", label: "屋顶面积 (㎡)", type: "number", required: true, placeholder: "例：5000" },
        {
          key: "type",
          label: "屋顶类型",
          type: "select",
          enumKey: "ROOF_TYPE",
          required: true,
        },
        {
          key: "capacity",
          label: "预估容量 (MW)",
          type: "number",
          required: true,
          placeholder: "例：0.5",
        },
        { key: "birdView", label: "房屋鸟瞰图", type: "image" },
        {
          key: "orientation",
          label: "朝向",
          type: "select",
          enumKey: "ROOF_ORIENTATION",
        },
      ],
    },
    {
      key: "surface",
      title: "屋顶屋面",
      fields: [
        {
          key: "utilization",
          label: "屋顶利用率",
          type: "select",
          enumKey: "ROOF_UTILIZATION",
        },
        {
          key: "obstacleTypes",
          label: "遮挡物类型",
          type: "chips",
          enumKey: "ROOF_OBSTACLE_TYPE",
        },
        { key: "obstacleImage", label: "遮挡物照片", type: "image" },
        {
          key: "pollutionLevel",
          label: "污染情况",
          type: "select",
          enumKey: "ROOF_POLLUTION_LEVEL",
        },
        { key: "pollutionImage", label: "污染照片", type: "image" },
      ],
    },
    {
      key: "internal",
      title: "内部结构",
      fields: [
        {
          key: "structureType",
          label: "结构类型",
          type: "select",
          enumKey: "ROOF_STRUCTURE_TYPE",
        },
        { key: "structureImage", label: "结构照片", type: "image" },
        {
          key: "abnormalTypes",
          label: "异常情况",
          type: "chips",
          enumKey: "ROOF_ABNORMAL_TYPE",
        },
        { key: "abnormalImage", label: "异常照片", type: "image" },
        { key: "abnormalDescription", label: "异常说明", type: "textarea", placeholder: "例：东南角有轻微漏水痕迹" },
      ],
    },
    {
      key: "surroundings",
      title: "房屋周边",
      fields: [
        {
          key: "surroundingDescription",
          label: "周边环境说明",
          type: "textarea",
          placeholder: "例：南侧无高层建筑遮挡",
        },
        { key: "surroundingImage", label: "周边照片", type: "image" },
      ],
    },
  ],
};

export const electricalModuleConfig = {
  sections: [
    {
      key: "sitePhotos",
      title: "现场照片",
      fields: [
        { key: "siteRoomImage", label: "配电房整体", type: "image" },
        { key: "siteTransformerImage", label: "变压器及铭牌", type: "image" },
        { key: "siteSingleLineImage", label: "一次系统图", type: "image" },
        { key: "siteEnvImage", label: "周边环境", type: "image" },
      ],
    },
    {
      key: "subFacilities",
      title: "分项设施",
      // This section is handled specially in the component
      fields: [],
    },
    {
      key: "distributionInfo",
      title: "配电信息",
      fields: [
        {
          key: "incomingVoltage",
          label: "进线电压",
          type: "select",
          enumKey: "ELECTRICAL_VOLTAGE",
        },
        {
          key: "meteringVoltage",
          label: "计量点电压",
          type: "select",
          enumKey: "ELECTRICAL_VOLTAGE",
        },
        { key: "switchStationLevel", label: "开关站情况", type: "text", placeholder: "例：无 / 10kV开关站" },
        {
          key: "transformerInfoJson",
          label: "变压器信息",
          type: "textarea",
          placeholder: 'JSON格式：[{"capacity": 1600, "model": "S11"}, ...]',
        },
        {
          key: "transformerDistImage",
          label: "变压器位置分布图",
          type: "image",
        },
      ],
    },
    {
      key: "gridInfo",
      title: "并网信息",
      fields: [
        {
          key: "gridMode",
          label: "上网模式",
          type: "select",
          enumKey: "GRID_MODE",
        },
        { key: "gridCabinetLocation", label: "并网柜位置", type: "text", placeholder: "例：1F配电房旁" },
        {
          key: "cableLayingMethods",
          label: "电缆敷设方式",
          type: "chips",
          enumKey: "CABLE_LAYING_METHOD",
        },
        {
          key: "cablePathDescription",
          label: "电缆路径说明",
          type: "textarea",
          placeholder: "例：沿电缆沟敷设至并网柜",
        },
        {
          key: "gridLevel",
          label: "并网/接入等级",
          type: "select",
          enumKey: "ELECTRICAL_VOLTAGE",
        },
        {
          key: "gridSchemeDescription",
          label: "接入方案描述",
          type: "textarea",
          placeholder: "例：拟采用0.4kV低压侧并网",
        },
        { key: "gridAttention", label: "注意事项", type: "textarea", placeholder: "例：注意避开现有电缆路径" },
      ],
    },
  ],
};

export const subFacilityConfig = {
  fields: [
    { key: "roomImage", label: "配电室", type: "image" },
    { key: "transformerImage", label: "变压器及铭牌", type: "image" },
    { key: "singleLineImage", label: "一次系统图", type: "image" },
    { key: "panelImage", label: "配电柜", type: "image" },
    { key: "meterImage", label: "计量表", type: "image" },
    { key: "envImage", label: "周边环境", type: "image" },
  ],
};

export const documentCollectionConfig = {
  sections: [
    {
      title: "图纸资料",
      items: [
        { key: "plant_layout_map", label: "厂区总平图" },
        { key: "plant_pipeline_map", label: "厂区管线分布图" },
        { key: "building_construction_drawing", label: "房屋建筑施工图" },
        { key: "structure_construction_drawing", label: "房屋结构施工图" },
        { key: "roof_hvac_map", label: "屋面暖通/管道图纸" },
        { key: "roof_firefighting_map", label: "屋面消防图纸" },
        { key: "elec_layout_map", label: "电气总平图" },
        { key: "hv_lv_system_diagram", label: "高低压系统图" },
        { key: "grounding_map", label: "接地布置图" },
        { key: "cable_routing_map", label: "电缆走向图" },
        { key: "room_layout_map", label: "配电室布置图" },
      ],
    },
    {
      title: "报告 / 说明",
      items: [
        { key: "plant_geology_report", label: "厂区地勘报告" },
        { key: "building_design_spec", label: "房屋设计说明" },
        { key: "elec_design_spec", label: "电气设计说明" },
      ],
    },
    {
      title: "用电资料",
      items: [
        { key: "power_bills_1yr", label: "近12个月电费单" },
        { key: "load_curve_1yr", label: "近12个月负荷曲线" },
      ],
    },
    {
      title: "资质 / 产权",
      items: [
        { key: "license", label: "用电企业营业执照" },
        { key: "land_cert", label: "土地证" },
        { key: "property_cert", label: "房产证" },
      ],
    },
  ],
};
