import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotePago, OrdenPagoPendiente } from '../models/cuentas-por-pagar.model';

/** Menú "Pagos" del pagador (2026-11-09) — ver PagosController en el backend. */
@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly baseUrl = `${environment.apiUrl}/Pagos`;

  constructor(private readonly http: HttpClient) {}

  pendientes(): Observable<OrdenPagoPendiente[]> {
    return this.http.get<OrdenPagoPendiente[]>(`${this.baseUrl}/pendientes`);
  }

  /** Paga como un lote: mismo banco y fecha, UN soporte PDF para todo (null si no sale plata). */
  pagarLote(ids: number[], idCuentaBancoWO: number | null, fechaPago: string, soporte: File | null): Observable<LotePago> {
    const datos = new FormData();
    datos.append('ids', ids.join(','));
    if (idCuentaBancoWO !== null) datos.append('idCuentaBancoWO', String(idCuentaBancoWO));
    datos.append('fechaPago', fechaPago);
    if (soporte) datos.append('soporte', soporte, soporte.name);
    return this.http.post<LotePago>(`${this.baseUrl}/lotes`, datos);
  }

  rechazar(id: number, comentario: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/ordenes/${id}/rechazar`, { comentario });
  }

  lotes(): Observable<LotePago[]> {
    return this.http.get<LotePago[]>(`${this.baseUrl}/lotes`);
  }

  soporte(loteId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/lotes/${loteId}/soporte`, { responseType: 'blob' });
  }
}
