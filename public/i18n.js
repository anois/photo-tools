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
        github: '在 GitHub 查看源码'
      },
      lang: { zh: '中', en: 'EN', label: '语言' },
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
        rotate: '旋转',
        rotateCcw: '逆时针 90°',
        rotateCw: '顺时针 90°',
        crop: '裁剪…',
        cropAndRotate: '裁剪 & 旋转…',
        geometry: '几何调整',
        geometryClean: '原图',
        geometryCropped: '已裁剪',
        customBg: '自定义背景图',
        customBgHint: 'JPEG / PNG · 替换默认的自我磨砂背景源',
        customBgClear: '移除',
        presets: '预设',
        presetsHint: '保存 · 应用 · 分享',
        presetChoose: '（选择预设）',
        presetSave: '保存当前为…',
        presetDelete: '删除',
        presetShare: '复制分享链接',
        presetSavePrompt: '为这个预设起个名字',
        presetDefaultName: '预设 {ts}',
        advancedFrosted: '高级 · 毛玻璃参数',
        advancedShadow: '高级 · 阴影',
        blur: '模糊',
        brightness: '亮度',
        saturation: '饱和度',
        defaultReadout: '默认',
        resetDefault: '恢复默认',
        shadowBlur: '模糊半径',
        shadowOffset: '纵向偏移',
        shadowOpacity: '不透明度',
        applyAll: '将相框设置应用到全部',
        applyAllTitle: '把当前照片的所有相框设置（画幅 / 风格 / 边距 / 高级参数 / 阴影 / 文字模板 / 字段开关）应用到全部已加载的照片',
        styles: {
          frosted: '毛玻璃',
          'frosted-noir': '暗调',
          'gallery-white': '白衬',
          'gallery-noir': '黑衬',
          polaroid: '宝丽来',
          instax: 'Instax',
          'film-35': '35mm',
          editorial: '杂志',
          'editorial-mirror': '杂志·镜像'
        },
        families: {
          editorial: '编辑',
          gallery: '画廊',
          instant: '即影',
          film: '胶片'
        }
      },
      caption: {
        template: '模板',
        templates: {
          'minimal-text': '极简',
          'brand-logo': '品牌左',
          'brand-right': '品牌右',
          'tech-stack': '技术栈',
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
          standard: '标准 · 1440',
          high: '高清 · 2×',
          original: '原始 · 原生'
        },
        exportCurrent: '导出当前',
        batchZip: '批量 · ZIP',
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
        emptySubDesktop: '从左侧导入，或拖到此处。',
        emptySubMobile: '点击上方“导入照片”。',
        rendering: '渲染中'
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
        hint: 'J/K 切换 · ⌘1-7 跳章节 · [ 折叠 · 空格 看原图 · ⌘E 导出 · Esc 关闭'
      },
      footer: { brandShip: 'frame · caption · ship' },
      update: {
        available: '新版本已就绪',
        refresh: '刷新使用',
        dismiss: '关闭'
      },
      crop: {
        title: '裁剪 & 旋转',
        close: '关闭',
        reset: '重置',
        cancel: '取消',
        apply: '应用',
        readout: '{w}% × {h}%',
        aspect: '比例',
        aspectFree: '自由',
        aspectFrame: '当前画幅',
        rotate: '旋转',
        rotateReset: '归零'
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
        github: 'View source on GitHub'
      },
      lang: { zh: '中', en: 'EN', label: 'Language' },
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
        rotate: 'Rotate',
        rotateCcw: 'Rotate 90° counter-clockwise',
        rotateCw: 'Rotate 90° clockwise',
        crop: 'Crop…',
        cropAndRotate: 'Crop & rotate…',
        geometry: 'Geometry',
        geometryClean: 'untouched',
        geometryCropped: 'cropped',
        customBg: 'Custom bg image',
        customBgHint: 'JPEG / PNG · replaces the self-bg blur source',
        customBgClear: 'Remove',
        presets: 'Presets',
        presetsHint: 'save · apply · share',
        presetChoose: '(Choose a preset)',
        presetSave: 'Save current as…',
        presetDelete: 'Delete',
        presetShare: 'Copy share link',
        presetSavePrompt: 'Name this preset',
        presetDefaultName: 'Preset {ts}',
        advancedFrosted: 'Advanced · frosted bg',
        advancedShadow: 'Advanced · shadow',
        blur: 'Blur',
        brightness: 'Brightness',
        saturation: 'Saturation',
        defaultReadout: 'preset',
        resetDefault: 'Reset to default',
        shadowBlur: 'Blur radius',
        shadowOffset: 'Y offset',
        shadowOpacity: 'Opacity',
        applyAll: 'Apply frame to all',
        applyAllTitle: 'Copy this photo’s frame settings (aspect / style / padding / advanced / shadow / template / fields) to every loaded photo',
        styles: {
          frosted: 'Frosted',
          'frosted-noir': 'Noir',
          'gallery-white': 'White',
          'gallery-noir': 'Noir',
          polaroid: 'Polaroid',
          instax: 'Instax',
          'film-35': '35 mm',
          editorial: 'Spread',
          'editorial-mirror': 'Mirror'
        },
        families: {
          editorial: 'Editorial',
          gallery: 'Gallery',
          instant: 'Instant',
          film: 'Film'
        }
      },
      caption: {
        template: 'Template',
        templates: {
          'minimal-text': 'Minimal',
          'brand-logo': 'Brand · L',
          'brand-right': 'Brand · R',
          'tech-stack': 'Tech stack',
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
          standard: 'Standard · 1440',
          high: 'High · 2×',
          original: 'Original · native'
        },
        exportCurrent: 'Export current',
        batchZip: 'Batch · ZIP',
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
        emptySubDesktop: 'Import from the left panel, or drop here.',
        emptySubMobile: 'Tap “Import photos” above.',
        rendering: 'rendering'
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
        hint: 'J/K switch · ⌘1-7 jump · [ collapse · Space peek · ⌘E export · Esc close'
      },
      footer: { brandShip: 'frame · caption · ship' },
      update: {
        available: 'New version available',
        refresh: 'Refresh',
        dismiss: 'Dismiss'
      },
      crop: {
        title: 'Crop & rotate',
        close: 'Close',
        reset: 'Reset',
        cancel: 'Cancel',
        apply: 'Apply',
        readout: '{w}% × {h}%',
        aspect: 'Aspect',
        aspectFree: 'Free',
        aspectFrame: 'Frame',
        rotate: 'Rotate',
        rotateReset: 'Zero'
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
