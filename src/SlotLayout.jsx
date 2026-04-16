export default function SlotLayout({ slots }) {
  return (
    <div className="slot-layout">
      {slots.topBar && <div className="slot-top">{slots.topBar}</div>}
      <div className="slot-main">
        <div className="slot-viewport">{slots.viewport}</div>
        {slots.rightPanel && <div className="slot-right">{slots.rightPanel}</div>}
      </div>
      {slots.bottomBar && <div className="slot-bottom">{slots.bottomBar}</div>}
      {slots.floatingUI && <div className="slot-floating">{slots.floatingUI}</div>}
    </div>
  );
}
