import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

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
        path: 'documentos/:id',
        loadComponent: () => import('./features/documentos/documento-detalle.component').then((m) => m.DocumentoDetalleComponent)
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
        path: 'admin/flujos',
        loadComponent: () => import('./features/admin/flujos/flujos-list.component').then((m) => m.FlujosListComponent),
        canActivate: [adminGuard]
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
