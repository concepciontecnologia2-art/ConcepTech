// Pantalla temporal para los módulos que todavía están en desarrollo
export default function Proximamente({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{titulo}</h1>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 13, padding: "22px 20px" }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#d97706", background: "rgba(245,158,11,.12)", borderRadius: 6, padding: "3px 9px", marginBottom: 10 }}>
          EN DESARROLLO
        </span>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>{descripcion}</p>
      </div>
    </div>
  );
}