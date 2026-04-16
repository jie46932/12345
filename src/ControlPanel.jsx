import { useState, useEffect } from 'react';

export default function ControlPanel({ app }) {
  const [height, setHeight] = useState(94);
  const [material, setMaterial] = useState('light');

  useEffect(() => {
    if (!app || !app.scene) return;
    const table = app.scene.getObjectByName('Table');
    if (table) {
      const normalized = (height - 68) / 52;
      table.position.y = 0.68 + normalized * 0.52;
    }
  }, [app, height]);

  const changeMaterial = (mat) => {
    setMaterial(mat);
    if (!app || !app.scene) return;
    const desktop = app.scene.getObjectByName('Desktop');
    if (desktop?.material) {
      const colors = { light: 0xD4A574, oak: 0xC19A6B, dark: 0x5D4E37 };
      desktop.material.color.setHex(colors[mat]);
    }
  };

  return (
    <aside className="control-panel">
      <div className="height-control">
        <button onClick={() => setHeight(h => Math.max(68, h - 1))}>-</button>
        <span>高度: {height}cm</span>
        <button onClick={() => setHeight(h => Math.min(120, h + 1))}>+</button>
      </div>
      <div className="material-control">
        <button onClick={() => changeMaterial('light')} className={material === 'light' ? 'active' : ''}>浅胡桃木</button>
        <button onClick={() => changeMaterial('oak')} className={material === 'oak' ? 'active' : ''}>原木白橡</button>
        <button onClick={() => changeMaterial('dark')} className={material === 'dark' ? 'active' : ''}>黑胡桃木</button>
      </div>
    </aside>
  );
}
