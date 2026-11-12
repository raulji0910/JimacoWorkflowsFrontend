import { Routes } from '@angular/router';
import { authGuard, adminGuard, puedeDevolverCualquierDocumentoGuard, puedeVerAlistamientoGuard, puedeVerCuentasPorPagarGuard, puedePagarCuentasGuard, puedeVerEntregasGuard } from './core/guards/auth.guard';
import { cambiosSinGuardarGuard } from './core/guards/cambios-sin-guardar.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    // Fuera del authGuard a propósito: se accede desde el link del correo de notificación, sin
    // sesión iniciada — la autorización la da el token de la URL, no el login normal.
    path: 'accion-correo/:id',
    loadComponent: () => import('./features/accion-correo/accion-correo.component').then((m) => m.AccionCorreoComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'pendientes', pathMatch: 'full' },
      {
        path: 'pendientes',
        loadComponent: () => import('./features/documentos/pendientes-list.component').then((m) => m.PendientesListComponent)
      },
      {
        path: 'documentos/nuevo',
        loadComponent: () => import('./features/documentos/documento-nuevo.component').then((m) => m.DocumentoNuevoComponent)
      },
      {
        path: 'documentos/mios',
        loadComponent: () =>
          import('./features/documentos/mis-documentos-list.component').then((m) => m.MisDocumentosListComponent)
      },
      {
        path: 'documentos/buscar',
        loadComponent: () => import('./features/documentos/buscar-documento.component').then((m) => m.BuscarDocumentoComponent),
        canActivate: [puedeDevolverCualquierDocumentoGuard]
      },
      {
        path: 'documentos/:id',
        loadComponent: () => import('./features/documentos/documento-detalle.component').then((m) => m.DocumentoDetalleComponent)
      },
      {
        path: 'alistamiento',
        loadComponent: () =>
          import('./features/alistamiento/alistamiento-dashboard.component').then((m) => m.AlistamientoDashboardComponent),
        canActivate: [puedeVerAlistamientoGuard]
      },
      {
        path: 'alistamiento/:id',
        loadComponent: () =>
          import('./features/alistamiento/hoja-alistamiento-detalle.component').then((m) => m.HojaAlistamientoDetalleComponent),
        canActivate: [puedeVerAlistamientoGuard],
        canDeactivate: [cambiosSinGuardarGuard]
      },
      {
        path: 'cuentas-por-pagar',
        loadComponent: () =>
          import('./features/cuentas-por-pagar/cuentas-por-pagar.component').then((m) => m.CuentasPorPagarComponent),
        canActivate: [puedeVerCuentasPorPagarGuard]
      },
      {
        // Antes que ':identificacion' — si no, "relacion" se tomaría como un NIT.
        path: 'cuentas-por-pagar/relacion',
        loadComponent: () =>
          import('./features/cuentas-por-pagar/relacion-pagos.component').then((m) => m.RelacionPagosComponent),
        canActivate: [puedeVerCuentasPorPagarGuard]
      },
      {
        path: 'cuentas-por-pagar/seguimiento',
        loadComponent: () =>
          import('./features/cuentas-por-pagar/seguimiento-pagos.component').then((m) => m.SeguimientoPagosComponent),
        canActivate: [puedeVerCuentasPorPagarGuard]
      },
      {
        path: 'pagos',
        loadComponent: () => import('./features/pagos/pagos.component').then((m) => m.PagosComponent),
        canActivate: [puedePagarCuentasGuard]
      },
      {
        path: 'cuentas-por-pagar/:identificacion',
        loadComponent: () =>
          import('./features/cuentas-por-pagar/proveedor-cuentas-por-pagar.component').then((m) => m.ProveedorCuentasPorPagarComponent),
        canActivate: [puedeVerCuentasPorPagarGuard]
      },
      {
        path: 'entregas',
        loadComponent: () => import('./features/entregas/entregas-dashboard.component').then((m) => m.EntregasDashboardComponent),
        canActivate: [puedeVerEntregasGuard]
      },
      {
        path: 'entregas/:id',
        loadComponent: () => import('./features/entregas/remision-detalle.component').then((m) => m.RemisionDetalleComponent),
        canActivate: [puedeVerEntregasGuard]
      },
      {
        path: 'admin/roles',
        loadComponent: () => import('./features/admin/roles/roles-list.component').then((m) => m.RolesListComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/usuarios',
        loadComponent: () => import('./features/admin/usuarios/usuarios-list.component').then((m) => m.UsuariosListComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/tipos-documento',
        loadComponent: () =>
          import('./features/admin/tipos-documento/tipos-documento-list.component').then((m) => m.TiposDocumentoListComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/cuentas-por-pagar',
        loadComponent: () =>
          import('./features/admin/configuracion-cuentas-por-pagar/configuracion-cuentas-por-pagar.component').then(
            (m) => m.ConfiguracionCuentasPorPagarComponent
          ),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/entregas',
        loadComponent: () =>
          import('./features/admin/configuracion-entregas/configuracion-entregas.component').then(
            (m) => m.ConfiguracionEntregasComponent
          ),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/flujos',
        loadComponent: () => import('./features/admin/flujos/flujos-list.component').then((m) => m.FlujosListComponent),
        canActivate: [adminGuard]
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
