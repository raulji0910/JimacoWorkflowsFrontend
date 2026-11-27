import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CajaService } from '../../core/services/caja.service';
import {
  Beneficiario,
  CajaResumen,
  ConceptoCaja,
  ETIQUETA_ESTADO_GIRO,
  ETIQUETA_MOVIMIENTO,
  Giro,
  OrdenCompraPendientePago
} from '../../core/models/caja.model';

function mensaje(e: HttpErrorResponse, porDefecto: string): string {
  return e.error?.mensaje ?? porDefecto;
}

/** Abre un PDF/archivo en otra pestaña; la pestaña se abre dentro del clic (Safari bloquea window.open después de una espera). */
export function abrirEnPestana(peticion: import('rxjs').Observable<Blob>, alFallar: () => void): void {
  const ventana = window.open('', '_blank');
  peticion.subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    },
    error: () => {
      ventana?.close();
      alFallar();
    }
  });
}

// =====================================================================================
// Nuevo giro
// =====================================================================================

export interface NuevoGiroData {
  caja: CajaResumen;
  conceptos: ConceptoCaja[];
}

@Component({
  selector: 'app-nuevo-giro-dialog',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatCheckboxModule, MatAutocompleteModule, MatButtonToggleModule],
  template: `
    <h2 mat-dialog-title>Nuevo giro — {{ data.caja.nombre }}</h2>
    <mat-dialog-content class="dlg">
      <p class="dlg__disponible">
        Efectivo disponible: <strong>{{ data.caja.saldoActual | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
      </p>

      <!-- Persona -->
      @if (!creandoPersona()) {
        <div class="dlg__fila">
          <mat-form-field appearance="outline" class="dlg__crece" subscriptSizing="dynamic">
            <mat-label>Persona que recibe (nombre o cédula)</mat-label>
            <input matInput [ngModel]="textoPersona" (ngModelChange)="buscarPersona($event)" [matAutocomplete]="auto" name="persona" />
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="nombrePersona" (optionSelected)="elegirPersona($event.option.value)">
              @for (p of personas(); track p.id) {
                <mat-option [value]="p" [disabled]="!p.activo">
                  {{ p.nombre }} <span class="dlg__tenue">· C.C. {{ p.cedula }}{{ p.activo ? '' : ' · inactivo' }}</span>
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="nuevaPersona()"><mat-icon>person_add</mat-icon> Nueva persona</button>
        </div>
        @if (persona(); as p) {
          <p class="dlg__elegido"><mat-icon>check_circle</mat-icon> {{ p.nombre }} · C.C. {{ p.cedula }}{{ p.telefono ? ' · ' + p.telefono : '' }}</p>
        }
      } @else {
        <fieldset class="dlg__persona">
          <legend>Nueva persona</legend>
          <div class="dlg__fila">
            <mat-form-field appearance="outline" class="dlg__crece" subscriptSizing="dynamic">
              <mat-label>Nombre completo</mat-label>
              <input matInput [(ngModel)]="nuevo.nombre" name="nNombre" required />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Cédula</mat-label>
              <input matInput [(ngModel)]="nuevo.cedula" name="nCedula" inputmode="numeric" required />
            </mat-form-field>
          </div>
          <div class="dlg__fila">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Teléfono (opcional)</mat-label>
              <input matInput [(ngModel)]="nuevo.telefono" name="nTelefono" inputmode="tel" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="dlg__crece" subscriptSizing="dynamic">
              <mat-label>Correo (opcional)</mat-label>
              <input matInput [(ngModel)]="nuevo.correo" name="nCorreo" type="email" />
            </mat-form-field>
          </div>
          <mat-button-toggle-group [(ngModel)]="nuevo.esInterno" name="nInterno" aria-label="Interno o externo">
            <mat-button-toggle [value]="true">Interno</mat-button-toggle>
            <mat-button-toggle [value]="false">Externo</mat-button-toggle>
          </mat-button-toggle-group>
          <div class="dlg__acciones-persona">
            <button mat-button type="button" (click)="creandoPersona.set(false)">Cancelar</button>
            <button mat-flat-button type="button" (click)="guardarPersona()" [disabled]="ocupado()">Guardar persona</button>
          </div>
        </fieldset>
      }

      <!-- Concepto -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Concepto</mat-label>
        <mat-select [(ngModel)]="conceptoId" name="concepto">
          @for (c of conceptosActivos; track c.id) {
            <mat-option [value]="c.id">{{ c.nombre }}</mat-option>
          }
        </mat-select>
        @if (conceptosActivos.length === 0) {
          <mat-hint>No hay conceptos: el administrador de la caja debe crearlos.</mat-hint>
        }
      </mat-form-field>

      <!-- OC de contado -->
      @if (ordenes().length > 0) {
        <div class="dlg__oc">
          <p class="dlg__subtitulo">OC de contado esperando pago en efectivo (opcional)</p>
          @for (o of ordenes(); track o.instanciaDocumentoId) {
            <mat-checkbox [checked]="elegidas().has(o.instanciaDocumentoId)" (change)="alternarOc(o)">
              OC {{ o.numeroReferencia }} · {{ o.proveedor }} · <strong>{{ o.valor | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
            </mat-checkbox>
          }
          @if (totalOc() > 0) {
            <p class="dlg__tenue">Las OC elegidas suman {{ totalOc() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}.
              Lo que se entregue de más queda como vuelta pendiente.</p>
          }
        </div>
      }

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Valor entregado</mat-label>
        <span matTextPrefix>$&nbsp;</span>
        <input matInput type="number" min="1" step="1" [(ngModel)]="valor" name="valor" />
        @if (valor && totalOc() > 0 && valor > totalOc()) {
          <mat-hint>Vuelta esperada: {{ valor - totalOc() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</mat-hint>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Nota (opcional)</mat-label>
        <textarea matInput rows="2" [(ngModel)]="nota" name="nota" maxlength="500"></textarea>
      </mat-form-field>

      @if (error()) {
        <p class="dlg__error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="girar()" [disabled]="ocupado() || !persona() || !conceptoId || !valor">Registrar giro</button>
    </mat-dialog-actions>
  `,
  styleUrl: './caja-dialogos.scss'
})
export class NuevoGiroDialogComponent implements OnInit {
  readonly data = inject<NuevoGiroData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NuevoGiroDialogComponent, Giro>);
  private readonly servicio = inject(CajaService);
  private readonly busqueda$ = new Subject<string>();

  readonly conceptosActivos = this.data.conceptos.filter((c) => c.activo);
  readonly personas = signal<Beneficiario[]>([]);
  readonly persona = signal<Beneficiario | null>(null);
  readonly creandoPersona = signal(false);
  readonly ordenes = signal<OrdenCompraPendientePago[]>([]);
  readonly elegidas = signal(new Set<number>());
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalOc = computed(() =>
    this.ordenes().filter((o) => this.elegidas().has(o.instanciaDocumentoId)).reduce((s, o) => s + o.valor, 0)
  );

  textoPersona = '';
  conceptoId: number | null = this.conceptosActivos.length === 1 ? this.conceptosActivos[0].id : null;
  valor: number | null = null;
  nota = '';
  nuevo = { nombre: '', cedula: '', telefono: '', correo: '', esInterno: true as boolean | null };

  constructor() {
    this.busqueda$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((t) => this.servicio.buscarBeneficiarios(t).pipe(catchError(() => of([] as Beneficiario[])))),
        takeUntilDestroyed()
      )
      .subscribe((lista) => this.personas.set(lista));
  }

  ngOnInit(): void {
    this.busqueda$.next('');
    this.servicio.ordenesPendientes(this.data.caja.id).subscribe({ next: (o) => this.ordenes.set(o) });
  }

  nombrePersona = (p: Beneficiario | string | null): string => (typeof p === 'string' ? p : (p?.nombre ?? ''));

  buscarPersona(texto: unknown): void {
    // Al elegir una opción llega el objeto, no texto (ver el mismo caso en el editor de cotizaciones).
    if (typeof texto !== 'string') return;
    this.textoPersona = texto;
    this.persona.set(null);
    this.busqueda$.next(texto.trim());
  }

  elegirPersona(p: Beneficiario): void {
    this.persona.set(p);
  }

  nuevaPersona(): void {
    const texto = this.textoPersona.trim();
    this.nuevo = { nombre: /^\d+$/.test(texto) ? '' : texto, cedula: /^\d+$/.test(texto) ? texto : '', telefono: '', correo: '', esInterno: true };
    this.creandoPersona.set(true);
  }

  guardarPersona(): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio
      .crearBeneficiario({
        nombre: this.nuevo.nombre,
        cedula: this.nuevo.cedula,
        telefono: this.nuevo.telefono || null,
        correo: this.nuevo.correo || null,
        esInterno: this.nuevo.esInterno
      })
      .subscribe({
        next: (p) => {
          this.ocupado.set(false);
          this.persona.set(p);
          this.textoPersona = p.nombre;
          this.creandoPersona.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.ocupado.set(false);
          this.error.set(mensaje(e, 'No se pudo guardar la persona.'));
        }
      });
  }

  alternarOc(o: OrdenCompraPendientePago): void {
    const elegidas = new Set(this.elegidas());
    if (elegidas.has(o.instanciaDocumentoId)) elegidas.delete(o.instanciaDocumentoId);
    else elegidas.add(o.instanciaDocumentoId);
    this.elegidas.set(elegidas);
    // Propone el valor de las OC si todavía no se escribió uno mayor.
    if (!this.valor || this.valor < this.totalOc()) this.valor = this.totalOc() || null;
  }

  girar(): void {
    const persona = this.persona();
    if (!persona || !this.conceptoId || !this.valor) return;
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio
      .crearGiro(this.data.caja.id, {
        beneficiarioId: persona.id,
        conceptoId: this.conceptoId,
        valorEntregado: this.valor,
        nota: this.nota.trim() || null,
        ordenesCompraIds: [...this.elegidas()]
      })
      .subscribe({
        next: (giro) => this.ref.close(giro),
        error: (e: HttpErrorResponse) => {
          this.ocupado.set(false);
          this.error.set(mensaje(e, 'No se pudo registrar el giro.'));
        }
      });
  }
}

