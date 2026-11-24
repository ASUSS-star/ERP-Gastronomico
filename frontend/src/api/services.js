/** Funciones por módulo: los componentes nunca escriben URLs a mano. */
import api from './client';
import { mutar, nuevoId } from '../offline/cola';

/** CRUD genérico para recursos REST simples. */
const crud = (base) => ({
  listar: (params) => api.get(base, { params }),
  obtener: (id) => api.get(`${base}/${id}`),
  crear: (payload) => api.post(base, payload),
  actualizar: (id, payload) => api.put(`${base}/${id}`, payload),
  eliminar: (id) => api.delete(`${base}/${id}`),
});

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registro: (payload) => api.post('/auth/registro', payload),
  perfil: () => api.get('/auth/perfil'),
  cambiarPassword: (payload) => api.patch('/auth/password', payload),
};

export const usuariosApi = crud('/usuarios');
export const mesasApi = crud('/mesas');
export const categoriasApi = crud('/categorias');
export const proveedoresApi = crud('/proveedores');

export const platillosApi = {
  ...crud('/platillos'),
  definirReceta: (id, insumos) => api.put(`/platillos/${id}/receta`, { insumos }),
};

export const insumosApi = {
  ...crud('/insumos'),
  alertas: () => api.get('/insumos/alertas/stock-bajo'),
  movimientos: (id, params) => api.get(`/insumos/${id}/movimientos`, { params }),
  registrarMovimiento: (id, payload) => api.post(`/insumos/${id}/movimientos`, payload),
};

// Crear, cambiar estado y cobrar funcionan sin internet: se encolan y se envían al reconectar.
// Si quedan en cola, la respuesta es { pendiente: true, data: null }.
export const comandasApi = {
  listar: (params) => api.get('/comandas', { params }),
  crear: (payload, descripcion = 'Nueva comanda') =>
    mutar({ metodo: 'post', url: '/comandas', data: { clienteId: nuevoId(), ...payload }, descripcion }),
  cambiarEstado: (id, estado, descripcion = `Comanda → ${estado}`) =>
    mutar({ metodo: 'patch', url: `/comandas/${id}/estado`, data: { estado }, descripcion }),
  /** pagos: [{ metodo, monto, recibido? }]. Si no cubren el saldo queda como pago parcial. */
  pagar: (id, pagos, descripcion = 'Cobro') =>
    mutar({ metodo: 'post', url: `/comandas/${id}/pagos`, data: { clienteId: nuevoId(), pagos }, descripcion }),
};

export const reportesApi = {
  resumen: (params) => api.get('/reportes/resumen', { params }),
  corte: (params) => api.get('/reportes/corte', { params }),
};
