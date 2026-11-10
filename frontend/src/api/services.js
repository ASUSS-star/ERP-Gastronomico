/** Funciones por módulo: los componentes nunca escriben URLs a mano. */
import api from './client';

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

export const comandasApi = {
  listar: (params) => api.get('/comandas', { params }),
  crear: (payload) => api.post('/comandas', payload),
  cambiarEstado: (id, estado, metodoPago) => api.patch(`/comandas/${id}/estado`, { estado, metodoPago }),
};

export const reportesApi = {
  resumen: (params) => api.get('/reportes/resumen', { params }),
};
