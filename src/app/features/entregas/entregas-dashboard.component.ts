import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { RemisionService } from '../../core/services/remision.service';
import { EstadoFiltroRemisiones, RemisionResumen, RemisionesPagina } from '../../core/models/remision.model';
import { PaginadorComponent } from '../../shared/paginador.component';
import { abrirPdfEnPestana, haceCuanto } from './entregas-utilidades';

const MS_ENTRE_CHEQUEOS = 60_000;

/**
 * Entregas (2026-11-12): Remisiones contabilizadas de World Office para Logística — imprimirlas y
 * confirmar la entrega con el soporte firmado. Mismo espíritu que el dashboard de Alistamiento.
 */
@Component({
  selector: 'app-entregas-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    PaginadorComponent
  ],
  templateUrl: './entregas-dashboard.component.html',
  styleUrl: './entregas-dashboard.component.scss'
})
export class EntregasDashboardComponent implements OnInit, OnDestroy {
  readonly estado = signal<EstadoFiltroRemisiones>('PorEntregar');
  readonly buscar = signal('');
  readonly pagina = signal(1);
  readonly datos = signal<RemisionesPagina | null>(null);
  readonly cargando = signal(false);
  readonly seleccion = signal<Set<number>>(new Set());
  readonly ahora = signal(Date.now());

  readonly puedeGestionar = computed(() => this.datos()?.puedeGestionar ?? false);
  readonly cantidadSeleccion = computed(() => this.seleccion().size);
  readonly seleccionables = computed(() => (this.datos()?.items ?? []).filter((r) => r.estado === 'PorEntregar'));
  readonly todasSeleccionadas = computed(() => {
    const s = this.seleccionables();
    return s.length > 0 && s.every((r) => this.seleccion().has(r.id));
  });

  private readonly busqueda$ = new Subject<void>();
  private subs = new Subscription();
  private intervalo?: ReturnType<typeof setInterval>;

  constructor(
    private readonly servicio: RemisionService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.subs.add(this.busqueda$.pipe(debounceTime(350)).subscribe(() => this.irA(1)));
    this.cargar();
    this.intervalo = setInterval(() => this.cargar(true), MS_ENTRE_CHEQUEOS);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.intervalo) clearInterval(this.intervalo);
  }

  cambiarEstado(estado: EstadoFiltroRemisiones): void {
    if (this.estado() === estado) return;
    this.estado.set(estado);
    this.seleccion.set(new Set());
    this.irA(1);
  }

  escribirBusqueda(texto: string): void {
    this.buscar.set(texto);
    this.busqueda$.next();
  }

  irA(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  /** silencioso = refresco automático: sin barra de progreso y sin perder la selección. */
  cargar(silencioso = false): void {
    if (!silencioso) this.cargando.set(true);
    this.servicio.listar(this.estado(), this.buscar(), this.pagina()).subscribe({
      next: (d) => {
        this.ahora.set(Date.now());
        this.datos.set(d);
        this.cargando.set(false);
        // La selección solo conserva lo que sigue visible y por entregar.
        const visibles = new Set(d.items.filter((r) => r.estado === 'PorEntregar').map((r) => r.id));
        this.seleccion.set(new Set([...this.seleccion()].filter((id) => visibles.has(id))));
      },
      error: () => this.cargando.set(false)
    });
  }

  alternar(r: RemisionResumen, marcado: boolean): void {
    const s = new Set(this.seleccion());
    if (marcado) s.add(r.id);
    else s.delete(r.id);
    this.seleccion.set(s);
  }

  alternarTodas(marcado: boolean): void {
    this.seleccion.set(marcado ? new Set(this.seleccionables().map((r) => r.id)) : new Set());
  }

  imprimir(ids: number[]): void {
    if (ids.length === 0) return;
    abrirPdfEnPestana(this.servicio.pdf(ids), this.snackBar);
  }

  imprimirSeleccion(): void {
    this.imprimir([...this.seleccion()]);
  }

  abrir(r: RemisionResumen): void {
    this.router.navigate(['/entregas', r.id]);
  }

  antiguedad(r: RemisionResumen): string {
    return haceCuanto(r.fecha, this.ahora(), true);
  }

  entregadaHace(r: RemisionResumen): string {
    return r.fechaEntrega ? haceCuanto(r.fechaEntrega, this.ahora()) : '';
  }

  /** Por entregar hace más de 2 días: se resalta. */
  atrasada(r: RemisionResumen): boolean {
    if (r.estado !== 'PorEntregar') return false;
    const dias = (this.ahora() - new Date(r.fecha.slice(0, 10) + 'T00:00:00').getTime()) / 86_400_000;
    return dias >= 3;
  }

  revisar(r: RemisionResumen): boolean {
    return r.estado === 'Entregada' && !!r.verificacionQR && r.verificacionQR !== 'Coincide';
  }
}
