export default function ViewSwitcher() {
  return (
    <div className="view-switcher">
      <button className="view-switch-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 8l4-4v8l-4-4z"/>
        </svg>
        左侧视角
      </button>
      <div className="view-sep"></div>
      <button className="view-switch-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 8l-4-4v8l4-4z"/>
        </svg>
        右侧视角
      </button>
      <div className="view-sep"></div>
      <button className="view-switch-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2L4 6h8l-4-4z"/>
        </svg>
        俯视视角
      </button>
    </div>
  );
}
