export default function HeightTrack({ height }) {
  const percentage = ((height - 68) / (120 - 68)) * 100;

  return (
    <div className="height-track">
      <div className="height-fill" style={{ height: `${percentage}%` }}></div>
      <div className="height-thumb" style={{ bottom: `${percentage}%` }}></div>
    </div>
  );
}
