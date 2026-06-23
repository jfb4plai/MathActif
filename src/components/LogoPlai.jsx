export default function LogoPlai({ size = 'md' }) {
  const sizes = { sm: 'h-8', md: 'h-12', lg: 'h-16' }
  return (
    <img
      src="/plai-logo.jpg"
      alt="PLAI — Pôle Liégeois d'Accompagnement vers une École Inclusive"
      className={`${sizes[size]} w-auto object-contain`}
    />
  )
}
