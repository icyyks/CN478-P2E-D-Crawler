export default function GameOverModal({ lostCount, floorReached, penaltyHP, onReturnLobby }) {
  return (
    <div className="gameover-modal">
      <h2 style={{ color: '#ff5252', marginTop: 0 }}>💀 YOU DIED — คุณตายแล้ว! 💀</h2>
      <p style={{ fontSize: '16px', margin: '12px 0' }}>
        คุณดึงดันสู้ต่อจนเลือดหมดที่ <strong>ชั้น {floorReached}</strong>
      </p>
      <div className="gameover-box">
        <p style={{ margin: '6px 0', color: '#ff8a80' }}>
          🗑️ ของทั้งหมดที่ได้มาในรอบนี้หายเกลี้ยง ({lostCount} ชิ้น)
        </p>
        <p style={{ margin: '6px 0', color: '#ffd54f' }}>
          ⚠️ บทลงโทษ: รอบหน้าเริ่มต้นด้วย HP {penaltyHP} / 100
        </p>
      </div>

      <button
        className="action-btn"
        style={{ backgroundColor: '#555', marginTop: '20px' }}
        onClick={onReturnLobby}
      >
        🏃 กลับ Lobby
      </button>
    </div>
  );
}