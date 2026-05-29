/* photo-tools — minimal i18n.
 *
 * - Two locales: zh-CN (default for the original UI) + en.
 * - Static UI text lives in dictionaries below, addressed by dotted keys.
 * - HTML elements declare their key via data-i18n / data-i18n-placeholder /
 *   data-i18n-aria-label / data-i18n-title; applyDom() walks `root` and
 *   writes the active-locale string into the right slot.
 * - Dynamic strings (status messages, EXIF warning, defaults readout) call
 *   I18N.t(key, vars). vars get spliced into {placeholders}.
 * - On setLocale() we re-applyDom and dispatch 'i18nchange' so live readouts
 *   (currently-rendered status, '默认' chips, modal stage label) can refresh.
 *
 * Locale persists to localStorage; first visit auto-detects from navigator.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'phototools.locale';

  const DICT = {
    'zh-CN': {
      brand: { sub: 'frame · caption · ship' },
      topbar: {
        photos: '张',
        switch: '切换',
        export: '导出',
        import: '导入',
        importCloud: '云端读取',
        importCloudTitle: '从配置好的 S3 / OSS / R2 云存储里挑照片加载到胶卷',
        github: '在 GitHub 查看源码'
      },
      lang: { zh: '中', en: 'EN', label: '语言' },
      lookbar: {
        look: '风格',
        frame: '相框',
        template: '模板',
        aspect: '画幅',
        quality: '质量',
        compose: '构图'
      },
      look: {
        title: '风格库',
        subtitle: '点一个起点 · 微调 · 存为自己的 look',
        picker: '风格库',
        empty: '尚未选择',
        modified: '已微调',
        factoryHead: '✦ 精选',
        userHead: '我的预设',
        userEmpty: '还没有保存预设 · 把当前调好的 look 存下来 ↓',
        save: '保存当前为新预设',
        share: '复制分享链接',
        shareTitle: '把当前 look 编码成一条 #p=… 链接，发给朋友',
        paste: '粘贴分享码',
        pasteTitle: '从剪贴板贴入分享链接或分享码',
        pastePrompt: '把分享链接 / 分享码粘进来',
        pastedLabel: '来自分享码',
        delete: '删除'
      },
      picker: {
        frame: '选择相框',
        frameSub: ' 款 · 4 个家族',
        template: '选择文字模板',
        templateSub: ' 款 · 4 个语法',
        aspect: '画幅比例',
        aspectSub: '5 个预设 + 自定义',
        quality: '导出',
        qualitySub: '质量 + 格式'
      },
      workshop: {
        title: '工作台',
        subtitle: '编辑师的桌面',
        open: '打开工作台',
        close: '关闭工作台',
        hint: '裁剪 · EXIF · 签名 · 拼贴',
        exifOverride: '按图覆盖',
        // ─── rev.2 「The Bench」 (1.9.0+) · 5 tools ───
        tool: {
          instrument: '仪器',
          instrumentTitle: '仪器 · 跟着当前相框',
          instrumentHint: '每张相框是一台仪器 · 切换相框看到对应的物质化面板',
          caliper: '测量',
          caliperTitle: '测量 · 画幅几何',
          notation: '笔记',
          notationTitle: '笔记 · 字幕 + EXIF',
          notationHint: '照片在说什么 · 字幕带尺寸 + 自动 EXIF 字段（可逐张覆盖）',
          arrange: '排版',
          arrangeTitle: '排版 · 多张拼贴',
          arrangeHint: '把多张照片夹在同一相框内 · 选布局后绑定伙伴照片',
          seal: '印记',
          sealTitle: '印记 · 签名',
          sealHint: '盖在照片画框内的蜡印水印'
        },
        topBadgeRow: '顶部标记 ▸',
        instrument: {
          lighting: '▾ 光影 · shadow'
        },
        caliper: {
          frameGeom: '画幅几何'
        },
        notebook: {
          field: '字段',
          auto: '自动 · DETECTED',
          hand: '手写 · OVERRIDE',
          captionStripZone: '字幕带'
        },
        seal: {
          waxZone: '蜡印 · 签名',
          clampZone: '纸夹 · 拼贴',
          pressTitle: '按下印章'
        },
        footerSummaryFmt: '{total} 件工具 · {n} 处修改',
        footerSummaryNone: '{total} 件工具 · 全部默认',
        resetAll: '全部重置',
        resetAllTitle: '本张照片的全部设置回到当前相框出厂默认'
      },
      topTemplate: {
        none: '关闭',
        brandModel: '品牌·型号',
        brandOnly: '品牌',
        wordmark: '字标'
      },
      cmdk: {
        open: '打开命令面板',
        title: '命令面板',
        search: '搜索',
        placeholder: '搜索相框 / 模板 / 操作…',
        empty: '没有匹配项。试试"毛玻璃"、"导出"、"1:1"。',
        groupFrames: '相框',
        groupTemplates: '文字模板',
        groupAspects: '画幅',
        groupActions: '操作',
        aspectLabel: '画幅',
        actions: {
          exportCurrent: '导出当前照片',
          exportBatch: '批量导出 ZIP',
          crop: '裁剪 & 旋转…',
          editExif: '编辑 EXIF',
          uploadSignature: '上传签名',
          collage: '配置拼贴',
          savePreset: '保存为预设',
          copyShare: '复制分享链接',
          applyFrameAll: '相框设置应用到全部',
          changelog: '查看更新日志',
          import: '导入照片'
        }
      },
      sections: {
        source: '原图',
        frame: '相框',
        caption: '文字',
        exif: 'EXIF',
        collage: '拼贴',
        signature: '签名',
        export: '导出'
      },
      nav: { collapse: '收起侧栏', expand: '展开侧栏' },
      source: {
        importTitle: '导入照片',
        hintDesktop: 'JPEG / PNG / HEIC · 可多选 · 拖到此处',
        hintMobile: 'JPEG / PNG / HEIC · 点击选择'
      },
      frame: {
        aspect: '画幅',
        aspectCustom: '自定义',
        aspectCustomTitle: '自定义画幅比例',
        aspectCustomWidth: '宽',
        aspectCustomHeight: '高',
        aspectCustomApply: '应用',
        aspectCustomCancel: '取消',
        aspectCustomPresets: '常用比例',
        aspectCustomError: '请输入 0.1 ~ 10 之间的有效比例',
        style: '风格',
        padding: '边距',
        captionH: '文字带高度',
        captionAuto: '自动',
        customBg: '自定义背景图',
        customBgHint: 'JPEG / PNG · 替换默认的自我磨砂背景源',
        customBgClear: '移除',
        presetSavePrompt: '为这个预设起个名字',
        presetDefaultName: '预设 {ts}',
        advancedFrosted: '高级 · 毛玻璃参数',
        advancedTorn: '高级 · 撕纸纸面',
        advancedFilmMf: '高级 · 复古印品',
        advancedShadow: '高级 · 阴影',
        tornJitter: '撕扯深度',
        tornStep: '撕扯密度',
        tornEdgeOpacity: '暗边强度',
        filmMfAge: '复古程度',
        blur: '模糊',
        brightness: '亮度',
        saturation: '饱和度',
        bgDarken: '压暗',
        bgGrain: '颗粒',
        galMatWidth: '衬纸宽度',
        galLineSpacing: '双线间距',
        galLineWeight: '线条粗细',
        galLineColor: '线条颜色',
        galColor: { ink: '墨色', charcoal: '炭灰', warm: '暖棕' },
        f35Sprocket: '齿孔密度',
        f35Grain: '颗粒强度',
        f35EdgePrint: '胶片边印',
        f35FrameNo: '帧号样式',
        f35FrameNoOpt: { 'xx': '匿名 XX', '1-36': '半帧 24A', 'a-z': '字母 A–Z' },
        instaxSlab: '底部留白',
        instaxTint: '相纸色调',
        instaxTintOpt: { pure: '纯白', cream: '奶油', aged: '陈旧' },
        instaxStamp: '日期戳',
        instaxRainbow: '彩虹标',
        slideMountColor: '卡纸色',
        slideMountColorOpt: { cream: '奶油', leather: '皮革棕', black: '档案黑' },
        slideOuterRing: '外框色',
        slideOuterRingOpt: { wine: '酒红', brass: '黄铜', charcoal: '炭黑' },
        slidePebble: '颗粒密度',
        slideBevel: '凹陷深度',
        toggleOn: '开',
        toggleOff: '关',
        defaultReadout: '默认',
        resetDefault: '恢复默认',
        radius: '圆角',
        captionOverlay: '水印嵌入图片',
        captionOverlayHint: '盖在照片底部渐变条上（35mm 真实底片观感）',
        captionOverlayLift: '水印离底部距离',
        topTemplate: '风格',
        topTemplateHint: '在照片上方留白处加一行品牌身份标记。某些相框（35mm 胶片）会用上方留白做自己的装饰。',
        shadowBlur: '模糊半径',
        shadowOffset: '纵向偏移',
        shadowOpacity: '不透明度',
        applyAll: '将相框设置应用到全部',
        applyAllTitle: '把当前照片的所有相框设置（画幅 / 风格 / 边距 / 高级参数 / 阴影 / 文字模板 / 字段开关）应用到全部已加载的照片',
        styles: {
          'frosted-noir': '暗调毛玻璃',
          'gallery-white': '白衬画廊',
          instax: 'Instax',
          torn: '撕纸',
          'film-35': '35mm 胶片',
          'film-mf': '银盐印品',
          'slide-mount': '幻灯片'
        },
        families: {
          editorial: '编辑',
          gallery: '画廊',
          instant: '即影',
          film: '胶片'
        }
      },
      preset: {
        factory: {
          frostedNoirStack: '夜色毛玻璃',
          tornPaperStack:   '撕纸',
          film35Stack:      '35mm 胶卷',
          filmMfPrint:      '银盐印品',
          slideMountPrint:  '幻灯片'
        }
      },
      caption: {
        template: '模板',
        templates: {
          'minimal-text': '极简',
          'brand-logo': '品牌·logo',
          'brand-right': '品牌·右',
          'tech-stack': '技术栈',
          'spec-grid': '参数胶囊·横排',
          'spec-rail': '参数胶囊·侧栏',
          'date-lens': '日期·镜头',
          wordmark: '字标',
          headline: '标题',
          slate: '场记板',
          passport: '护照戳'
        },
        families: {
          spec: '参数',
          brand: '品牌',
          editorial: '编辑',
          stamp: '印戳'
        },
        showFields: '显示字段',
        fields: {
          brand: '品牌',
          model: '型号',
          focal: '焦段',
          aperture: '光圈',
          shutter: '快门',
          iso: 'ISO',
          lens: '镜头',
          date: '日期',
          author: '作者',
          flash: '闪灯',
          gps: 'GPS'
        },
        compat: {
          narrow: '当前相框的底部文字带偏窄，这个模板的多行布局塞进去会显拥挤。建议改用 极简 / 日期·镜头 / 护照戳。',
          rotated: '当前相框的文字带走垂直方向（旋转 ±90°），横排参数模板被旋转后字符竖排，可读性差。建议改用 标题 / 字标。'
        }
      },
      exif: {
        summary: 'EXIF',
        summaryHint: '读取 · 编辑',
        warn: '<strong>⚠ 未在图片中读取到 EXIF</strong> — 下方输入框的灰色斜体文字只是示例占位。微信 / 社交平台上传会剥离元数据。请手动填写需要显示的字段，或改用原图。',
        labels: {
          make: '品牌',
          model: '型号',
          focalLength: '焦距 (mm)',
          fNumber: 'ƒ-number',
          exposureTime: '快门',
          iso: 'ISO',
          lensModel: '镜头',
          date: '日期',
          author: '作者',
          flash: '闪光灯',
          latitude: '纬度',
          longitude: '经度'
        },
        flashAuto: '自动',
        flashFired: '触发',
        flashOff: '关闭',
        resetAuto: '重置为自动读取',
        applyAll: '将 EXIF 应用到全部',
        applyAllTitle: '把当前照片的 EXIF 编辑应用到所有已加载的照片',
        copyRaw: '复制原始 EXIF',
        copyRawTitle: '把这张照片解析出来的原始 EXIF JSON 复制到剪贴板（debug 用）',
        pickOnMap: '📍 在地图上选',
        pickOnMapTitle: '打开地图选择拍摄位置（首次使用需联网加载地图）'
      },
      geo: {
        title: '选择位置',
        close: '关闭',
        loading: '正在加载地图…',
        offline: '无法加载地图（可能是离线状态）。可在上方手动填写经纬度。',
        locateMe: '使用当前位置',
        cancel: '取消',
        confirm: '使用此位置'
      },
      signature: {
        uploadTitle: '上传签名',
        hint: 'SVG / PNG · 建议透明背景',
        clear: '移除签名',
        position: '位置',
        posBL: '左下',
        posBC: '中下',
        posBR: '右下',
        size: '大小',
        opacity: '不透明度'
      },
      collage: {
        layout: '布局',
        off: '关闭',
        h2: '左右（1×2）',
        v2: '上下（2×1）',
        h3: '横排三联（1×3）',
        v3: '竖排三联（3×1）',
        '2x2': '田字格（2×2）',
        choose: '选择第 {n} 张',
        clear: '移除'
      },
      export: {
        quality: '质量',
        format: '格式',
        qualities: {
          standard: '标准',
          high: '高清',
          original: '原始'
        },
        qualityNative: '原生',
        qualityHelp: {
          standard: '社交分享。文件最小、导出最快。',
          high: '打印 / 大屏。约 3× 文件体积。',
          original: '源分辨率。像素级精度，最慢。iOS Safari 可能上限 4096px。'
        },
        exportCurrent: '导出',
        batchZip: '批量 · ZIP',
        batchShort: 'ZIP',
        modalTitle: '导出中…',
        modalDoneTitle: '已完成',
        modalDoneWithErrors: '完成 · 有错误',
        stageRender: '渲染中',
        stagePack: '打包 ZIP…',
        stageDone: '完成',
        currentPack: '生成压缩包',
        currentDone: '已下载 ZIP',
        currentEmpty: '—',
        close: '关闭'
      },
      canvas: {
        dropHint: '拖入照片以导入',
        emptyTitle: '尚未载入照片',
        emptySubLookbar: '从顶栏导入，或直接把照片拖到画布。',
        rendering: '渲染中'
      },
      statusbar: {
        hints: '<kbd>J</kbd> / <kbd>K</kbd> 切照片 · <kbd>⌘K</kbd> 搜索 · <kbd>⌘E</kbd> 导出 · 空格 看原图 · esc 关闭'
      },
      rail: {
        head: '胶卷',
        empty: '尚无照片',
        navigate: '上下切换',
        ariaList: '已导入照片',
        ariaPane: '照片胶卷',
        applyFrameFromHere: '把这张的相框设置应用到全部',
        applyExifFromHere: '把这张的 EXIF 应用到全部',
        removeOne: '从胶卷中移除'
      },
      status: {
        ready: '就绪',
        loadingAssets: '加载资源中…',
        bundleFail: '资源加载失败：{msg}',
        previewFail: '预览失败：{msg}',
        readingExif: '读取 EXIF…',
        exifFail: 'EXIF 解析失败：{msg}',
        reading: '读取中…',
        decodeFailMany: '{n} 张图片无法解码（已跳过）',
        decodeHeicFail: 'HEIC 解码失败（文件可能已损坏）',
        decodeUnsupported: '不支持的格式 {mime}',
        decodeBroken: '图片无法解码（文件可能已损坏）',
        heicDecoding: '解码 HEIC ({n} 张)…',
        noPhoto: '尚未载入照片',
        exifLoading: 'EXIF 仍在加载…',
        copiedRaw: '已复制原始 EXIF（{n} 个键）到剪贴板',
        copiedRawFallback: '已复制原始 EXIF（备用方式）',
        onlyOne: '仅有一张照片',
        appliedFrame: '已将相框设置应用到 {n} 张照片',
        appliedExif: '已将 {n} 个 EXIF 字段应用到 {m} 张照片',
        signatureLoaded: '签名已加载',
        signatureFail: '签名读取失败：{msg}',
        signatureTooBig: '签名图片过大（{mb} MB），上限 2 MB',
        customBgLoaded: '背景图已加载',
        customBgFail: '背景图读取失败：{msg}',
        customBgTooBig: '背景图过大（{mb} MB），上限 32 MB',
        customBgCompressing: '压缩背景图…',
        collagePartnerSet: '第 {n} 张照片已设置：{name}',
        collagePartnerFail: '拼贴照片读取失败：{msg}',
        presetSaved: '已保存预设「{name}」',
        presetApplied: '已应用预设「{name}」',
        presetDeleted: '已删除预设「{name}」',
        presetShareCopied: '分享链接已复制到剪贴板',
        presetShareFail: '复制失败，请手动选取地址栏',
        presetHashApplied: '已应用分享预设',
        presetHashBad: '分享链接无效',
        presetEmptyName: '名字不能为空',
        presetNonePicked: '请先选择一个预设',
        exporting: '导出中…',
        exported: '已导出',
        exportFail: '导出失败',
        batchPrefix: '批量 · {n} 张',
        batchDone: '完成 · {n} 个错误',
        batchFail: '批量失败',
        hint: 'J/K 切换 · ⌘1-7 跳章节 · [ 折叠 · 空格 看原图 · ⌘E 导出 · Esc 关闭',
        s3Downloading: '下载中 · {name}',
        s3DownloadDone: '已下载 · {name}',
        s3DownloadFail: '下载失败：{msg}',
        s3Saved: '配置已保存',
        s3TestOk: '连接成功',
        s3TestFail: '连接失败：{msg}',
        s3MissingFields: '请先填好 endpoint / access key / secret',
        s3LinkCopied: '分享链接已复制（含读写凭证）',
        s3LinkFail: '复制失败，请手动选取地址栏',
        s3Uploading: '上传中 {done}/{total} · {name}',
        s3UploadDone: '已上传 {n} 张',
        s3UploadFail: '上传失败：{msg}',
        s3Listing: '加载列表中…',
        s3ListEmpty: '远程文件夹为空',
        s3ListDone: '共 {n} 张',
        s3LoadingRemote: '从云端加载 {done}/{total}…',
        s3LoadedRemote: '已加载 {n} 张',
        s3HashApplied: '已应用云端配置，准备好预览',
        s3HashBad: '云端分享链接无效',
        s3CountSelected: '已选 {n} 张'
      },
      gallery: {
        title: '云端画廊',
        back: '返回',
        backTitle: '返回画布（Esc）',
        lightboxTitle: '大图预览',
        lightboxClose: '关闭（Esc）',
        lightboxPrev: '上一张（←）',
        lightboxNext: '下一张（→）',
        lightboxSelect: '选中',
        lightboxSelected: '已选',
        lightboxLoading: '载入原图…',
        download: '下载',
        downloadTitle: '把这张原图下载到本地',
        downloadSelected: '下载所选',
        downloadSelectedTitle: '把所选的多张原图打包成 ZIP 下载'
      },
      s3: {
        configTitle: '云存储配置',
        title: '云相册',
        cloudEntry: '云相册（点击进入画廊）',
        open: '云相册配置',
        close: '关闭',
        tabConfig: '配置',
        tabGallery: '画廊',
        provider: '服务商',
        providerAws: 'AWS S3',
        providerR2: 'Cloudflare R2',
        providerAliyun: '阿里云 OSS',
        endpoint: 'Endpoint（自动生成，可手改）',
        region: 'Region',
        bucket: 'Bucket',
        prefix: '文件夹 / 前缀',
        accountId: 'Account ID',
        accessKeyId: 'Access Key ID',
        secretAccessKey: 'Secret Access Key',
        toggleSecret: '显示 / 隐藏 secret',
        save: '保存',
        test: '测试连接',
        share: '复制分享链接',
        shareWarning: '该链接包含读写凭证，任何人拿到都能修改或删除你的 bucket 内容。仅在信任的小圈子里分享。',
        uploadCurrent: '上传当前胶卷',
        uploadLocal: '上传本地文件',
        uploadLocalTitle: '直接从硬盘挑文件批量上传到云端（不会加入当前胶卷）',
        refresh: '刷新',
        loadSelected: '加载所选到胶卷',
        noneSelected: '尚未选择',
        upload: {
          modalTitle: '上传中…',
          modalDoneTitle: '已上传',
          modalDoneWithErrors: '已上传 · 部分失败',
          stageUpload: '上传中',
          stageDone: '完成',
          currentEmpty: '—',
          currentDone: '已上传到云端'
        },
        download: {
          modalTitle: '下载中…',
          modalDoneTitle: '已下载',
          modalDoneWithErrors: '已下载 · 部分失败',
          stageDownload: '下载中',
          stagePack: '打包 ZIP…',
          stageDone: '完成',
          currentEmpty: '—',
          currentPack: '打包压缩包',
          currentDone: '已保存到本地'
        },
        guideHeader: '🛠 完整配置指引 · 建桶 / 凭证 / CORS',
        guide: {
          aws: '<h4>① 建 S3 Bucket</h4><ol><li>登录 <a href="https://s3.console.aws.amazon.com" target="_blank" rel="noopener">AWS S3 控制台</a> → <b>Create bucket</b></li><li>命名 + 选 <b>Region</b>（如 <code>us-east-1</code>、<code>ap-southeast-1</code>）。本面板的「Region」字段填的就是这个</li><li>「Block all public access」<b>保持勾选</b> —— 我们走签名 URL，不要公开读</li></ol><h4>② 拿 Access Key</h4><ol><li>进 <a href="https://console.aws.amazon.com/iam" target="_blank" rel="noopener">IAM 控制台</a> → <b>Users</b> → <b>Create user</b></li><li>跳过 console access；下一步 <b>Attach policies directly</b> → 勾选 <code>AmazonS3FullAccess</code>（生产建议改为针对单 bucket 的 inline policy）</li><li>用户创建完 → 进入用户详情 → <b>Security credentials</b> → <b>Create access key</b> → 用途选「Application running outside AWS」→ 保存出现的 <b>Access key ID</b> 和 <b>Secret access key</b>（关掉就再也看不到 secret）</li></ol><h4>③ 配 CORS</h4><ol><li>回到刚才的 bucket → <b>Permissions</b> tab → 下拉到 <b>Cross-origin resource sharing (CORS)</b> → <b>Edit</b></li><li>粘贴：</li></ol><pre>[\n  {\n    "AllowedOrigins": ["{origin}"],\n    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "ExposeHeaders": ["ETag"],\n    "MaxAgeSeconds": 3000\n  }\n]</pre><h4>④ 字段对应</h4><ul><li><b>Region</b> → 步骤①里选的 region（如 <code>us-east-1</code>）</li><li><b>Bucket</b> → 步骤①里起的 bucket 名</li><li><b>Folder / prefix</b> → 想放的子目录（如 <code>trips/2026</code>，可留空）</li><li><b>Access Key ID / Secret</b> → 步骤②里复制下来的两段</li><li><b>Endpoint</b> → 留默认，自动拼成 <code>https://&lt;bucket&gt;.s3.&lt;region&gt;.amazonaws.com/</code></li></ul>',
          r2: '<h4>① 建 R2 Bucket</h4><ol><li>登录 <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare Dashboard</a> → 左侧 <b>R2</b> → <b>Create bucket</b></li><li>命名 + 选 <b>Location hint</b>（如 <i>Asia-Pacific</i>、<i>Western Europe</i>） —— R2 的"region"概念被屏蔽，签名时统一是 <code>auto</code></li></ol><h4>② 拿 Access Key</h4><ol><li>R2 主页右上 → <b>Manage R2 API tokens</b> → <b>Create API token</b></li><li>Token name 任意；<b>Permissions</b> 勾「Object Read &amp; Write」；<b>Specify bucket</b> 选你刚建的那个；TTL 建议 90 天以上</li><li>创建后立刻保存 <b>Access Key ID</b> 和 <b>Secret Access Key</b>（页面关掉就再也看不到 secret）</li></ol><h4>③ 拿 Account ID</h4><p>R2 主页右侧 / Cloudflare 主控台右上的 <b>Account ID</b>（一串十六进制 ID）。本面板「Account ID」字段填它。</p><h4>④ 配 CORS</h4><ol><li>进刚才的 bucket → <b>Settings</b> → 下拉到 <b>CORS Policy</b> → <b>Add CORS policy</b></li><li>粘贴：</li></ol><pre>[\n  {\n    "AllowedOrigins": ["{origin}"],\n    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "ExposeHeaders": ["ETag"],\n    "MaxAgeSeconds": 3000\n  }\n]</pre><h4>⑤ 字段对应</h4><ul><li><b>Account ID</b> → 步骤③</li><li><b>Bucket</b> → 步骤①里起的名字</li><li><b>Folder / prefix</b> → 子目录，可留空</li><li><b>Access Key ID / Secret</b> → 步骤②</li><li><b>Endpoint</b> → 留默认，自动拼成 <code>https://&lt;account-id&gt;.r2.cloudflarestorage.com/&lt;bucket&gt;/</code></li></ul>',
          aliyun: '<h4>① 建 OSS Bucket</h4><ol><li>登录 <a href="https://oss.console.aliyun.com" target="_blank" rel="noopener">阿里云 OSS 控制台</a> → <b>创建 Bucket</b></li><li>选 <b>Region</b>（如 <code>oss-cn-hangzhou</code>、<code>oss-cn-shenzhen</code>） —— 本面板「Region」字段填这个，<code>oss-</code> 前缀填不填都行，签名时会自动归一</li><li><b>读写权限</b> 选「私有」 —— 走签名 URL，不要公开读</li></ol><h4>② 拿 Access Key（强烈建议用 RAM 子账号）</h4><ol><li>进 <a href="https://ram.console.aliyun.com" target="_blank" rel="noopener">RAM 访问控制</a> → <b>用户</b> → <b>创建用户</b></li><li>访问方式勾选「<b>OpenAPI 调用访问</b>」（不要勾控制台登录）</li><li>创建完成那一刻就要立刻保存 <b>AccessKey ID</b> 和 <b>AccessKey Secret</b>（关闭页面后 secret 再也看不到）</li><li>给该用户授权 <code>AliyunOSSFullAccess</code>（生产建议改成针对单 bucket 的自定义 policy）</li></ol><h4>③ 配 CORS</h4><ol><li>进刚才的 bucket → <b>权限管理</b> → <b>跨域设置</b> → <b>创建规则</b></li><li>来源（AllowedOrigin）：<code>{origin}</code></li><li>方法（AllowedMethod）：勾 GET / PUT / DELETE / HEAD</li><li>HTTP header（AllowedHeader）：<code>*</code></li><li>暴露 header（ExposeHeader）：<code>ETag</code></li><li>缓存（MaxAgeSeconds）：3000</li></ol><h4>④ 字段对应</h4><ul><li><b>Region</b> → 步骤①里的 region（<code>cn-hangzhou</code> 或 <code>oss-cn-hangzhou</code> 都行）</li><li><b>Bucket</b> → 步骤①里起的名字</li><li><b>Folder / prefix</b> → 子目录，可留空</li><li><b>Access Key ID / Secret</b> → 步骤②</li><li><b>Endpoint</b> → 留默认，自动拼成 <code>https://&lt;bucket&gt;.oss-&lt;region&gt;.aliyuncs.com/</code></li></ul>'
        }
      },
      footer: { brandShip: 'frame · caption · ship' },
      update: {
        available: '新版本已就绪',
        refresh: '刷新使用',
        dismiss: '关闭'
      },
      compose: {
        openTitle: '构图 · 直接拖拽调整裁剪、旋转与四边距',
        title: '直接操控',
        crumbName: '构图',
        crumbSub: '· Compose',
        empty: '—',
        close: '关闭',
        cancel: '取消',
        apply: '应用',
        resetAll: '全部重置',
        session: '编排',
        requirePhoto: '需要先导入一张照片',
        rotateKnob: '拖动以旋转 · 按住 Shift 自由旋转',
        kbd: { switch: '切换', free: '自由', exit: '退出' },
        focus: { crop: '裁剪 (1)', pad: '边距 (2)', rot: '旋转 (3)' },
        bench: { crop: '裁剪', pad: '边距', rot: '旋转', ratio: '比例', snap: '吸附', reset: '重置' },
        hint: {
          crop: '拖角落收紧裁剪 · 拖照片内部平移裁剪框',
          pad: '推拉胶囊条调整四边边距',
          rot: '拖下方拖拽条调整角度 · 任意度数都可以'
        },
        rotateCcw: '逆时针 90°',
        rotateCw: '顺时针 90°',
        rotateZero: '归零',
        mobile: {
          numeric: '精确数值',
          numericTitle: '精确数值',
          padSync: '左右同步',
          padSyncTitle: '同步调整左右边距'
        },
        crop: {
          aspect: '比例',
          aspectFree: '自由',
          aspectFrame: '当前画幅',
          aspectCustom: '自定义'
        },
        hud: {
          pad: '边距', crop: '裁剪', rot: '旋转', pan: '平移',
          min: '最小', below: '低于推荐',
          free: '自由 · 1°', snap90: '吸附 · 90°'
        },
        tag: { crop: '裁', rot: '旋', pad: '距' }
      },
      changelog: {
        button: '更新日志',
        title: '更新日志',
        close: '关闭',
        loading: '加载中…'
      }
    },

    'en': {
      brand: { sub: 'frame · caption · ship' },
      topbar: {
        photos: 'photos',
        switch: 'switch',
        export: 'export',
        import: 'import',
        importCloud: 'From Cloud',
        importCloudTitle: 'Pull photos from a configured S3 / OSS / R2 bucket into the rail',
        github: 'View source on GitHub'
      },
      lang: { zh: '中', en: 'EN', label: 'Language' },
      lookbar: {
        look: 'Look',
        frame: 'Frame',
        template: 'Template',
        aspect: 'Aspect',
        quality: 'Quality',
        compose: 'Compose'
      },
      look: {
        title: 'Looks',
        subtitle: 'apply a starting point · twist · save your own',
        picker: 'Looks',
        empty: '(none)',
        modified: 'modified',
        factoryHead: '✦ Curated',
        userHead: 'My presets',
        userEmpty: 'No saved presets yet · save the current look below ↓',
        save: 'Save current as new preset',
        share: 'Copy share link',
        shareTitle: 'Encode the current look as a #p=… link to send a friend',
        paste: 'Paste share code',
        pasteTitle: 'Paste a share link or code from the clipboard',
        pastePrompt: 'Paste the share link or code',
        pastedLabel: 'From share code',
        delete: 'Delete'
      },
      picker: {
        frame: 'Pick a frame',
        frameSub: ' styles · 4 families',
        template: 'Caption template',
        templateSub: ' layouts · 4 grammars',
        aspect: 'Aspect ratio',
        aspectSub: '5 presets + custom',
        quality: 'Export',
        qualitySub: 'quality + format'
      },
      workshop: {
        title: 'Workshop',
        subtitle: "Editor's desk",
        open: 'Open workshop',
        close: 'Close workshop',
        hint: 'crop · exif · sign · tile',
        exifOverride: 'Override (per photo)',
        // ─── rev.2 「The Bench」 (1.9.0+) · 5 tools ───
        tool: {
          instrument: 'Instrument',
          instrumentTitle: 'Instrument · follows the active frame',
          instrumentHint: 'Each frame is its own instrument — switch frames to see the matching material panel',
          caliper: 'Caliper',
          caliperTitle: 'Caliper · frame geometry',
          notation: 'Notation',
          notationTitle: 'Notation · caption + EXIF',
          notationHint: "What the photo says · caption strip sizing + auto-detected EXIF fields (overridable per photo)",
          arrange: 'Arrange',
          arrangeTitle: 'Arrange · multi-photo collage',
          arrangeHint: 'Clamp multiple photos into the same frame · pick a layout, then bind partner files',
          seal: 'Seal',
          sealTitle: 'Seal · signature',
          sealHint: 'Wax-stamped watermark on the photo aperture'
        },
        topBadgeRow: 'Top badge ▸',
        instrument: {
          lighting: '▾ LIGHTING · shadow'
        },
        caliper: {
          frameGeom: 'Frame geometry'
        },
        notebook: {
          field: 'Field',
          auto: 'Auto · detected',
          hand: 'Hand · override',
          captionStripZone: 'Caption strip'
        },
        seal: {
          waxZone: 'Wax seal · signature',
          clampZone: 'Paper clamps · collage',
          pressTitle: 'Press your seal'
        },
        footerSummaryFmt: '{total} tools · {n} modified',
        footerSummaryNone: '{total} tools · clean',
        resetAll: 'Reset all',
        resetAllTitle: "Revert this photo's everything to the active frame's factory defaults"
      },
      topTemplate: {
        none: 'None',
        brandModel: 'Brand · Model',
        brandOnly: 'Brand',
        wordmark: 'Wordmark'
      },
      cmdk: {
        open: 'Open command palette',
        title: 'Command palette',
        search: 'Search',
        placeholder: 'Search frames, templates, actions…',
        empty: 'No matches. Try “frosted”, “export”, or “1:1”.',
        groupFrames: 'Frames',
        groupTemplates: 'Templates',
        groupAspects: 'Aspects',
        groupActions: 'Actions',
        aspectLabel: 'Aspect',
        actions: {
          exportCurrent: 'Export current photo',
          exportBatch: 'Export batch as ZIP',
          crop: 'Crop & rotate…',
          editExif: 'Edit EXIF override',
          uploadSignature: 'Upload signature',
          collage: 'Configure collage',
          savePreset: 'Save look as preset',
          copyShare: 'Copy share link',
          applyFrameAll: 'Apply frame to all photos',
          changelog: 'Open changelog',
          import: 'Import photos'
        }
      },
      sections: {
        source: 'Source',
        frame: 'Frame',
        caption: 'Caption',
        exif: 'EXIF',
        collage: 'Collage',
        signature: 'Signature',
        export: 'Export'
      },
      nav: { collapse: 'Collapse panel', expand: 'Expand panel' },
      source: {
        importTitle: 'Import photos',
        hintDesktop: 'JPEG / PNG / HEIC · multi-select · drag here',
        hintMobile: 'JPEG / PNG / HEIC · tap to choose'
      },
      frame: {
        aspect: 'Aspect',
        aspectCustom: 'Custom',
        aspectCustomTitle: 'Custom aspect ratio',
        aspectCustomWidth: 'Width',
        aspectCustomHeight: 'Height',
        aspectCustomApply: 'Apply',
        aspectCustomCancel: 'Cancel',
        aspectCustomPresets: 'Presets',
        aspectCustomError: 'Enter a valid ratio between 0.1 and 10',
        style: 'Style',
        padding: 'Padding',
        captionH: 'Caption height',
        captionAuto: 'auto',
        customBg: 'Custom bg image',
        customBgHint: 'JPEG / PNG · replaces the self-bg blur source',
        customBgClear: 'Remove',
        presetSavePrompt: 'Name this preset',
        presetDefaultName: 'Preset {ts}',
        advancedFrosted: 'Advanced · frosted bg',
        advancedTorn: 'Advanced · torn paper',
        advancedFilmMf: 'Advanced · vintage print',
        advancedShadow: 'Advanced · shadow',
        tornJitter: 'Tear depth',
        tornStep: 'Tear density',
        tornEdgeOpacity: 'Edge ink',
        filmMfAge: 'Aging',
        blur: 'Blur',
        brightness: 'Brightness',
        saturation: 'Saturation',
        bgDarken: 'Darken',
        bgGrain: 'Grain',
        galMatWidth: 'Mat width',
        galLineSpacing: 'Line spacing',
        galLineWeight: 'Line weight',
        galLineColor: 'Line color',
        galColor: { ink: 'Ink', charcoal: 'Charcoal', warm: 'Warm' },
        f35Sprocket: 'Sprocket density',
        f35Grain: 'Border grain',
        f35EdgePrint: 'DX edge print',
        f35FrameNo: 'Frame №',
        f35FrameNoOpt: { 'xx': 'XX (anon)', '1-36': '24A (half)', 'a-z': 'A–Z (letter)' },
        instaxSlab: 'Bottom slab',
        instaxTint: 'Paper tint',
        instaxTintOpt: { pure: 'Pure', cream: 'Cream', aged: 'Aged' },
        instaxStamp: 'Date stamp',
        instaxRainbow: 'Rainbow stripe',
        slideMountColor: 'Mount color',
        slideMountColorOpt: { cream: 'Cream', leather: 'Leather', black: 'Archival' },
        slideOuterRing: 'Outer ring',
        slideOuterRingOpt: { wine: 'Wine', brass: 'Brass', charcoal: 'Charcoal' },
        slidePebble: 'Pebble density',
        slideBevel: 'Bevel depth',
        toggleOn: 'ON',
        toggleOff: 'OFF',
        defaultReadout: 'preset',
        resetDefault: 'Reset to default',
        radius: 'Corner radius',
        captionOverlay: 'Caption inside photo',
        captionOverlayHint: 'stamp on photo bottom (35mm authentic look)',
        captionOverlayLift: 'Lift from bottom',
        topTemplate: 'Style',
        topTemplateHint: 'Stamps brand identity into the frame’s top padding. Some frames (film-35) reserve that space for their own decoration.',
        shadowBlur: 'Blur radius',
        shadowOffset: 'Y offset',
        shadowOpacity: 'Opacity',
        applyAll: 'Apply frame to all',
        applyAllTitle: 'Copy this photo’s frame settings (aspect / style / padding / advanced / shadow / template / fields) to every loaded photo',
        styles: {
          'frosted-noir': 'Frosted noir',
          'gallery-white': 'Gallery white',
          instax: 'Instax',
          torn: 'Torn paper',
          'film-35': '35mm film',
          'film-mf': 'Silver print',
          'slide-mount': 'Slide mount'
        },
        families: {
          editorial: 'Editorial',
          gallery: 'Gallery',
          instant: 'Instant',
          film: 'Film'
        }
      },
      preset: {
        factory: {
          frostedNoirStack: 'Frosted noir',
          tornPaperStack:   'Torn paper',
          film35Stack:      '35mm film',
          filmMfPrint:      'Silver print',
          slideMountPrint:  'Slide mount'
        }
      },
      caption: {
        template: 'Template',
        templates: {
          'minimal-text': 'Minimal',
          'brand-logo': 'Brand · logo',
          'brand-right': 'Brand · right',
          'tech-stack': 'Tech stack',
          'spec-grid': 'Spec grid',
          'spec-rail': 'Spec rail',
          'date-lens': 'Date · lens',
          wordmark: 'Wordmark',
          headline: 'Headline',
          slate: 'Slate',
          passport: 'Passport'
        },
        families: {
          spec: 'Spec',
          brand: 'Brand',
          editorial: 'Editorial',
          stamp: 'Stamp'
        },
        showFields: 'Show fields',
        fields: {
          brand: 'Brand',
          model: 'Model',
          focal: 'Focal',
          aperture: 'Aperture',
          shutter: 'Shutter',
          iso: 'ISO',
          lens: 'Lens',
          date: 'Date',
          author: 'Author',
          flash: 'Flash',
          gps: 'GPS'
        },
        compat: {
          narrow: 'This frame has a narrow bottom caption strip; multi-row templates feel cramped here. Try Minimal, Date · lens, or Passport.',
          rotated: 'This frame’s caption runs vertically (±90°); horizontally-laid templates become unreadable when rotated. Try Headline or Wordmark.'
        }
      },
      exif: {
        summary: 'EXIF',
        summaryHint: 'read · edit',
        warn: '<strong>⚠ No EXIF in image</strong> — the gray italics in the inputs below are placeholder hints only. Social platforms (WeChat, Instagram, etc.) strip metadata on upload. Fill in the fields you want shown, or use the original file.',
        labels: {
          make: 'Make',
          model: 'Model',
          focalLength: 'Focal (mm)',
          fNumber: 'ƒ-number',
          exposureTime: 'Shutter',
          iso: 'ISO',
          lensModel: 'Lens',
          date: 'Date',
          author: 'Author',
          flash: 'Flash',
          latitude: 'Latitude',
          longitude: 'Longitude'
        },
        flashAuto: 'auto',
        flashFired: 'Fired',
        flashOff: 'Off',
        resetAuto: 'Reset to auto-read',
        applyAll: 'Apply EXIF to all',
        applyAllTitle: 'Copy this photo’s EXIF edits to every loaded photo',
        copyRaw: 'Copy raw EXIF',
        copyRawTitle: 'Copy this photo’s raw EXIF JSON to clipboard (debug)',
        pickOnMap: '📍 Pick on map',
        pickOnMapTitle: 'Open a map to pick the location (first use needs network to load the map library)'
      },
      geo: {
        title: 'Pick location',
        close: 'Close',
        loading: 'Loading map…',
        offline: 'Could not load map (offline?). Type latitude / longitude above instead.',
        locateMe: 'Use my location',
        cancel: 'Cancel',
        confirm: 'Use this location'
      },
      signature: {
        uploadTitle: 'Upload signature',
        hint: 'SVG / PNG · transparent bg recommended',
        clear: 'Remove signature',
        position: 'Position',
        posBL: 'Bottom-left',
        posBC: 'Bottom-center',
        posBR: 'Bottom-right',
        size: 'Size',
        opacity: 'Opacity'
      },
      collage: {
        layout: 'Layout',
        off: 'Off',
        h2: 'Side by side (1×2)',
        v2: 'Stacked (2×1)',
        h3: '3 across (1×3)',
        v3: '3 stacked (3×1)',
        '2x2': '2×2 grid',
        choose: 'Choose photo #{n}',
        clear: 'Remove'
      },
      export: {
        quality: 'Quality',
        format: 'Format',
        qualities: {
          standard: 'Standard',
          high: 'High',
          original: 'Original'
        },
        qualityNative: 'native',
        qualityHelp: {
          standard: 'Web sharing & messaging.',
          high: 'Print & large displays.',
          original: 'Source-resolution. iOS Safari may cap at 4096px.'
        },
        exportCurrent: 'Export',
        batchZip: 'Batch · ZIP',
        batchShort: 'ZIP',
        modalTitle: 'Exporting…',
        modalDoneTitle: 'Exported',
        modalDoneWithErrors: 'Exported · errors',
        stageRender: 'Rendering',
        stagePack: 'Packing ZIP…',
        stageDone: 'Done',
        currentPack: 'Building archive',
        currentDone: 'ZIP downloaded',
        currentEmpty: '—',
        close: 'Close'
      },
      canvas: {
        dropHint: 'Drop photos to import',
        emptyTitle: 'No photo loaded',
        emptySubLookbar: 'Import from the topbar, or drop here.',
        rendering: 'rendering'
      },
      statusbar: {
        hints: '<kbd>J</kbd> / <kbd>K</kbd> photo · <kbd>⌘K</kbd> search · <kbd>⌘E</kbd> export · space peek · esc close'
      },
      rail: {
        head: 'Roll',
        empty: 'No photos yet',
        navigate: 'navigate',
        ariaList: 'Imported photos',
        ariaPane: 'Photo roll',
        applyFrameFromHere: "Apply this photo's frame to all",
        applyExifFromHere: "Apply this photo's EXIF to all",
        removeOne: 'Remove from roll'
      },
      status: {
        ready: 'ready',
        loadingAssets: 'loading assets…',
        bundleFail: 'bundle load failed: {msg}',
        previewFail: 'preview failed: {msg}',
        readingExif: 'reading EXIF…',
        exifFail: 'EXIF parse failed: {msg}',
        reading: 'reading…',
        decodeFailMany: '{n} files could not be decoded (skipped)',
        decodeHeicFail: 'HEIC decode failed (file may be corrupt)',
        decodeUnsupported: 'unsupported format {mime}',
        decodeBroken: 'image could not be decoded (file may be corrupt)',
        heicDecoding: 'decoding HEIC ({n} file(s))…',
        noPhoto: 'no photo loaded',
        exifLoading: 'EXIF still loading…',
        copiedRaw: 'copied raw EXIF ({n} keys) to clipboard',
        copiedRawFallback: 'copied raw EXIF (fallback)',
        onlyOne: 'only one photo loaded',
        appliedFrame: 'applied frame settings to {n} photo(s)',
        appliedExif: 'applied {n} EXIF field(s) to {m} photo(s)',
        signatureLoaded: 'signature loaded',
        signatureFail: 'signature read failed: {msg}',
        signatureTooBig: 'signature too large ({mb} MB) — max 2 MB',
        customBgLoaded: 'background image loaded',
        customBgFail: 'background image read failed: {msg}',
        customBgTooBig: 'background image too large ({mb} MB) — max 32 MB',
        customBgCompressing: 'compressing background image…',
        collagePartnerSet: 'photo #{n} set: {name}',
        collagePartnerFail: 'collage photo read failed: {msg}',
        presetSaved: 'saved preset "{name}"',
        presetApplied: 'applied preset "{name}"',
        presetDeleted: 'deleted preset "{name}"',
        presetShareCopied: 'share link copied to clipboard',
        presetShareFail: 'copy failed — copy the URL bar manually',
        presetHashApplied: 'applied shared preset',
        presetHashBad: 'invalid share link',
        presetEmptyName: 'name cannot be empty',
        presetNonePicked: 'pick a preset first',
        exporting: 'exporting…',
        exported: 'exported',
        exportFail: 'export failed',
        batchPrefix: 'batch · {n} files',
        batchDone: 'done · {n} errors',
        batchFail: 'batch failed',
        hint: 'J/K switch · ⌘1-7 jump · [ collapse · Space peek · ⌘E export · Esc close',
        s3Downloading: 'downloading · {name}',
        s3DownloadDone: 'downloaded · {name}',
        s3DownloadFail: 'download failed: {msg}',
        s3Saved: 'config saved',
        s3TestOk: 'connection ok',
        s3TestFail: 'connection failed: {msg}',
        s3MissingFields: 'fill in endpoint / access key / secret first',
        s3LinkCopied: 'share link copied (contains read/write credentials)',
        s3LinkFail: 'copy failed — please select the URL manually',
        s3Uploading: 'uploading {done}/{total} · {name}',
        s3UploadDone: 'uploaded {n} photo(s)',
        s3UploadFail: 'upload failed: {msg}',
        s3Listing: 'loading list…',
        s3ListEmpty: 'folder is empty',
        s3ListDone: '{n} item(s)',
        s3LoadingRemote: 'fetching from cloud {done}/{total}…',
        s3LoadedRemote: 'loaded {n} photo(s) from cloud',
        s3HashApplied: 'cloud config applied, gallery ready',
        s3HashBad: 'cloud share link is invalid',
        s3CountSelected: '{n} selected'
      },
      gallery: {
        title: 'Cloud gallery',
        back: 'Back',
        backTitle: 'Back to canvas (Esc)',
        lightboxTitle: 'Preview',
        lightboxClose: 'Close (Esc)',
        lightboxPrev: 'Previous (←)',
        lightboxNext: 'Next (→)',
        lightboxSelect: 'Select',
        lightboxSelected: 'Selected',
        lightboxLoading: 'Loading original…',
        download: 'Download',
        downloadTitle: 'Download this original to your device',
        downloadSelected: 'Download selected',
        downloadSelectedTitle: 'Pack the selected originals into a ZIP and download'
      },
      s3: {
        configTitle: 'Cloud config',
        title: 'Cloud gallery',
        cloudEntry: 'Cloud gallery (open)',
        open: 'Cloud config',
        close: 'Close',
        tabConfig: 'Config',
        tabGallery: 'Gallery',
        provider: 'Provider',
        providerAws: 'AWS S3',
        providerR2: 'Cloudflare R2',
        providerAliyun: 'Aliyun OSS',
        endpoint: 'Endpoint (auto-filled · edit to override)',
        region: 'Region',
        bucket: 'Bucket',
        prefix: 'Folder / prefix',
        accountId: 'Account ID',
        accessKeyId: 'Access Key ID',
        secretAccessKey: 'Secret Access Key',
        toggleSecret: 'Show / hide secret',
        save: 'Save',
        test: 'Test connection',
        share: 'Copy share link',
        shareWarning: 'This link contains read/write credentials. Anyone with it can modify or delete content in your bucket. Share only with people you trust.',
        uploadCurrent: 'Upload current rail',
        uploadLocal: 'Upload local files',
        uploadLocalTitle: 'Pick files from disk and batch-upload to the cloud (no rail import)',
        refresh: 'Refresh',
        loadSelected: 'Load selected',
        noneSelected: 'No photos selected',
        upload: {
          modalTitle: 'Uploading…',
          modalDoneTitle: 'Uploaded',
          modalDoneWithErrors: 'Uploaded · with errors',
          stageUpload: 'Uploading',
          stageDone: 'Done',
          currentEmpty: '—',
          currentDone: 'Uploaded to cloud'
        },
        download: {
          modalTitle: 'Downloading…',
          modalDoneTitle: 'Downloaded',
          modalDoneWithErrors: 'Downloaded · with errors',
          stageDownload: 'Downloading',
          stagePack: 'Packing ZIP…',
          stageDone: 'Done',
          currentEmpty: '—',
          currentPack: 'Building archive',
          currentDone: 'Saved to disk'
        },
        guideHeader: '🛠 Full setup guide · bucket / credentials / CORS',
        guide: {
          aws: '<h4>① Create the S3 bucket</h4><ol><li>Sign in to the <a href="https://s3.console.aws.amazon.com" target="_blank" rel="noopener">AWS S3 console</a> → <b>Create bucket</b></li><li>Pick a name + a <b>Region</b> (e.g. <code>us-east-1</code>, <code>ap-southeast-1</code>). This panel\'s "Region" field maps to exactly this choice</li><li>Keep <b>Block all public access</b> <b>checked</b> — we use signed URLs, never public reads</li></ol><h4>② Create an access key</h4><ol><li>Open the <a href="https://console.aws.amazon.com/iam" target="_blank" rel="noopener">IAM console</a> → <b>Users</b> → <b>Create user</b></li><li>Skip console access; on the next step <b>Attach policies directly</b> → tick <code>AmazonS3FullAccess</code> (in production, prefer an inline policy scoped to this one bucket)</li><li>After the user is created → <b>Security credentials</b> tab → <b>Create access key</b> → choose "Application running outside AWS" → save the <b>Access key ID</b> and <b>Secret access key</b> right away (the secret is shown once only)</li></ol><h4>③ Configure CORS</h4><ol><li>Back to your bucket → <b>Permissions</b> tab → scroll to <b>Cross-origin resource sharing (CORS)</b> → <b>Edit</b></li><li>Paste:</li></ol><pre>[\n  {\n    "AllowedOrigins": ["{origin}"],\n    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "ExposeHeaders": ["ETag"],\n    "MaxAgeSeconds": 3000\n  }\n]</pre><h4>④ Fill these fields</h4><ul><li><b>Region</b> → the region from step ①</li><li><b>Bucket</b> → the bucket name from step ①</li><li><b>Folder / prefix</b> → any subdirectory (e.g. <code>trips/2026</code>; may be empty)</li><li><b>Access Key ID / Secret</b> → from step ②</li><li><b>Endpoint</b> → leave as auto, becomes <code>https://&lt;bucket&gt;.s3.&lt;region&gt;.amazonaws.com/</code></li></ul>',
          r2: '<h4>① Create the R2 bucket</h4><ol><li>Sign in to the <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare dashboard</a> → left nav <b>R2</b> → <b>Create bucket</b></li><li>Name it + pick a <b>Location hint</b> (e.g. APAC, WEUR). R2 hides the concept of "region" — SigV4 always signs as <code>auto</code></li></ol><h4>② Create an API token</h4><ol><li>From the R2 page top-right → <b>Manage R2 API tokens</b> → <b>Create API token</b></li><li>Any token name; <b>Permissions</b> → "Object Read &amp; Write"; <b>Specify bucket</b> → pick the one you created; TTL: 90 days or longer</li><li>After creation, save the <b>Access Key ID</b> and <b>Secret Access Key</b> immediately (page closes and the secret is gone)</li></ol><h4>③ Find the Account ID</h4><p>Right rail of the R2 page (or the top-right of the Cloudflare console): a hex string labelled <b>Account ID</b>. This panel\'s "Account ID" field wants that.</p><h4>④ Configure CORS</h4><ol><li>Back to your bucket → <b>Settings</b> → scroll to <b>CORS Policy</b> → <b>Add CORS policy</b></li><li>Paste:</li></ol><pre>[\n  {\n    "AllowedOrigins": ["{origin}"],\n    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "ExposeHeaders": ["ETag"],\n    "MaxAgeSeconds": 3000\n  }\n]</pre><h4>⑤ Fill these fields</h4><ul><li><b>Account ID</b> → step ③</li><li><b>Bucket</b> → step ①</li><li><b>Folder / prefix</b> → subdirectory, may be empty</li><li><b>Access Key ID / Secret</b> → step ②</li><li><b>Endpoint</b> → leave as auto, becomes <code>https://&lt;account-id&gt;.r2.cloudflarestorage.com/&lt;bucket&gt;/</code></li></ul>',
          aliyun: '<h4>① Create the OSS bucket</h4><ol><li>Sign in to the <a href="https://oss.console.aliyun.com" target="_blank" rel="noopener">Aliyun OSS console</a> → <b>Create Bucket</b></li><li>Pick a <b>Region</b> (e.g. <code>oss-cn-hangzhou</code>, <code>oss-cn-shenzhen</code>). The "Region" field here accepts both <code>cn-hangzhou</code> and <code>oss-cn-hangzhou</code> — the SDK normalizes them</li><li>Choose <b>Private</b> for "read/write permission" — we use signed URLs, not public reads</li></ol><h4>② Get an access key (use a RAM sub-account, not the root key)</h4><ol><li>Open the <a href="https://ram.console.aliyun.com" target="_blank" rel="noopener">RAM access control</a> → <b>Users</b> → <b>Create user</b></li><li>Check <b>OpenAPI access</b> (do NOT enable console login)</li><li>Save the <b>AccessKey ID</b> and <b>AccessKey Secret</b> the moment they appear — the secret cannot be retrieved afterwards</li><li>Attach <code>AliyunOSSFullAccess</code> (in production, prefer a custom policy scoped to one bucket)</li></ol><h4>③ Configure CORS</h4><ol><li>Back to your bucket → <b>权限管理 (Permissions)</b> → <b>跨域设置 (CORS)</b> → <b>Create rule</b></li><li>AllowedOrigin: <code>{origin}</code></li><li>AllowedMethod: GET / PUT / DELETE / HEAD</li><li>AllowedHeader: <code>*</code></li><li>ExposeHeader: <code>ETag</code></li><li>MaxAgeSeconds: 3000</li></ol><h4>④ Fill these fields</h4><ul><li><b>Region</b> → step ① (with or without the <code>oss-</code> prefix)</li><li><b>Bucket</b> → step ①</li><li><b>Folder / prefix</b> → subdirectory, may be empty</li><li><b>Access Key ID / Secret</b> → step ②</li><li><b>Endpoint</b> → leave as auto, becomes <code>https://&lt;bucket&gt;.oss-&lt;region&gt;.aliyuncs.com/</code></li></ul>'
        }
      },
      footer: { brandShip: 'frame · caption · ship' },
      update: {
        available: 'New version available',
        refresh: 'Refresh',
        dismiss: 'Dismiss'
      },
      compose: {
        openTitle: 'Compose — drag crop / rotation / per-edge padding directly',
        title: 'Direct manipulation',
        crumbName: 'Compose',
        crumbSub: '',
        empty: '—',
        close: 'Close',
        cancel: 'Cancel',
        apply: 'Apply',
        resetAll: 'Reset all',
        session: 'compose',
        requirePhoto: 'Import a photo first',
        rotateKnob: 'Drag to rotate · hold Shift for free rotation',
        kbd: { switch: 'switch', free: 'free', exit: 'exit' },
        focus: { crop: 'Crop (1)', pad: 'Padding (2)', rot: 'Rotate (3)' },
        bench: { crop: 'Crop', pad: 'Padding', rot: 'Rotate', ratio: 'Ratio', snap: 'Snap', reset: 'Reset' },
        hint: {
          crop: 'drag corners to tighten · drag inside to pan',
          pad: 'push the edge bars to adjust margins',
          rot: 'drag the slider below · any angle'
        },
        rotateCcw: 'Rotate −90°',
        rotateCw: 'Rotate +90°',
        rotateZero: 'Zero',
        mobile: {
          numeric: 'Numeric input',
          numericTitle: 'Precise values',
          padSync: 'Sync L/R',
          padSyncTitle: 'Mirror left/right padding'
        },
        crop: {
          aspect: 'Aspect',
          aspectFree: 'Free',
          aspectFrame: 'Frame',
          aspectCustom: 'Custom'
        },
        hud: {
          pad: 'PAD', crop: 'CROP', rot: 'ROT', pan: 'PAN',
          min: 'min', below: 'below min',
          free: 'free · 1°', snap90: 'snap · 90°'
        },
        tag: { crop: 'crop', rot: 'rot', pad: 'pad' }
      },
      changelog: {
        button: "What's new",
        title: "What's new",
        close: 'Close',
        loading: 'loading…'
      }
    }
  };

  function getByPath(obj, path) {
    let cur = obj;
    for (const seg of path.split('.')) {
      if (cur == null) return undefined;
      cur = cur[seg];
    }
    return cur;
  }

  function interpolate(template, vars) {
    if (vars == null) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : '{' + k + '}'
    );
  }

  let current = (function detectInitial() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DICT[saved]) return saved;
    } catch (_) {}
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('zh')) return 'zh-CN';
    return 'en';
  })();

  const listeners = new Set();

  function t(key, vars) {
    const dict = DICT[current] || DICT['en'];
    let raw = getByPath(dict, key);
    if (raw == null) raw = getByPath(DICT['en'], key);
    if (raw == null) return key;
    if (typeof raw !== 'string') return key;
    return interpolate(raw, vars);
  }

  function applyDom(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const html = el.hasAttribute('data-i18n-html');
      const v = t(key);
      if (html) el.innerHTML = v;
      else el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.documentElement.setAttribute('lang', current);
  }

  function setLocale(loc) {
    if (!DICT[loc] || loc === current) return;
    current = loc;
    try { localStorage.setItem(STORAGE_KEY, loc); } catch (_) {}
    applyDom();
    listeners.forEach((fn) => { try { fn(loc); } catch (e) { console.error('[i18n]', e); } });
  }

  function getLocale() { return current; }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function locales() { return Object.keys(DICT); }

  window.I18N = { t, applyDom, setLocale, getLocale, onChange, locales };

  // Translate static markup as soon as the DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyDom(), { once: true });
  } else {
    applyDom();
  }
})();
