import { Coffee } from 'lucide-react';

export function BuyMeACoffeeButton({
  slug = 'semi.column',
  className = '',
}) {
  return (
    <a
      href={`https://buymeacoffee.com/${slug}`}
      target="_blank"
      rel="noreferrer"
      className={`bmc-native-button ${className}`.trim()}
      aria-label="Buy me a coffee"
    >
      <div className="bmc-button-content">
        <Coffee className="bmc-icon" size={20} fill="currentColor" />
        <span>Buy me a coffee</span>
      </div>
    </a>
  );
}
