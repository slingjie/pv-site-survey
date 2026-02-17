好，我给你一套**可以直接在 Figma 里落地的 UI Design System 方案**，你基本按这个搭，就能把这个踏勘软件所有界面高效复刻出来。

下面内容分为：

1. Figma 文件结构（Pages 布局）
2. 变量（Variables）设计
3. 样式（Styles）：颜色 / 字体 / 效果
4. 基础组件（Components）与变体设计
5. 页面模板（Patterns）
6. 落地示例：如何拼出一个实际页面

------

## 1. Figma 文件结构（Pages）

建议在 Figma 文件里建立如下 Pages：

1. `00 – Foundations`
   - Colors
   - Typography
   - Elevation & Radius
   - Spacing & Layout
   - Icon Set
2. `01 – Components`
   - Buttons
   - Inputs & Selects
   - Tags & Chips
   - Tabs & Navigation
   - Upload & Media
   - Status & Pills
   - Dialog / Bottom Sheet
3. `02 – Patterns`
   - 表单区块（如“基础信息”、“用电信息”）
   - 布局模板（Tab 顶栏 + 左侧菜单 + 表单区域）
4. `03 – Screens`
   - 厂区概况
   - 建筑屋面
   - 电气设施
   - 收资清单

------

## 2. Figma 变量（Variables）设计

在 Figma 里创建 Variable Collections：

### 2.1 Collection：`Color`

定义一组 Token 名，后续组件全部引用变量，不直接写死颜色值：

```text
Color/Brand/Primary       = #FFC83D
Color/Brand/Secondary     = #FFA83D
Color/Brand/Confirm       = #00C853

Color/Text/Primary        = #333333
Color/Text/Secondary      = #666666
Color/Text/Placeholder    = #999999
Color/Text/Inverse        = #FFFFFF

Color/Border/Default      = #CCCCCC
Color/Border/Strong       = #999999

Color/Bg/Base             = #FFFFFF
Color/Bg/Surface          = #FAFAFA
Color/Bg/Page             = #F5F5F5
Color/Bg/Tag              = #F5F5F5
Color/Bg/TagSelected      = rgba(255,200,61,0.2)

Color/State/Error         = #FF4D4F
Color/State/DisableText   = #BBBBBB

Color/Link/Primary        = #4A90E2
```

------

### 2.2 Collection：`Typography`

可以只用 Variables 管字号，Style 控字体：

```text
Typo/Size/PageTitle   = 22
Typo/Size/Section     = 16
Typo/Size/Label       = 14
Typo/Size/Body        = 14
Typo/Size/Caption     = 12
Typo/Size/Button      = 16
```

------

### 2.3 Collection：`Spacing`

按 4pt 体系：

```text
Space/4   = 4
Space/8   = 8
Space/12  = 12
Space/16  = 16
Space/20  = 20
Space/24  = 24
Space/32  = 32
```

------

### 2.4 Collection：`Radius & Elevation`

```text
Radius/Sm     = 8
Radius/Md     = 12
Radius/Lg     = 16
Radius/Chip   = 20
Radius/Button = 24

Shadow/Card   = 0,2,6,rgba(0,0,0,0.08)
Shadow/Dialog = 0,4,12,rgba(0,0,0,0.12)
```

所有组件的 Corner radius 和 Effect 统一引用这些变量。

------

## 3. Figma 样式（Styles）

### 3.1 Color Styles（与变量一一对应）

在 Styles 里建立：

- `Fill/Brand/Primary`
- `Fill/Text/Primary`
- `Fill/Bg/Page`
   等，颜色值引用 `Color` Collection 变量，方便统一改。

------

### 3.2 Text Styles

建议：

```text
Text/PageTitle
  - Font: PingFang SC / SF Pro
  - Size: 22, Weight: Medium, LineHeight: ~30

Text/SectionTitle
  - Size: 16, Weight: Medium

Text/Label
  - Size: 14, Weight: Regular, Color: Text/Secondary

Text/Body
  - Size: 14, Weight: Regular, Color: Text/Primary

Text/Caption
  - Size: 12, Weight: Regular, Color: Text/Secondary

Text/Button
  - Size: 16, Weight: Medium, Align: center
```

------

### 3.3 Effects Styles

- `Shadow/Card`
- `Shadow/Dialog`

------

## 4. 基础组件（Components & Variants）

下面是关键组件列表及 Variant 结构。你可以在 `01 – Components` 里每一组用一个 Frame 管理。

------

### 4.1 Button 按钮组件

**组件名**：`Button / Primary`、`Button / Secondary`（用 Variants 合并）

Variant 维度建议：

- `Type`: Primary | Secondary
- `State`: Default | Pressed | Disabled
- `Size`: M（默认 48 高）

结构：

- Auto Layout 横向
- 高度：48
- Padding：水平 16
- Corner radius：`Radius/Button`

样式：

- Primary：背景 `Brand/Primary`，无边框，文字 `Text/Primary`
- Secondary：背景白，Stroke `Brand/Secondary`，文字 `Brand/Secondary`

------

### 4.2 TextField 输入框组件

**组件名**：`Field / Text`

Variants：

- `State`: Default | Focus | Error | Disabled
- `Type`: SingleLine | MultiLine（用 auto-layout 高度拉伸）

结构：

