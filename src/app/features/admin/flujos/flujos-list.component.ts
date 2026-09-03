import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TipoDocumentoService } from '../../../core/services/tipo-documento.service';
import { FlujoService } from '../../../core/services/flujo.service';
import { RolService } from '../../../core/services/rol.service';
import { TipoDocumento } from '../../../core/models/tipo-documento.model';
import { DefinicionFlujo } from '../../../core/models/flujo.model';
import { Rol } from '../../../core/models/rol.model';
import { FlujoFormDialogComponent } from './flujo-form-dialog.component';

@Component({
  selector: 'app-flujos-list',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatProgressBarModule
  ],
  templateUrl: './flujos-list.component.html',
  styleUrl: '../roles/roles-list.component.scss'
})
export class FlujosListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tipoDocumentoService = inject(TipoDocumentoService);
  private readonly flujoService = inject(FlujoService);
  private readonly rolService = inject(RolService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = ['orden', 'nombre', 'roles', 'devolver', 'rechazar'];
  readonly tipos = signal<TipoDocumento[]>([]);
  readonly roles = signal<Rol[]>([]);
  readonly flujos = signal<DefinicionFlujo[]>([]);
  readonly cargando = signal(false);
  tipoDocumentoId: number | null = null;

  get flujoActivo(): DefinicionFlujo | null {
    return this.flujos().find((f) => f.activo) ?? null;
  }

  ngOnInit(): void {
    this.rolService.listar().subscribe((roles) => this.roles.set(roles));
    this.tipoDocumentoService.listar().subscribe((tipos) => {
      this.tipos.set(tipos);
      const desdeQuery = Number(this.route.snapshot.queryParamMap.get('tipoDocumentoId'));
      this.tipoDocumentoId = desdeQuery || tipos[0]?.id || null;
      if (this.tipoDocumentoId) this.cargar();
    });
  }

  cambiarTipo(): void {
    this.cargar();
  }

  cargar(): void {
    if (!this.tipoDocumentoId) return;
    this.cargando.set(true);
    this.flujoService.listarPorTipoDocumento(this.tipoDocumentoId).subscribe({
      next: (flujos) => {
        this.flujos.set(flujos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  nombreRol(rolId: number): string {
    return this.roles().find((r) => r.id === rolId)?.nombre ?? '?';
  }

  abrirNuevoFlujo(): void {
    if (!this.tipoDocumentoId) return;

    const flujoActivo = this.flujoActivo;
    const dialogRef = this.dialog.open(FlujoFormDialogComponent, {
      width: '46rem',
      data: { tipoDocumentoId: this.tipoDocumentoId, roles: this.roles(), flujoActivo }
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.flujoService.crear(resultado).subscribe({
        next: () => {
          this.snackBar.open(flujoActivo ? 'Flujo actualizado' : 'Flujo creado y activado', 'Cerrar', { duration: 3000 });
          this.cargar();
        },
        error: (error) => {
          const mensaje = error?.error?.mensaje ?? 'No se pudo crear el flujo.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
