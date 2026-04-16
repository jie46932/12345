import React, { useState } from 'react';

// inline 版本：无 fixed 定位，由 ControlBar 嵌入并缩放
const ViewSlider = ({ onViewChange }) => {
  const [activeView, setActiveView] = useState('front');

  const views = [
    { key: 'right', label: '右', angle: 19 },
    { key: 'back',  label: '后', angle: 91 },
    { key: 'left',  label: '左', angle: 163 },
    { key: 'front', label: '前', angle: 235 },
    { key: 'top',   label: '上', angle: 307 },
  ];

  const handleViewClick = (view) => {
    setActiveView(view.key);
    onViewChange?.(view.key);
  };

  const activeAngle = views.find(v => v.key === activeView)?.angle || 235;

  return (
    <div>
      <style>{`
        .view-knob-container {
          user-select: none;
          position: relative;
          width: 200px;
          height: 200px;
        }
        .knob-outer {
          position: relative;
          width: 190px;
          height: 190px;
          margin: 5px;
          border-radius: 100%;
          box-shadow: inset 0 3px 10px rgba(0,0,0,.6), 0 2px 20px rgba(255,255,255,1);
          background: radial-gradient(circle at center, #888888 0%, #333333 100%);
        }
        .knob-sector-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 50%;
          height: 70px;
          margin-top: -35px;
          transform-origin: 0% 50%;
          cursor: pointer;
          z-index: 2;
        }
        .knob-sector-btn span {
          position: absolute;
          top: 0;
          right: 0;
          width: 40px;
          height: 100%;
          font-weight: bold;
          font-size: 15px;
          line-height: 70px;
          text-align: center;
          color: #eee;
          text-shadow: 0 1px 0 #444;
        }
        .knob-center {
          position: absolute;
          left: 50%; top: 50%;
          z-index: 4;
          width: 120px; height: 120px;
          margin: -60px 0 0 -60px;
          border-radius: 100%;
          box-shadow: inset 0 2px 2px rgba(255,255,255,.4), 0 3px 13px rgba(0,0,0,.85);
          background: linear-gradient(to bottom, #f2f6f5 0%, #cbd5d6 100%);
          pointer-events: none;
        }
        .knob-center-inner {
          position: absolute;
          left: 50%; top: 50%;
          width: 100px; height: 100px;
          margin: -50px 0 0 -50px;
          border-radius: 100%;
          background: linear-gradient(to bottom, #cbd5d6 0%, #f2f6f5 100%);
        }
        .knob-center-core {
          position: absolute;
          left: 50%; top: 50%;
          width: 80px; height: 80px;
          margin: -40px 0 0 -40px;
          border-radius: 100%;
          box-shadow: inset 0 2px 3px rgba(255,255,255,.6), 0 8px 20px rgba(0,0,0,.9);
          background: linear-gradient(to bottom, #eef7f6 0%, #8d989a 100%);
        }
        .knob-light {
          z-index: 1;
          position: absolute;
          left: 50%; top: 50%;
          width: 50%; height: 100px;
          margin-top: -50px;
          transform-origin: 0% 50%;
          transition: transform 0.5s ease;
          pointer-events: none;
        }
        .knob-light span {
          opacity: 0.4;
          position: absolute;
          top: 0; left: 15px;
          width: 100px; height: 100px;
          background: radial-gradient(circle, rgba(139,99,72,1) 0%, rgba(139,99,72,0.42) 42%, rgba(139,99,72,0) 72%);
        }
        .knob-dot {
          z-index: 6;
          position: absolute;
          left: 50%; top: 50%;
          width: 50%; height: 12px;
          margin-top: -6px;
          transform-origin: 0% 50%;
          transition: transform 0.5s ease;
          pointer-events: none;
        }
        .knob-dot span {
          position: absolute;
          top: 0; left: 30px;
          width: 12px; height: 12px;
          border-radius: 100%;
          background: linear-gradient(to bottom, #dae2e4 0%, #ecf5f4 100%);
        }
        .knob-line {
          z-index: 1;
          position: absolute;
          left: 50%; top: 50%;
          width: 50%; height: 2px;
          margin-left: 0; margin-top: -1px;
          transform-origin: 0% 50%;
          border-top: 1px solid #3c3d3f;
          border-bottom: 1px solid #666769;
        }
      `}</style>

      <div className="view-knob-container">
        <div className="knob-outer">
          <hr className="knob-line" style={{ transform: 'rotate(-17deg)' }} />
          <hr className="knob-line" style={{ transform: 'rotate(55deg)' }} />
          <hr className="knob-line" style={{ transform: 'rotate(127deg)' }} />
          <hr className="knob-line" style={{ transform: 'rotate(199deg)' }} />
          <hr className="knob-line" style={{ transform: 'rotate(271deg)' }} />

          {views.map(view => (
            <div
              key={view.key}
              className="knob-sector-btn"
              style={{ transform: `rotate(${view.angle}deg)` }}
              onClick={() => handleViewClick(view)}
            >
              <span style={{ transform: `rotate(${-view.angle}deg)` }}>
                {view.label}
              </span>
            </div>
          ))}

          <div className="knob-light" style={{ transform: `rotate(${activeAngle}deg)` }}>
            <span />
          </div>
          <div className="knob-dot" style={{ transform: `rotate(${activeAngle}deg)` }}>
            <span style={{ transform: `rotate(${-activeAngle}deg)` }} />
          </div>
          <div className="knob-center">
            <div className="knob-center-inner">
              <div className="knob-center-core" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewSlider;
