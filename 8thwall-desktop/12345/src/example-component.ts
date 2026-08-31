import * as ecs from '@8thwall/ecs'

type FlowState = 'scanning' | 'ready-to-place' | 'placed'
type ControlMode = 'idle' | 'move' | 'rotate'
type ControlAction = 'front' | 'back' | 'left' | 'right' | 'rotate-left' | 'rotate-right'

declare global {
  interface Window {
    __heFurnitureARController?: HEFurnitureARController
    ecs?: any
    XR8?: any
  }
}

const MODEL_NAME_PART = 'mainModel-ar-ios11'
const LONG_PRESS_MS = 450
const CONTROL_REPEAT_MS = 40
const MOVE_STEP_METERS = 0.018
const ROTATE_STEP_RADIANS = Math.PI / 90
const HIT_TEST_X = 0.5
const HIT_TEST_Y = 0.58
const SURFACE_HIT_TYPES = new Set(['DETECTED_SURFACE', 'ESTIMATED_SURFACE'])
const MODEL_ENTITY_ID = 'f24191cd-bd18-4c4f-91c3-5466e48822a6'

const DATASET_DEFAULTS: Record<string, string> = {
  viewerARProvider: '8th-wall-ecs',
  viewerARMode: 'active',
  viewerAROverlayActive: 'true',
  viewerARLaunchState: 'starting',
  viewerARFlowState: 'scanning',
  viewerARPlacementMarkerVisible: 'false',
  viewerARPlacementRequiresReticle: 'true',
  viewerARPlaneReady: 'false',
  viewerARReticleReady: 'false',
  viewerARPlaced: 'false',
  viewerARControlMode: 'idle',
  viewerARMoveControlsVisible: 'false',
  viewerARRotateControlsVisible: 'false',
  viewerARScaleLocked: 'true',
  viewerARRotationLockedAxis: 'vertical',
  viewerARBrandingSource: 'none',
  viewerARModelVisible: 'false',
  viewerARModelReady: 'false',
  viewerARHitCount: '0',
  viewerARHitType: '',
  viewerARHitSource: '',
  viewerARHitTestError: '',
  viewerARPlacementPointX: '',
  viewerARPlacementPointY: '',
  viewerARPlacementPointZ: '',
  viewerARReticleScreenX: '',
  viewerARReticleScreenY: '',
  viewerARPlacementReadyReason: '',
  viewerARTrackingEvidence: 'none',
  viewerARLastRealityEvent: '',
  viewerARLastMoveX: '',
  viewerARLastMoveZ: '',
  viewerARLastRotateRadians: '0',
}

