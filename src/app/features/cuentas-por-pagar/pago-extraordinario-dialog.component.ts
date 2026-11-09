import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, catchError } from 'rxjs';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { TerceroWO, TipoGiro } from '../../core/models/cuentas-por-pagar.model';

/**
 * Pago extraordinario (2026-11-09) — giro a un tercero sin factura, cuando Gerencia Comercial lo
 * necesita: tercero (catálogo de World Office), monto, tipo de giro (decide la cuenta del CE) y
 * concepto. Genera un correo solo para este giro; el pagador lo ve en su menú "Pagos".
 */
@Component({
  selector: 'app-pago-extraordinario-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule],
  template: `
    <h2 mat-dialog-title>Pago extraordinario</h2>
    <mat-dialog-content class="pe">
      <p class="pe__ayuda">Un giro a un tercero que no sale de una factura. Le llega un correo solo para este pago al pagador.</p>

      <mat-form-field appearance="outline" class="pe__campo">
        <mat-label>Tercero (nombre o NIT)</mat-label>
        <input
          matInput
          [matAutocomplete]="auto"
          [ngModel]="textoTercero"
          (ngModelChange)="buscar($event)"
          autocomplete="off"
        />
        <mat-autocomplete #auto="matAutocomplete" [displayWith]="mostrar" (optionSelected)="elegir($event)">
          @for (t of terceros(); track t.idTerceroWO) {
            <mat-option [value]="t">{{ t.nombre }} · {{ t.identificacion }}</mat-option>
          }
        </mat-autocomplete>
        @if (tercero(); as t) {
          <mat-hint>Elegido: {{ t.nombre }} (NIT {{ t.identificacion }})</mat-hint>
        } @else if (buscando()) {
          <mat-hint>Buscando…</mat-hint>
        } @else if (sinResultados()) {
          <mat-hint>No aparece en World Office. Si es nuevo, primero hay que crearlo en WO.</mat-hint>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="pe__campo">
        <mat-label>Monto</mat-label>
        <span matTextPrefix>$&nbsp;</span>
        <input matInput type="number" min="1" step="1" [(ngModel)]="valor" />
        @if (valor && valor > 0) { <mat-hint>$ {{ valor | number: '1.0-0' }}</mat-hint> }
      </mat-form-field>

      <mat-form-field appearance="outline" class="pe__campo">
        <mat-label>Tipo de giro</mat-label>
        <mat-select [(ngModel)]="tipoGiroId">
          @for (t of tiposGiro(); track t.id) {
            <mat-option [value]="t.id">{{ t.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="pe__campo">
        <mat-label>Concepto</mat-label>
        <textarea matInput rows="2" maxlength="300" [(ngModel)]="concepto"></textarea>
        <mat-hint align="end">{{ concepto.length }}/300</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="enviando()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!listo() || enviando()" (click)="enviar()">
        {{ enviando() ? 'Enviando…' : 'Enviar al pagador' }}
      </button>
    </mat-dialog-actions>
    @if (error()) {
      <p class="pe__error">{{ error() }}</p>
    }
  `,
  styles: [`
    .pe { display: flex; flex-direction: column; gap: 0.25rem; min-width: min(28rem, 80vw); }
    .pe__campo { width: 100%; }
    .pe__ayuda { margin: 0 0 0.5rem; opacity: 0.8; }
    .pe__error { color: var(--mat-sys-error); padding: 0 1.5rem 1rem; margin: 0; }
  `]
})
export class PagoExtraordinarioDialogComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly dialogRef = inject(MatDialogRef<PagoExtraordinarioDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busquedas = new Subject<string>();

  readonly tiposGiro = signal<TipoGiro[]>([]);
  readonly terceros = signal<TerceroWO[]>([]);
  readonly tercero = signal<TerceroWO | null>(null);
  readonly buscando = signal(false);
  readonly sinResultados = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  textoTercero = '';
  readonly mostrar = (t: TerceroWO | string | null): string => (typeof t === 'string' ? t : (t?.nombre ?? ''));
  valor: number | null = null;
  tipoGiroId: number | null = null;
  concepto = '';

  ngOnInit(): void {
    this.servicio.tiposGiro().subscribe((tipos) => {
      this.tiposGiro.set(tipos);
      if (tipos.length === 1) this.tipoGiroId = tipos[0].id;
    });

    this.busquedas
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (texto.trim().length < 2) {
            this.buscando.set(false);
            return of([] as TerceroWO[]);
          }
          this.buscando.set(true);
          return this.servicio.buscarTerceros(texto.trim()).pipe(catchError(() => of([] as TerceroWO[])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lista) => {
        this.buscando.set(false);
        this.terceros.set(lista);
        this.sinResultados.set(lista.length === 0 && this.textoTercero.trim().length >= 2 && !this.tercero());
      });
  }

  buscar(texto: string | TerceroWO): void {
    if (typeof texto !== 'string') return; // la opción elegida llega por elegir()
    this.textoTercero = texto;
    this.tercero.set(null);
    this.busquedas.next(texto);
  }

  elegir(evento: MatAutocompleteSelectedEvent): void {
    const t = evento.option.value as TerceroWO;
    this.tercero.set(t);
    this.textoTercero = t.nombre;
    this.sinResultados.set(false);
  }

  listo(): boolean {
    return this.tercero() !== null && (this.valor ?? 0) > 0 && this.tipoGiroId !== null && this.concepto.trim().length > 0;
  }

  enviar(): void {
    const t = this.tercero();
    if (!t || !this.listo()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .crearExtraordinario({ idTerceroWO: t.idTerceroWO, valor: Math.round(this.valor!), tipoGiroId: this.tipoGiroId!, concepto: this.concepto.trim() })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (e: { error?: { mensaje?: string } }) => {
          this.enviando.set(false);
          this.error.set(e.error?.mensaje ?? 'No se pudo crear el pago.');
        }
      });
  }
}
