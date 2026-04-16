import React from 'react';

const ViewCube = ({ onViewChange }) => {
  const buttonBaseClass = "w-24 h-24 bg-[#8B6348] rounded-xl flex items-center justify-center text-white text-5xl font-bold cursor-pointer hover:bg-[#6B4838] transition-colors shadow-lg";

  const views = [
    { name: '后', key: 'back', pos: 'col-start-2 row-start-1' },
    { name: '左', key: 'left', pos: 'col-start-1 row-start-2' },
    { name: '上', key: 'top', pos: 'col-start-2 row-start-2' },
    { name: '右', key: 'right', pos: 'col-start-3 row-start-2' },
    { name: '前', key: 'front', pos: 'col-start-2 row-start-3' },
  ];

  return (
    <div className="fixed top-8 right-8 w-80 h-80 grid grid-cols-3 grid-rows-3 gap-6 p-4 z-50">
      {views.map(view => (
        <button
          key={view.key}
          id={`btn-view-${view.key}`}
          className={`${buttonBaseClass} ${view.pos}`}
          onClick={() => onViewChange(view.key)}
        >
          {view.name}
        </button>
      ))}
    </div>
  );
};

export default ViewCube;