// =====================================================================================
// Captura de un valor (recarga, legalización, vuelta, arqueo) o un motivo (anulación)
// =====================================================================================

export interface ValorDialogData {
  titulo: string;
  descripcion?: string;
  /** Sin etiqueta = no pide valor (solo nota/motivo, ej. anular). */
  etiquetaValor?: string;
  valorInicial?: number | null;
  /** Sin etiqueta = no pide nota. */
  etiquetaNota?: string;
  notaObligatoria?: boolean;
  archivoObligatorio?: boolean;
  textoBoton: string;
  /** Permite adjuntar una foto/PDF de soporte (legalización). */
  permiteArchivo?: boolean;
  peligro?: boolean;
}

export interface ValorDialogResultado {
  valor: number | null;
  nota: string | null;
  archivo: File | null;
}

@Component({
  selector: 'app-valor-caja-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content class="dlg">
      @if (data.descripcion) {
        <p class="dlg__tenue">{{ data.descripcion }}</p>
      }
      @if (data.etiquetaValor) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ data.etiquetaValor }}</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0" step="1" [(ngModel)]="valor" name="valor" cdkFocusInitial />
        </mat-form-field>
      }
      @if (data.etiquetaNota) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ data.etiquetaNota }}</mat-label>
          <textarea matInput rows="2" [(ngModel)]="nota" name="nota" maxlength="500"></textarea>
        </mat-form-field>
      }
      @if (data.permiteArchivo) {
        <div class="dlg__archivo">
          <button mat-stroked-button type="button" (click)="selector.click()">
            <mat-icon>photo_camera</mat-icon> Foto del soporte{{ data.archivoObligatorio ? '' : ' (opcional)' }}
          </button>
          <span class="dlg__tenue">{{ archivo?.name ?? 'Factura o recibo' }}</span>
          <input #selector type="file" accept="image/*,application/pdf" hidden (change)="elegirArchivo($event)" />
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button [class.dlg__peligro]="data.peligro" (click)="aceptar()" [disabled]="!valido()">{{ data.textoBoton }}</button>
    </mat-dialog-actions>
  `,
  styleUrl: './caja-dialogos.scss'
})
export class ValorCajaDialogComponent {
  readonly data = inject<ValorDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ValorCajaDialogComponent, ValorDialogResultado>);

  valor: number | null = this.data.valorInicial ?? null;
  nota = '';
  archivo: File | null = null;

  valido(): boolean {
    if (this.data.etiquetaValor && (this.valor === null || this.valor < 0)) return false;
    if (this.data.notaObligatoria && !this.nota.trim()) return false;
    if (this.data.archivoObligatorio && !this.archivo) return false;
    return true;
  }

  elegirArchivo(evento: Event): void {
    this.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
  }

  aceptar(): void {
    if (!this.valido()) return;
    this.ref.close({ valor: this.data.etiquetaValor ? this.valor : null, nota: this.nota.trim() || null, archivo: this.archivo });
  }
}

// =====================================================================================
// Detalle de un giro
// =====================================================================================

export interface GiroDetalleData {
  cajaId: number;
  giroId: number;
  esAdministrador: boolean;
}

export type AccionGiro = 'legalizar' | 'vuelta' | 'anular' | 'soporte';

@Component({
  selector: 'app-giro-detalle-dialog',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    @if (giro(); as g) {
      <h2 mat-dialog-title>Giro #{{ g.numero }} <span class="estado" [class]="'estado estado--' + g.estado">{{ estados[g.estado] }}</span></h2>
      <mat-dialog-content class="dlg">
        <dl class="dlg__datos">
          <dt>Entregado a</dt><dd>{{ g.beneficiario.nombre }} · C.C. {{ g.beneficiario.cedula }}</dd>
          <dt>Concepto</dt><dd>{{ g.concepto.nombre }}</dd>
          <dt>Valor entregado</dt><dd><strong>{{ g.valorEntregado | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong></dd>
          <dt>Girado</dt><dd>{{ g.fecha | date: 'dd/MM/yyyy hh:mm a' }} por {{ g.giradoPor }}</dd>
          @if (g.nota) { <dt>Nota</dt><dd>{{ g.nota }}</dd> }
          @if (g.ordenesCompra.length) {
            <dt>Paga las OC</dt>
            <dd>
              @for (o of g.ordenesCompra; track o.instanciaDocumentoId) {
                <div>OC {{ o.numeroReferencia }} · {{ o.proveedor }} · {{ o.valor | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                  <span class="dlg__tenue">({{ o.pasoActual ?? 'aprobada' }})</span></div>
              }
            </dd>
          }
          @if (g.valorLegalizado !== null) {
            <dt>Gastado</dt><dd>{{ g.valorLegalizado | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              <span class="dlg__tenue">· {{ g.fechaLegalizacion | date: 'dd/MM/yyyy hh:mm a' }} por {{ g.legalizadoPor }}</span></dd>
            @if (g.notaLegalizacion) { <dt>Legalización</dt><dd>{{ g.notaLegalizacion }}</dd> }
          }
          @if (g.vueltaPendiente > 0) {
            <dt>Vuelta pendiente</dt><dd class="dlg__alerta">{{ g.vueltaPendiente | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</dd>
          }
          @if (g.valorVueltasRecibidas > 0) {
            <dt>Vueltas recibidas</dt><dd>{{ g.valorVueltasRecibidas | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</dd>
          }
          @if (g.estado === 'Anulado') {
            <dt>Anulado</dt><dd>{{ g.fechaAnulacion | date: 'dd/MM/yyyy hh:mm a' }} por {{ g.anuladoPor }} — {{ g.motivoAnulacion }}</dd>
          }
        </dl>

        <p class="dlg__subtitulo">Movimientos</p>
        <ul class="dlg__movimientos">
          @for (m of g.movimientos; track m.id) {
            <li [class.dlg__anulado]="m.anulado">
              {{ m.fecha | date: 'dd/MM hh:mm a' }} · {{ tipos[m.tipo] }} ·
              <strong>{{ m.valor | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong> · {{ m.usuario }}
              @if (m.anulado) { <span> (anulado)</span> }
            </li>
          }
        </ul>
      </mat-dialog-content>
      <mat-dialog-actions class="dlg__acciones">
        <button mat-stroked-button (click)="imprimir()"><mat-icon>print</mat-icon> Imprimir para firmar</button>
        @if (g.tieneSoporte) {
          <button mat-stroked-button (click)="verSoporte()"><mat-icon>image</mat-icon> Ver soporte</button>
        }
        @if (g.estado !== 'Anulado') {
          <button mat-stroked-button (click)="ref.close('soporte')"><mat-icon>photo_camera</mat-icon> {{ g.tieneSoporte ? 'Cambiar' : 'Subir' }} soporte</button>
        }
        <span class="dlg__espacio"></span>
        @if (data.esAdministrador && (g.estado === 'Abierto' || (g.estado !== 'Anulado' && g.valorVueltasRecibidas === 0))) {
          <button mat-button class="dlg__peligro-texto" (click)="ref.close('anular')">Anular</button>
        }
        @if (g.estado === 'Abierto') {
          <button mat-flat-button (click)="ref.close('legalizar')">Legalizar</button>
        }
        @if (g.estado === 'VueltaPendiente') {
          <button mat-flat-button (click)="ref.close('vuelta')">Recibir vuelta</button>
        }
        <button mat-button mat-dialog-close>Cerrar</button>
      </mat-dialog-actions>
    } @else {
      <mat-dialog-content><p>{{ error() ?? 'Cargando…' }}</p></mat-dialog-content>
    }
  `,
  styleUrl: './caja-dialogos.scss'
})
export class GiroDetalleDialogComponent implements OnInit {
  readonly data = inject<GiroDetalleData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<GiroDetalleDialogComponent, AccionGiro>);
  private readonly servicio = inject(CajaService);

  readonly estados = ETIQUETA_ESTADO_GIRO;
  readonly tipos = ETIQUETA_MOVIMIENTO;
  readonly giro = signal<Giro | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.servicio.giro(this.data.cajaId, this.data.giroId).subscribe({
      next: (g) => this.giro.set(g),
      error: (e: HttpErrorResponse) => this.error.set(mensaje(e, 'No se pudo cargar el giro.'))
    });
  }

  imprimir(): void {
    abrirEnPestana(this.servicio.pdf(this.data.cajaId, this.data.giroId), () => this.error.set('No se pudo generar el PDF.'));
  }

  verSoporte(): void {
    abrirEnPestana(this.servicio.soporte(this.data.cajaId, this.data.giroId), () => this.error.set('No se pudo abrir el soporte.'));
  }
}
