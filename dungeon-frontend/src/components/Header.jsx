export default function Header({ wallet }) {
  return (
    <div className="header">
      <h2>⚔️ D-Crawler</h2>
      <div className="wallet-badge">
        🟢 {wallet.substring(0, 6)}...{wallet.substring(38)}
      </div>
    </div>
  );
}