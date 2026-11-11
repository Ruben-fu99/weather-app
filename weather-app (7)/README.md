# 天氣查詢網站

使用 HTML、CSS、JavaScript(ES modules)與 OpenWeatherMap API 製作的天氣查詢網站,測試通過後透過 GitHub Actions 自動部署到 GitHub Pages。

## 功能

**查詢**
- 以城市名稱查詢,輸入時顯示城市建議(可區分同名城市),支援方向鍵與 Esc
- 「使用我的位置」定位查詢;也可以直接點擊地球上的任一點查詢該處天氣
- 最近 5 筆查詢、最多 8 個收藏城市(顯示目前溫度),偏好保存在瀏覽器

**天氣資訊**
- 目前天氣:溫度、體感、濕度、風速、氣壓、降雨機率、降雨量、日出、日落
- 穿著與活動建議:依體感溫度、降雨、風速、悶熱程度與空氣品質給出建議(規則寫在 `src/advice.js`)
- 未來 24 小時溫度曲線(每 3 小時一筆,含降雨機率)與 5 天預報(含降雨機率與降雨量)
- 空氣品質(OpenWeather 的 1–5 指數與 PM2.5 / PM10,不等同各國官方 AQI)
- 開啟網站時自動以瀏覽器定位顯示所在位置的天氣;拒絕定位或不支援時維持首頁,仍可手動搜尋
- 攝氏 / 華氏切換、中文 / English 切換
- 可直接用中文查詢,細到區、鄉、鎮、市(如「台北市大安區」「高雄美濃」「屏東恆春鎮」「蘭嶼鄉」):台灣全部縣市的行政區與鄉鎮市、以及約 70 個常用城市內建中文名與座標,不耗用地理編碼額度;其他地點交給 OpenWeather 搜尋

**地球模型**
- 可旋轉的 3D 地球:拖曳、方向鍵、自動旋轉(尊重「減少動態效果」設定)
- 即時日夜分界線(由太陽位置公式計算,不需網路)
- 標示目前城市與最近查詢的城市,點擊標記可切換城市
- 擬真外觀:大氣層光暈、邊緣藍調、海面太陽反光、背景星空,可開關經緯線
- 即時資訊:世界協調時間時鐘與太陽直射點每秒更新;日夜分界依即時太陽位置移動
- 衛星雲圖:可切換為 NASA MODIS Terra 真彩色衛星影像(前一日完整影像,缺漏處以底圖補齊),同樣可旋轉
- 即時雲層:疊加 OpenWeather 雲量圖(每 10 分鐘自動更新),可與衛星影像同時開啟;查詢結果也顯示雲量與能見度
- 3D 按鍵:頂部「3D」按鈕可一鍵開關所有立體效果(視差、卡片傾斜、雲殼與雲影、地震立柱、ISS 高度),選擇會記住
- 3D 介面:天氣場景分成遠、中、近多層,隨滑鼠移動(手機則隨傾斜)產生視差;雲有立體漸層與高光、雨雪分遠近兩層、山丘有明暗漸層;卡片在滑鼠懸停時會微幅 3D 傾斜。偏好減少動態時全部停用
- 立體建模:即時雲層是懸浮在地表上方的獨立雲殼(球體邊緣可見厚度與視差),並在日照面投下雲影;地震以立柱呈現(高度隨規模增加);ISS 以真實軌道高度(約 400 公里)繪製,並以細線連到正下方地面
- 經緯線每 15 度一條,赤道較亮
- 可開關的圖層:12 個大城市的目前溫度、過去 24 小時 M2.5 以上地震(USGS,每 5 分鐘自動更新,一小時內的地震有脈動環)、國際太空站(ISS)即時位置與軌跡

**體驗與可靠性**
- 可安裝為 PWA,應用程式外殼離線可用;離線時顯示最近一次成功取得的天氣,並標示資料儲存時間
- 同一地點 10 分鐘內使用快取,不重複呼叫 API
- 全螢幕插畫天窗:依天氣(晴、多雲、雨、雷雨、雪、霧)與晨昏切換場景,雲、雨、雪、星空與閃電會動,並尊重「減少動態效果」設定
- 動畫:溫度數字從山丘後升起、折線與預報溫度條依序畫出、量尺與日照弧線填入、天氣圖示(旋轉的太陽光芒、落下的雨滴與雪、閃爍的閃電),場景中有飛過的鳥與閃爍的窗燈;系統設定「減少動態效果」時全部停用
- 節慶主題:聖誕節(樹上彩燈)、萬聖節(南瓜)、農曆新年(紅燈籠)、中秋節(夜晚的滿月)會在節期前後自動出現,日期規則寫在 `src/season.js`
- 紙張顆粒與手繪般的前景輪廓,營造插畫質感
- 視覺化資訊:日照弧線、風向箭頭、濕度與降雨機率量尺、24 小時面積圖(含天氣圖示)、5 天溫度區間條、空氣品質五段量尺
- 支援深色模式、手機版面與寬螢幕雙欄版面
- 完整狀態處理:載入中、空輸入、查無城市、金鑰無效、請求過多、逾時、斷線、拒絕定位;預報或空氣品質失敗時仍顯示目前天氣

