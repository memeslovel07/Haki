export default function HakiLogo({ className = "h-9 w-9", alt = "HAKI logo" }) {
  return <img src="/logo.svg" alt={alt} className={`inline-block shrink-0 object-contain ${className}`} />;
}
