import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CrearPagoExtraordinario,
  CuentaBanco,
  DetalleProveedorCuentaPorPagar,
  RelacionBorrador,
  RelacionCreada,
  ResumenCuentasPorPagar,
  TerceroWO,
  TipoGiro
} from '../models/cuentas-por-pagar.model';

@Injectable({ providedIn: 'root' })
export class CuentasPorPagarService {
  private readonly baseUrl = `${environment.apiUrl}/CuentasPorPagar`;

  constructor(private readonly http: HttpClient) {}

  resumen(): Observable<ResumenCuentasPorPagar> {
    return this.http.get<ResumenCuentasPorPagar>(this.baseUrl);
  }

  proveedor(identificacion: string): Observable<DetalleProveedorCuentaPorPagar> {
    return this.http.get<DetalleProveedorCuentaPorPagar>(`${this.baseUrl}/proveedores/${encodeURIComponent(identificacion)}`);
  }

  bancos(): Observable<CuentaBanco[]> {
    return this.http.get<CuentaBanco[]>(`${this.baseUrl}/bancos`);
  }

  // ---- Relación de pagos ----

  relacion(): Observable<RelacionBorrador> {
    return this.http.get<RelacionBorrador>(`${this.baseUrl}/relacion`);
  }

  /** Guarda lo elegido de UN proveedor en la relación; sin facturas, lo quita. */
  guardarEnRelacion(identificacion: string, idsFacturas: number[], idsAnticipos: number[]): Observable<RelacionBorrador> {
    return this.http.put<RelacionBorrador>(`${this.baseUrl}/relacion/proveedores/${encodeURIComponent(identificacion)}`, {
      idsFacturas,
      idsAnticipos
    });
  }

  ratificar(observaciones: string | null): Observable<RelacionCreada> {
    return this.http.post<RelacionCreada>(`${this.baseUrl}/relacion/ratificar`, { observaciones });
  }

  // ---- Pago extraordinario ----

  tiposGiro(): Observable<TipoGiro[]> {
    return this.http.get<TipoGiro[]>(`${this.baseUrl}/tipos-giro`);
  }

  buscarTerceros(texto: string): Observable<TerceroWO[]> {
    return this.http.get<TerceroWO[]>(`${this.baseUrl}/terceros`, { params: new HttpParams().set('q', texto) });
  }

  crearExtraordinario(dto: CrearPagoExtraordinario): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/extraordinarios`, dto);
  }
}
