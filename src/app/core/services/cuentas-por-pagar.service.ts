import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CrearPagoProveedor, DetalleProveedorCuentaPorPagar, ResumenCuentasPorPagar } from '../models/cuentas-por-pagar.model';

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

  crearPago(dto: CrearPagoProveedor): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/pagos`, dto);
  }
}