const setARData = (name: string, value: string | number | boolean) => {
  document.documentElement.dataset[name] = String(value)
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const normalizeAngle = (angle: number) => {
  let next = angle
  while (next > Math.PI) next -= Math.PI * 2
  while (next < -Math.PI) next += Math.PI * 2
  return next
}

class HEFurnitureARController {
  private world: any = null
  private modelEid: number | null = null
  private modelEntity: any = null
  private modelObject: any = null
  private modelY = 0
  private modelYaw = 0
  private modelScale = 1
  private flowState: FlowState = 'scanning'
  private controlMode: ControlMode = 'idle'
  private planeReady = false
  private placementPoint = {x: 0, y: 0, z: 0}
  private markerScreen = {x: 50, y: 55}
  private rafId = 0
  private longPressTimer = 0
  private controlTimer = 0
  private pointerStart: {x: number, y: number, count: number} | null = null
  private activePointers = new Map<number, {x: number, y: number}>()
  private statusText: HTMLElement
  private root: HTMLElement
  private marker: HTMLElement
  private moveControls: HTMLElement
  private rotateControls: HTMLElement

  constructor() {
    this.root = this.createOverlay()
    this.statusText = this.root.querySelector<HTMLElement>('[data-ar-status]')!
    this.marker = this.root.querySelector<HTMLElement>('[data-placement-marker]')!
    this.moveControls = this.root.querySelector<HTMLElement>('[data-move-controls]')!
    this.rotateControls = this.root.querySelector<HTMLElement>('[data-rotate-controls]')!
    this.bindDomEvents()
    this.setFlowState('scanning')
    this.detectBrandingSource()
  }

  start() {
    Object.entries(DATASET_DEFAULTS).forEach(([key, value]) => setARData(key, value))
    this.waitForWorld()
  }

  destroy() {
    window.cancelAnimationFrame(this.rafId)
    window.clearTimeout(this.longPressTimer)
    window.clearInterval(this.controlTimer)
    this.root.remove()
    setARData('viewerAROverlayActive', 'false')
    setARData('viewerARMoveControlsVisible', 'false')
    setARData('viewerARRotateControlsVisible', 'false')
  }

  private waitForWorld() {
    this.world = window.ecs?.application?.getWorld?.()
    if (!this.world) {
      window.setTimeout(() => this.waitForWorld(), 80)
      return
    }

    this.world.three?.setMatrixUpdateMode?.('auto')
    this.bindRealityEvents()
    this.findAndHideModel()
    setARData('viewerARLaunchState', 'started')
    this.statusText.textContent = '移动手机扫描地面或桌面'
    this.tick()
  }

  private bindRealityEvents() {
    const events = this.world?.events
    const globalId = events?.globalId
    if (!events || globalId === undefined) {
      setARData('viewerARLastRealityEvent', 'no-event-bus')
      return
    }

    const recordEvent = (event: any) => {
      const eventName = event?.name || 'reality-event'
      setARData('viewerARLastRealityEvent', eventName)
    }

    ;[
      ecs.events.REALITY_READY,
      ecs.events.REALITY_TRACKING_STATUS,
      ecs.events.REALITY_MESH_FOUND,
      ecs.events.REALITY_LOCATION_FOUND,
      ecs.events.REALITY_LOCATION_UPDATED,
    ].forEach((eventName) => {
      events.addListener(globalId, eventName, recordEvent)
    })
  }

  private findAndHideModel() {
    const entities = Array.from(this.world?.eidToEntity?.values?.() || []) as any[]
    const modelEntity = entities.find((entity) => {
      const object = this.world?.three?.entityToObject?.get?.(entity.eid)
      return entity?.id === MODEL_ENTITY_ID || object?.name?.includes?.(MODEL_NAME_PART) || entity?.eid === this.modelEid
    })

    if (!modelEntity) {
      this.modelObject = this.findModelObjectInScene()
      if (this.modelObject) {
        this.hideModel()
        this.modelScale = this.modelObject.scale?.x || 1
        setARData('viewerARModelReady', 'true')
        setARData('viewerARModelVisible', 'false')
        return
      }
      window.setTimeout(() => this.findAndHideModel(), 120)
      return
    }

    this.modelEid = modelEntity.eid
    this.modelEntity = modelEntity
    this.modelObject = this.world.three.entityToObject.get(modelEntity.eid)
    if (this.modelObject) {
      this.modelObject.traverse?.((object: any) => {
        object.frustumCulled = false
      })
      this.modelScale = this.modelObject.scale?.x || 1
      setARData('viewerARModelReady', 'true')
    }
    this.hideModel()
    setARData('viewerARModelVisible', 'false')
  }

  private findModelObjectInScene() {
    let found: any = null
    const scene = this.world?.three?.scene
    scene?.traverse?.((object: any) => {
      if (!found && object?.name?.includes?.(MODEL_NAME_PART)) found = object
    })
    return found
  }

  private hideModel() {
    this.modelEntity?.hide?.()
    if (this.modelEid !== null) this.world?.getEntity?.(this.modelEid)?.hide?.()
    if (this.modelObject) this.modelObject.visible = false
  }

  private showModel() {
    this.modelEntity?.show?.()
    if (this.modelEid !== null) this.world?.getEntity?.(this.modelEid)?.show?.()
    if (this.modelObject) this.modelObject.visible = true
  }

  private setFlowState(nextState: FlowState) {
    if (this.flowState === 'placed' && nextState !== 'placed') return
    this.flowState = nextState
    setARData('viewerARFlowState', nextState)

    if (nextState === 'scanning') {
      this.statusText.textContent = '移动手机扫描地面或桌面'
      this.marker.hidden = true
    }

    if (nextState === 'ready-to-place') {
      this.statusText.textContent = '点击摆放点放置模型'
      this.marker.hidden = false
    }

    if (nextState === 'placed') {
      this.statusText.textContent = '长按屏幕显示移动或旋转按钮'
      this.marker.hidden = true
    }
  }

  private setControlMode(nextMode: ControlMode) {
    if (this.flowState !== 'placed') nextMode = 'idle'
    this.controlMode = nextMode
    setARData('viewerARControlMode', nextMode)
    const moveVisible = nextMode === 'move'
    const rotateVisible = nextMode === 'rotate'
    this.moveControls.hidden = !moveVisible
    this.rotateControls.hidden = !rotateVisible
    setARData('viewerARMoveControlsVisible', moveVisible)
    setARData('viewerARRotateControlsVisible', rotateVisible)
    if (nextMode === 'move') this.statusText.textContent = '按住箭头水平移动'
    if (nextMode === 'rotate') this.statusText.textContent = '按住左转或右转旋转'
    if (nextMode === 'idle' && this.flowState === 'placed') {
      this.statusText.textContent = '长按屏幕显示移动或旋转按钮'
    }
  }

  private tick = () => {
    if (this.flowState !== 'placed') this.ensureModelHiddenBeforePlacement()
    if (this.flowState !== 'placed') this.updatePlacementPoint()
    this.lockModelTransform(false)
    this.detectBrandingSource()
    this.rafId = window.requestAnimationFrame(this.tick)
  }

  private ensureModelHiddenBeforePlacement() {
    if (!this.modelObject) {
      this.modelObject = this.findModelObjectInScene()
      if (this.modelObject) {
        this.modelScale = this.modelObject.scale?.x || 1
        setARData('viewerARModelReady', 'true')
      }
    }
    this.hideModel()
    setARData('viewerARModelVisible', 'false')
  }

  private updatePlacementPoint() {
    const camera = this.world?.three?.activeCamera
    if (!camera?.position) return

    const hit = this.getSurfaceHit()
    if (!hit) {
      this.planeReady = false
      setARData('viewerARPlaneReady', 'false')
      setARData('viewerARReticleReady', 'false')
      setARData('viewerARPlacementMarkerVisible', 'false')
      setARData('viewerARTrackingEvidence', 'none')
      if (this.flowState !== 'placed') this.setFlowState('scanning')
      return
    }

    const point = this.vectorFromHitPosition(hit.position)
    if (!point) {
      this.planeReady = false
      setARData('viewerARPlaneReady', 'false')
      setARData('viewerARReticleReady', 'false')
      setARData('viewerARPlacementMarkerVisible', 'false')
      if (this.flowState !== 'placed') this.setFlowState('scanning')
      return
    }

    this.placementPoint = point
    const projected = this.projectWorldToScreen(camera, point)
    if (projected) this.markerScreen = projected

    this.root.style.setProperty('--marker-x', `${this.markerScreen.x}%`)
    this.root.style.setProperty('--marker-y', `${this.markerScreen.y}%`)
    if (projected) {
      setARData('viewerARReticleScreenX', this.markerScreen.x.toFixed(2))
      setARData('viewerARReticleScreenY', this.markerScreen.y.toFixed(2))
    }
    setARData('viewerARPlacementPointX', point.x.toFixed(4))
    setARData('viewerARPlacementPointY', point.y.toFixed(4))
    setARData('viewerARPlacementPointZ', point.z.toFixed(4))

    this.planeReady = true
    setARData('viewerARPlaneReady', 'true')
    setARData('viewerARReticleReady', 'true')
    setARData('viewerARPlacementMarkerVisible', this.flowState === 'placed' ? 'false' : 'true')
    setARData('viewerARTrackingEvidence', 'surface-hit')
    setARData('viewerARPlacementReadyReason', 'xr8-hit-test')
    if (this.flowState !== 'placed') this.setFlowState('ready-to-place')
  }

  private getSurfaceHit() {
    const hitTest = window.XR8?.XrController?.hitTest
    if (typeof hitTest !== 'function') {
      setARData('viewerARHitTestError', 'XR8.XrController.hitTest unavailable')
      setARData('viewerARHitCount', '0')
      return null
    }

    try {
      const rawHits = hitTest(HIT_TEST_X, HIT_TEST_Y) || []
      const hits = Array.isArray(rawHits) ? rawHits : [rawHits]
      setARData('viewerARHitCount', hits.length)
      const surfaceHit = hits.find((candidate) => {
        const type = String(candidate?.type || candidate?.hitType || candidate?.surfaceType || '')
        return candidate?.position && (!type || SURFACE_HIT_TYPES.has(type))
      })
      setARData('viewerARHitType', surfaceHit ? String(surfaceHit.type || surfaceHit.hitType || surfaceHit.surfaceType || 'SURFACE_HIT') : '')
      setARData('viewerARHitSource', surfaceHit ? 'XR8.XrController.hitTest' : '')
      setARData('viewerARHitTestError', '')
      return surfaceHit || null
    } catch (error) {
      setARData('viewerARHitTestError', error instanceof Error ? error.message : 'hit-test failed')
      setARData('viewerARHitCount', '0')
      setARData('viewerARHitType', '')
      setARData('viewerARHitSource', '')
      return null
    }
  }

  private vectorFromHitPosition(position: any) {
    const x = Number(Array.isArray(position) ? position[0] : position?.x)
    const y = Number(Array.isArray(position) ? position[1] : position?.y)
    const z = Number(Array.isArray(position) ? position[2] : position?.z)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
    return {x, y, z}
  }

  private projectWorldToScreen(camera: any, point: {x: number, y: number, z: number}) {
    try {
      const vector = camera.position.clone()
      vector.set(point.x, point.y, point.z)
      vector.project(camera)
      if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return null
      return {
        x: clamp((vector.x * 0.5 + 0.5) * 100, 8, 92),
        y: clamp((-vector.y * 0.5 + 0.5) * 100, 18, 78),
      }
    } catch {
      return null
    }
  }

  private placeModel() {
    if (this.flowState !== 'ready-to-place' || !this.modelObject) return
    this.updatePlacementPoint()
    if (!this.planeReady || this.flowState !== 'ready-to-place') return
    this.modelY = this.placementPoint.y
    this.modelObject.position.set?.(this.placementPoint.x, this.modelY, this.placementPoint.z)
    if (this.modelEid !== null) this.world.setPosition?.(this.modelEid, this.placementPoint.x, this.modelY, this.placementPoint.z)
    this.showModel()
    this.lockModelTransform(true)
    setARData('viewerARPlaced', 'true')
    setARData('viewerARModelVisible', 'true')
    setARData('viewerARPlacementMarkerVisible', 'false')
    setARData('viewerARLastMoveX', this.placementPoint.x.toFixed(4))
    setARData('viewerARLastMoveZ', this.placementPoint.z.toFixed(4))
    this.setFlowState('placed')
  }

  private lockModelTransform(syncEcs = false) {
    if (!this.modelObject) return
    if (syncEcs) this.modelObject.position.y = this.modelY
    this.modelObject.rotation.x = 0
    this.modelObject.rotation.z = 0
    this.modelObject.rotation.y = this.modelYaw
    this.modelObject.scale.set?.(this.modelScale, this.modelScale, this.modelScale)
    if (syncEcs && this.modelEid !== null) {
      this.world?.setPosition?.(this.modelEid, this.modelObject.position.x, this.modelY, this.modelObject.position.z)
      this.world?.setScale?.(this.modelEid, this.modelScale, this.modelScale, this.modelScale)
    }
    setARData('viewerARScaleLocked', 'true')
    setARData('viewerARRotationLockedAxis', 'vertical')
  }

  private applyAction(action: ControlAction) {
    if (this.flowState !== 'placed' || !this.modelObject) return
    const camera = this.world?.three?.activeCamera
    const yaw = this.getCameraYaw(camera)
    const forward = {x: Math.sin(yaw), z: -Math.cos(yaw)}
    const right = {x: Math.cos(yaw), z: Math.sin(yaw)}

    if (action === 'front') {
      this.modelObject.position.x += forward.x * MOVE_STEP_METERS
      this.modelObject.position.z += forward.z * MOVE_STEP_METERS
    } else if (action === 'back') {
      this.modelObject.position.x -= forward.x * MOVE_STEP_METERS
      this.modelObject.position.z -= forward.z * MOVE_STEP_METERS
    } else if (action === 'left') {
      this.modelObject.position.x -= right.x * MOVE_STEP_METERS
      this.modelObject.position.z -= right.z * MOVE_STEP_METERS
    } else if (action === 'right') {
      this.modelObject.position.x += right.x * MOVE_STEP_METERS
      this.modelObject.position.z += right.z * MOVE_STEP_METERS
    } else if (action === 'rotate-left') {
      this.modelYaw = normalizeAngle(this.modelYaw + ROTATE_STEP_RADIANS)
    } else if (action === 'rotate-right') {
      this.modelYaw = normalizeAngle(this.modelYaw - ROTATE_STEP_RADIANS)
    }

    this.lockModelTransform(true)
    setARData('viewerARLastMoveX', this.modelObject.position.x.toFixed(4))
    setARData('viewerARLastMoveZ', this.modelObject.position.z.toFixed(4))
    setARData('viewerARLastRotateRadians', this.modelYaw.toFixed(4))
  }

  private getCameraYaw(camera: any) {
    try {
      const direction = camera.position.clone()
      camera.getWorldDirection(direction)
      return Math.atan2(direction.x, -direction.z)
    } catch {
      return 0
    }
  }

  private bindDomEvents() {
    const touchLayer = this.root.querySelector<HTMLElement>('[data-touch-layer]')!

    touchLayer.addEventListener('pointerdown', (event) => this.handlePointerDown(event))
    touchLayer.addEventListener('pointermove', (event) => this.handlePointerMove(event))
    touchLayer.addEventListener('pointerup', (event) => this.handlePointerUp(event))
    touchLayer.addEventListener('pointercancel', (event) => this.handlePointerUp(event))

    this.root.querySelectorAll<HTMLButtonElement>('[data-control-action]').forEach((button) => {
      const action = button.dataset.controlAction as ControlAction
      const start = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        this.startControlAction(action)
      }
      const stop = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        this.stopControlAction()
      }
      button.addEventListener('pointerdown', start)
      button.addEventListener('pointerup', stop)
      button.addEventListener('pointerleave', stop)
      button.addEventListener('pointercancel', stop)
      button.addEventListener('touchstart', start, {passive: false})
      button.addEventListener('touchend', stop)
      button.addEventListener('touchcancel', stop)
    })

    this.root.querySelector<HTMLButtonElement>('[data-reset]')?.addEventListener('click', () => this.resetPlacement())
    this.root.querySelector<HTMLButtonElement>('[data-exit]')?.addEventListener('click', () => {
      window.history.back()
    })
  }

  private handlePointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    this.activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY})
    this.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      count: this.activePointers.size,
    }
    window.clearTimeout(this.longPressTimer)
    this.longPressTimer = window.setTimeout(() => {
      if (this.flowState !== 'placed') return
      this.setControlMode(this.activePointers.size >= 2 ? 'rotate' : 'move')
    }, LONG_PRESS_MS)
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.activePointers.has(event.pointerId)) return
    this.activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY})
    if (!this.pointerStart) return
    const distance = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y)
    if (distance > 18) window.clearTimeout(this.longPressTimer)
  }

  private handlePointerUp(event: PointerEvent) {
    event.preventDefault()
    const start = this.pointerStart
    this.activePointers.delete(event.pointerId)
    window.clearTimeout(this.longPressTimer)

    if (this.activePointers.size === 0) {
      const wasTap = start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 24
      if (wasTap && this.flowState === 'ready-to-place' && this.isNearMarker(event.clientX, event.clientY)) {
        this.placeModel()
      }
      this.pointerStart = null
    }
  }

  private isNearMarker(clientX: number, clientY: number) {
    const x = (this.markerScreen.x / 100) * window.innerWidth
    const y = (this.markerScreen.y / 100) * window.innerHeight
    return Math.hypot(clientX - x, clientY - y) < 96
  }

  private startControlAction(action: ControlAction) {
    this.applyAction(action)
    this.stopControlAction()
    this.controlTimer = window.setInterval(() => this.applyAction(action), CONTROL_REPEAT_MS)
  }

  private stopControlAction() {
    window.clearInterval(this.controlTimer)
    this.controlTimer = 0
  }

  private resetPlacement() {
    this.stopControlAction()
    this.hideModel()
    if (this.modelObject) {
      this.modelObject.visible = false
      this.modelObject.position.set?.(0, this.modelY, 0)
      this.modelYaw = 0
      this.lockModelTransform(true)
    }
    setARData('viewerARPlaced', 'false')
    setARData('viewerARModelVisible', 'false')
    this.setControlMode('idle')
    this.planeReady = false
    setARData('viewerARPlaneReady', 'false')
    setARData('viewerARReticleReady', 'false')
    setARData('viewerARPlacementMarkerVisible', 'false')
    this.setFlowState('scanning')
  }

  private detectBrandingSource() {
    const bodyText = document.body.innerText || ''
    const hasAppBrand = this.root.innerText.includes('8th Wall')
    const hasVisiblePowered = /powered\s+by\s+8th\s+wall/i.test(bodyText)
    const hasRuntimeLogo = Array.from(document.images).some((img) => /powered-by|8thwall/i.test(img.src))
    if (hasAppBrand) setARData('viewerARBrandingSource', 'app')
    else if (hasRuntimeLogo || hasVisiblePowered) setARData('viewerARBrandingSource', 'engine-binary')
    else setARData('viewerARBrandingSource', 'none')
  }

  private createOverlay() {
    const root = document.createElement('div')
    root.className = 'he-ar-overlay'
    root.innerHTML = `
      <div class="he-ar-touch-layer" data-touch-layer></div>
      <div class="he-ar-placement" data-placement-marker hidden>
        <div class="he-ar-grid">${Array.from({length: 77}).map(() => '<i></i>').join('')}</div>
        <button type="button" class="he-ar-reticle" aria-label="点击摆放点放置模型"><span></span></button>
      </div>
      <div class="he-ar-move" data-move-controls hidden>
        <button type="button" class="he-ar-control he-ar-front" data-control-action="front"><b>↑</b><span>前</span></button>
        <button type="button" class="he-ar-control he-ar-back" data-control-action="back"><b>↓</b><span>后</span></button>
        <button type="button" class="he-ar-control he-ar-left" data-control-action="left"><b>←</b><span>左</span></button>
        <button type="button" class="he-ar-control he-ar-right" data-control-action="right"><b>→</b><span>右</span></button>
      </div>
      <div class="he-ar-rotate" data-rotate-controls hidden>
        <span></span>
        <button type="button" class="he-ar-rot-left" data-control-action="rotate-left">↶</button>
        <button type="button" class="he-ar-rot-right" data-control-action="rotate-right">↷</button>
      </div>
      <div class="he-ar-status"><strong>AR 预览</strong><span data-ar-status>移动手机扫描地面或桌面</span></div>
      <button type="button" class="he-ar-exit" data-exit aria-label="退出 AR">×</button>
      <button type="button" class="he-ar-reset" data-reset aria-label="重置放置">↻</button>
      <style>
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; }
        .he-ar-overlay { --marker-x: 50%; --marker-y: 55%; position: fixed; inset: 0; z-index: 9999; color: #fff; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; pointer-events: none; touch-action: none; }
        .he-ar-touch-layer { position: fixed; inset: 0; z-index: 1; pointer-events: auto; touch-action: none; }
        .he-ar-placement { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
        .he-ar-grid { position: absolute; left: var(--marker-x); top: calc(var(--marker-y) + 7vh); width: min(92vw, 460px); display: grid; grid-template-columns: repeat(11, 1fr); gap: 14px 18px; transform: translate(-50%, -50%) perspective(360px) rotateX(58deg); opacity: .82; }
        .he-ar-grid i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 0 8px rgba(255,255,255,.35); }
        .he-ar-reticle { position: absolute; left: var(--marker-x); top: var(--marker-y); width: 86px; height: 86px; transform: translate(-50%, -50%) perspective(360px) rotateX(58deg); border: 4px solid rgba(92,247,255,.96); border-radius: 8px; background: rgba(5,10,14,.18); box-shadow: 0 0 20px rgba(92,247,255,.52); pointer-events: none; }
        .he-ar-reticle span { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; border-radius: 50%; background: #fff; transform: translate(-50%, -50%); }
        .he-ar-status { position: fixed; left: 50%; bottom: calc(28px + env(safe-area-inset-bottom, 0px)); z-index: 6; min-width: min(78vw, 360px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 18px; border: 1px solid rgba(255,255,255,.26); border-radius: 8px; background: rgba(8,12,18,.74); text-align: center; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
        .he-ar-status strong { font-size: 12px; opacity: .72; }
        .he-ar-status span { font-size: 16px; font-weight: 850; line-height: 1.35; }
        .he-ar-exit, .he-ar-reset { position: fixed; top: calc(18px + env(safe-area-inset-top, 0px)); z-index: 7; width: 58px; height: 58px; border: 1px solid rgba(255,255,255,.18); border-radius: 50%; background: rgba(5,7,11,.76); color: #fff; font-size: 34px; font-weight: 800; pointer-events: auto; -webkit-tap-highlight-color: transparent; }
        .he-ar-exit { left: 18px; }
        .he-ar-reset { right: 18px; }
        .he-ar-move, .he-ar-rotate { position: fixed; inset: 0; z-index: 4; pointer-events: none; }
        .he-ar-control { position: fixed; width: 78px; height: 58px; display: grid; grid-template-rows: 36px 14px; place-items: center; border: 0; background: transparent; color: #5cf7ff; text-shadow: 0 3px 12px rgba(0,0,0,.5); pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; }
        .he-ar-control b { font-size: 46px; line-height: 1; }
        .he-ar-control span { font-size: 12px; color: rgba(255,255,255,.82); font-weight: 900; }
        .he-ar-front { left: 50%; top: 36%; transform: translate(-50%, -50%); }
        .he-ar-back { left: 50%; top: 66%; transform: translate(-50%, -50%); }
        .he-ar-left { left: 23%; top: 55%; transform: translate(-50%, -50%); }
        .he-ar-right { left: 77%; top: 55%; transform: translate(-50%, -50%); }
        .he-ar-rotate > span { position: fixed; left: 50%; top: 52%; width: min(82vw, 390px); aspect-ratio: 1; transform: translate(-50%, -50%); border: 14px solid rgba(92,247,255,.86); border-top-color: transparent; border-bottom-color: transparent; border-radius: 50%; }
        .he-ar-rot-left, .he-ar-rot-right { position: fixed; top: 54%; width: 78px; height: 78px; border: 0; border-radius: 50%; background: rgba(5,7,11,.55); color: #5cf7ff; font-size: 46px; font-weight: 900; pointer-events: auto; touch-action: none; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .he-ar-rot-left { left: 18%; }
        .he-ar-rot-right { right: 18%; }
        .he-ar-control:active, .he-ar-rot-left:active, .he-ar-rot-right:active { background: rgba(92,247,255,.82); color: #061014; }
      </style>
    `
    document.body.appendChild(root)
    return root
  }
}

const bootController = () => {
  window.__heFurnitureARController?.destroy()
  window.__heFurnitureARController = new HEFurnitureARController()
  window.__heFurnitureARController.start()
}

window.addEventListener('ecsInit', bootController)

ecs.registerComponent({
  name: 'he-furniture-ar-controls',
  add: () => {
    if (!window.__heFurnitureARController) bootController()
  },
})
