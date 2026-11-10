import Icono from './Icono';

/** Marco compartido por Login y Registro: panel de marca + formulario. */
export default function Acceso({ children }) {
  return (
    <div className="acceso">
      <section className="acceso-arte">
        <div className="marca">
          <span className="marca-logo"><Icono n="salon" size={20} /></span>
          <span><b>ERP Gastronómico</b></span>
        </div>
        <div>
          <h1>Tu restaurante, bajo control desde un solo lugar.</h1>
          <p>Personal, menú, inventario, comandas y caja para restaurantes, fondas y comederos. Cada negocio opera con sus datos aislados.</p>
        </div>
        <ul className="acceso-puntos">
          <li><span><Icono n="ticket" /></span> Comandas del salón a la cocina y a la caja, en tiempo real</li>
          <li><span><Icono n="inventario" /></span> El inventario se descuenta solo con cada platillo vendido</li>
          <li><span><Icono n="panel" /></span> Ventas del día, ticket promedio y platillos más vendidos</li>
        </ul>
      </section>
      <section className="acceso-form">{children}</section>
    </div>
  );
}