- Frame 高度 48（单行）
- 左：Label（外部也可以单独控）
- 内部：背景白，Stroke `Border/Default`，Corner radius `Radius/Sm`
- 右侧可预留 Icon Slot（> 或 当前位置）

State 风格：

- Focus：描边 `Brand/Primary`
- Error：描边 `State/Error` + 左侧/底部错误文案

------

### 4.3 Select / Picker 入口

就是截图中“请选择”的那种字段，外形等同 TextField，只是右侧固定一个「>」图标，Text 颜色稍浅（Placeholder）。

**组件名**：`Field / Select`

Variants：

- `State`: Default | Selected | Error | Disabled

------

### 4.4 Chip / Tag 标签组件

**组件名**：`Tag / Filter`

Variants：

- `State`: Default | Selected | Disabled

样式：

- Default：背景 `Bg/Tag`，文字 `Text/Primary`
- Selected：背景 `Bg/TagSelected`，描边 `Brand/Primary`
- Disabled：文字 `Text/DisableText`

Corner radius 使用 `Radius/Chip`，高度 32，水平 padding 12。

------

### 4.5 Radio & Checkbox

**组件名**：

- `Control / Radio`
- `Control / Checkbox`

Variants：

- `State`: Default | Selected | Disabled

结构：

- 左图标（18–20px），右文字 label
- 用 Auto Layout 组合一个 `RadioWithLabel` 组件供表单复用

------

### 4.6 Tabs 顶部 Tab 组件

**组件名**：`Tab / Top`

Variants：

- `State`: Active | Inactive

结构：

- 文本 + 下方 2px 高的选中条
- 选中：文字 `Brand/Primary` + 下划线 `Brand/Primary`
- 未选中：文字 `Text/Secondary`，无下划线

再单独做一个左侧竖向菜单：

**组件名**：`Tab / SideNavItem`

Variants：

- `State`: Active | Inactive

Active 背景可用浅灰突出，左边加色条也行。

------

### 4.7 Upload 图片上传组件

**组件名**：`Media / UploadCard`

Variants：

- `State`: Empty | Filled | Error
- `Size`: S | M（M 用在主区域，S 用于小图）

结构：

- 卡片外层：圆角 `Radius/Sm`，虚线边框
- 居中图标 + 文本「上传/拍照」
- 右上预留「示例」按钮 Slot（小文字+图标）

Filled 状态时，内部替换为 Image Placeholder。

------

### 4.8 Status Pill – 收资状态组件

用于「齐全 / 部分 / 待收 / 无法提供」。

**组件名**：`Status / DocCollect`

Variants：

- `Value`: Full | Partial | Pending | None

你可以只做为一个四态的 Chip，应用在收资清单表格以及其他「选择收资情况」字段中。

样式建议：

- Full：绿色背景浅色 + 绿文字
- Partial：橙色
- Pending：灰黄
- None：灰色

------

### 4.9 Bottom Sheet / Picker 弹窗

**组件名**：`Dialog / BottomSheet`

内部再做一个 `List / Option` 组件用于展示“单休 / 双休”的列表项。底部使用两颗 `Button` Primary/Secondary 组件拼成。

------

## 5. 页面模板（Patterns）

在 `02 – Patterns` 页里搭好常用模板，后面画界面就拖拽使用即可。

### 5.1 “Tab + 左侧菜单 + 表单” 模板

结构：

- 顶部：返回 + 标题 + 右上菜单
- 下：项目编号 + 地区选择框（用 Field + Tag 拼）
- 再下：四个顶 Tab（组件）
- 内容区：左右两列
  - 左：SideNav（位置交通 / 风险区域 / 用电信息 / 产权信息）
  - 右：表单区域（多个 Section）

建议整个内容区使用：

- Frame 宽度按手机尺寸 375 / 390
- 左列宽 90–100px，右列填充剩余

------

### 5.2 “表单 Section” 模板

**组件名**：`Pattern / FormSection`

结构：

- 顶部：Section 标题（例如“用电信息”），用 Text/SectionTitle
- 下方：1–N 个表单项，统一垂直间距 12

以后所有页面的「基础信息 / 屋顶屋面 / 内部结构 / 房屋周边…」都使用这个 Section 模板。

------

## 6. 落地示例：拼一个“厂区概况 – 用电信息”页面

你在 `03 – Screens` 新建一个 Frame，尺寸 375×812，步骤如下：

1. 从 Pattern 中拖出「Tab + 左侧菜单 + 表单」模板。
2. 顶部 Tab 选中「厂区概况」，SideNav 选中「用电信息」。
3. 表单 Section 里依次摆放：
   - Field/Select（用电时段）
   - Field/Select（电价类型）
   - Field/Select（电压等级）
   - RadioGroup（分时电价 是/否）
   - Field/StatusSelect（电费单 – 调用收资状态组件）
   - Field/StatusSelect（用电负荷曲线）
   - Field/StatusSelect（营业执照）
4. 底部加入 Button/Secondary（生成踏勘报告）和 Button/Primary（保存）。

同理，你可以快速拼出：

- 建筑屋面 > 屋顶-1 > 基础信息
- 建筑屋面 > 屋顶-1 > 屋顶屋面
- 电气设施 > 并网信息
- 收资清单 矩阵页面（用 Table 模式 + Status Pill）

