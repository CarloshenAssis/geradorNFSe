export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="8" fill="#2563eb" />
        <path
          d="M8 7.5C8 6.67157 8.67157 6 9.5 6H15.5L20 10.5V20.5C20 21.3284 19.3284 22 18.5 22H9.5C8.67157 22 8 21.3284 8 20.5V7.5Z"
          fill="white"
          fillOpacity="0.95"
        />
        <path d="M15.5 6L20 10.5H16.5C15.9477 10.5 15.5 10.0523 15.5 9.5V6Z" fill="#bfdbfe" />
        <rect x="10" y="13" width="8" height="1.4" rx="0.7" fill="#2563eb" />
        <rect x="10" y="16" width="8" height="1.4" rx="0.7" fill="#2563eb" />
        <rect x="10" y="19" width="5" height="1.4" rx="0.7" fill="#2563eb" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-slate-900">
        Nota<span className="text-brand-600">Flow</span>
      </span>
    </div>
  );
}
