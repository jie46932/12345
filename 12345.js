/* __V3D_TEMPLATE__ - template-based file; delete this line to prevent this file from being updated */

'use strict';

// 请求场景路径并启动 Verge3D 应用
async function startApp(token) {
    const params = v3d.AppUtils.getPageParams();

    // 优先用 URL 参数（调试用），否则向后端请求真实场景路径
    let sceneURL = params.load;
    if (!sceneURL) {
        try {
            const resp = await fetch('/api/get-scene', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await resp.json();
            if (!data.success) {
                console.error('Scene access denied:', data.message);
                return;
            }
            sceneURL = data.sceneURL;
        } catch (err) {
            console.error('Failed to get scene URL:', err);
            return;
        }
    }

    createApp({
        containerId: 'v3d-container',
        fsButtonId: 'fullscreen-button',
        sceneURL,
        logicURL: params.logic || 'visual_logic.js',
    });
}

window.addEventListener('load', () => {
    // 若已登录（刷新页面时 sessionStorage 仍有 token），立即加载
    const existingToken = sessionStorage.getItem('v3d_token');
    if (existingToken) {
        startApp(existingToken);
        return;
    }

    // 否则等待登录成功事件
    window.addEventListener('v3d-authed', (e) => {
        startApp(e.detail.token);
    }, { once: true });
});

async function createApp({containerId, fsButtonId = null, sceneURL, logicURL = ''}) {
    if (!sceneURL) {
        console.log('No scene URL specified');
        return;
    }

    let PL = null, PE = null;
    if (v3d.AppUtils.isXML(logicURL)) {
        const PUZZLES_DIR = '/puzzles/';
        const logicURLJS = logicURL.match(/(.*)\.xml$/)[1] + '.js';
        PL = await new v3d.PuzzlesLoader().loadEditorWithLogic(PUZZLES_DIR, logicURLJS);
        PE = v3d.PE;
    } else if (v3d.AppUtils.isJS(logicURL)) {
        PL = await new v3d.PuzzlesLoader().loadLogic(logicURL);
    }

    let initOptions = { useFullscreen: true };
    if (PL) {
        initOptions = PL.execInitPuzzles({ container: containerId }).initOptions;
    }
    initOptions.useCompAssets = true;
    // 若 sceneURL 已是 .dat（经 api/get-scene 返回的伪装压缩文件），不追加 .xz
    // 若 sceneURL 是原始 .gltf（调试时 URL 参数传入），则追加 .xz
    if (initOptions.useCompAssets && !sceneURL.endsWith('.dat')) {
        sceneURL = `${sceneURL}.xz`;
    }

    const disposeFullscreen = prepareFullscreen(containerId, fsButtonId,
            initOptions.useFullscreen);
    const preloader = createPreloader(containerId, initOptions, PE);

    const app = createAppInstance(containerId, initOptions, preloader, PE);
    app.addEventListener('dispose', () => disposeFullscreen && disposeFullscreen());

    if (initOptions.preloaderStartCb) initOptions.preloaderStartCb();
    app.loadScene(sceneURL, () => {
        app.enableControls();
        app.run();

        if (PE) PE.updateAppInstance(app);
        if (PL) {
            Promise.allSettled(PL.loadedLibraries || []).then(() => {
                PL.init(app, initOptions);
            });
        }

        window.v3dApp = app;
        runCode(app, PL);
        window.dispatchEvent(new CustomEvent('v3d-scene-ready', { detail: { app } }));
    }, null, () => {
        console.log(`Can't load the scene ${sceneURL}`);
    });

    return { app, PL };
}


function createPreloader(containerId, initOptions, PE) {
    const updateCb = initOptions.useCustomPreloader ? initOptions.preloaderProgressCb : null;
    const finishCb = initOptions.useCustomPreloader ? initOptions.preloaderEndCb : null;
    const preloader = createCustomPreloader(updateCb, finishCb);

    if (PE) puzzlesEditorPreparePreloader(preloader, PE);

    return preloader;
}

function createCustomPreloader(updateCb, finishCb) {
    class CustomPreloader extends v3d.Preloader {
        constructor() {
            super();
            // 隐藏 Verge3D 默认的进度条 UI，使用 React 自定义加载界面
            const el = document.querySelector('.v3d-preloader');
            if (el) el.style.display = 'none';
        }

        onUpdate(percentage) {
            super.onUpdate(percentage);
            if (updateCb) updateCb(percentage);
            window.dispatchEvent(new CustomEvent('v3d-loading-progress', { detail: { percentage } }));
        }

        onFinish() {
            super.onFinish();
            if (finishCb) finishCb();
        }
    }

    return new CustomPreloader();
}

/**
 * Modify the app's preloader to track the loading process in the Puzzles Editor.
 */
function puzzlesEditorPreparePreloader(preloader, PE) {
    const _onUpdate = preloader.onUpdate.bind(preloader);
    preloader.onUpdate = function(percentage) {
        _onUpdate(percentage);
        PE.loadingUpdateCb(percentage);
    }

    const _onFinish = preloader.onFinish.bind(preloader);
    preloader.onFinish = function() {
        _onFinish();
        PE.loadingFinishCb();
    }
}


function createAppInstance(containerId, initOptions, preloader, PE) {
    const ctxSettings = {};
    if (initOptions.useBkgTransp) ctxSettings.alpha = true;
    if (initOptions.preserveDrawBuf) ctxSettings.preserveDrawingBuffer = true;

    const app = new v3d.App(containerId, ctxSettings, preloader);
    if (initOptions.useBkgTransp) {
        app.clearBkgOnLoad = true;
        if (app.renderer) {
            app.renderer.setClearColor(0x000000, 0);
        }
    }

    // namespace for communicating with code generated by Puzzles
    app.ExternalInterface = {};
    prepareExternalInterface(app);
    if (PE) PE.viewportUseAppInstance(app);

    return app;
}


function prepareFullscreen(containerId, fsButtonId, useFullscreen) {
    const container = document.getElementById(containerId);
    const fsButton = document.getElementById(fsButtonId);

    if (!fsButton) {
        return null;
    }
    if (!useFullscreen) {
        if (fsButton) fsButton.style.display = 'none';
        return null;
    }

    const fsEnabled = () => document.fullscreenEnabled
            || document.webkitFullscreenEnabled
            || document.mozFullScreenEnabled
            || document.msFullscreenEnabled;
    const fsElement = () => document.fullscreenElement
            || document.webkitFullscreenElement
            || document.mozFullScreenElement
            || document.msFullscreenElement;
    const requestFs = elem => (elem.requestFullscreen
            || elem.mozRequestFullScreen
            || elem.webkitRequestFullscreen
            || elem.msRequestFullscreen).call(elem);
    const exitFs = () => (document.exitFullscreen
            || document.mozCancelFullScreen
            || document.webkitExitFullscreen
            || document.msExitFullscreen).call(document);
    const changeFs = () => {
        const elem = fsElement();
        fsButton.classList.add(elem ? 'fullscreen-close' : 'fullscreen-open');
        fsButton.classList.remove(elem ? 'fullscreen-open' : 'fullscreen-close');
    };

    function fsButtonClick(event) {
        event.stopPropagation();
        if (fsElement()) {
            exitFs();
        } else {
            requestFs(container);
        }
    }

    if (fsEnabled()) fsButton.style.display = 'inline';

    fsButton.addEventListener('click', fsButtonClick);
    document.addEventListener('webkitfullscreenchange', changeFs);
    document.addEventListener('mozfullscreenchange', changeFs);
    document.addEventListener('msfullscreenchange', changeFs);
    document.addEventListener('fullscreenchange', changeFs);

    const disposeFullscreen = () => {
        fsButton.removeEventListener('click', fsButtonClick);
        document.removeEventListener('webkitfullscreenchange', changeFs);
        document.removeEventListener('mozfullscreenchange', changeFs);
        document.removeEventListener('msfullscreenchange', changeFs);
        document.removeEventListener('fullscreenchange', changeFs);
    }

    return disposeFullscreen;
}


function prepareExternalInterface(app) {
    /**
     * Register functions in the app.ExternalInterface to call them from
     * Puzzles, e.g:
     * app.ExternalInterface.myJSFunction = function() {
     *     console.log('Hello, World!');
     * }
     */

}

function runCode(app, puzzles) {
    const scene = app.scene;
    const renderer = app.renderer;

    // 背景纯黑
    scene.worldMaterial = null;
    scene.background = new v3d.Color(0x000000);

    // 用 HDR 作为环境光源，手动分配给除 Plane001 外的所有材质
    const pmrem = new v3d.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    new v3d.RGBELoader().load('media/22.hdr', texture => {
        const envMap = pmrem.fromEquirectangular(texture).texture;

        // 不设置 scene.environment（避免自动分配给所有材质）
        // 手动给除 Plane001 外的所有网格材质赋 envMap
        scene.traverse(o => {
            if (o.isMesh && o.name !== 'Plane001') {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => {
                    m.envMap = envMap;
                    m.needsUpdate = true;
                });
            }
        });

        scene.background = new v3d.Color(0x000000);
        texture.dispose();
        pmrem.dispose();
    });
}
