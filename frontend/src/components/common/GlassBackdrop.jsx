export default function GlassBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-canvas transition-colors duration-200"
    >
      {/* Pearl Light Mesh Blobs */}
      <div
        className="dark:hidden absolute inset-0"
        style={{
          background: [
            'radial-gradient(68% 60% at 8% 12%, rgba(255, 217, 199, 0.90) 0%, rgba(255, 217, 199, 0) 68%)',
            'radial-gradient(62% 58% at 92% 16%, rgba(218, 211, 255, 0.85) 0%, rgba(218, 211, 255, 0) 68%)',
            'radial-gradient(68% 62% at 52% 94%, rgba(205, 239, 227, 0.88) 0%, rgba(205, 239, 227, 0) 70%)',
          ].join(', '),
        }}
      />

      {/* Onyx True-Black Subtle Glows */}
      <div
        className="hidden dark:block absolute inset-0"
        style={{
          background: [
            'radial-gradient(52% 48% at 10% 12%, rgba(45, 212, 191, 0.12) 0%, rgba(45, 212, 191, 0) 68%)',
            'radial-gradient(55% 52% at 90% 88%, rgba(56, 189, 248, 0.09) 0%, rgba(56, 189, 248, 0) 70%)',
            'radial-gradient(45% 42% at 62% 24%, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 70%)',
          ].join(', '),
        }}
      />

      {/* Subtle tactile grain overlay */}
      <div className="vanni-noise absolute inset-0" />
    </div>
  )
}