## 本機執行

1. 到 [OpenWeatherMap](https://openweathermap.org/api) 申請免費 API key
2. 複製 `config.example.js` 為 `config.js`,填入你的 key(`config.js` 已被 `.gitignore` 排除,不會進入版本控制)
3. 用靜態伺服器開啟專案(ES modules 無法直接用 `file://` 開啟):

   ```bash
   python3 -m http.server 8000
   ```

   然後瀏覽 http://localhost:8000

## 測試

```bash
npm test
```

使用 Node 內建的 test runner,不需要安裝任何套件。

## 部署到 GitHub Pages

1. Repo 的 **Settings → Secrets and variables → Actions** 新增 secret `OPENWEATHER_API_KEY`
2. **Settings → Pages** 的 Source 選擇 **GitHub Actions**
3. 推送到 `main` 分支後,`.github/workflows/deploy.yml` 會先執行測試,通過後才建置並部署

部署時 workflow 會在輸出目錄產生 `config.js`,因此金鑰不會被提交進 repo。由於是純前端網站,金鑰仍會出現在已部署的網頁資源中,建議使用免費方案專用的 key。

## 地球模型說明

- 地球以 Canvas 2D 自行運算渲染,不依賴任何外部函式庫:先把 Web Mercator 圖磚重新投影成經緯度貼圖,再逐像素以正射投影取樣
- 底圖為 NASA Blue Marble(透過 [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) 提供,共 64 塊圖磚,不計入 OpenWeather 呼叫次數)
- 衛星雲圖使用 NASA GIBS 的 MODIS Terra 真彩色影像(64 塊圖磚,不計入 OpenWeather 呼叫次數)
- 即時雲層使用 OpenWeather `clouds_new` 圖磚(縮放等級 2,共 16 塊),會計入 OpenWeather 的每分鐘呼叫次數,因此預設關閉;需要設定 API 金鑰
- 地震資料來自 [USGS 公開資料](https://earthquake.usgs.gov/earthquakes/feed/),只在開啟圖層時載入
- ISS 位置來自 [wheretheiss.at](https://wheretheiss.at/w/developer) 的公開 API(不需金鑰),只在開啟圖層且地球在畫面內時每 5 秒查詢一次,兩次查詢之間依移動速度推算位置
- 城市溫度圖層開啟時會呼叫 OpenWeather 最多 12 次(已查過的地點走快取);收藏城市在頁面載入時也各呼叫 1 次。免費方案有每分鐘次數上限,請留意
- 地球區塊捲動到畫面內才會載入;載入失敗時可按「重新載入」重試

## PWA 與離線

- `manifest.webmanifest` 與 `sw.js` 讓網站可安裝;應用程式外殼與 NASA 底圖圖磚會被快取
- 天氣資料不由 service worker 快取,而是在每次成功查詢後存入瀏覽器(最多 5 筆),離線時作為備援顯示
- 部署時 workflow 會把 commit 編號寫入 `sw.js` 的快取名稱,新版本上線後舊快取會自動清除
- 新增或移除 `src/` 或 `icons/` 的檔案時,要同步更新 `sw.js` 的 `PRECACHE`,測試會檢查兩者是否一致

## 專案結構

| 路徑 | 說明 |
| --- | --- |
| `index.html` | 頁面結構 |
| `style.css` | 樣式(深色模式、天氣場景配色、手機與寬螢幕版面) |
| `manifest.webmanifest`、`sw.js`、`icons/` | PWA 設定、service worker、應用程式圖示 |
| `src/main.js` | 事件處理與整體流程(查詢、收藏、離線備援、語言與單位切換) |
| `src/api.js` | OpenWeatherMap 請求、定位 |
| `src/ui.js` | 畫面渲染 |
| `src/art.js` | 天氣圖示與線條圖示(內嵌 SVG,不依賴外部圖片) |
| `src/season.js` | 依日期判斷節慶主題 |
| `src/scene.js` | 天窗場景:依天氣與晨昏產生前後景分層的 SVG |
| `src/i18n.js` | 中英文字典與翻譯函式 |
| `src/format.js` | 格式化、預報彙整、錯誤訊息 |
| `src/advice.js` | 穿著與活動建議規則 |
| `src/storage.js`、`src/location.js` | 瀏覽器儲存(偏好、收藏、離線資料)與地點工具 |
| `src/cache.js` | 帶有效期限的快取 |
| `src/chart.js` | 折線圖座標計算 |
| `src/chinese-places.js` | 常用城市中文名對照與中文查詢 |
| `src/globe.js` | 地球互動、圖層、載入狀態與動畫迴圈 |
| `src/globe-math.js`、`src/globe-renderer.js`、`src/globe-textures.js` | 投影運算、逐像素渲染(含日夜分界)、圖磚貼圖 |
| `src/sun.js` | 太陽位置(日夜分界) |
| `src/quakes.js`、`src/iss.js`、`src/cities.js` | 地震資料解析、ISS 位置與推算、地球上的城市清單 |
| `src/errors.js` | 錯誤型別 |
| `test/` | 單元測試 |
| `config.example.js` | 金鑰設定範本 |
| `.github/workflows/deploy.yml` | 測試與自動部署流程 |
