export default function Login({ onConnect }) {
  return (
    <div className="container login-screen">
      <h1>⚔️ Web3 Dungeon Crawler</h1>
      <p>กรุณาเชื่อมต่อกระเป๋าเพื่อเข้าสู่เกม</p>
      <button className="connect-btn" onClick={onConnect}>🦊 Connect MetaMask</button>
    </div>
  );
}